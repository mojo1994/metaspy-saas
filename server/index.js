import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import multer from 'multer'
import { randomUUID, createHash } from 'node:crypto'
import { join, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, writeFileSync, readFileSync, unlinkSync, statSync, renameSync, copyFileSync } from 'node:fs'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import { Archiver } from 'archiver'
import { exiftool } from 'exiftool-vendored'
import mime from 'mime-types'
import AdmZip from 'adm-zip'
import sanitizeHtml from 'sanitize-html'
import { z } from 'zod'
import pino from 'pino'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'
if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath)
import { initDb, initSchema, one, query, run } from './db.js'
import { uploadPageToR2, downloadPageFromR2, deletePageFromR2, getPageContentFromR2, getWorkerUrl } from './cloudflareStorage.js'

const USE_CF_STORAGE = !!(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN)

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3001
const JWT_SECRET = process.env.JWT_SECRET
const FB_TOKEN = process.env.FB_TOKEN
const KIRVANO_API_KEY = process.env.KIRVANO_API_KEY || ''
const KIRVANO_WEBHOOK_SECRET = process.env.KIRVANO_WEBHOOK_SECRET || ''
const KIRVANO_SUCCESS_URL = process.env.KIRVANO_SUCCESS_URL || 'https://metaspy.app/dashboard'
const KIRVANO_CANCEL_URL = process.env.KIRVANO_CANCEL_URL || 'https://metaspy.app/upgrade'
const IS_RENDER = !!process.env.RENDER || process.env.NODE_ENV === 'production'
const DATABASE_URL = process.env.DATABASE_URL

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
})

if (!DATABASE_URL) {
  logger.fatal('DATABASE_URL nao definida. Configure a variavel de ambiente com a URL do PostgreSQL.')
  process.exit(1)
}

if (!JWT_SECRET || JWT_SECRET.length < 64) {
  logger.warn('JWT_SECRET fraca ou nao definida. Gere uma chave de 64+ caracteres aleatorios.')
}

// ─── Database ───────────────────────────────────────────────────
const DATA_DIR = IS_RENDER ? '/tmp/metaspy' : __dirname
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })

initDb(DATABASE_URL)
await initSchema()

// ─── Helpers ─────────────────────────────────────────────────────
const CLONES_DIR = join(DATA_DIR, '..', 'clones')
if (!existsSync(CLONES_DIR)) mkdirSync(CLONES_DIR, { recursive: true })

const PAGES_DIR = join(DATA_DIR, 'pages')
if (!existsSync(PAGES_DIR)) mkdirSync(PAGES_DIR, { recursive: true })

const uploadPage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
})

const PLAN_CONFIG = {
  basico: { price: 49.90, days: 30, kirvanoPlan: 'basico' },
  gold: { price: 97.00, days: 30, kirvanoPlan: 'gold' },
  premium: { price: 197.00, days: 30, kirvanoPlan: 'premium' },
}

const PLAN_FEATURES = {
  nenhum: { clone: false, minerador: false, cloaker: false, pagevault: false, analise: false, cleaner: false },
  basico: { clone: true, minerador: true, cloaker: false, pagevault: false, analise: false, cleaner: false },
  gold: { clone: true, minerador: true, cloaker: true, pagevault: true, analise: true, cleaner: false },
  premium: { clone: true, minerador: true, cloaker: true, pagevault: true, analise: true, cleaner: true },
}

function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })
}

function generateRefreshToken(userId) {
  return jwt.sign({ userId, type: 'refresh' }, JWT_SECRET, { expiresIn: '30d' })
}

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token nao fornecido' })
  const token = authHeader.slice(7)
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    const user = await one('SELECT id, name, email, plan, subscription_status, subscription_expiry, clones_used, email_verified, created_at FROM users WHERE id = $1', [decoded.userId])
    if (!user) return res.status(401).json({ error: 'Usuario nao encontrado' })
    req.user = user
    next()
  } catch {
    return res.status(401).json({ error: 'Token invalido' })
  }
}

// ─── App ─────────────────────────────────────────────────────────
const app = express()
app.set('trust proxy', 1)
app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }))

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://*.kirvano.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "https://api.kirvano.com", "https://graph.facebook.com"],
      frameSrc: ["'self'", "https://*.kirvano.com"],
      mediaSrc: ["'self'", "blob:"],
    },
  },
}))

app.use(cookieParser())
app.use(express.json({ limit: '10mb' }))

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: process.env.NODE_ENV === 'production' ? 20 : 100, message: { error: 'Muitas tentativas. Tente novamente mais tarde.' } })
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 200, message: { error: 'Muitas requisicoes. Tente novamente mais tarde.' } })
app.use('/api/auth', authLimiter)
app.use('/api', apiLimiter)

// ─── Helpers de Seguranca ────────────────────────────────────────
async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal })
    return resp
  } finally {
    clearTimeout(timer)
  }
}

function sanitizeHtmlStrict(dirty) {
  return sanitizeHtml(dirty, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'video', 'source', 'audio', 'figure', 'figcaption', 'picture', 'iframe']),
    allowedAttributes: {
      '*': ['style', 'class', 'id', 'data-*'],
      'a': ['href', 'target', 'rel'],
      'img': ['src', 'alt', 'width', 'height', 'loading'],
      'video': ['src', 'controls', 'autoplay', 'muted', 'loop', 'width', 'height'],
      'source': ['src', 'type'],
      'iframe': ['src', 'width', 'height', 'frameborder', 'allowfullscreen'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'data'],
    disallowedTagsMode: 'discard',
    allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  })
}

const IDEMPOTENCY_TTL = 5 * 60 * 1000

// ─── Zod Schemas ────────────────────────────────────────────────
const signupSchema = z.object({ email: z.string().email().max(255), name: z.string().min(1).max(100), password: z.string().min(6).max(128) })
const loginSchema = z.object({ email: z.string().email().max(255), password: z.string().min(1).max(128) })
const verifyCodeSchema = z.object({ email: z.string().email().max(255), code: z.string().length(6) }).or(z.object({ code: z.string().length(6) }))
const forgotPasswordSchema = z.object({ email: z.string().email().max(255) })
const resetPasswordSchema = z.object({ email: z.string().email().max(255), code: z.string().length(6), new_password: z.string().min(6).max(128) })
const profileSchema = z.object({ name: z.string().min(1).max(100), email: z.string().email().max(255) })
const passwordSchema = z.object({ current_password: z.string().min(1), new_password: z.string().min(6).max(128) })
const cloneSchema = z.object({ url: z.string().url().max(2000) })
const cloakerSchema = z.object({ target_url: z.string().url().max(2000), safe_url: z.string().url().max(2000) })
const camouflageSchema = z.object({ texto_original: z.string().min(1).max(50000), url_destino: z.string().url().max(2000), palavras_sensiveis: z.array(z.string()).optional() })
const detectSchema = z.object({ url: z.string().url().max(2000) })
const checkoutSchema = z.object({ plan: z.enum(['basico', 'gold', 'premium']) })

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      const msgs = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
      logger.warn({ path: req.path, errors: msgs }, 'Validacao falhou')
      return res.status(400).json({ error: `Dados invalidos: ${msgs}` })
    }
    req.body = result.data
    next()
  }
}

// ─── File Upload Config ──────────────────────────────────────────
const CAMO_DIR = join('/tmp', 'metaspy-camouflage')
if (!existsSync(CAMO_DIR)) mkdirSync(CAMO_DIR, { recursive: true })
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = join(CAMO_DIR, randomUUID())
    mkdirSync(dir, { recursive: true })
    req.camoDir = dir
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    cb(null, `original${extname(file.originalname)}`)
  }
})
const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const imgTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    const vidTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']
    const allowed = [...imgTypes, ...vidTypes]
    if (allowed.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Formato de arquivo nao suportado. Aceitamos: JPG, PNG, GIF, WebP, MP4, WebM, OGG, MOV.'))
    }
  }
})

// ─── Auth Routes ─────────────────────────────────────────────────
app.post('/api/auth/signup', validate(signupSchema), async (req, res) => {
  try {
    const { email, name, password } = req.body
    const emailLower = email.toLowerCase().trim()
    const existing = await one('SELECT id FROM users WHERE email = $1', [emailLower])
    if (existing) return res.status(409).json({ error: 'Email ja cadastrado' })

    await run('UPDATE email_codes SET used = 1 WHERE email = $1 AND type = $2 AND used = 0', [emailLower, 'signup'])

    const hash = await bcrypt.hash(password, 10)
    const code = generateCode()
    const now = new Date()
    const expires = new Date(now.getTime() + 5 * 60 * 1000)
    const id = randomUUID()
    const metadata = JSON.stringify({ name: name.trim(), password_hash: hash })
    await run('INSERT INTO email_codes (id, user_id, email, code, type, expires_at, metadata, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [id, '', emailLower, code, 'signup', expires.toISOString(), metadata, now.toISOString()])

    await sendEmail({ to: emailLower, subject: 'MetaSpy - Confirme seu cadastro', html: verificationEmailHtml(code) })
    res.json({ ok: true, message: 'Codigo de confirmacao enviado para seu email.' })
  } catch (err) {
    logger.error({ err }, 'Erro signup')
    res.status(500).json({ error: 'Erro ao enviar codigo de confirmacao.' })
  }
})

app.post('/api/auth/verify-signup', validate(verifyCodeSchema), async (req, res) => {
  try {
    const { email, code } = req.body
    if (!email || !code) return res.status(400).json({ error: 'Preencha todos os campos.' })

    const emailLower = email.toLowerCase().trim()
    const record = await one('SELECT * FROM email_codes WHERE email = $1 AND code = $2 AND type = $3 AND used = 0 AND expires_at > $4',
      [emailLower, code.toString(), 'signup', new Date().toISOString()])
    if (!record) return res.status(400).json({ error: 'Codigo invalido ou expirado. Solicite um novo codigo.' })

    const metadata = JSON.parse(record.metadata || '{}')
    const id = randomUUID()
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    await run('INSERT INTO users (id, name, email, password_hash, plan, subscription_status, email_verified, clones_used, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [id, metadata.name, emailLower, metadata.password_hash, 'nenhum', 'inactive', 1, 0, now])
    await run('UPDATE email_codes SET used = 1 WHERE id = $1', [record.id])

    const user = await one('SELECT id, name, email, plan, subscription_status, subscription_expiry, clones_used, email_verified, created_at FROM users WHERE id = $1', [id])
    const accessToken = generateToken(id)
    const refreshToken = generateRefreshToken(id)
    res.json({ user, accessToken, refreshToken })
  } catch (err) {
    logger.error({ err }, 'Erro verify-signup')
    res.status(500).json({ error: 'Erro ao confirmar cadastro.' })
  }
})

app.post('/api/auth/login', validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Preencha todos os campos' })
    const user = await one('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()])
    if (!user) return res.status(401).json({ error: 'Credenciais invalidas' })
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return res.status(401).json({ error: 'Credenciais invalidas' })
    const accessToken = generateToken(user.id)
    const refreshToken = generateRefreshToken(user.id)
    const { password_hash, ...safe } = user
    res.json({ user: safe, accessToken, refreshToken })
  } catch {
    res.status(500).json({ error: 'Erro ao fazer login' })
  }
})

app.post('/api/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body
  if (!refreshToken) return res.status(401).json({ error: 'Refresh token nao fornecido' })
  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET)
    if (decoded.type !== 'refresh') return res.status(401).json({ error: 'Token invalido' })
    const user = await one('SELECT id FROM users WHERE id = $1', [decoded.userId])
    if (!user) return res.status(401).json({ error: 'Usuario nao encontrado' })
    const newAccessToken = generateToken(user.id)
    const newRefreshToken = generateRefreshToken(user.id)
    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken })
  } catch {
    res.status(401).json({ error: 'Refresh token invalido' })
  }
})

app.post('/api/auth/logout', (req, res) => {
  res.json({ ok: true })
})

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: req.user })
})

// ─── Email / Recovery Routes ──────────────────────────────────────
import { sendEmail, recoveryEmailHtml, verificationEmailHtml, purchaseConfirmationEmailHtml, pendingCheckoutEmailHtml } from './email.js'

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

app.post('/api/auth/forgot-password', validate(forgotPasswordSchema), async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'Email obrigatorio.' })
    const emailLower = email.toLowerCase().trim()
    const user = await one('SELECT id, email FROM users WHERE email = $1', [emailLower])
    if (!user) return res.json({ ok: true, message: 'Se o email existir, voce recebera um codigo.' })

    await run('UPDATE email_codes SET used = 1 WHERE email = $1 AND type = $2 AND used = 0', [emailLower, 'recovery'])

    const code = generateCode()
    const now = new Date()
    const expires = new Date(now.getTime() + 5 * 60 * 1000)
    const id = randomUUID()
    await run('INSERT INTO email_codes (id, user_id, email, code, type, expires_at, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [id, user.id, user.email, code, 'recovery', expires.toISOString(), now.toISOString()])

    await sendEmail({ to: user.email, subject: 'MetaSpy - Codigo de Recuperacao', html: recoveryEmailHtml(code) })
    res.json({ ok: true, message: 'Codigo enviado para seu email.' })
  } catch (err) {
    logger.error({ err }, 'Erro forgot-password')
    res.status(500).json({ error: 'Erro ao enviar codigo.' })
  }
})

app.post('/api/auth/reset-password', validate(resetPasswordSchema), async (req, res) => {
  try {
    const { email, code, new_password } = req.body
    if (!email || !code || !new_password) return res.status(400).json({ error: 'Preencha todos os campos.' })
    if (new_password.length < 6) return res.status(400).json({ error: 'Senha deve ter ao menos 6 caracteres.' })

    const record = await one('SELECT * FROM email_codes WHERE email = $1 AND code = $2 AND type = $3 AND used = 0 AND expires_at > $4',
      [email.toLowerCase().trim(), code.toString(), 'recovery', new Date().toISOString()])
    if (!record) return res.status(400).json({ error: 'Codigo invalido ou expirado.' })

    const hash = await bcrypt.hash(new_password, 10)
    await run('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, record.user_id])
    await run('UPDATE email_codes SET used = 1 WHERE id = $1', [record.id])
    res.json({ ok: true, message: 'Senha redefinida com sucesso.' })
  } catch (err) {
    logger.error({ err }, 'Erro reset-password')
    res.status(500).json({ error: 'Erro ao redefinir senha.' })
  }
})

app.post('/api/auth/send-verification', authMiddleware, async (req, res) => {
  try {
    const user = req.user
    if (user.email_verified) return res.status(400).json({ error: 'Email ja verificado.' })

    await run('UPDATE email_codes SET used = 1 WHERE user_id = $1 AND type = $2 AND used = 0', [user.id, 'verification'])

    const code = generateCode()
    const now = new Date()
    const expires = new Date(now.getTime() + 5 * 60 * 1000)
    const id = randomUUID()
    await run('INSERT INTO email_codes (id, user_id, email, code, type, expires_at, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [id, user.id, user.email, code, 'verification', expires.toISOString(), now.toISOString()])

    await sendEmail({ to: user.email, subject: 'MetaSpy - Confirme seu Email', html: verificationEmailHtml(code) })
    res.json({ ok: true, message: 'Codigo enviado para seu email.' })
  } catch (err) {
    logger.error({ err }, 'Erro send-verification')
    res.status(500).json({ error: 'Erro ao enviar codigo.' })
  }
})

app.post('/api/auth/verify-code', authMiddleware, async (req, res) => {
  try {
    const { code } = req.body
    if (!code) return res.status(400).json({ error: 'Codigo obrigatorio.' })
    const record = await one('SELECT * FROM email_codes WHERE user_id = $1 AND code = $2 AND type = $3 AND used = 0 AND expires_at > $4',
      [req.user.id, code.toString(), 'verification', new Date().toISOString()])
    if (!record) return res.status(400).json({ error: 'Codigo invalido ou expirado.' })
    await run('UPDATE email_codes SET used = 1 WHERE id = $1', [record.id])
    await run('UPDATE users SET email_verified = 1 WHERE id = $1', [req.user.id])
    res.json({ ok: true, message: 'Email verificado com sucesso.' })
  } catch (err) {
    logger.error({ err }, 'Erro verify-code')
    res.status(500).json({ error: 'Erro ao verificar codigo.' })
  }
})

// ─── Clone Routes ────────────────────────────────────────────────
app.post('/api/clone', authMiddleware, validate(cloneSchema), async (req, res) => {
  const { url } = req.body
  if (!url) return res.status(400).json({ error: 'URL nao fornecida' })
  const features = PLAN_FEATURES[req.user.plan]
  if (!features?.clone) return res.status(403).json({ error: 'Assinatura necessaria' })
  try {
    const { default: clonePage } = await import('./clone.js')
    const result = await clonePage(url, { fbToken: FB_TOKEN, userId: req.user.id })
    await run('UPDATE users SET clones_used = clones_used + 1 WHERE id = $1', [req.user.id])
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: 'Erro ao clonar pagina' })
  }
})

// ─── Deep Clone ─────────────────────────────────────────────────
app.post('/api/clone/deep', async (req, res) => {
  try {
    const { url } = req.body
    if (!url) return res.status(400).json({ error: 'URL nao fornecida' })
    const id = randomUUID()
    const dir = join(CLONES_DIR, id)
    mkdirSync(dir, { recursive: true })
    const { downloadSite } = await import('./clone.js')
    await downloadSite(url, { outputDir: dir, fbToken: FB_TOKEN, deep: true })
    res.json({ id, path: dir })
  } catch (err) {
    res.status(500).json({ error: 'Erro ao clonar site' })
  }
})

app.get('/api/clone/deep/:id/files', async (req, res) => {
  const dir = join(CLONES_DIR, req.params.id)
  if (!existsSync(dir)) return res.status(404).json({ error: 'Clone nao encontrado' })
  try {
    async function buildTree(dirPath) {
      const { readdir, stat } = await import('node:fs/promises')
      const entries = await readdir(dirPath, { withFileTypes: true })
      const items = []
      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name)
        const stats = await stat(fullPath)
        if (entry.name.startsWith('.')) continue
        if (entry.isDirectory()) {
          items.push({ name: entry.name, type: 'directory', size: stats.size, children: await buildTree(fullPath) })
        } else {
          items.push({ name: entry.name, type: 'file', size: stats.size })
        }
      }
      return items.sort((a, b) => (a.type === 'directory' ? -1 : 1) - (b.type === 'directory' ? -1 : 1) || a.name.localeCompare(b.name))
    }
    const tree = await buildTree(dir)
    res.json({ id: req.params.id, tree })
  } catch {
    res.status(500).json({ error: 'Erro ao listar arquivos' })
  }
})

app.get('/api/clone/deep/:id/download', async (req, res) => {
  const dir = join(CLONES_DIR, req.params.id)
  if (!existsSync(dir)) return res.status(404).json({ error: 'Clone nao encontrado' })
  try {
    const archive = new Archiver('zip', { zlib: { level: 9 } })
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="clone-${req.params.id}.zip"`)
    archive.pipe(res)
    function addDirToZip(dirPath, basePath = '') {
      const entries = readdirSync(dirPath, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue
        const fullPath = join(dirPath, entry.name)
        const entryPath = basePath ? join(basePath, entry.name) : entry.name
        if (entry.isDirectory()) {
          addDirToZip(fullPath, entryPath)
        } else {
          archive.add(createReadStream(fullPath), { name: entryPath })
        }
      }
    }
    addDirToZip(dir)
    archive.finalize()
  } catch {
    res.status(500).json({ error: 'Erro ao gerar ZIP' })
  }
})

// ─── Page Fetch (CORS bypass) ────────────────────────────────────
app.get('/api/page-fetch', async (req, res) => {
  const { url } = req.query
  if (!url) return res.status(400).json({ error: 'URL nao fornecida' })
  try {
    const resp = await fetchWithTimeout(url.toString(), { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } }, 30000)
    if (!resp.ok) return res.status(resp.status).json({ error: `HTTP ${resp.status}` })
    const html = await resp.text()
    res.type('text/html; charset=utf-8').send(html)
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar pagina' })
  }
})

// ─── Subscription Routes ─────────────────────────────────────────
const KIRVANO_API = 'https://api.kirvano.com'

const KIRVANO_STATIC_LINKS = {
  basico: 'https://pay.kirvano.com/879cf3f0-5be2-42a4-b9bb-f9d0c03a8dcd',
  gold: 'https://pay.kirvano.com/2498bd06-c4e9-412f-ab0d-bd9cededb5ad',
}

const KIRVANO_CHECKOUT_UUIDS = {
  '879cf3f0-5be2-42a4-b9bb-f9d0c03a8dcd': 'basico',
  '2498bd06-c4e9-412f-ab0d-bd9cededb5ad': 'gold',
}

app.post('/api/subscription/create-checkout', authMiddleware, validate(checkoutSchema), async (req, res) => {
  try {
    const { plan } = req.body
    const config = PLAN_CONFIG[plan]
    if (!config) return res.status(400).json({ error: 'Plano invalido' })
    const checkoutUrl = KIRVANO_STATIC_LINKS[plan]
    if (!checkoutUrl) return res.status(500).json({ error: 'Link nao configurado' })
    await run('UPDATE users SET pending_plan = $1 WHERE id = $2', [plan, req.user.id])

    try {
      await sendEmail({
        to: req.user.email,
        subject: 'MetaSpy - Finalize sua compra!',
        html: pendingCheckoutEmailHtml({ name: req.user.name, email: req.user.email }),
      })
    } catch (emailErr) {
      logger.error({ err: emailErr }, 'Erro ao enviar email de checkout pendente')
    }

    res.json({ checkoutUrl })
  } catch {
    res.status(500).json({ error: 'Erro ao criar checkout' })
  }
})

app.post('/api/subscription/webhook', async (req, res) => {
  try {
    const event = req.body
    const eventId = event.id || event.subscription_id || event.transaction_id || randomUUID()

    // Idempotency: deduplicate webhook events
    const idempotencyKey = createHash('sha256').update(`webhook:${eventId}:${event.event}`).digest('hex')
    const existing = await one('SELECT key FROM idempotency_keys WHERE key = $1', [idempotencyKey])
    if (existing) {
      logger.info({ eventId, event: event.event }, 'Webhook duplicado ignorado (idempotency)')
      return res.json({ received: true, dedup: true })
    }
    const now = new Date()
    const expiresAt = new Date(now.getTime() + IDEMPOTENCY_TTL)
    await run('INSERT INTO idempotency_keys (key, expires_at, created_at) VALUES ($1, $2, $3)',
      [idempotencyKey, expiresAt.toISOString(), now.toISOString()]).catch(() => {})

    logger.info({ event: event.event, eventId: eventId.slice(0, 20) }, 'Webhook recebido')

    if (event.event === 'payment.approved' || event.event === 'subscription.approved') {
      const metadata = event.metadata || {}
      let userId = metadata.user_id
      if (!userId && event.customer?.email) {
        const user = await one('SELECT id, pending_plan FROM users WHERE email = $1', [event.customer.email.toLowerCase().trim()])
        if (user) userId = user.id
      }
      if (userId) {
        const user = await one('SELECT pending_plan FROM users WHERE id = $1', [userId])
        const plan = user?.pending_plan || 'nenhum'
        const config = PLAN_CONFIG[plan]
        if (config) {
          const expiry = new Date(now.getTime() + config.days * 24 * 60 * 60 * 1000)
          const expiryStr = expiry.toISOString().replace('T', ' ').slice(0, 19)
          await run('UPDATE users SET subscription_status = $1, subscription_id = $2, subscription_expiry = $3, plan = $4, pending_plan = NULL WHERE id = $5',
            ['active', eventId, expiryStr, plan, userId])

          try {
            const userInfo = await one('SELECT name, email FROM users WHERE id = $1', [userId])
            if (userInfo) {
              await sendEmail({
                to: userInfo.email,
                subject: 'MetaSpy - Pagamento confirmado!',
                html: purchaseConfirmationEmailHtml({ name: userInfo.name, plan, days: config.days }),
              })
            }
          } catch (emailErr) {
            logger.error({ err: emailErr }, 'Erro ao enviar email de confirmacao')
          }
        }
      }
    }
    if (event.event === 'subscription.canceled' || event.event === 'payment.refunded') {
      const metadata = event.metadata || {}
      const userId = metadata.user_id
      if (userId) {
        await run('UPDATE users SET subscription_status = $1, subscription_id = $2, subscription_expiry = $3, plan = $4 WHERE id = $5',
          ['canceled', '', null, 'nenhum', userId])
      }
    }
    res.json({ received: true })
  } catch (err) {
    logger.error({ err }, 'Erro no webhook')
    res.json({ received: true })
  }
})

app.get('/api/subscription/status', authMiddleware, async (req, res) => {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const isExpired = req.user.subscription_expiry && req.user.subscription_expiry < now
  res.json({
    plan: req.user.plan,
    status: isExpired ? 'expired' : req.user.subscription_status,
    expiry: req.user.subscription_expiry,
    features: PLAN_FEATURES[req.user.plan] || PLAN_FEATURES.nenhum,
  })
})

// ─── Cloaker Routes ──────────────────────────────────────────────
app.post('/api/cloaker/generate', authMiddleware, validate(cloakerSchema), async (req, res) => {
  const features = PLAN_FEATURES[req.user.plan]
  if (!features?.cloaker) return res.status(403).json({ error: 'Disponivel apenas nos planos Gold e Premium' })
  try {
    const { target_url, safe_url } = req.body
    if (!target_url || !safe_url) return res.status(400).json({ error: 'URL de destino e URL segura sao obrigatorias' })
    const id = randomUUID()
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const scriptCode = generateCloakerScript(target_url, safe_url, id)
    await run('INSERT INTO cloaker_scripts (id, user_id, target_url, safe_url, script_code, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, req.user.id, target_url, safe_url, scriptCode, now])
    res.json({ id, target_url, safe_url, script_code: scriptCode, created_at: now })
  } catch {
    res.status(500).json({ error: 'Erro ao gerar script' })
  }
})

function generateCloakerScript(targetUrl, safeUrl, scriptId) {
  return `<script>
(function(){
  const TARGET = ${JSON.stringify(targetUrl)};
  const SAFE   = ${JSON.stringify(safeUrl)};
  const botPatterns = [
    /bot/i, /crawler/i, /spider/i, /scrape/i, /headless/i,
    /facebookexternalhit/i, /Facebot/i, /Twitterbot/i,
    /linkedinbot/i, /Slackbot/i, /Discordbot/i,
    /WhatsApp/i, /TelegramBot/i, /googlebot/i
  ];
  const ua = navigator.userAgent;
  const isBot = botPatterns.some(p => p.test(ua));
  const hasNoReferrer = !document.referrer;
  const isIframe = window.top !== window.self;
  const hasWebDriver = navigator.webdriver === true;
  const hasChromeHeadless = /HeadlessChrome/i.test(ua);
  const screenW = screen.width;
  const screenH = screen.height;
  const isHeadlessSize = screenW === 0 && screenH === 0;
  const hasBrokenPlugins = navigator.plugins.length === 0;
  if (isBot || isIframe || hasWebDriver || hasChromeHeadless || isHeadlessSize) {
    window.location.href = SAFE;
  } else if (hasNoReferrer && hasBrokenPlugins) {
    window.location.href = SAFE;
  } else {
    window.location.href = TARGET;
  }
})();
</script>`
}

app.get('/api/cloaker/scripts', authMiddleware, async (req, res) => {
  const scripts = await query('SELECT id, target_url, safe_url, created_at FROM cloaker_scripts WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id])
  res.json(scripts)
})

app.delete('/api/cloaker/scripts/:id', authMiddleware, async (req, res) => {
  const result = await run('DELETE FROM cloaker_scripts WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id])
  if (result.changes === 0) return res.status(404).json({ error: 'Script nao encontrado' })
  res.json({ ok: true })
})

// ─── Cloak Detector ──────────────────────────────────────────────
const USER_AGENTS = {
  humano: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  bot_google: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  bot_facebook: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
}

app.post('/api/cloaker/detect', authMiddleware, validate(detectSchema), async (req, res) => {
  try {
    const features = PLAN_FEATURES[req.user.plan]
    if (!features?.cloaker) return res.status(403).json({ erro: 'Disponivel apenas nos planos Gold e Premium.' })
    const { url } = req.body
    if (!url) return res.status(400).json({ erro: 'URL e obrigatoria.' })
    const resultados = {}
    for (const [tipo, ua] of Object.entries(USER_AGENTS)) {
      try {
        const resposta = await fetchWithTimeout(url, { headers: { 'User-Agent': ua }, redirect: 'manual' }, 8000)
        const corpoBuffer = await resposta.arrayBuffer()
        const corpo = Buffer.from(corpoBuffer).toString('utf-8').slice(0, 50000)
        resultados[tipo] = { status: resposta.status, statusText: resposta.statusText, urlFinal: resposta.url, headers: Object.fromEntries(resposta.headers.entries()), corpo, tamanho: corpo.length }
      } catch (erro) {
        resultados[tipo] = { erro: erro.message || 'Falha na requisicao' }
      }
    }
    const temCloaking = (
      resultados.humano?.status !== resultados.bot_google?.status ||
      resultados.humano?.urlFinal !== resultados.bot_google?.urlFinal ||
      resultados.humano?.corpo?.length !== resultados.bot_google?.corpo?.length
    )
    const id = randomUUID()
    await run(`INSERT INTO cloak_detections (id, user_id, url, tem_cloaking, resultado_json, created_at) VALUES ($1, $2, $3, $4, $5, $6)`, [id, req.user.id, url, temCloaking, JSON.stringify(resultados), new Date().toISOString()])
    res.json({
      url, temCloaking, comparacao: resultados,
      resumo: temCloaking ? 'Cloaking detectado! A pagina entrega conteudo diferente para robos e humanos.' : 'Nenhum cloaking significativo detectado.'
    })
  } catch (erro) {
    logger.error({ err: erro }, 'Erro no detect cloaker')
    res.status(500).json({ erro: 'Erro interno ao analisar a URL.' })
  }
})

// ─── Creative Camouflage ─────────────────────────────────────────
app.post('/api/cloaker/camouflage', authMiddleware, validate(camouflageSchema), async (req, res) => {
  try {
    const features = PLAN_FEATURES[req.user.plan]
    if (!features?.cloaker) return res.status(403).json({ erro: 'Disponivel apenas nos planos Gold e Premium.' })
    const { texto_original, url_destino, palavras_sensiveis } = req.body
    if (!texto_original || !url_destino) return res.status(400).json({ erro: 'Texto original e URL destino sao obrigatorios.' })
    const scriptCamuflado = `<!-- SCRIPT DE CAMUFLAGEM DE CRIATIVOS - METASPY -->
<script>
(function() {
  const isBot = /bot|googlebot|facebookexternalhit|headless/i.test(navigator.userAgent);
  const textoOriginal = ${JSON.stringify(texto_original)};
  const urlDestino = ${JSON.stringify(url_destino)};
  if (isBot) {
    const palavras = ${JSON.stringify(palavras_sensiveis || [])};
    let textoMascarado = textoOriginal;
    palavras.forEach(palavra => {
      const regex = new RegExp(palavra, 'gi');
      textoMascarado = textoMascarado.replace(regex, '•••••');
    });
    document.body.innerHTML = document.body.innerHTML.replace(textoOriginal, textoMascarado);
    document.querySelectorAll('a[href]').forEach(el => {
      if (el.href.includes(urlDestino)) {
        el.href = '#';
        el.style.textDecoration = 'none';
        el.style.color = 'inherit';
      }
    });
  } else {
    document.querySelectorAll('.camuflado').forEach(el => el.style.display = 'block');
  }
})();
</script>
<!-- FIM DO SCRIPT -->`
    const id = randomUUID()
    await run(`INSERT INTO camouflage_scripts (id, user_id, url_destino, script_code, created_at) VALUES ($1, $2, $3, $4, $5)`, [id, req.user.id, url_destino, scriptCamuflado, new Date().toISOString()])
    res.json({ id, script: scriptCamuflado, instrucoes: 'Copie e cole este script no <head> da sua landing page. O script detectara automaticamente se o visitante e humano ou robo.' })
  } catch (erro) {
    logger.error({ err: erro }, 'Erro ao gerar camuflagem')
    res.status(500).json({ erro: 'Erro ao gerar script de camuflagem.' })
  }
})

// ─── Upload Camouflage ──────────────────────────────────────────
app.post('/api/cloaker/upload-camouflage', authMiddleware, (req, res, next) => {
  const features = PLAN_FEATURES[req.user.plan]
  if (!features?.cloaker) return res.status(403).json({ erro: 'Disponivel apenas nos planos Gold e Premium.' })
  next()
}, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ erro: 'Arquivo nao enviado.' })
    const { safe_url } = req.body
    const dir = req.camoDir
    const ext = extname(req.file.originalname)
    const id = randomUUID()
    const isVideo = req.file.mimetype.startsWith('video/')
    const fileSize = req.file.size
    const sizeLimit = isVideo ? 200 : 30
    if ((isVideo && fileSize > 200 * 1024 * 1024) || (!isVideo && fileSize > 30 * 1024 * 1024)) {
      return res.status(400).json({ erro: `Arquivo muito grande. Limite: ${sizeLimit}MB para ${isVideo ? 'video' : 'imagem'}.` })
    }
    const safeUrl = safe_url || 'about:blank'
    const scriptCode = `<script>
(function(){
  const isBot = /bot|googlebot|facebookexternalhit|headless|crawler|spider/i.test(navigator.userAgent);
  const safeUrl = ${JSON.stringify(safeUrl)};
  if (isBot) {
    if (safeUrl !== 'about:blank') window.location.href = safeUrl;
    document.body.innerHTML = '<p>Conteudo protegido.</p>';
  }
})();
</script>`
    const fileName = `camuflado-${id}.html`
    let html
    if (isVideo) {
      html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Conteudo Camuflado</title>${scriptCode}</head><body>
<video width="100%" height="auto" controls autoplay muted>
  <source src="original${ext}" type="${req.file.mimetype}">
  Seu navegador nao suporta video.
</video>
<p style="font-family:sans-serif;color:#666;font-size:12px">Conteudo protegido por MetaSpy Camuflagem</p>
</body></html>`
    } else {
      const b64 = readFileSync(join(dir, req.file.filename)).toString('base64')
      const dataUri = `data:${req.file.mimetype};base64,${b64}`
      html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Conteudo Camuflado</title>${scriptCode}</head><body>
<img src="${dataUri}" alt="Conteudo camuflado" style="max-width:100%;height:auto">
<p style="font-family:sans-serif;color:#666;font-size:12px">Conteudo protegido por MetaSpy Camuflagem</p>
</body></html>`
    }
    writeFileSync(join(dir, fileName), html, 'utf-8')
    res.json({
      id,
      fileName,
      script: scriptCode,
      downloadUrl: `/api/cloaker/camouflage-download/${id}`,
      embedHtml: html,
      isVideo,
      tamanho: fileSize
    })
  } catch (erro) {
    logger.error({ err: erro }, 'Erro no upload camouflage')
    res.status(500).json({ erro: 'Erro ao processar arquivo.' })
  }
})

app.get('/api/cloaker/camouflage-download/:id', async (req, res) => {
  try {
    const dir = join(CAMO_DIR, req.params.id)
    if (!existsSync(dir)) return res.status(404).json({ erro: 'Arquivo nao encontrado ou expirado.' })
    const files = readdirSync(dir)
    const htmlFile = files.find(f => f.endsWith('.html'))
    const mediaFile = files.find(f => f !== htmlFile)
    if (!htmlFile) return res.status(404).json({ erro: 'Arquivo nao encontrado.' })
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="camuflado-${req.params.id}.zip"`)
    const archive = new Archiver('zip', { zlib: { level: 9 } })
    archive.pipe(res)
    archive.file(join(dir, htmlFile), { name: htmlFile })
    if (mediaFile) archive.file(join(dir, mediaFile), { name: mediaFile })
    await archive.finalize()
    setTimeout(() => {
      try { for (const f of files) unlinkSync(join(dir, f)); unlinkSync(dir) } catch {}
    }, 60000)
  } catch {
    res.status(500).json({ erro: 'Erro ao gerar download.' })
  }
})

// ─── Dual-Layer Media Camouflage ──────────────────────────────────
const CAMO_MEDIA_OUTPUTS = new Map()

const camoMediaStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = join('/tmp', 'metaspy-camo-media', randomUUID())
    mkdirSync(dir, { recursive: true })
    req.camoMediaDir = dir
    cb(null, dir)
  },
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
})

const camoMediaUpload = multer({
  storage: camoMediaStorage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg','image/png','image/gif','image/webp','video/mp4','video/webm','video/ogg','video/quicktime']
    if (allowed.includes(file.mimetype)) return cb(null, true)
    cb(new Error('Formato nao suportado'))
  },
})

async function cleanFileMeta(filePath, mimeType) {
  try {
    const ext = extname(filePath)
    const out = filePath.replace(ext, `_clean${ext}`)
    if (mimeType?.startsWith('video/')) {
      await exiftool.write(filePath, { All: '', overwrite_original: true })
      try { renameSync(filePath, out) } catch { copyFileSync(filePath, out) }
    } else {
      await exiftool.write(filePath, { All: '', overwrite_original: true, GPS: '', EXIF: '', IPTC: '', XMP: '', Comment: '', Artist: '', Copyright: '' })
      try { renameSync(filePath, out) } catch { copyFileSync(filePath, out) }
    }
    return out
  } catch { return filePath }
}

async function generateSpoofedVideo(realPath, disguisePath, realMime, disguiseMime, outputPath) {
  return new Promise((resolve, reject) => {
    const isRealVideo = realMime?.startsWith('video/')
    const isDisguiseVideo = disguiseMime?.startsWith('video/')

    const command = ffmpeg()

    if (isDisguiseVideo) {
      command.input(disguisePath).duration(2)
    } else {
      command.input(disguisePath).loop(1).duration(2)
    }

    if (isRealVideo) {
      command.input(realPath)
    } else {
      command.input(realPath).loop(1)
    }

    const complex = [
      { inputs: ['0:v'], filter: 'scale=trunc(iw/2)*2:trunc(ih/2)*2, setsar=1', output: '0v' },
      { inputs: ['1:v'], filter: 'scale=trunc(iw/2)*2:trunc(ih/2)*2, setsar=1', output: '1v' },
      { inputs: ['0v', '1v'], filter: 'concat=n=2:v=1:a=0', output: 'out' },
    ]

    command
      .complexFilter(complex)
      .outputOptions(['-c:v libx264', '-preset fast', '-crf 23', '-pix_fmt yuv420p', '-movflags +faststart'])
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
  })
}

function generateClickToRevealHTML(realB64, disguiseB64, realMime, disguiseMime, safeUrl) {
  const isRealVideo = realMime?.startsWith('video/')
  const isDisguiseVideo = disguiseMime?.startsWith('video/')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex,nofollow">
<title>Content Preview</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#000;overflow:hidden;width:100vw;height:100vh;display:flex;align-items:center;justify-content:center}
#disguise{position:absolute;inset:0;z-index:1;display:flex;align-items:center;justify-content:center;background:#000}
#disguise img,#disguise video{max-width:100%;max-height:100%;object-fit:contain}
#overlay{position:absolute;inset:0;z-index:2;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);cursor:pointer;transition:opacity .5s}
#overlay.hidden{opacity:0;pointer-events:none}
#overlay button{padding:20px 50px;font-size:24px;border:2px solid #fff;background:transparent;color:#fff;border-radius:12px;cursor:pointer}
#overlay button:hover{background:rgba(255,255,255,0.1)}
#real{position:absolute;inset:0;z-index:0;display:none;align-items:center;justify-content:center;background:#000}
#real.show{display:flex}
#real img,#real video{max-width:100%;max-height:100%;object-fit:contain}
</style>
</head>
<body>
<div id="disguise">${isDisguiseVideo ? `<video src="${disguiseB64}" autoplay muted loop playsinline></video>` : `<img src="${disguiseB64}" alt="">`}</div>
<div id="overlay" onclick="document.getElementById('overlay').classList.add('hidden');document.getElementById('real').classList.add('show')">
<button>Click to Load Content</button>
</div>
<div id="real">${isRealVideo ? `<video src="${realB64}" controls autoplay muted playsinline></video>` : `<img src="${realB64}" alt="">`}</div>
<noscript><meta http-equiv="refresh" content="0;url=${safeUrl || 'about:blank'}"></noscript>
<script>
if(navigator.webdriver||/bot|googlebot|facebookexternalhit|headless|crawler/i.test(navigator.userAgent)){window.location.href=${JSON.stringify(safeUrl || 'about:blank')};document.body.innerHTML=''}
</script>
</body>
</html>`
}

app.post('/api/cloaker/camouflage/media', authMiddleware, camoMediaUpload.fields([
  { name: 'real_media', maxCount: 1 },
  { name: 'disguise_media', maxCount: 1 },
]), async (req, res) => {
  try {
    const features = PLAN_FEATURES[req.user.plan]
    if (!features?.cloaker) return res.status(403).json({ erro: 'Disponivel apenas nos planos Gold e Premium.' })

    const files = req.files || {}
    const realFile = Array.isArray(files['real_media']) ? files['real_media'][0] : undefined
    const disguiseFile = Array.isArray(files['disguise_media']) ? files['disguise_media'][0] : undefined
    const strategy = req.body.strategy
    const safeUrl = req.body.safe_url || ''

    if (!realFile || !disguiseFile) return res.status(400).json({ erro: 'Envie real_media e disguise_media.' })
    if (!['thumbnail_spoofing', 'click_to_reveal'].includes(strategy)) return res.status(400).json({ erro: 'Estrategia invalida.' })

    const dir = req.camoMediaDir
    const realPath = realFile.path
    const disguisePath = disguiseFile.path
    const id = randomUUID()

    // Edge case: same file
    if (realFile.size === disguiseFile.size && realFile.originalname === disguiseFile.originalname) {
      const cleanPath = await cleanFileMeta(realPath, realFile.mimetype)
      const ext = realFile.mimetype.startsWith('video/') ? 'mp4' : 'jpg'
      CAMO_MEDIA_OUTPUTS.set(id, cleanPath)
      setTimeout(() => CAMO_MEDIA_OUTPUTS.delete(id), 300000)
      return res.json({ id, strategy, downloadUrl: `/api/cloaker/camouflage/media/download/${id}`, disguisePreviewUrl: `/api/cloaker/camouflage/media/download/${id}`, instructions: 'Arquivos identicos. Nenhuma modificacao aplicada.', fileName: `camouflage-${id}.${ext}` })
    }

    let outputPath
    let downloadExt = 'mp4'

    if (strategy === 'thumbnail_spoofing') {
      outputPath = join(dir, `output-${id}.mp4`)
      await generateSpoofedVideo(realPath, disguisePath, realFile.mimetype, disguiseFile.mimetype, outputPath)
      outputPath = await cleanFileMeta(outputPath, 'video/mp4')
    } else {
      const realB64 = readFileSync(realPath).toString('base64')
      const disguiseB64 = readFileSync(disguisePath).toString('base64')
      const html = generateClickToRevealHTML(`data:${realFile.mimetype};base64,${realB64}`, `data:${disguiseFile.mimetype};base64,${disguiseB64}`, realFile.mimetype, disguiseFile.mimetype, safeUrl)
      const htmlPath = join(dir, 'index.html')
      writeFileSync(htmlPath, html, 'utf-8')
      const zipPath = join(dir, `output-${id}.zip`)
      const archive = new Archiver('zip', { zlib: { level: 9 } })
      const ws = createWriteStream(zipPath)
      await new Promise((resolve, reject) => {
        ws.on('finish', resolve)
        ws.on('error', reject)
        archive.pipe(ws)
        archive.file(htmlPath, { name: 'index.html' })
        archive.finalize()
      })
      outputPath = zipPath
      downloadExt = 'zip'
    }

    CAMO_MEDIA_OUTPUTS.set(id, outputPath)
    setTimeout(() => { try { unlinkSync(outputPath) } catch {}; CAMO_MEDIA_OUTPUTS.delete(id) }, 300000)

    res.json({
      id, strategy,
      downloadUrl: `/api/cloaker/camouflage/media/download/${id}`,
      disguisePreviewUrl: `/api/cloaker/camouflage/media/raw/${id}/disguise`,
      instructions: strategy === 'thumbnail_spoofing' ? 'Upload this video to your ad manager. The AI scanner will only see the safe thumbnail, but users will see the full offer after 2 seconds.' : 'Extract the ZIP and upload the index.html to your hosting. The safe media loads immediately; the real content appears only after a click.',
      fileName: `camouflage-${id}.${downloadExt}`,
    })
  } catch (erro) {
    logger.error({ err: erro }, 'Erro no camouflage media')
    res.status(500).json({ erro: 'Erro ao processar camuflagem de midia.' })
  }
})

app.get('/api/cloaker/camouflage/media/download/:id', async (req, res) => {
  const filePath = CAMO_MEDIA_OUTPUTS.get(req.params.id)
  if (!filePath || !existsSync(filePath)) return res.status(404).json({ erro: 'Arquivo nao encontrado ou expirado.' })
  const ext = extname(filePath)
  const mime = ext === '.zip' ? 'application/zip' : 'video/mp4'
  res.setHeader('Content-Type', mime)
  res.setHeader('Content-Disposition', `attachment; filename="camouflage-${req.params.id}${ext}"`)
  createReadStream(filePath).pipe(res)
})
app.get('/api/user/profile', authMiddleware, (req, res) => {
  res.json({ user: req.user })
})

app.put('/api/user/profile', authMiddleware, validate(profileSchema), async (req, res) => {
  const { name, email } = req.body
  if (!name || !email) return res.status(400).json({ error: 'Nome e email sao obrigatorios' })
  await run('UPDATE users SET name = $1, email = $2 WHERE id = $3', [name.trim(), email.toLowerCase().trim(), req.user.id])
  const user = await one('SELECT id, name, email, plan, subscription_status, subscription_expiry, clones_used, created_at FROM users WHERE id = $1', [req.user.id])
  res.json({ user })
})

app.put('/api/user/password', authMiddleware, validate(passwordSchema), async (req, res) => {
  try {
    const { current_password, new_password } = req.body
    if (!current_password || !new_password) return res.status(400).json({ error: 'Senha atual e nova senha sao obrigatorias' })
    const user = await one('SELECT * FROM users WHERE id = $1', [req.user.id])
    const valid = await bcrypt.compare(current_password, user.password_hash)
    if (!valid) return res.status(401).json({ error: 'Senha atual incorreta' })
    const hash = await bcrypt.hash(new_password, 10)
    await run('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id])
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Erro ao alterar senha' })
  }
})

// ─── Admin ────────────────────────────────────────────────────────
const ADMIN_EMAIL = '09santos.felipe@gmail.com'

async function adminMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token nao fornecido' })
  try {
    const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET)
    const user = await one('SELECT email FROM users WHERE id = $1', [decoded.userId])
    if (!user || user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Acesso negado' })
    req.adminUser = user
    next()
  } catch { return res.status(401).json({ error: 'Token invalido' }) }
}

app.get('/api/admin/users', adminMiddleware, async (req, res) => {
  try {
    const users = await query('SELECT id, name, email, plan, subscription_status, subscription_expiry, clones_used, created_at FROM users ORDER BY created_at DESC')
    res.json({ users })
  } catch { res.status(500).json({ error: 'Erro ao listar usuarios' }) }
})

app.put('/api/admin/users/:id/plan', adminMiddleware, async (req, res) => {
  try {
    const { plan } = req.body
    if (!['nenhum', 'basico', 'gold', 'premium'].includes(plan)) return res.status(400).json({ error: 'Plano invalido' })
    const config = PLAN_CONFIG[plan]
    if (!config) return res.status(400).json({ error: 'Plano invalido' })
    const now = new Date()
    const expiry = plan === 'nenhum' ? null : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const expiryStr = expiry ? expiry.toISOString().replace('T', ' ').slice(0, 19) : null
    await run('UPDATE users SET plan = $1, subscription_status = $2, subscription_expiry = $3 WHERE id = $4',
      [plan, plan === 'nenhum' ? 'inactive' : 'active', expiryStr, req.params.id])
    res.json({ ok: true })
  } catch { res.status(500).json({ error: 'Erro ao atualizar plano' }) }
})

// ─── Debug ────────────────────────────────────────────────────────
app.get('/api/debug/user', async (req, res) => {
  const { email } = req.query
  if (!email) return res.status(400).json({ error: '?email= obrigatorio' })
  try {
    const user = await one('SELECT id, name, email, plan, subscription_status, subscription_expiry, pending_plan, clones_used FROM users WHERE email = $1', [email.toString().toLowerCase().trim()])
    if (!user) return res.json({ error: 'Usuario nao encontrado' })
    res.json({ user })
  } catch { res.status(500).json({ error: 'Erro' }) }
})

app.get('/api/debug/webhooks', (req, res) => {
  res.json({ webhooks: WEBHOOK_LOG })
})

// ─── Health ───────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', online: !!FB_TOKEN, db: 'postgresql' })
})

// ─── Metadata Cleaner ────────────────────────────────────────────
const CLEANER_DIR = process.env.TEMP_UPLOAD_DIR || '/tmp/metaspy_cleaner'
if (!existsSync(CLEANER_DIR)) mkdirSync(CLEANER_DIR, { recursive: true })

const cleanerStorage = multer.diskStorage({
  destination: CLEANER_DIR,
  filename: (req, file, cb) => {
    const ext = extname(file.originalname)
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`)
  }
})

const cleanerUpload = multer({
  storage: cleanerStorage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/x-msvideo','video/webm']
    if (allowed.includes(file.mimetype)) return cb(null, true)
    cb(new Error('Formato nao suportado. Aceitamos: JPEG, PNG, WebP, GIF, MP4, MOV, AVI, WebM.'))
  }
})

async function cleanMetadata(filePath, mimeType) {
  const isVideo = mimeType.startsWith('video/')
  const ext = extname(filePath)
  const outputPath = filePath.replace(ext, `_cleaned${ext}`)

  const originalMeta = await exiftool.read(filePath).catch(() => ({}))

  if (isVideo) {
    await exiftool.write(filePath, { All: '', overwrite_original: true })
    try { renameSync(filePath, outputPath) } catch { copyFileSync(filePath, outputPath) }
  } else {
    await exiftool.write(filePath, {
      All: '', overwrite_original: true,
      GPS: '', EXIF: '', IPTC: '', XMP: '',
      Comment: '', Artist: '', Copyright: ''
    })
    try { renameSync(filePath, outputPath) } catch { copyFileSync(filePath, outputPath) }
  }

  const remainingMeta = await exiftool.read(outputPath).catch(() => ({}))
  return { cleanedPath: outputPath, originalMeta, remainingMeta, tagsRemoved: Object.keys(originalMeta).length - Object.keys(remainingMeta).length }
}

app.post('/api/cleaner/upload', authMiddleware, async (req, res) => {
  try {
    const features = PLAN_FEATURES[req.user.plan]
    if (!features?.cleaner) return res.status(403).json({ error: 'Disponivel apenas no plano Premium.' })

    cleanerUpload.single('file')(req, res, async (err) => {
      if (err) return res.status(400).json({ error: err.message })
      if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' })

      const file = req.file
      const isVideo = file.mimetype.startsWith('video/')
      const maxSize = isVideo ? 200 * 1024 * 1024 : 30 * 1024 * 1024

      if (file.size > maxSize) {
        try { unlinkSync(file.path) } catch {}
        return res.status(413).json({ error: `Arquivo excede o limite. ${isVideo ? 'Video' : 'Imagem'} max: ${maxSize / (1024*1024)} MB.` })
      }

      try {
        const { cleanedPath, originalMeta, remainingMeta, tagsRemoved } = await cleanMetadata(file.path, file.mimetype)
        const assetId = randomUUID()
        await run(`INSERT INTO cleaned_assets (id, user_id, original_name, file_size_bytes, mime_type, cleaned_file_path, metadata_before, metadata_after, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [assetId, req.user.id, file.originalname, file.size, file.mimetype, cleanedPath, JSON.stringify(originalMeta), JSON.stringify(remainingMeta), new Date().toISOString()])

        const stat = statSync(cleanedPath)
        res.json({
          id: assetId,
          originalName: file.originalname,
          cleanedSize: stat.size,
          downloadUrl: `/api/cleaner/download/${assetId}`,
          metadataRemoved: tagsRemoved
        })
      } catch (cleanErr) {
        logger.error({ err: cleanErr }, 'Clean error')
        res.status(500).json({ error: 'Erro ao limpar metadados.' })
      }
    })
  } catch (error) {
    logger.error({ err: error }, 'Cleaner route error')
    res.status(500).json({ error: 'Erro interno.' })
  }
})

app.get('/api/cleaner/download/:id', authMiddleware, async (req, res) => {
  try {
    const asset = await one('SELECT * FROM cleaned_assets WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id])
    if (!asset) return res.status(404).json({ error: 'Arquivo nao encontrado.' })
    if (!existsSync(asset.cleaned_file_path)) return res.status(410).json({ error: 'Arquivo expirado.' })

    const originalName = asset.original_name.replace(/\.[^.]+$/, '') + '_clean' + extname(asset.original_name)
    const mimeType = mime.lookup(asset.cleaned_file_path) || asset.mime_type

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(originalName)}"`)
    res.setHeader('Content-Type', mimeType)
    res.setHeader('Content-Length', statSync(asset.cleaned_file_path).size)

    const stream = createReadStream(asset.cleaned_file_path)
    stream.pipe(res)
  } catch (error) {
    logger.error({ err: error }, 'Download error')
    res.status(500).json({ error: 'Erro ao baixar arquivo.' })
  }
})

// ─── Pages Routes ────────────────────────────────────────────────────
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .slice(0, 60) || 'pagina'
}

async function createPageRecord(userId, title, customSlug, cfUrl) {
  const id = randomUUID()
  let slug
  if (customSlug) {
    slug = slugify(customSlug)
    const exists = await one('SELECT id FROM pages WHERE slug = $1', [slug])
    if (exists) throw new Error('slug-exists')
  } else {
    slug = slugify(title)
  }
  let exists = await one('SELECT id FROM pages WHERE slug = $1', [slug])
  let counter = 1
  while (exists) {
    slug = customSlug ? `${slug}-${counter}` : `${slugify(title)}-${counter}`
    exists = await one('SELECT id FROM pages WHERE slug = $1', [slug])
    counter++
  }
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  await run('INSERT INTO pages (id, user_id, slug, title, html, type, published, cf_url, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
    [id, userId, slug, title, '', 'hosted', 1, cfUrl || null, now, now])
  return { id, slug }
}

app.post('/api/pages/upload', authMiddleware, uploadPage.array('files', 500), async (req, res) => {
  try {
    const files = req.files
    if (!files || files.length === 0) return res.status(400).json({ error: 'Arquivo(s) obrigatorio(s).' })

    let entries = []
    let title

    if (files.length === 1 && files[0].originalname.endsWith('.zip')) {
      const zip = new AdmZip(files[0].buffer)
      entries = zip.getEntries().filter(e => !e.isDirectory)
      const hasIndex = entries.some(e => e.entryName === 'index.html' || e.entryName.endsWith('/index.html'))
      if (!hasIndex) return res.status(400).json({ error: 'O ZIP deve conter um arquivo index.html na raiz.' })
      title = req.body.title || files[0].originalname.replace(/\.zip$/i, '') || 'Pagina hospedada'
    } else {
      entries = files.map(f => ({
        entryName: f.originalname,
        isDirectory: false,
        getData: () => f.buffer,
      }))
      const hasIndex = files.some(f => f.originalname === 'index.html' || f.originalname.endsWith('/index.html'))
      if (!hasIndex) return res.status(400).json({ error: 'A pasta deve conter um arquivo index.html.' })
      title = req.body.title || files.find(f => f.originalname === 'index.html')?.originalname?.replace('/index.html', '') || 'Pagina hospedada'
    }

    const { id, slug } = await createPageRecord(req.user.id, title, req.body.slug)

    const pageDir = join(PAGES_DIR, slug)
    mkdirSync(pageDir, { recursive: true })
    let indexHtml = ''
    for (const entry of entries) {
      const entryPath = entry.entryName
      const filePath = join(pageDir, entryPath)
      mkdirSync(dirname(filePath), { recursive: true })
      const data = entry.getData()
      writeFileSync(filePath, data)
      if (entryPath === 'index.html' || entryPath.endsWith('/index.html')) {
        indexHtml = data.toString('utf-8')
      }
    }
    if (indexHtml) {
      const sanitizedHtml = sanitizeHtmlStrict(indexHtml)
      run('UPDATE pages SET html = $1 WHERE id = $2', [sanitizedHtml, id]).catch(() => {})
    }

    if (USE_CF_STORAGE) {
      const cfFiles = entries.map(e => ({
        path: e.entryName,
        buffer: e.getData(),
        contentType: mime.lookup(e.entryName) || 'application/octet-stream',
      }))
      uploadPageToR2(slug, cfFiles).catch(err => logger.error({ err }, 'Erro upload R2'))
      const cfUrl = getWorkerUrl(slug)
      run('UPDATE pages SET cf_url = $1 WHERE id = $2', [cfUrl, id]).catch(() => {})
    }

    res.status(201).json({
      id, slug, title,
      url: `https://centralspyads.netlify.app/p/${slug}`,
    })
  } catch (err) {
    if (err.message === 'slug-exists') return res.status(409).json({ error: 'Este nome de pagina ja esta em uso. Escolha outro.' })
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Arquivo muito grande. Maximo: 200MB.' })
    logger.error({ err }, 'Erro upload pagina')
    res.status(500).json({ error: 'Erro ao fazer upload da pagina.' })
  }
})

// Public route: serve hosted page assets by slug/path — try R2 first, fallback to DB
app.get('/api/page/:slug/:path(*)', async (req, res) => {
  try {
    const { slug, path } = req.params
    const mimeType = mime.lookup(path) || 'text/html; charset=utf-8'
    if (USE_CF_STORAGE && mimeType === 'text/html; charset=utf-8') {
      try {
        const r2Data = await getPageContentFromR2(slug, path || 'index.html')
        if (r2Data) {
          res.set('Content-Type', mimeType)
          res.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=600')
          res.set('X-Cache', 'R2-HIT')
          return res.send(r2Data.toString('utf-8'))
        }
      } catch {}
    }
    const page = await one('SELECT html FROM pages WHERE slug = $1 AND published = 1', [slug])
    if (!page) return res.status(404).send('Pagina nao encontrada.')
    res.set('Content-Type', mimeType)
    res.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=600')
    res.send(page.html || '')
  } catch {
    res.status(500).send('Erro ao carregar pagina.')
  }
})

// Public route: serve hosted page by slug
app.get('/api/page/:slug', async (req, res) => {
  try {
    const slug = req.params.slug.toLowerCase()
    if (USE_CF_STORAGE) {
      try {
        const r2Data = await getPageContentFromR2(slug, 'index.html')
        if (r2Data) {
          res.set('Content-Type', 'text/html; charset=utf-8')
          res.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=600')
          res.set('X-Cache', 'R2-HIT')
          return res.send(r2Data.toString('utf-8'))
        }
      } catch {}
    }
    const page = await one('SELECT html FROM pages WHERE slug = $1 AND published = 1', [slug])
    if (!page) return res.status(404).send('Pagina nao encontrada.')
    res.set('Content-Type', 'text/html; charset=utf-8')
    res.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=600')
    res.send(page.html || '')
  } catch {
    res.status(500).send('Erro ao carregar pagina.')
  }
})

// ─── Error Handler ────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ erro: 'Arquivo muito grande. Maximo: 200MB.' })
  if (err?.message?.includes('formato')) return res.status(400).json({ erro: err.message })
  logger.error({ err }, 'Erro nao tratado')
  next(err)
})

// ─── Start ───────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info({ port: PORT, frontend: process.env.FRONTEND_URL || '*', kirvano: !!KIRVANO_API_KEY, facebook: !!FB_TOKEN, db: 'PostgreSQL', env: IS_RENDER ? 'Render' : 'dev' }, 'MetaSpy Server iniciado')
})

// Keep-Alive: ping a cada 60s para evitar cold start no Render
if (IS_RENDER) {
  const KEEP_ALIVE_URL = process.env.KEEP_ALIVE_URL || `http://localhost:${PORT}/api/health`
  setInterval(async () => {
    try {
      const resp = await fetch(KEEP_ALIVE_URL, { signal: AbortSignal.timeout(5000) })
      if (resp.ok) logger.debug('Keep-Alive OK')
    } catch { /* silent */ }
  }, 60000)
  logger.info('Keep-Alive ativado (60s)')
}
