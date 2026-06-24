import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import multer from 'multer'
import { randomUUID } from 'node:crypto'
import { join, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createReadStream, existsSync, mkdirSync, readdirSync, writeFileSync, readFileSync, unlinkSync, statSync, renameSync, copyFileSync } from 'node:fs'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import { Archiver } from 'archiver'
import { exiftool } from 'exiftool-vendored'
import mime from 'mime-types'
import AdmZip from 'adm-zip'
import { initDb, initSchema, one, query, run } from './db.js'
import { uploadPageToR2, downloadPageFromR2, deletePageFromR2, getPageContentFromR2, getWorkerUrl } from './cloudflareStorage.js'
const USE_CF_STORAGE = !!(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN)

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3001
const JWT_SECRET = process.env.JWT_SECRET || 'metaspy-dev-secret-change-in-prod'
const FB_TOKEN = process.env.FB_TOKEN
const KIRVANO_API_KEY = process.env.KIRVANO_API_KEY || ''
const KIRVANO_WEBHOOK_SECRET = process.env.KIRVANO_WEBHOOK_SECRET || ''
const KIRVANO_SUCCESS_URL = process.env.KIRVANO_SUCCESS_URL || 'https://metaspy.app/dashboard'
const KIRVANO_CANCEL_URL = process.env.KIRVANO_CANCEL_URL || 'https://metaspy.app/upgrade'
const IS_RENDER = !!process.env.RENDER || process.env.NODE_ENV === 'production'
const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('DATABASE_URL nao definida. Configure a variavel de ambiente com a URL do PostgreSQL.')
  process.exit(1)
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
  mensal: { price: 49.90, days: 30, kirvanoPlan: 'mensal' },
  anual: { price: 110.90, days: 365, renewal: 97, kirvanoPlan: 'anual' },
}

const PLAN_FEATURES = {
  nenhum: { clone: false, minerador: false, cloaker: false, pagevault: false, analise: false, cleaner: false },
  mensal: { clone: true, minerador: true, cloaker: false, pagevault: true, analise: false, cleaner: false },
  anual: { clone: true, minerador: true, cloaker: true, pagevault: true, analise: true, cleaner: true },
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
app.use(cookieParser())
app.use(express.json({ limit: '10mb' }))

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: process.env.NODE_ENV === 'production' ? 20 : 100, message: { error: 'Muitas tentativas. Tente novamente mais tarde.' } })
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 200, message: { error: 'Muitas requisicoes. Tente novamente mais tarde.' } })
app.use('/api/auth', authLimiter)
app.use('/api', apiLimiter)

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
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, name, password } = req.body
    if (!email || !name || !password) return res.status(400).json({ error: 'Preencha todos os campos' })
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
    console.error('Erro signup:', err)
    res.status(500).json({ error: 'Erro ao enviar codigo de confirmacao.' })
  }
})

app.post('/api/auth/verify-signup', async (req, res) => {
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
    console.error('Erro verify-signup:', err)
    res.status(500).json({ error: 'Erro ao confirmar cadastro.' })
  }
})

app.post('/api/auth/login', async (req, res) => {
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

app.post('/api/auth/forgot-password', async (req, res) => {
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
    console.error('Erro forgot-password:', err)
    res.status(500).json({ error: 'Erro ao enviar codigo.' })
  }
})

app.post('/api/auth/reset-password', async (req, res) => {
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
    console.error('Erro reset-password:', err)
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
    console.error('Erro send-verification:', err)
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
    console.error('Erro verify-code:', err)
    res.status(500).json({ error: 'Erro ao verificar codigo.' })
  }
})

// ─── Clone Routes ────────────────────────────────────────────────
app.post('/api/clone', authMiddleware, async (req, res) => {
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
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30000)
    const resp = await fetch(url.toString(), { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } })
    clearTimeout(timer)
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
  mensal: 'https://pay.kirvano.com/879cf3f0-5be2-42a4-b9bb-f9d0c03a8dcd',
  anual: 'https://pay.kirvano.com/2498bd06-c4e9-412f-ab0d-bd9cededb5ad',
}

const KIRVANO_CHECKOUT_UUIDS = {
  '879cf3f0-5be2-42a4-b9bb-f9d0c03a8dcd': 'mensal',
  '2498bd06-c4e9-412f-ab0d-bd9cededb5ad': 'anual',
}

app.post('/api/subscription/create-checkout', authMiddleware, async (req, res) => {
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
      console.error('Erro ao enviar email de checkout pendente:', emailErr)
    }

    res.json({ checkoutUrl })
  } catch {
    res.status(500).json({ error: 'Erro ao criar checkout' })
  }
})

const WEBHOOK_LOG = []

app.post('/api/subscription/webhook', async (req, res) => {
  try {
    const event = req.body
    WEBHOOK_LOG.unshift({ time: new Date().toISOString(), event })
    if (WEBHOOK_LOG.length > 20) WEBHOOK_LOG.length = 20
    console.log('WEBHOOK RECEBIDO:', JSON.stringify(event).slice(0, 500))
    if (event.event === 'payment.approved' || event.event === 'subscription.approved') {
      const metadata = event.metadata || {}
      let userId = metadata.user_id
      if (!userId && event.customer?.email) {
        const user = await one('SELECT id, pending_plan FROM users WHERE email = $1', [event.customer.email.toLowerCase().trim()])
        if (user) userId = user.id
      }
      if (userId) {
        const user = await one('SELECT pending_plan FROM users WHERE id = $1', [userId])
        const plan = user?.pending_plan || 'gratuito'
        const config = PLAN_CONFIG[plan]
        if (config) {
          const now = new Date()
          const expiry = new Date(now.getTime() + config.days * 24 * 60 * 60 * 1000)
          const expiryStr = expiry.toISOString().replace('T', ' ').slice(0, 19)
          await run('UPDATE users SET subscription_status = $1, subscription_id = $2, subscription_expiry = $3, plan = $4, pending_plan = NULL WHERE id = $5',
            ['active', event.id || event.subscription_id || '', expiryStr, plan, userId])

          // Send purchase confirmation email
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
            console.error('Erro ao enviar email de confirmacao:', emailErr)
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
  } catch {
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
app.post('/api/cloaker/generate', authMiddleware, async (req, res) => {
  const features = PLAN_FEATURES[req.user.plan]
  if (!features?.cloaker) return res.status(403).json({ error: 'Plano anual necessario' })
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

app.post('/api/cloaker/detect', authMiddleware, async (req, res) => {
  try {
    const features = PLAN_FEATURES[req.user.plan]
    if (!features?.cloaker) return res.status(403).json({ erro: 'Funcionalidade disponivel apenas no plano Anual.' })
    const { url } = req.body
    if (!url) return res.status(400).json({ erro: 'URL e obrigatoria.' })
    const resultados = {}
    for (const [tipo, ua] of Object.entries(USER_AGENTS)) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      try {
        const resposta = await fetch(url, { headers: { 'User-Agent': ua }, redirect: 'manual', signal: controller.signal })
        clearTimeout(timeout)
        const corpoBuffer = await resposta.arrayBuffer()
        const corpo = Buffer.from(corpoBuffer).toString('utf-8').slice(0, 50000)
        resultados[tipo] = { status: resposta.status, statusText: resposta.statusText, urlFinal: resposta.url, headers: Object.fromEntries(resposta.headers.entries()), corpo, tamanho: corpo.length }
      } catch (erro) {
        clearTimeout(timeout)
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
    console.error('Erro no detect cloaker:', erro)
    res.status(500).json({ erro: 'Erro interno ao analisar a URL.' })
  }
})

// ─── Creative Camouflage ─────────────────────────────────────────
app.post('/api/cloaker/camouflage', authMiddleware, async (req, res) => {
  try {
    const features = PLAN_FEATURES[req.user.plan]
    if (!features?.cloaker) return res.status(403).json({ erro: 'Disponivel apenas no plano Anual.' })
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
    console.error('Erro ao gerar camuflagem:', erro)
    res.status(500).json({ erro: 'Erro ao gerar script de camuflagem.' })
  }
})

// ─── Upload Camouflage ──────────────────────────────────────────
app.post('/api/cloaker/upload-camouflage', authMiddleware, (req, res, next) => {
  const features = PLAN_FEATURES[req.user.plan]
  if (!features?.cloaker) return res.status(403).json({ erro: 'Disponivel apenas no plano Anual.' })
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
    console.error('Erro no upload camouflage:', erro)
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

// ─── User Routes ─────────────────────────────────────────────────
app.get('/api/user/profile', authMiddleware, (req, res) => {
  res.json({ user: req.user })
})

app.put('/api/user/profile', authMiddleware, async (req, res) => {
  const { name, email } = req.body
  if (!name || !email) return res.status(400).json({ error: 'Nome e email sao obrigatorios' })
  await run('UPDATE users SET name = $1, email = $2 WHERE id = $3', [name.trim(), email.toLowerCase().trim(), req.user.id])
  const user = await one('SELECT id, name, email, plan, subscription_status, subscription_expiry, clones_used, created_at FROM users WHERE id = $1', [req.user.id])
  res.json({ user })
})

app.put('/api/user/password', authMiddleware, async (req, res) => {
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
    if (!['nenhum', 'mensal', 'anual'].includes(plan)) return res.status(400).json({ error: 'Plano invalido' })
    const config = PLAN_CONFIG[plan]
    if (!config) return res.status(400).json({ error: 'Plano invalido' })
    const now = new Date()
    const expiry = plan === 'nenhum' ? null : new Date(now.getTime() + (plan === 'anual' ? 365 : 30) * 24 * 60 * 60 * 1000)
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
    if (!features?.cleaner) return res.status(403).json({ error: 'Disponivel apenas no plano Anual.' })

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
        console.error('Clean error:', cleanErr)
        res.status(500).json({ error: 'Erro ao limpar metadados.' })
      }
    })
  } catch (error) {
    console.error('Cleaner route error:', error)
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
    console.error('Download error:', error)
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

app.post('/api/pages', authMiddleware, async (req, res) => {
  try {
    const { title, html } = req.body
    if (!title || !html) return res.status(400).json({ error: 'Titulo e HTML obrigatorios.' })
    const id = randomUUID()
    const baseSlug = slugify(title)
    let slug = baseSlug
    let exists = await one('SELECT id FROM pages WHERE slug = $1', [slug])
    let counter = 1
    while (exists) {
      slug = `${baseSlug}-${counter}`
      exists = await one('SELECT id FROM pages WHERE slug = $1', [slug])
      counter++
    }
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    await run('INSERT INTO pages (id, user_id, slug, title, html, type, published, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [id, req.user.id, slug, title.trim(), html, 'page', 1, now, now])
    const page = await one('SELECT * FROM pages WHERE id = $1', [id])
    res.status(201).json(page)
  } catch (err) {
    console.error('Erro criar pagina:', err)
    res.status(500).json({ error: 'Erro ao criar pagina.' })
  }
})

app.get('/api/pages', authMiddleware, async (req, res) => {
  try {
    const pages = await query('SELECT id, slug, title, type, published, cf_url, created_at, updated_at FROM pages WHERE user_id = $1 ORDER BY updated_at DESC', [req.user.id])
    res.json(pages)
  } catch {
    res.status(500).json({ error: 'Erro ao listar paginas.' })
  }
})

app.get('/api/pages/:id', authMiddleware, async (req, res) => {
  try {
    const page = await one('SELECT * FROM pages WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id])
    if (!page) return res.status(404).json({ error: 'Pagina nao encontrada.' })
    res.json(page)
  } catch {
    res.status(500).json({ error: 'Erro ao buscar pagina.' })
  }
})

app.put('/api/pages/:id', authMiddleware, async (req, res) => {
  try {
    const { title, html } = req.body
    const page = await one('SELECT id FROM pages WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id])
    if (!page) return res.status(404).json({ error: 'Pagina nao encontrada.' })
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    await run('UPDATE pages SET title = $1, html = $2, updated_at = $3 WHERE id = $4',
      [title?.trim() || 'Sem titulo', html || '', now, req.params.id])
    const updated = await one('SELECT * FROM pages WHERE id = $1', [req.params.id])
    res.json(updated)
  } catch {
    res.status(500).json({ error: 'Erro ao atualizar pagina.' })
  }
})

app.delete('/api/pages/:id', authMiddleware, async (req, res) => {
  try {
    const page = await one('SELECT slug, cf_url FROM pages WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id])
    if (!page) return res.status(404).json({ error: 'Pagina nao encontrada.' })
    await run('DELETE FROM pages WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id])
    if (USE_CF_STORAGE && page.slug) {
      deletePageFromR2(page.slug).catch(() => {})
    }
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Erro ao deletar pagina.' })
  }
})

// Upload zip or folder page
app.post('/api/pages/upload', authMiddleware, uploadPage.array('files', 500), async (req, res) => {
  try {
    const files = req.files
    if (!files || files.length === 0) return res.status(400).json({ error: 'Arquivo(s) obrigatorio(s).' })

    let entries = []
    let title

    // Single zip file
    if (files.length === 1 && files[0].originalname.endsWith('.zip')) {
      const zip = new AdmZip(files[0].buffer)
      entries = zip.getEntries().filter(e => !e.isDirectory)
      const hasIndex = entries.some(e => e.entryName === 'index.html' || e.entryName.endsWith('/index.html'))
      if (!hasIndex) return res.status(400).json({ error: 'O ZIP deve conter um arquivo index.html na raiz.' })
      title = req.body.title || files[0].originalname.replace(/\.zip$/i, '') || 'Pagina hospedada'
    } else {
      // Folder upload
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

    // Always save to local disk
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
    // Store index.html content in DB for reliable serving
    if (indexHtml) {
      run('UPDATE pages SET html = $1 WHERE id = $2', [indexHtml, id]).catch(() => {})
    }

    // Save to R2 + update cf_url
    if (USE_CF_STORAGE) {
      const cfFiles = entries.map(e => ({
        path: e.entryName,
        buffer: e.getData(),
        contentType: mime.lookup(e.entryName) || 'application/octet-stream',
      }))
      uploadPageToR2(slug, cfFiles).catch(err => console.error('Erro upload R2:', err))
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
    console.error('Erro upload pagina:', err)
    res.status(500).json({ error: 'Erro ao fazer upload da pagina.' })
  }
})

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

// Public routes: serve page by slug (no auth) — serve from DB html column for all types
// Attempt R2 first, fallback to DB, then set cache headers for edge/CDN caching
app.get('/api/page/:slug/:path(*)', async (req, res) => {
  try {
    const { slug, path } = req.params
    const mimeType = mime.lookup(path) || 'text/html; charset=utf-8'

    // Try R2 first for html pages
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

    const page = await one('SELECT html, type, published FROM pages WHERE slug = $1 AND published = 1', [slug.toLowerCase()])
    if (!page) return res.status(404).send('Pagina nao encontrada.')
    res.set('Content-Type', mimeType)
    res.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=600')
    res.send(page.html || '')
  } catch {
    res.status(500).send('Erro ao carregar pagina.')
  }
})

app.get('/api/page/:slug', async (req, res) => {
  try {
    const slug = req.params.slug.toLowerCase()

    // Try R2 first
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

    const page = await one('SELECT html, type, title FROM pages WHERE slug = $1 AND published = 1', [slug])
    if (!page) return res.status(404).send('Pagina nao encontrada.')
    res.set('Content-Type', 'text/html; charset=utf-8')
    res.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=600')
    res.send(page.html || '')
  } catch {
    res.status(500).send('Erro ao carregar pagina.')
  }
})

// ─── Builder Routes ─────────────────────────────────────────────────
const builderUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'video/mp4', 'video/webm', 'video/ogg']
    if (allowed.includes(file.mimetype)) return cb(null, true)
    cb(new Error('Formato de arquivo nao suportado. Aceito: JPEG, PNG, GIF, WebP, SVG, MP4, WebM, OGG.'))
  },
})

app.post('/api/builder/upload', authMiddleware, builderUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhuma imagem enviada.' })
    const ext = extname(req.file.originalname) || '.jpg'
    const fileName = `builder_${randomUUID()}${ext}`
    const pageDir = join(PAGES_DIR, '_uploads')
    if (!existsSync(pageDir)) mkdirSync(pageDir, { recursive: true })
    writeFileSync(join(pageDir, fileName), req.file.buffer)
    let url = `/api/builder/image/${fileName}`
    if (USE_CF_STORAGE) {
      try {
        await uploadPageToR2(`_uploads/${fileName}`, [{
          path: fileName,
          buffer: req.file.buffer,
          contentType: req.file.mimetype,
        }])
        url = getWorkerUrl(`_uploads/${fileName}`)
      } catch (cfErr) {
        console.error('Erro R2 upload image:', cfErr)
      }
    }
    res.json({ url, fileName })
  } catch (err) {
    console.error('Erro upload builder image:', err)
    res.status(500).json({ error: 'Erro ao fazer upload da imagem.' })
  }
})

app.get('/api/builder/image/:fileName', async (req, res) => {
  try {
    const filePath = join(PAGES_DIR, '_uploads', req.params.fileName)
    if (!existsSync(filePath)) return res.status(404).send('Imagem nao encontrada.')
    const mimeType = mime.lookup(filePath) || 'image/jpeg'
    res.set('Content-Type', mimeType)
    res.sendFile(filePath)
  } catch {
    res.status(500).send('Erro ao carregar imagem.')
  }
})

app.post('/api/builder/save', authMiddleware, async (req, res) => {
  try {
    const { id, name, slug, tree } = req.body
    if (!name || !tree) return res.status(400).json({ error: 'Nome e arvore sao obrigatorios.' })
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const treeJson = JSON.stringify(tree)
    const baseSlug = slug || slugify(name)

    if (id) {
      const existing = await one('SELECT id FROM pages WHERE id = $1 AND user_id = $2', [id, req.user.id])
      if (!existing) return res.status(404).json({ error: 'Pagina nao encontrada.' })
      await run('UPDATE pages SET title = $1, slug = $2, html = $3, type = $4, updated_at = $5 WHERE id = $6',
        [name.trim(), baseSlug, treeJson, 'builder', now, id])
      const page = await one('SELECT id, slug, title, type, published, cf_url, created_at, updated_at FROM pages WHERE id = $1', [id])
      return res.json(page)
    }

    // Create new
    const newId = randomUUID()
    let finalSlug = baseSlug
    let exists = await one('SELECT id FROM pages WHERE slug = $1', [finalSlug])
    let counter = 1
    while (exists) {
      finalSlug = `${baseSlug}-${counter}`
      exists = await one('SELECT id FROM pages WHERE slug = $1', [finalSlug])
      counter++
    }
    await run('INSERT INTO pages (id, user_id, slug, title, html, type, published, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [newId, req.user.id, finalSlug, name.trim(), treeJson, 'builder', 0, now, now])
    const page = await one('SELECT id, slug, title, type, published, cf_url, created_at, updated_at FROM pages WHERE id = $1', [newId])
    res.status(201).json(page)
  } catch (err) {
    console.error('Erro salvar builder:', err)
    res.status(500).json({ error: 'Erro ao salvar pagina.' })
  }
})

app.get('/api/builder', authMiddleware, async (req, res) => {
  try {
    const pages = await query('SELECT id, slug, title, type, published, cf_url, created_at, updated_at FROM pages WHERE user_id = $1 AND type = $2 ORDER BY updated_at DESC', [req.user.id, 'builder'])
    res.json(pages)
  } catch {
    res.status(500).json({ error: 'Erro ao listar paginas.' })
  }
})

app.get('/api/builder/:id', authMiddleware, async (req, res) => {
  try {
    const page = await one('SELECT * FROM pages WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id])
    if (!page) return res.status(404).json({ error: 'Pagina nao encontrada.' })
    if (page.type !== 'builder' && page.type !== 'hosted') return res.status(400).json({ error: 'Tipo invalido.' })
    res.json(page)
  } catch {
    res.status(500).json({ error: 'Erro ao buscar pagina.' })
  }
})

app.delete('/api/builder/:id', authMiddleware, async (req, res) => {
  try {
    const result = await run('DELETE FROM pages WHERE id = $1 AND user_id = $2 AND type = $3', [req.params.id, req.user.id, 'builder'])
    if (result.changes === 0) return res.status(404).json({ error: 'Pagina nao encontrada.' })
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Erro ao deletar pagina.' })
  }
})

// Publish builder page: generate HTML, update record in-place to type='hosted' + embed tree
app.post('/api/builder/:id/publish', authMiddleware, async (req, res) => {
  try {
    const page = await one('SELECT * FROM pages WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id])
    if (!page) return res.status(404).json({ error: 'Pagina nao encontrada.' })
    if (page.type !== 'builder') return res.status(400).json({ error: 'Tipo invalido. Use uma pagina do builder.' })

    const tree = JSON.parse(page.html)
    const html = generateBuilderHtml(tree, page.title)
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const slug = page.slug

    // Store generated HTML in the html column & embed tree JSON in a script tag for re-editing
    const fullHtml = html.replace('</body>',
      `<script id="__METASPY_TREE" type="application/json">${JSON.stringify(tree)}</script>\n</body>`)

    // Update existing record to type='hosted' so it serves the rendered HTML
    await run('UPDATE pages SET html = $1, type = $2, published = $3, updated_at = $4 WHERE id = $5',
      [fullHtml, 'hosted', 1, now, page.id])

    // Save files to disk
    const pageDir = join(PAGES_DIR, slug)
    mkdirSync(pageDir, { recursive: true })
    writeFileSync(join(pageDir, 'index.html'), fullHtml)

    // Upload to R2
    if (USE_CF_STORAGE) {
      const cfUrl = getWorkerUrl(slug)
      await uploadPageToR2(slug, [{
        path: 'index.html',
        buffer: Buffer.from(fullHtml),
        contentType: 'text/html; charset=utf-8',
      }]).catch(err => console.error('Erro R2 publish:', err))
      run('UPDATE pages SET cf_url = $1 WHERE id = $2', [cfUrl, page.id]).catch(() => {})
    }

    const updated = await one('SELECT id, slug, title, type, published, cf_url, created_at, updated_at FROM pages WHERE id = $1', [page.id])
    res.json({
      ...updated,
      url: `https://centralspyads.netlify.app/p/${slug}`,
    })
  } catch (err) {
    console.error('Erro publicar builder:', err)
    res.status(500).json({ error: 'Erro ao publicar pagina.' })
  }
})

function generateBuilderHtml(tree, title) {
  function hoverStyleToCss(hs) {
    if (!hs) return ''
    const p = []
    if (hs.backgroundColor) p.push(`background-color: ${hs.backgroundColor}`)
    if (hs.color) p.push(`color: ${hs.color}`)
    if (hs.boxShadow) p.push(`box-shadow: ${hs.boxShadow}`)
    if (hs.opacity !== undefined) p.push(`opacity: ${hs.opacity}`)
    const t = []
    if (hs.scale) t.push(`scale(${hs.scale})`)
    if (hs.translateY) t.push(`translateY(${hs.translateY}px)`)
    if (t.length) p.push(`transform: ${t.join(' ')}`)
    return p.join('; ')
  }
  function stylesToCss(styles, layoutMode) {
    if (!styles) return ''
    const lines = []
    const val = (s) => s ? `${s.value}${s.unit}` : '0'
    if (layoutMode === 'freehand') {
      if (styles.left) lines.push(`left: ${val(styles.left)}`)
      if (styles.top) lines.push(`top: ${val(styles.top)}`)
      if (styles.zIndex !== undefined) lines.push(`z-index: ${styles.zIndex}`)
      if (styles.rotation) lines.push(`transform: rotate(${styles.rotation}deg)`)
    }
    const f = (k, v) => { if (v !== undefined && v !== '') lines.push(`${k}: ${v}`) }
    f('display', styles.display); f('flex-direction', styles.flexDirection)
    f('align-items', styles.alignItems); f('justify-content', styles.justifyContent)
    f('gap', styles.gap ? val(styles.gap) : undefined); f('flex', styles.flex)
    if (styles.width) { if (styles.width === 'fill') f('width', '100%'); else if (styles.width === 'hug') f('width', 'auto'); else f('width', val(styles.width)) }
    if (styles.height) { if (styles.height === 'hug') f('height', 'auto'); else f('height', val(styles.height)) }
    f('min-width', styles.minWidth ? val(styles.minWidth) : undefined)
    f('max-width', styles.maxWidth ? val(styles.maxWidth) : undefined)
    f('min-height', styles.minHeight ? val(styles.minHeight) : undefined)
    ;['margin', 'padding'].forEach(p => { ['Top', 'Right', 'Bottom', 'Left'].forEach(s => { const key = `${p}${s}`; f(`${p}-${s.toLowerCase()}`, styles[key] ? val(styles[key]) : undefined) }) })
    f('background-color', styles.backgroundColor)
    f('background-image', styles.backgroundImage ? `url(${styles.backgroundImage})` : undefined)
    f('background-size', styles.backgroundSize)
    ;['border-width', 'border-style', 'border-color', 'border-radius'].forEach(p => { const key = p === 'border-width' ? 'borderWidth' : p === 'border-style' ? 'borderStyle' : p === 'border-color' ? 'borderColor' : 'borderRadius'; const v = styles[key]; if (v) f(p, typeof v === 'object' ? val(v) : v) })
    f('box-shadow', styles.boxShadow); f('opacity', styles.opacity)
    f('font-family', styles.fontFamily); f('font-size', styles.fontSize ? val(styles.fontSize) : undefined)
    f('font-weight', styles.fontWeight); f('line-height', styles.lineHeight)
    f('letter-spacing', styles.letterSpacing ? val(styles.letterSpacing) : undefined)
    f('color', styles.color); f('text-align', styles.textAlign); f('text-decoration', styles.textDecoration)
    return lines.join('; ')
  }
  const SCROLL_ANIMATION_KEYFRAMES = `
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
@keyframes fadeInLeft { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); } }
@keyframes fadeInRight { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
@keyframes scaleIn { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
@keyframes slideIn { from { opacity: 0; transform: translateY(60px); } to { opacity: 1; transform: translateY(0); } }
`

  function renderNode(node) {
    const css = stylesToCss(node.styles, node.layoutMode)
    const styleAttr = css ? ` style="${css}"` : ''
    const animAttr = node.scrollAnimation ? ` data-scroll="${node.scrollAnimation.type}" data-duration="${node.scrollAnimation.duration}" data-delay="${node.scrollAnimation.delay}"` : ''
    const clickAttr = node.clickAction?.type === 'link' ? ` onclick="window.open('${node.clickAction.linkUrl}','${node.clickAction.linkTarget || '_self'}')"` : node.clickAction?.type === 'scrollTo' ? ` onclick="document.querySelector('${node.clickAction.scrollSelector}')?.scrollIntoView({behavior:'smooth'})"` : ''

    const hoverId = node.hoverStyle ? `_h_${node.id.replace(/[^a-zA-Z0-9]/g, '_')}` : ''

    switch (node.type) {
      case 'page':
        return `<div${styleAttr}${animAttr}${clickAttr}>${node.children.map(renderNode).join('\n')}</div>`
      case 'section':
        return `<section${styleAttr}${animAttr}${clickAttr}${hoverId ? ` id="${hoverId}"` : ''}>${node.children.map(renderNode).join('\n')}</section>`
      case 'container': case 'row': case 'column':
        return `<div${styleAttr}${animAttr}${clickAttr}${hoverId ? ` id="${hoverId}"` : ''}>${node.children.map(renderNode).join('\n')}</div>`
      case 'heading': {
        const level = node.props?.level || 'h2'
        return `<${level}${styleAttr}${animAttr}${clickAttr}${hoverId ? ` id="${hoverId}"` : ''}>${node.props?.text || ''}</${level}>`
      }
      case 'text':
        return `<div${styleAttr}${animAttr}${clickAttr}${hoverId ? ` id="${hoverId}"` : ''}>${node.props?.html || ''}</div>`
      case 'button': {
        const link = node.props?.link || '#'
        const target = node.props?.target || '_self'
        return `<a href="${link}" target="${target}"${styleAttr}${animAttr}${clickAttr}${hoverId ? ` id="${hoverId}"` : ''}>${node.props?.text || ''}</a>`
      }
      case 'image':
        return `<img src="${node.props?.src || ''}" alt="${node.props?.alt || ''}"${styleAttr}${animAttr}${clickAttr}${hoverId ? ` id="${hoverId}"` : ''} />`
      case 'divider':
        return `<hr${styleAttr}${animAttr}${clickAttr}${hoverId ? ` id="${hoverId}"` : ''} />`
      case 'icon':
        return `<div${styleAttr}${animAttr}${clickAttr}${hoverId ? ` id="${hoverId}"` : ''}><span class="material-icons">${node.props?.icon || 'star'}</span></div>`
      case 'video': {
        const src = node.props?.src || ''
        if (node.props?.type === 'youtube') {
          const vid = src.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/)?.[1] || src
          return `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden"><iframe src="https://www.youtube.com/embed/${vid}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none" allowfullscreen></iframe></div>`
        }
        if (node.props?.type === 'vimeo') {
          const vid = src.match(/vimeo\.com\/(\d+)/)?.[1] || src
          return `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden"><iframe src="https://player.vimeo.com/video/${vid}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none" allowfullscreen></iframe></div>`
        }
        return `<video src="${src}" ${node.props?.autoplay ? 'autoplay' : ''} controls style="width:100%;border-radius:8px"></video>`
      }
      case 'list': {
        const listItems = node.props?.items || []
        const listTag = node.props?.style === 'ordered' ? 'ol' : 'ul'
        return `<${listTag}${styleAttr}${animAttr}${clickAttr}${hoverId ? ` id="${hoverId}"` : ''}>${listItems.map(i => `<li>${i}</li>`).join('')}</${listTag}>`
      }
      case 'form': {
        const formFields = node.props?.fields || []
        return `<form${styleAttr}${animAttr}${clickAttr}${hoverId ? ` id="${hoverId}"` : ''} action="${node.props?.action || ''}" method="POST">${formFields.map(f => `<div style="margin-bottom:8px"><label style="display:block;margin-bottom:4px;font-weight:500">${f.label}${f.required ? ' *' : ''}</label><input type="${f.type}" name="${(f.label || '').toLowerCase()}" placeholder="${f.placeholder || ''}" ${f.required ? 'required' : ''} style="width:100%;padding:8px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:14px"></div>`).join('')}<button type="submit" style="padding:12px 24px;background-color:#7c3aed;color:#fff;border:none;border-radius:8px;font-weight:600;font-size:16px;cursor:pointer;width:100%">${node.props?.submitText || 'Enviar'}</button></form>`
      }
      case 'nav': {
        const navLinks = node.props?.links || []
        return `<nav${styleAttr}${animAttr}${clickAttr}${hoverId ? ` id="${hoverId}"` : ''}><div style="font-weight:700;font-size:20px">${node.props?.logo || 'Logo'}</div><div style="display:flex;gap:16px;align-items:center">${navLinks.map(l => `<a href="${l.href || '#'}" style="text-decoration:none;color:#333;font-size:14px">${l.label}</a>`).join('')}</div></nav>`
      }
      case 'hero':
        return `<section${styleAttr}${animAttr}${clickAttr}${hoverId ? ` id="${hoverId}"` : ''}><h1 style="font-size:48px;font-weight:800;color:#111;margin-bottom:0">${node.props?.title || ''}</h1><p style="font-size:20px;color:#666;max-width:600px">${node.props?.subtitle || ''}</p><a href="${node.props?.ctaLink || '#'}" style="display:inline-block;padding:16px 32px;background-color:#7c3aed;color:#fff;border-radius:8px;font-weight:600;text-decoration:none;margin-top:8px">${node.props?.ctaText || 'Comece Agora'}</a></section>`
      case 'pricing': {
        const pricingPlans = node.props?.plans || []
        return `<div${styleAttr}${animAttr}${clickAttr}${hoverId ? ` id="${hoverId}"` : ''} style="display:flex;flex-wrap:wrap;gap:16px;justify-content:center">${pricingPlans.map(p => {
          const hl = p.highlighted
          return `<div style="flex:1;min-width:250px;padding:24px;background:${hl ? '#7c3aed' : '#fff'};border-radius:12px;color:${hl ? '#fff' : '#111'};box-shadow:0 2px 12px rgba(0,0,0,0.08);border:${hl ? 'none' : '1px solid #e5e7eb'};text-align:center"><h3 style="font-size:18px;margin-bottom:8px">${p.name || ''}</h3><div style="font-size:36px;font-weight:800">${p.price || ''}<span style="font-size:14px;font-weight:400">${p.period || ''}</span></div><ul style="list-style:none;padding:0;margin:20px 0">${(p.features || []).map(f => `<li style="padding:6px 0">${f}</li>`).join('')}</ul><a href="#" style="display:inline-block;padding:12px 32px;background:${hl ? '#fff' : '#7c3aed'};color:${hl ? '#7c3aed' : '#fff'};border-radius:8px;font-weight:600;text-decoration:none">${p.cta || 'Escolher'}</a></div>`
        }).join('')}</div>`
      }
      case 'faq': {
        const faqItems = node.props?.items || []
        return `<div${styleAttr}${animAttr}${clickAttr}${hoverId ? ` id="${hoverId}"` : ''}>${faqItems.map(item => `<details style="border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px"><summary style="font-weight:600;cursor:pointer;font-size:16px">${item.question || ''}</summary><p style="margin-top:8px;color:#555;font-size:14px">${item.answer || ''}</p></details>`).join('')}</div>`
      }
      case 'testimonial':
        return `<div${styleAttr}${animAttr}${clickAttr}${hoverId ? ` id="${hoverId}"` : ''}><div style="font-size:18px;line-height:1.6;color:#333;font-style:italic;margin-bottom:12px">${node.props?.quote || ''}</div>${node.props?.avatar ? `<img src="${node.props.avatar}" alt="" style="width:48px;height:48px;border-radius:50%;object-fit:cover;margin-bottom:8px">` : ''}<div style="font-weight:600">${node.props?.author || ''}</div><div style="font-size:14px;color:#888">${node.props?.role || ''}</div></div>`
      case 'countdown': {
        const targetDate = node.props?.targetDate || ''
        return `<div class="metaspy-countdown"${styleAttr}${animAttr}${clickAttr}${hoverId ? ` id="${hoverId}"` : ''} data-target="${targetDate}"><div style="text-align:center;font-size:16px;font-weight:600;color:#555;margin-bottom:12px">${node.props?.label || ''}</div><div class="metaspy-countdown-units" style="display:flex;justify-content:center;gap:16px;font-size:36px;font-weight:700;color:#111"><div style="text-align:center"><span class="countdown-days">00</span>${node.props?.showLabels ? '<div style="font-size:12px;color:#888;font-weight:400">dias</div>' : ''}</div><div style="text-align:center"><span class="countdown-hours">00</span>${node.props?.showLabels ? '<div style="font-size:12px;color:#888;font-weight:400">horas</div>' : ''}</div><div style="text-align:center"><span class="countdown-minutes">00</span>${node.props?.showLabels ? '<div style="font-size:12px;color:#888;font-weight:400">min</div>' : ''}</div><div style="text-align:center"><span class="countdown-seconds">00</span>${node.props?.showLabels ? '<div style="font-size:12px;color:#888;font-weight:400">seg</div>' : ''}</div></div></div>`
      }
      case 'tabs': {
        const tabItems = node.props?.tabs || []
        return `<div data-tabs-container${styleAttr}${animAttr}${clickAttr}${hoverId ? ` id="${hoverId}"` : ''}><div style="display:flex;border-bottom:2px solid #e5e7eb;margin-bottom:16px">${tabItems.map((t, i) => `<button data-tab="${i}" style="padding:10px 20px;border:none;background:${i === (node.props?.activeTab || 0) ? '#7c3aed' : 'transparent'};color:${i === (node.props?.activeTab || 0) ? '#fff' : '#555'};border-radius:6px 6px 0 0;font-weight:500;cursor:pointer">${t.label || ''}</button>`).join('')}</div>${tabItems.map((t, i) => `<div data-tab-content="${i}" style="display:${i === (node.props?.activeTab || 0) ? 'block' : 'none'}">${t.content || ''}</div>`).join('')}</div>`
      }
      case 'modal':
        return `<div${styleAttr}${animAttr}${clickAttr}${hoverId ? ` id="${hoverId}"` : ''}><button onclick="document.getElementById('modal-${node.id}').style.display='flex'" style="padding:12px 24px;background-color:#7c3aed;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer">${node.props?.triggerText || 'Abrir Modal'}</button><div id="modal-${node.id}" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;align-items:center;justify-content:center" onclick="if(event.target===this&&${node.props?.closeOnOverlay !== false ? 'true' : 'false'})this.style.display='none'"><div style="background:#fff;border-radius:12px;padding:32px;max-width:500px;width:90%;position:relative"><button onclick="this.closest('[id^=modal-]').style.display='none'" style="position:absolute;top:12px;right:12px;border:none;background:transparent;font-size:24px;cursor:pointer;color:#888">&times;</button><h2 style="margin-bottom:12px;font-size:20px">${node.props?.title || ''}</h2><div>${node.props?.content || ''}</div></div></div></div>`
      case 'embed':
        return `<div${styleAttr}${animAttr}${clickAttr}${hoverId ? ` id="${hoverId}"` : ''}>${node.props?.code || ''}</div>`
      default:
        return `<div${styleAttr}${animAttr}${clickAttr}${hoverId ? ` id="${hoverId}"` : ''}>${node.children.map(renderNode).join('\n')}</div>`
    }
  }

  // Collect hover styles
  function collectHoverStyles(node) {
    let css = ''
    if (node.hoverStyle) {
      const id = `_h_${node.id.replace(/[^a-zA-Z0-9]/g, '_')}`
      css += `#${id}:hover { ${hoverStyleToCss(node.hoverStyle)} }\n`
    }
    if (node.scrollAnimation) {
      const id = node.id.replace(/[^a-zA-Z0-9]/g, '_')
      css += `[data-scroll="${node.scrollAnimation.type}"] { opacity: 0; }\n`
    }
    node.children.forEach(c => { css += collectHoverStyles(c) })
    return css
  }

  const bodyContent = renderNode(tree)
  const hoverCss = collectHoverStyles(tree)

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title || 'Minha Pagina'}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; -webkit-font-smoothing: antialiased; }
    ${hoverCss}
    ${SCROLL_ANIMATION_KEYFRAMES}
  </style>
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            var el = entry.target;
            var anim = el.getAttribute('data-scroll');
            var dur = el.getAttribute('data-duration') || 600;
            var delay = el.getAttribute('data-delay') || 0;
            el.style.animation = anim + ' ' + dur + 'ms ease ' + delay + 'ms both';
            observer.unobserve(el);
          }
        });
      }, { threshold: 0.1 });
      document.querySelectorAll('[data-scroll]').forEach(function(el) { observer.observe(el); });

      // Countdown timers
      document.querySelectorAll('.metaspy-countdown').forEach(function(container) {
        var targetStr = container.getAttribute('data-target');
        if (!targetStr) return;
        var target = new Date(targetStr).getTime();
        function update() {
          var now = new Date().getTime();
          var diff = Math.max(0, target - now);
          var d = Math.floor(diff / (1000*60*60*24));
          var h = Math.floor((diff % (1000*60*60*24)) / (1000*60*60));
          var m = Math.floor((diff % (1000*60*60)) / (1000*60));
          var s = Math.floor((diff % (1000*60)) / 1000);
          var pad = function(n) { return n < 10 ? '0' + n : '' + n; };
          var cd = container.querySelector('.countdown-days');
          var ch = container.querySelector('.countdown-hours');
          var cm = container.querySelector('.countdown-minutes');
          var cs = container.querySelector('.countdown-seconds');
          if (cd) cd.textContent = pad(d);
          if (ch) ch.textContent = pad(h);
          if (cm) cm.textContent = pad(m);
          if (cs) cs.textContent = pad(s);
        }
        update();
        setInterval(update, 1000);
      });

      // Tabs
      document.querySelectorAll('[data-tab]').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var idx = btn.getAttribute('data-tab');
          var tabsContainer = btn.closest('[data-tab]') ? btn.parentElement.parentElement : btn.parentElement;
          tabsContainer.querySelectorAll('[data-tab]').forEach(function(b) {
            b.style.background = 'transparent';
            b.style.color = '#555';
          });
          btn.style.background = '#7c3aed';
          btn.style.color = '#fff';
          var parent = btn.closest('[data-tabs-container]') || btn.parentElement.parentElement;
          parent.querySelectorAll('[data-tab-content]').forEach(function(c) {
            c.style.display = 'none';
          });
          var content = parent.querySelector('[data-tab-content="' + idx + '"]');
          if (content) content.style.display = 'block';
        });
      });
    });
  </script>
</head>
<body>
${bodyContent}
</body>
</html>`
}

// Cleanup cron: remove files older than 1 hour
setInterval(async () => {
  const oneHour = 60 * 60 * 1000
  const now = Date.now()
  try {
    const { readdir, stat, unlink } = await import('node:fs/promises')
    const files = await readdir(CLEANER_DIR).catch(() => [])
    for (const file of files) {
      const filePath = join(CLEANER_DIR, file)
      try {
        const stats = await stat(filePath)
        if (now - stats.mtimeMs > oneHour) await unlink(filePath).catch(() => {})
      } catch {}
    }
  } catch {}
}, 60 * 60 * 1000)

// ─── Error Handler ────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ erro: 'Arquivo muito grande. Maximo: 200MB.' })
  if (err?.message?.includes('formato')) return res.status(400).json({ erro: err.message })
  console.error('Erro nao tratado:', err)
  next(err)
})

// ─── Start ───────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`MetaSpy Server rodando na porta ${PORT}`)
  console.log(`Frontend URL: ${process.env.FRONTEND_URL || '*'}`)
  console.log(`Kirvano: ${KIRVANO_API_KEY ? 'configurado' : 'NÃO configurado'}`)
  console.log(`Facebook: ${FB_TOKEN ? 'configurado' : 'NÃO configurado'}`)
  console.log(`Database: PostgreSQL`)
  console.log(`Environment: ${IS_RENDER ? 'Render (production)' : 'development'}`)
})
