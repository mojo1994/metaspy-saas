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
import archiver from 'archiver'
import { exiftool } from 'exiftool-vendored'
import mime from 'mime-types'
import { initDb, initSchema, one, query, run } from './db.js'

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
    const user = await one('SELECT id, name, email, plan, subscription_status, subscription_expiry, clones_used, created_at FROM users WHERE id = $1', [decoded.userId])
    if (!user) return res.status(401).json({ error: 'Usuario nao encontrado' })
    req.user = user
    next()
  } catch {
    return res.status(401).json({ error: 'Token invalido' })
  }
}

// ─── App ─────────────────────────────────────────────────────────
const app = express()
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
    const existing = await one('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()])
    if (existing) return res.status(409).json({ error: 'Email ja cadastrado' })
    const hash = await bcrypt.hash(password, 10)
    const id = randomUUID()
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    await run('INSERT INTO users (id, name, email, password_hash, plan, subscription_status, clones_used, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [id, name.trim(), email.toLowerCase().trim(), hash, 'nenhum', 'inactive', 0, now])
    const user = await one('SELECT id, name, email, plan, subscription_status, subscription_expiry, clones_used, created_at FROM users WHERE id = $1', [id])
    const accessToken = generateToken(id)
    const refreshToken = generateRefreshToken(id)
    res.json({ user, accessToken, refreshToken })
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar conta' })
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
import { sendEmail, recoveryEmailHtml, verificationEmailHtml } from './email.js'

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'Email obrigatorio.' })
    const user = await one('SELECT id, email FROM users WHERE email = $1', [email.toLowerCase().trim()])
    if (!user) return res.json({ ok: true, message: 'Se o email existir, voce recebera um codigo.' })

    const code = generateCode()
    const now = new Date()
    const expires = new Date(now.getTime() + 15 * 60 * 1000)
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
    const code = generateCode()
    const now = new Date()
    const expires = new Date(now.getTime() + 15 * 60 * 1000)
    const id = randomUUID()
    await run('INSERT INTO email_codes (id, user_id, email, code, type, expires_at, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [id, user.id, user.email, code, 'verification', expires.toISOString(), now.toISOString()])

    await sendEmail({ to: user.email, subject: 'MetaSpy - Codigo de Confirmacao', html: verificationEmailHtml(code) })
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
    const archive = archiver('zip', { zlib: { level: 9 } })
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
    const archive = archiver('zip', { zlib: { level: 9 } })
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
