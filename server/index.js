import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { randomUUID } from 'node:crypto'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createReadStream, existsSync, mkdirSync, readdirSync } from 'node:fs'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import { ZipArchive } from 'archiver'
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
  gratuito: { price: 0, days: 7, kirvanoPlan: 'gratuito' },
  mensal: { price: 49.90, days: 30, kirvanoPlan: 'mensal' },
  anual: { price: 110.90, days: 365, renewal: 97, kirvanoPlan: 'anual' },
}

const PLAN_FEATURES = {
  nenhum: { clone: false, minerador: false, cloaker: false, pagevault: false, analise: false },
  gratuito: { clone: true, minerador: true, cloaker: false, pagevault: true, analise: false },
  mensal: { clone: true, minerador: true, cloaker: false, pagevault: true, analise: false },
  anual: { clone: true, minerador: true, cloaker: true, pagevault: true, analise: true },
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
    const { default: downloadSite } = await import('./clone.js')
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
    const archive = new ZipArchive()
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

// ─── Subscription Routes ─────────────────────────────────────────
const KIRVANO_API = 'https://api.kirvano.com'

const KIRVANO_LINK = 'https://pay.kirvano.com/94aa8ec8-bb4a-4921-bb43-a3a7646d397c'

const KIRVANO_STATIC_LINKS = {
  gratuito: KIRVANO_LINK,
  mensal: KIRVANO_LINK,
  anual: KIRVANO_LINK,
}

const KIRVANO_CHECKOUT_UUIDS = {
  '94aa8ec8-bb4a-4921-bb43-a3a7646d397c': 'gratuito',
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

// ─── Start ───────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`MetaSpy Server rodando na porta ${PORT}`)
  console.log(`Frontend URL: ${process.env.FRONTEND_URL || '*'}`)
  console.log(`Kirvano: ${KIRVANO_API_KEY ? 'configurado' : 'NÃO configurado'}`)
  console.log(`Facebook: ${FB_TOKEN ? 'configurado' : 'NÃO configurado'}`)
  console.log(`Database: PostgreSQL`)
  console.log(`Environment: ${IS_RENDER ? 'Render (production)' : 'development'}`)
})
