import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import multer from 'multer'
import { randomUUID, createHash, createHmac, createCipheriv, createDecipheriv, timingSafeEqual, randomInt } from 'node:crypto'
import { join, dirname, extname } from 'node:path'
import { freemem } from 'node:os'
import { fileURLToPath } from 'node:url'
import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, writeFileSync, readFileSync, unlinkSync, statSync, renameSync, copyFileSync } from 'node:fs'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import { ZipArchive } from 'archiver'
import { exiftool } from 'exiftool-vendored'
import mime from 'mime-types'
import AdmZip from 'adm-zip'
import sanitizeHtml from 'sanitize-html'
import { z } from 'zod'
import pino from 'pino'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { getRedis, cacheGet, cacheSet } from './redis.js'
import { enqueueThumbnailExtraction, startWorker } from './thumbnailQueue.js'

let ffmpegInstance = null
let ffmpegLoading = false
let ffmpegLoadQueue = []
async function getFFmpeg() {
  if (ffmpegInstance) return ffmpegInstance
  if (ffmpegLoading) return new Promise(r => ffmpegLoadQueue.push(r))
  ffmpegLoading = true
  const ff = new FFmpeg()
  ff.on('log', ({ message }) => logger.debug({ msg: message }, 'ffmpeg'))
  await ff.load()
  ffmpegInstance = ff
  ffmpegLoading = false
  ffmpegLoadQueue.forEach(r => r(ff))
  ffmpegLoadQueue = []
  return ff
}
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
const HMAC_SECRET = process.env.HMAC_SECRET || JWT_SECRET
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

// ─── LRU Cache com TTL ──────────────────────────────────────────
class TtlLRUMap {
  #map = new Map()
  #maxSize
  #ttlMs
  constructor(maxSize = 1000, ttlMs = 300_000) { this.#maxSize = maxSize; this.#ttlMs = ttlMs }
  get(key) {
    const entry = this.#map.get(key)
    if (!entry) return undefined
    if (Date.now() - entry.time > this.#ttlMs) { this.#map.delete(key); return undefined }
    this.#map.delete(key); this.#map.set(key, entry)
    return entry.value
  }
  set(key, value) {
    if (this.#map.size >= this.#maxSize) { const first = this.#map.keys().next().value; this.#map.delete(first) }
    this.#map.set(key, { value, time: Date.now() })
  }
  delete(key) { this.#map.delete(key) }
  get size() { return this.#map.size }
}

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
  basico: { price: 39.90, days: 30, kirvanoPlan: 'basico' },
  gold: { price: 57.90, days: 30, kirvanoPlan: 'gold' },
  premium: { price: 197.00, days: 30, kirvanoPlan: 'premium' },
}

const PLAN_FEATURES = {
  nenhum: { clone: false, minerador: false, cloaker: false, pagevault: true, analise: false, cleaner: false, bypass: false },
  basico: { clone: false, minerador: true, cloaker: false, pagevault: false, analise: false, cleaner: true, bypass: false },
  gold: { clone: false, minerador: true, cloaker: false, pagevault: true, analise: true, cleaner: true, bypass: true },
  premium: { clone: true, minerador: true, cloaker: true, pagevault: true, analise: true, cleaner: true, bypass: true },
}

// ─── Cryptography Helpers ────────────────────────────────────────
function generateHMACSignature(campaignId, targetUrl, timestamp, nonce) {
  return createHmac('sha512', HMAC_SECRET)
    .update(`${campaignId}:${targetUrl}:${timestamp}:${nonce}`)
    .digest('hex')
}

function verifyHMACSignature(campaignId, targetUrl, timestamp, nonce, signature) {
  const expected = generateHMACSignature(campaignId, targetUrl, timestamp, nonce)
  if (expected.length !== signature.length) return false
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

// ─── Fraud Score Decision Engine ─────────────────────────────────
const FRAUD_WEIGHTS = {
  asn: 70, tcp: 35, ja4: 100, ua: 80, lang: 35, timing: 40, referrer: 20,
}

function calculateFraudScore(headers, ip, geo) {
  let score = 30
  const ua = (headers['user-agent'] || '').toLowerCase()
  const acceptLang = headers['accept-language'] || ''
  const referer = headers['referer'] || ''
  const via = headers['via'] || ''
  const xForwardedFor = headers['x-forwarded-for'] || ''

  if (/headless|phantom|puppeteer|webdriver/i.test(ua)) score += 80
  else if (/curl|python|wget|httpie|go-http/i.test(ua)) score += 90
  else if (/bot|crawler|spider|scrape/i.test(ua)) score += 70

  const uaIsDesktop = /windows|macintosh|linux x86_64/i.test(ua)
  const uaIsMobile = /mobile|android.*iphone|ipad/i.test(ua)
  if (!uaIsDesktop && !uaIsMobile && score < 70) score += 30

  if (!referer) score += 20
  else if (/l\.facebook\.com|lm\.facebook\.com/i.test(referer)) score -= 10
  else if (/facebook\.com.*/i.test(referer) && !/facebookexternalhit/i.test(ua)) score -= 5

  if (acceptLang && geo?.country) {
    const langCode = acceptLang.split(',')[0]?.split('-')[1]?.toUpperCase()
    if (langCode && langCode !== geo.country) score += 35
  }

  if (via || xForwardedFor.split(',').length > 2) score += 25

  return Math.max(0, Math.min(100, score))
}

// ─── White Page Generator ────────────────────────────────────────
const WHITE_CHUNKS = {
  headlines: [
    'Descubra as Novas Tendências de Tecnologia em 2026',
    'Guia Completo para Iniciantes em Marketing Digital',
    'Como Melhorar sua Produtividade com Ferramentas Simples',
    'Os Benefícios da Alimentação Saudável no Dia a Dia',
    'Dicas de Viagem para Explorar o Brasil sem Gastar Muito',
    'Entenda Como a Inteligência Artificial está Transformando o Mercado',
  ],
  paragraphs: [
    'Nos últimos anos, o mercado tem passado por transformações significativas impulsionadas pela digitalização e pela adoção de novas tecnologias. Empresas de todos os portes buscam se adaptar a esse novo cenário para permanecerem competitivas.',
    'Estudos recentes apontam que a maioria dos consumidores brasileiros já realiza compras online regularmente, criando oportunidades únicas para negócios que sabem aproveitar as ferramentas digitais disponíveis.',
    'A combinação de estratégias bem definidas com as plataformas certas pode gerar resultados expressivos em curto espaço de tempo. O segredo está em entender o comportamento do seu público-alvo.',
    'Com o avanço da tecnologia, novas soluções surgem diariamente para facilitar a vida de profissionais e empreendedores. Estar atualizado é fundamental para não ficar para trás.',
    'Segundo especialistas, o planejamento estratégico é a base para qualquer iniciativa de sucesso. Definir metas claras e mensuráveis é o primeiro passo para alcançar resultados consistentes.',
  ],
  footnotes: [
    'Este artigo é uma produção independente e não reflete necessariamente a opinião de terceiros.',
    'Informações atualizadas em Junho de 2026. Consulte fontes oficiais para dados mais recentes.',
    'Conteúdo informativo. Consulte um profissional especializado para orientações específicas.',
  ],
}

function pseudoRandom(seed) {
  let h = seed >>> 0
  return function () {
    h = (Math.imul(1103515245, h) + 12345) >>> 0
    return h / 0xFFFFFFFF
  }
}

function generateWhitePage(seedStr) {
  const seed = createHash('sha256').update(seedStr).digest().readUInt32BE(0)
  const rand = pseudoRandom(seed)
  const pick = (arr) => arr[Math.floor(rand() * arr.length)]
  const date = new Date(Date.now() - Math.floor(rand() * 1209600000))
  const dateStr = date.toLocaleDateString('pt-BR')
  const title = pick(WHITE_CHUNKS.headlines)
  const p1 = pick(WHITE_CHUNKS.paragraphs)
  const p2 = pick(WHITE_CHUNKS.paragraphs)
  const p3 = pick(WHITE_CHUNKS.paragraphs)
  const footnote = pick(WHITE_CHUNKS.footnotes)

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;background:#f9f9f9;max-width:720px;margin:0 auto;padding:20px}h1{font-size:24px;margin:20px 0 10px;color:#111}p{margin:12px 0;font-size:15px;color:#444}.meta{font-size:13px;color:#888;margin-bottom:20px}.footer{margin-top:30px;padding-top:15px;border-top:1px solid #ddd;font-size:12px;color:#999}
</style>
</head>
<body>
<h1>${title}</h1>
<div class="meta">Por Redacao &bull; ${dateStr}</div>
<p>${p1}</p>
<p>${p2}</p>
<p>${p3}</p>
<div class="footer"><p>${footnote}</p></div>
</body>
</html>`
}

// ─── JS Challenge Page Generator ─────────────────────────────────
function generateJSChallenge(campaignId, safeUrl, targetUrl) {
  const challengePassTarget = targetUrl || campaignId
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex,nofollow">
<title>Verificacao de Seguranca</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0a0a0f;color:#fff}
.card{text-align:center;padding:40px;max-width:400px}
.spinner{width:40px;height:40px;border:3px solid rgba(168,85,247,.2);border-top-color:#a855f7;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 24px}
@keyframes spin{to{transform:rotate(360deg)}}
p{font-size:14px;color:#999;margin-bottom:8px}
.btn{display:none}
</style>
</head>
<body>
<div class="card">
<div class="spinner"></div>
<p>Verificando navegador...</p>
</div>
<script>
let passed = false;
function unlock(){
  if(passed) return;
  passed = true;
  document.addEventListener('mousemove',function handler(){
    document.removeEventListener('mousemove',handler);
    if(window.location.search.includes('safe')){
      window.location.href='${safeUrl.replace(/'/g, "\\'")}';
    } else {
      document.querySelector('.card').innerHTML='<p style="color:#22c55e">✓ Verificado</p>';
      setTimeout(()=>{window.location.href='${challengePassTarget.replace(/'/g, "\\'")}';},600);
    }
  });
}
unlock();
setTimeout(()=>{if(!passed)window.location.href='${safeUrl.replace(/'/g, "\\'")}';},10000);
if(navigator.webdriver||/headless|phantom/i.test(navigator.userAgent)){
  window.location.href='${safeUrl.replace(/'/g, "\\'")}';
}
</script>
<noscript><meta http-equiv="refresh" content="0;url=${safeUrl}"></noscript>
</body>
</html>`
}

// ─── Enhanced Cloaker Script ─────────────────────────────────────
function generateEnhancedCloakerScript(campaignId, targetUrl, safeUrl) {
  return `<script>
(function(){
  const TARGET=${JSON.stringify(targetUrl)};
  const SAFE=${JSON.stringify(safeUrl)};
  const CAMPAIGN=${JSON.stringify(campaignId)};
  let score=30;
  const ua=navigator.userAgent.toLowerCase();
  const isBot=/bot|crawler|spider|scrape|headless|phantom|puppeteer|webdriver/i.test(ua);
  const hasWebDriver=navigator.webdriver===true;
  const hasChromeHeadless=/headlesschrome/i.test(ua);
  const plugins=navigator.plugins.length;
  const screenW=screen.width;
  const screenH=screen.height;
  if(isBot||hasWebDriver||hasChromeHeadless)score+=100;
  if(/curl|python|wget|httpie/i.test(ua))score+=90;
  if(!document.referrer)score+=20;
  if(plugins===0)score+=15;
  if(screenW===0&&screenH===0)score+=40;
  if(window.top!==window.self)score+=50;
  const nav=navigator;
  if(nav.deviceMemory!==undefined&&nav.deviceMemory<=2)score+=15;
  if(nav.hardwareConcurrency!==undefined&&nav.hardwareConcurrency<=2)score+=15;
  const elapsed=performance.now();
  if(elapsed<300)score+=35;
  if(score>=70){
    window.location.href=SAFE;
  }else if(score>=40){
    document.body.innerHTML='<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;color:#666"><p>Verificando...</p></div>';
    document.addEventListener('mousemove',function(){window.location.href=TARGET;},{once:true});
    setTimeout(function(){window.location.href=SAFE;},8000);
  }else{
    window.location.href=TARGET;
  }
})();
</script>`
}

// ─── URL Pool Helpers (DB-based weighted rotation) ──────────────
async function addUrlToPool(campaignId, url, weight = 10, maxHits = null) {
  const id = randomUUID()
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  await run('INSERT INTO url_pool_urls (id, pool_id, url, weight, hit_count, max_hits, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [id, campaignId, url, weight, 0, maxHits, now])
  return id
}

async function getNextUrlFromPool(campaignId) {
  const urls = await query('SELECT id, url, weight, hit_count, max_hits FROM url_pool_urls WHERE pool_id = $1 AND (max_hits IS NULL OR hit_count < max_hits) ORDER BY weight DESC', [campaignId])
  if (!urls.length) return null
  const totalWeight = urls.reduce((s, u) => s + u.weight, 0)
  let rand = Math.random() * totalWeight
  for (const url of urls) {
    rand -= url.weight
    if (rand <= 0) {
      await run('UPDATE url_pool_urls SET hit_count = hit_count + 1 WHERE id = $1', [url.id])
      return url.url
    }
  }
  return urls[0].url
}

// ─── LSB Steganography Helpers ──────────────────────────────────
const STEG_AES_KEY = process.env.STEG_AES_KEY || createHash('sha256').update(HMAC_SECRET).digest('hex').slice(0, 32)

function stegEncrypt(data) {
  const iv = randomUUID().replace(/-/g, '').slice(0, 16)
  const cipher = createCipheriv('aes-256-cbc', STEG_AES_KEY, iv)
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()])
  const hmac = createHmac('sha256', STEG_AES_KEY).update(encrypted).digest()
  return Buffer.concat([Buffer.from(iv), hmac, encrypted])
}

function stegDecrypt(payload) {
  try {
    const iv = payload.slice(0, 16).toString()
    const hmac = payload.slice(16, 48)
    const encrypted = payload.slice(48)
    const expected = createHmac('sha256', STEG_AES_KEY).update(encrypted).digest()
    if (!hmac.equals(expected)) return null
    const decipher = createDecipheriv('aes-256-cbc', STEG_AES_KEY, iv)
    return Buffer.concat([decipher.update(encrypted), decipher.final()])
  } catch { return null }
}

function embedLSB(coverBuffer, secretBuffer) {
  const pixels = Buffer.from(coverBuffer)
  const secret = stegEncrypt(secretBuffer)
  const maxBytes = Math.floor(pixels.length / 4) * 3 / 8
  if (secret.length > maxBytes) throw new Error('Secret too large for cover image')

  // Write length prefix (4 bytes, little-endian)
  const len = Buffer.alloc(4)
  len.writeUInt32LE(secret.length)
  const fullPayload = Buffer.concat([len, secret])

  for (let i = 0; i < fullPayload.length; i++) {
    for (let bit = 0; bit < 8; bit++) {
      const pixelIdx = i * 8 + bit
      const byteIdx = pixelIdx * 4 + 3 // Alpha channel
      if (byteIdx >= pixels.length) break
      pixels[byteIdx] = (pixels[byteIdx] & 0xFC) | ((fullPayload[i] >> bit) & 1)
    }
  }
  return pixels
}

function extractLSB(stegoBuffer) {
  const pixels = Buffer.from(stegoBuffer)
  const lenBytes = []
  for (let i = 0; i < 4; i++) {
    let byte = 0
    for (let bit = 0; bit < 8; bit++) {
      const pixelIdx = i * 8 + bit
      const byteIdx = pixelIdx * 4 + 3
      if (byteIdx >= pixels.length) return null
      byte |= ((pixels[byteIdx] & 1) << bit)
    }
    lenBytes.push(byte)
  }
  const secretLen = Buffer.from(lenBytes).readUInt32LE(0)
  if (secretLen < 1 || secretLen > pixels.length / 8) return null

  const secretBuf = Buffer.alloc(secretLen)
  for (let i = 0; i < secretLen; i++) {
    for (let bit = 0; bit < 8; bit++) {
      const pixelIdx = (i + 4) * 8 + bit
      const byteIdx = pixelIdx * 4 + 3
      if (byteIdx >= pixels.length) return null
      secretBuf[i] |= ((pixels[byteIdx] & 1) << bit)
    }
  }
  return stegDecrypt(secretBuf)
}

function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })
}

function generateRefreshToken(userId) {
  return jwt.sign({ userId, type: 'refresh' }, JWT_SECRET, { expiresIn: '30d' })
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/api/auth',
  maxAge: 30 * 24 * 60 * 60,
}

function setRefreshCookie(res, token) {
  res.cookie('refreshToken', token, COOKIE_OPTIONS)
}

function clearRefreshCookie(res) {
  res.clearCookie('refreshToken', { ...COOKIE_OPTIONS, maxAge: 0 })
}

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token nao fornecido' })
  const token = authHeader.slice(7)
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    const user = await one('SELECT id, name, email, plan, subscription_status, subscription_expiry, clones_used, email_verified, created_at FROM users WHERE id = $1', [decoded.userId])
    if (!user) return res.status(401).json({ error: 'Usuario nao encontrado' })
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    if (user.subscription_expiry && user.subscription_expiry < now && user.plan !== 'nenhum') {
      await run('UPDATE users SET plan = $1, subscription_status = $2 WHERE id = $3', ['nenhum', 'expired', user.id])
      user.plan = 'nenhum'
      user.subscription_status = 'expired'
    }
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
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'img', 'video', 'source', 'audio', 'figure', 'figcaption', 'picture', 'iframe',
      'style', 'link', 'script', 'meta', 'base', 'noscript', 'svg', 'path', 'circle', 'rect', 'defs', 'use',
    ]),
    allowedAttributes: {
      '*': ['style', 'class', 'id', 'data-*'],
      'a': ['href', 'target', 'rel'],
      'img': ['src', 'alt', 'width', 'height', 'loading', 'srcset', 'sizes'],
      'video': ['src', 'controls', 'autoplay', 'muted', 'loop', 'width', 'height', 'poster', 'playsinline'],
      'source': ['src', 'type', 'srcset', 'media', 'sizes'],
      'iframe': ['src', 'width', 'height', 'frameborder', 'allowfullscreen', 'loading', 'referrerpolicy'],
      'link': ['href', 'rel', 'type', 'media', 'crossorigin', 'integrity', 'as', 'hreflang'],
      'script': ['src', 'type', 'async', 'defer', 'crossorigin', 'integrity', 'nomodule'],
      'meta': ['name', 'content', 'charset', 'http-equiv', 'property'],
      'base': ['href', 'target'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'data', 'blob'],
    disallowedTagsMode: 'discard',
    allowedSchemesByTag: { img: ['http', 'https', 'data', 'blob'] },
  })
}

const IDEMPOTENCY_TTL = 5 * 60 * 1000

// ─── Zod Schemas ────────────────────────────────────────────────
const signupSchema = z.object({ email: z.string().email().max(255), name: z.string().min(1).max(100), password: z.string().min(6).max(128) })
const loginSchema = z.object({ email: z.string().email().max(255), password: z.string().min(1).max(128) })
const verifyCodeSchema = z.object({ email: z.string().email().max(255), code: z.string().length(6) }).or(z.object({ code: z.string().length(6) }))
const forgotPasswordSchema = z.object({ email: z.string().email().max(255) })
const resetPasswordSchema = z.object({ email: z.string().email().max(255), code: z.string().length(6).optional(), new_password: z.string().min(6).max(128) })
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

    const hash = await bcrypt.hash(password, 10)
    const id = randomUUID()
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    await run('INSERT INTO users (id, name, email, password_hash, plan, subscription_status, email_verified, clones_used, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [id, name.trim(), emailLower, hash, 'nenhum', 'inactive', 1, 0, now])

    const user = await one('SELECT id, name, email, plan, subscription_status, subscription_expiry, clones_used, email_verified, created_at FROM users WHERE id = $1', [id])
    const accessToken = generateToken(id)
    const refToken = generateRefreshToken(id)
    setRefreshCookie(res, refToken)
    res.json({ user, accessToken })
  } catch (err) {
    logger.error({ err }, 'Erro signup')
    res.status(500).json({ error: 'Erro ao criar conta.' })
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
    const refToken = generateRefreshToken(id)
    setRefreshCookie(res, refToken)
    res.json({ user, accessToken })
  } catch (err) {
    logger.error({ err }, 'Erro verify-signup')
    res.status(500).json({ error: 'Erro ao confirmar cadastro.' })
  }
})

app.post('/api/auth/check-email', async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'Email nao fornecido' })
    const emailLower = email.toLowerCase().trim()
    const existing = await one('SELECT id FROM users WHERE email = $1', [emailLower])
    res.json({ exists: !!existing })
  } catch {
    res.status(500).json({ error: 'Erro ao verificar email' })
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
    const refToken = generateRefreshToken(user.id)
    setRefreshCookie(res, refToken)
    const { password_hash, ...safe } = user
    res.json({ user: safe, accessToken })
  } catch {
    res.status(500).json({ error: 'Erro ao fazer login' })
  }
})

const refreshLimiter = rateLimit({ windowMs: 60 * 1000, max: 5, message: { error: 'Muitas requisicoes de refresh. Aguarde.' } })
app.post('/api/auth/refresh', refreshLimiter, async (req, res) => {
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken
  if (!refreshToken) return res.status(401).json({ error: 'Refresh token nao fornecido' })
  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET)
    if (decoded.type !== 'refresh') return res.status(401).json({ error: 'Token invalido' })
    const user = await one('SELECT id FROM users WHERE id = $1', [decoded.userId])
    if (!user) return res.status(401).json({ error: 'Usuario nao encontrado' })
    const newAccessToken = generateToken(user.id)
    const newRefToken = generateRefreshToken(user.id)
    setRefreshCookie(res, newRefToken)
    res.json({ accessToken: newAccessToken })
  } catch {
    res.status(401).json({ error: 'Refresh token invalido' })
  }
})

app.post('/api/auth/logout', (req, res) => {
  clearRefreshCookie(res)
  res.json({ ok: true })
})

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: req.user })
})

// ─── Email / Recovery Routes ──────────────────────────────────────
import { sendEmail, verificationEmailHtml, purchaseConfirmationEmailHtml, pendingCheckoutEmailHtml } from './email.js'

function generateCode() {
  return String(randomInt(100000, 999999))
}

app.post('/api/auth/forgot-password', validate(forgotPasswordSchema), async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'Email obrigatorio.' })
    const emailLower = email.toLowerCase().trim()
    const user = await one('SELECT id, email FROM users WHERE email = $1', [emailLower])
    if (!user) return res.status(404).json({ error: 'Email nao encontrado.' })
    res.json({ ok: true })
  } catch (err) {
    logger.error({ err }, 'Erro forgot-password')
    res.status(500).json({ error: 'Erro ao verificar email.' })
  }
})

app.post('/api/auth/reset-password', validate(resetPasswordSchema), async (req, res) => {
  try {
    const { email, code, new_password } = req.body
    if (!email || !new_password) return res.status(400).json({ error: 'Preencha todos os campos.' })
    if (new_password.length < 6) return res.status(400).json({ error: 'Senha deve ter ao menos 6 caracteres.' })

    const emailLower = email.toLowerCase().trim()

    if (code) {
      const record = await one('SELECT * FROM email_codes WHERE email = $1 AND code = $2 AND type = $3 AND used = 0 AND expires_at > $4',
        [emailLower, code.toString(), 'recovery', new Date().toISOString()])
      if (!record) return res.status(400).json({ error: 'Codigo invalido ou expirado.' })
      const hash = await bcrypt.hash(new_password, 10)
      await run('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, record.user_id])
      await run('UPDATE email_codes SET used = 1 WHERE id = $1', [record.id])
    } else {
      const user = await one('SELECT id FROM users WHERE email = $1', [emailLower])
      if (!user) return res.status(404).json({ error: 'Email nao encontrado.' })
      const hash = await bcrypt.hash(new_password, 10)
      await run('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, user.id])
    }
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

    const emailResult = await sendEmail({ to: user.email, subject: 'MetaSpy - Confirme seu Email', html: verificationEmailHtml(code) })
    if (emailResult.error) {
      logger.error({ emailError: emailResult.error, userId: user.id }, 'Falha ao enviar email de verificacao')
      return res.status(500).json({ error: 'Erro ao enviar codigo. Tente novamente mais tarde.' })
    }
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
function checkFeature(req, res, feature) {
  const features = PLAN_FEATURES[req.user?.plan]
  if (!features?.[feature]) {
    return res.status(403).json({ error: 'Seu plano nao inclui este recurso.' })
  }
  return null
}

const CLONE_ZIPS_DIR = join(CLONES_DIR, '_zips')
if (!existsSync(CLONE_ZIPS_DIR)) mkdirSync(CLONE_ZIPS_DIR, { recursive: true })
const CLONE_ZIP_CACHE = new Map()

app.post('/api/clone/deep', authMiddleware, async (req, res) => {
  const blocked = checkFeature(req, res, 'bypass')
  if (blocked) return blocked
  try {
    const { url } = req.body
    if (!url) return res.status(400).json({ error: 'URL nao fornecida' })
    const id = randomUUID()
    const dir = join(CLONES_DIR, id)
    mkdirSync(dir, { recursive: true })
    const { downloadSite, buildFileTree } = await import('./clone.js')
    await downloadSite(url, { outputDir: dir, fbToken: FB_TOKEN, deep: true })
    const files = buildFileTree(dir)

    const zipPath = join(CLONE_ZIPS_DIR, `${id}.zip`)
    const archive = new ZipArchive({ zlib: { level: 6 } })
    const ws = createWriteStream(zipPath)
    await new Promise((resolve, reject) => {
      ws.on('finish', resolve)
      ws.on('error', reject)
      archive.on('error', reject)
      archive.pipe(ws)
      archive.directory(dir, false)
      archive.finalize()
    })
    CLONE_ZIP_CACHE.set(id, zipPath)
    setTimeout(() => CLONE_ZIP_CACHE.delete(id), 300_000)

    res.json({ id, cloneId: id, path: dir, files })
  } catch (err) {
    logger.error({ err }, 'clone-deep POST error')
    res.status(500).json({ error: 'Erro ao clonar site' })
  }
})

app.get('/api/clone/deep/:id/files', authMiddleware, async (req, res) => {
  const blocked = checkFeature(req, res, 'bypass')
  if (blocked) return blocked
  const dir = join(CLONES_DIR, req.params.id)
  if (!existsSync(dir)) return res.status(404).json({ error: 'Clone nao encontrado' })
  try {
    const { buildFileTree } = await import('./clone.js')
    const tree = buildFileTree(dir)
    res.json({ id: req.params.id, tree })
  } catch {
    res.status(500).json({ error: 'Erro ao listar arquivos' })
  }
})

app.get('/api/clone/deep/:id/download', authMiddleware, async (req, res) => {
  const blocked = checkFeature(req, res, 'bypass')
  if (blocked) return blocked
  const id = req.params.id
  try {
    let zipPath = CLONE_ZIP_CACHE.get(id)
    if (!zipPath || !existsSync(zipPath)) {
      const dir = join(CLONES_DIR, id)
      if (!existsSync(dir)) return res.status(404).json({ error: 'Clone nao encontrado' })
      zipPath = join(CLONE_ZIPS_DIR, `${id}.zip`)
      const archive = new ZipArchive({ zlib: { level: 6 } })
      const ws = createWriteStream(zipPath)
      await new Promise((resolve, reject) => {
        ws.on('finish', resolve)
        ws.on('error', reject)
        archive.on('error', reject)
        archive.pipe(ws)
        archive.directory(dir, false)
        archive.finalize()
      })
      CLONE_ZIP_CACHE.set(id, zipPath)
    }
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="clone-${id}.zip"`)
    createReadStream(zipPath).pipe(res)
  } catch (err) {
    logger.error({ err, cloneId: id }, 'clone-download error')
    if (!res.headersSent) res.status(500).json({ error: 'Erro ao baixar ZIP' })
  }
})

// ─── Page Fetch (CORS bypass) ────────────────────────────────────
app.get('/api/page-fetch', authMiddleware, async (req, res) => {
  const blocked = checkFeature(req, res, 'minerador')
  if (blocked) return blocked
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

  // ─── CDN URL patterns for image_hash ──────────────────────────
const CDN_PATTERNS = [
  (hash) => `https://scontent.xx.fbcdn.net/v/t45.1600-4/${hash}_n.jpg`,
  (hash) => `https://scontent.xx.fbcdn.net/v/t1.15770-9/${hash}_n.jpg`,
  (hash) => `https://scontent.xx.fbcdn.net/v/t1.30497-1/${hash}_n.jpg`,
  (hash) => `https://scontent.xx.fbcdn.net/v/t1.6435-9/${hash}_n.jpg`,
]

async function resolveImageHash(hash) {
  for (const pattern of CDN_PATTERNS) {
    try {
      const url = pattern(hash)
      const resp = await fetchWithTimeout(url, { method: 'HEAD' }, 3000)
      if (resp.ok) return url
    } catch {}
  }
  return null
}

  // ─── Ad Image Extraction ─────────────────────────────────────────
const cachePreview = new TtlLRUMap(500, 600_000)
app.get('/api/ad-extract-image', async (req, res) => {
  const { id, snapshot, linkUrl, pageId: pageIdParam, objectStorySpec } = req.query
  if (!id && !snapshot) return res.status(400).json({ error: 'Informe id ou snapshot' })
  const chaveCache = id || snapshot.toString()
  const cacheado = cachePreview.get(chaveCache)
  if (cacheado) return res.json(cacheado)

  let imageUrl = null
  let pageId = pageIdParam?.toString() || null

  // Strategy 0: Se o frontend enviou objectStorySpec (da busca inicial), tenta extrair image_hash
  if (!imageUrl && objectStorySpec) {
    try {
      const spec = typeof objectStorySpec === 'string' ? JSON.parse(objectStorySpec) : objectStorySpec
      const findHash = (obj) => {
        if (!obj || typeof obj !== 'object') return null
        if (obj.image_hash && typeof obj.image_hash === 'string') return obj.image_hash
        for (const sub of ['link_data', 'photo_data', 'video_data', 'child_attachments']) {
          const child = obj[sub]
          if (child) {
            if (Array.isArray(child)) { for (const c of child) { const h = findHash(c); if (h) return h } }
            else { const h = findHash(child); if (h) return h }
          }
        }
        return null
      }
      const hash = findHash(spec)
      if (hash) {
        const resolved = await resolveImageHash(hash)
        if (resolved) { imageUrl = resolved }
      }
    } catch (e) { logger.warn({ err: e?.message }, 'Estrat0: objectStorySpec parse falhou') }
  }

  if (id) {
    try {
      const fields = encodeURIComponent('ad_creative_thumbnail_url,ad_snapshot_url,ad_creative_bodies,object_story_spec,page_id,creative{id,thumbnail_url,image_hash}')
      const apiUrl = `https://graph.facebook.com/v22.0/${id}?fields=${fields}&access_token=${FB_TOKEN}`
      const resp = await fetchWithTimeout(apiUrl, {}, 5000)
      logger.info({ status: resp.status, id }, 'Estrat1: Graph API individual')
      if (resp.ok) {
        const data = await resp.json()
        pageId = data.page_id || null

        // 1a: ad_creative_thumbnail_url direto
        if (data.ad_creative_thumbnail_url) {
          const result = { imageUrl: data.ad_creative_thumbnail_url }
          cachePreview.set(chaveCache, result)
          return res.json(result)
        }

        // 1b: creative.thumbnail_url do objeto creative embutido
        if (data.creative?.thumbnail_url) {
          const result = { imageUrl: data.creative.thumbnail_url }
          cachePreview.set(chaveCache, result)
          return res.json(result)
        }

        // 1c: Se temos creative.id, consulta direto + thumbnails
        const creativeId = data.creative?.id
        if (creativeId) {
          try {
            const cResp = await fetchWithTimeout(
              `https://graph.facebook.com/v22.0/${creativeId}?fields=thumbnail_url,image_hash&access_token=${FB_TOKEN}`,
              {}, 5000
            )
            if (cResp.ok) {
              const cData = await cResp.json()
              if (cData.thumbnail_url) {
                const result = { imageUrl: cData.thumbnail_url }
                cachePreview.set(chaveCache, result)
                return res.json(result)
              }
              // 1d: Se temos image_hash, tenta multiplos padroes CDN
              if (cData.image_hash) {
                const resolved = await resolveImageHash(cData.image_hash)
                if (resolved) {
                  const result = { imageUrl: resolved }
                  cachePreview.set(chaveCache, result)
                  return res.json(result)
                }
              }
            }
          } catch (e) { logger.warn({ err: e?.message, creativeId }, 'Estrat1c: creative query falhou') }

          try {
            const thumbResp = await fetchWithTimeout(
              `https://graph.facebook.com/v22.0/${creativeId}/thumbnails?access_token=${FB_TOKEN}`,
              {}, 10000
            )
            if (thumbResp.ok) {
              const thumbs = await thumbResp.json()
              const uri = thumbs?.data?.[0]?.uri
              if (uri) {
                const result = { imageUrl: uri }
                cachePreview.set(chaveCache, result)
                return res.json(result)
              }
            }
          } catch (e) { logger.warn({ err: e?.message, creativeId }, 'Estrat1d: creative thumbnails falhou') }
        }

        // 1e: object_story_spec - busca recursiva por URLs fbcdn e image_hash
        if (data.object_story_spec) {
          const specStr = JSON.stringify(data.object_story_spec)
          const imgMatch = specStr.match(/"(https:[^"]+?(?:fbcdn|scontent)[^"]+)"/)
          if (imgMatch) {
            const result = { imageUrl: imgMatch[1].replace(/\\\//g, '/') }
            cachePreview.set(chaveCache, result)
            return res.json(result)
          }
          const hashMatch = specStr.match(/"image_hash"\s*:\s*"([^"]+)"/)
          if (hashMatch) {
            const resolved = await resolveImageHash(hashMatch[1])
            if (resolved) {
              const result = { imageUrl: resolved }
              cachePreview.set(chaveCache, result)
              return res.json(result)
            }
          }
        }

        // 1f: tenta /{ad_id}/creatives diretamente
        try {
          const creativesResp = await fetchWithTimeout(
            `https://graph.facebook.com/v22.0/${id}/creatives?fields=thumbnail_url,image_hash&access_token=${FB_TOKEN}`,
            {}, 5000
          )
          if (creativesResp.ok) {
            const creativesData = await creativesResp.json()
            const first = creativesData?.data?.[0]
            if (first?.thumbnail_url) {
              const result = { imageUrl: first.thumbnail_url }
              cachePreview.set(chaveCache, result)
              return res.json(result)
            }
            if (first?.image_hash) {
              const resolved = await resolveImageHash(first.image_hash)
              if (resolved) {
                const result = { imageUrl: resolved }
                cachePreview.set(chaveCache, result)
                return res.json(result)
              }
            }
          }
        } catch (e) { logger.warn({ err: e?.message, id }, 'Estrat1f: creatives endpoint falhou') }
      }
    } catch (e) { logger.warn({ err: e?.message, id }, 'Estrat1: Graph API individual falhou') }
  }

  // Strategy 2: Scrape snapshot page
  if (snapshot) {
    try {
      const resp = await fetchWithTimeout(snapshot.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
        }
      }, 5000)
      if (resp.ok) {
        const html = await resp.text()
        imageUrl = null

        // og:image and twitter:image
        const metaMatch = html.match(/<meta\s+(?:property|name)="(?:og:image|twitter:image)"\s+content="([^"]+)"/i)
        if (metaMatch) imageUrl = metaMatch[1]

        // __NEXT_DATA__ JSON
        if (!imageUrl) {
          const nextMatch = html.match(/<script[^>]*>window\.__PRELOADED_STATE__\s*=\s*({.+?})<\/script>/)
          if (nextMatch) {
            try {
              const str = JSON.stringify(JSON.parse(nextMatch[1]))
              const fbUrl = str.match(/"(https:\/\/[^"]+fbcdn[^"]+)"/)
              if (fbUrl) imageUrl = fbUrl[1].replace(/\\u0025/g, '%').replace(/\\\//g, '/')
            } catch (e) { logger.warn({ err: String(e), id }, 'Estrat2: preloaded_state parse falhou') }
          }
        }

        // embedded JSON image/thumbnail keys
        if (!imageUrl) {
          const jsonMatch = html.match(/"(?:image|thumbnail|src|preview|imgUrl)"\s*:\s*"(https:[^"]+?fbcdn[^"]+?)"/i)
          if (jsonMatch) {
            try { imageUrl = JSON.parse('"' + jsonMatch[1] + '"') } catch { imageUrl = jsonMatch[1] }
          }
        }

        // script tag with JSON-LD
        if (!imageUrl) {
          const ldMatch = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>({.+?})<\/script>/)
          if (ldMatch) {
            try {
              const ld = JSON.parse(ldMatch[1])
              const findUrl = (o) => {
                if (!o || typeof o !== 'object') return null
                for (const v of Object.values(o)) {
                  if (typeof v === 'string' && v.includes('fbcdn')) return v
                  const r = findUrl(v)
                  if (r) return r
                }
                return null
              }
              imageUrl = findUrl(ld)
            } catch (e) { logger.warn({ err: String(e), id }, 'Estrat2: JSON-LD parse falhou') }
          }
        }

        // any img tag with fbcdn src
        if (!imageUrl) {
          const allImgs = [...html.matchAll(/<img[^>]+src="(https:[^"]+?)"[^>]*>/gi)]
          const fbcdn = allImgs.find(m => m[1].includes('fbcdn'))
          imageUrl = fbcdn?.[1] || null
        }

        if (imageUrl) {
          const result = { imageUrl }
          cachePreview.set(chaveCache, result)
          return res.json(result)
        }
      }
    } catch (e) { logger.warn({ err: String(e), id, snapshot: snapshot?.toString()?.slice(0, 80) }, 'Estrat2: snapshot fetch falhou') }
  }

  // Strategy 5: Try OG image from the landing page (linkUrl)
  if (linkUrl && !imageUrl) {
    try {
      const resp = await fetchWithTimeout(linkUrl.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
        }
      }, 5000)
      if (resp.ok) {
        const html = await resp.text()
        const m = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)
        if (m) {
          imageUrl = m[1].replace(/&amp;/g, '&')
          const result = { imageUrl }
          cachePreview.set(chaveCache, result)
          return res.json(result)
        }
        const twitterMatch = html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i)
        if (twitterMatch) {
          imageUrl = twitterMatch[1].replace(/&amp;/g, '&')
          const result = { imageUrl }
          cachePreview.set(chaveCache, result)
          return res.json(result)
        }
      }
    } catch (e) { logger.warn({ err: String(e), id, linkUrl: linkUrl?.toString()?.slice(0, 80) }, 'Estrat5: OG fetch falhou') }
  }

  // Strategy 6: Page profile picture as last resort
  if (!imageUrl) {
    imageUrl = await getPageProfilePic(pageId, id)
  }

  // Enqueue background extraction if no image found
  if (!imageUrl && (id || snapshot)) {
    enqueueThumbnailExtraction(id || '', snapshot?.toString() || '', linkUrl?.toString() || '').catch(e => logger.warn({ err: String(e) }, 'enqueueThumbnails falhou'))
  }

  const result = { imageUrl }
  if (imageUrl) cachePreview.set(chaveCache, result)
  res.json(result)
})

// ─── Page profile picture endpoint ────────────────────────────
app.get('/api/page-picture/:pageId', async (req, res) => {
  const { pageId } = req.params
  const url = await getPageProfilePic(pageId, null)
  if (url) return res.json({ imageUrl: url })
  res.json({ imageUrl: null })
})

// ─── Page profile picture fallback ─────────────────────────────
async function getPageProfilePic(pageId, adId) {
  const pid = pageId || adId?.split('_')?.[0]
  if (!pid || !FB_TOKEN) return null
  try {
    const url = `https://graph.facebook.com/v22.0/${pid}/picture?type=large&redirect=false&access_token=${FB_TOKEN}`
    const resp = await fetchWithTimeout(url, {}, 5000)
    if (resp.ok) {
      const data = await resp.json()
      if (data?.data?.url) return data.data.url
    }
  } catch (e) { logger.warn({ err: String(e), pid }, 'Estrat6: page pic fetch falhou') }
  return null
}

// ─── Apify Facebook Ads Scraper Integration ────────────────────
const APIFY_TOKEN = process.env.APIFY_TOKEN
const APIFY_ACTOR_ID = 'XtaWFhbtfxyzqrFmd'
const apifyCache = new TtlLRUMap(200, 1_800_000)

async function extractImageFromApifyData(items) {
  if (!Array.isArray(items) || items.length === 0) return null
  const item = items[0]
  // Try cards first (most common for multi-creative ads)
  const cards = item.snapshot?.cards || item.snapshot?.images || []
  for (const card of cards) {
    if (card.original_image_url) return card.original_image_url
    if (card.resized_image_url) return card.resized_image_url
    if (card.video_preview_image_url) return card.video_preview_image_url
  }
  // Try direct images
  const images = item.snapshot?.images || []
  for (const img of images) {
    if (img.original_image_url) return img.original_image_url
    if (img.resized_image_url) return img.resized_image_url
  }
  // Try page profile picture as last resort
  if (item.snapshot?.page_profile_picture_url) return item.snapshot.page_profile_picture_url
  return null
}

app.get('/api/ad-image-apify', async (req, res) => {
  const { adId, adUrl } = req.query
  const id = adId?.toString() || ''
  const libraryUrl = adUrl?.toString() || (id ? `https://www.facebook.com/ads/library/?id=${id}` : '')
  if (!libraryUrl) return res.status(400).json({ error: 'Informe adId ou adUrl' })

  const cacheKey = libraryUrl
  const cached = apifyCache.get(cacheKey)
  if (cached) return res.json({ imageUrl: cached })

  if (!APIFY_TOKEN) {
    logger.warn('APIFY_TOKEN nao configurado')
    return res.json({ imageUrl: null })
  }

  try {
    const runResp = await fetch(`https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/runs?token=${APIFY_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        count: 1,
        scrapeAdDetails: true,
        urls: [{ url: libraryUrl }]
      })
    })

    if (!runResp.ok) {
      const errText = await runResp.text().catch(() => '')
      if (runResp.status === 402 || errText.includes('concurrent-runs-limit')) {
        logger.warn({ status: runResp.status }, 'Apify: limite de execucoes concorrentes atingido')
      } else {
        logger.warn({ status: runResp.status, errText: errText.slice(0, 200) }, 'Apify run falhou')
      }
      return res.json({ imageUrl: null })
    }

    const runData = await runResp.json()
    const runId = runData?.data?.id
    if (!runId) return res.json({ imageUrl: null })

    // Poll for completion (max 30s)
    let result = null
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000))
      const statusResp = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`)
      if (!statusResp.ok) continue
      const statusData = await statusResp.json()
      const status = statusData?.data?.status

      if (status === 'SUCCEEDED') {
        // Get dataset items
        const dsResp = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_TOKEN}`)
        if (dsResp.ok) {
          const items = await dsResp.json()
          result = await extractImageFromApifyData(items)
        }
        break
      } else if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
        break
      }
    }

    if (result) {
      apifyCache.set(cacheKey, result)
      setTimeout(() => apifyCache.delete(cacheKey), 30 * 60 * 1000) // 30min cache
      return res.json({ imageUrl: result })
    }
    res.json({ imageUrl: null })
  } catch (e) {
    logger.warn({ err: String(e) }, 'Apify integration erro')
    res.json({ imageUrl: null })
  }
})

// ─── Image Proxy (bypass CDN blocking via browser fingerprint) ──
const DOMINIOS_PERMITIDOS = ['.fbcdn.net', '.facebook.com', '.meta.com', '.fbsbx.com']

function proxyImagemHandler(req, res) {
  const { url } = req.query
  if (!url) return res.status(400).json({ error: 'URL nao fornecida' })
  try {
    const urlObj = new URL(url.toString())
    const permitido = DOMINIOS_PERMITIDOS.some(d => urlObj.hostname.endsWith(d))
    if (!permitido) return res.status(403).json({ error: 'Dominio nao permitido' })
  } catch {
    return res.status(400).json({ error: 'URL invalida' })
  }
  fetchWithTimeout(url.toString(), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'Referer': 'https://www.facebook.com/',
      'Origin': 'https://www.facebook.com',
      'Sec-Fetch-Dest': 'image',
      'Sec-Fetch-Mode': 'no-cors',
      'Sec-Fetch-Site': 'cross-site',
      'Cache-Control': 'no-cache'
    }
  }, 30000).then(async resp => {
    if (!resp.ok) return res.status(204).end()
    const ct = resp.headers.get('content-type') || 'image/jpeg'
    res.set('Content-Type', ct)
    res.set('Cache-Control', 'public, max-age=86400')
    res.set('Access-Control-Allow-Origin', '*')
    const buf = await resp.arrayBuffer()
    res.send(Buffer.from(buf))
  }).catch(() => res.status(204).end())
}

app.get('/api/ad-image-proxy', proxyImagemHandler)
app.get('/api/image-proxy', proxyImagemHandler)

// ─── OG Image from landing page ─────────────────────────────────
app.get('/api/og-image', async (req, res) => {
  const { url } = req.query
  if (!url) return res.status(400).json({ error: 'URL nao fornecida' })
  try {
    const resp = await fetchWithTimeout(url.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    }, 10000)
    if (resp.ok) {
      const html = await resp.text()
      const ogMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)
      if (ogMatch) return res.json({ imageUrl: ogMatch[1] })
      const twitterMatch = html.match(/<meta\s+name="twitter:image"\s+content="([^"]+)"/i)
      if (twitterMatch) return res.json({ imageUrl: twitterMatch[1] })
    }
    res.json({ imageUrl: null })
  } catch {
    res.json({ imageUrl: null })
  }
})

// ─── Batch thumbnail enqueue for background extraction ────────────
app.post('/api/enqueue-thumbnails', async (req, res) => {
  try {
    const { ads } = req.body
    if (!Array.isArray(ads) || ads.length === 0) {
      return res.status(400).json({ error: 'Envie um array de ads' })
    }
    const results = []
    for (const ad of ads) {
      if (ad.idAnuncio && ad.urlBiblioteca) {
        const jobId = await enqueueThumbnailExtraction(ad.idAnuncio, ad.urlBiblioteca, ad.urlDestino || '')
        if (jobId) results.push({ id: ad.idAnuncio, jobId })
      }
    }
    res.json({ enfileirados: results.length, total: ads.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── Puppeteer Snapshot (headless browser for ads without thumbnails) ─
const PUPPETEER_MEM_MIN = 600 // 600MB — abaixo disso nao tenta
let browserInstance = null
async function getBrowser() {
  if (browserInstance && browserInstance.isConnected()) return browserInstance
  const memUsage = process.memoryUsage()
  const freeMem = typeof freemem === 'function' ? freemem() / 1024 / 1024 : Infinity
  if (freeMem < PUPPETEER_MEM_MIN) {
    logger.warn({ freeMemMb: Math.round(freeMem) }, 'Memoria insuficiente para Puppeteer — use o Cloudflare Worker (Browser Rendering) em vez do Chrome local')
    throw new Error(`Memoria insuficiente para Puppeteer (${Math.round(freeMem)}MB livres, minimo ${PUPPETEER_MEM_MIN}MB). Configure CF_WORKER_URL para usar Browser Rendering.`)
  }
  const puppeteer = await import('puppeteer')
  browserInstance = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox',
      '--disable-dev-shm-usage', '--disable-gpu',
      '--window-size=1280,720'
    ]
  })
  return browserInstance
}

app.get('/api/ad-snapshot-image', async (req, res) => {
  const { url } = req.query
  if (!url) return res.status(400).json({ error: 'URL nao fornecida' })
  try {
    const browser = await getBrowser()
    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36')
    await page.setViewport({ width: 1920, height: 1080 })
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'Referer': 'https://www.facebook.com/',
      'Origin': 'https://www.facebook.com'
    })
    // Set cookies to avoid cookie consent banners
    await page.setCookie({ name: 'locale', value: 'pt_BR', domain: '.facebook.com' })

    await page.goto(url.toString(), { waitUntil: 'networkidle2', timeout: 30000 })
    // Realistic human-like wait
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000))

    let imageUrl = null
    // Try og:image
    try {
      imageUrl = await page.$eval('meta[property="og:image"]', el => el.getAttribute('content'))
    } catch {}
    // Try twitter:image
    if (!imageUrl) {
      try {
        imageUrl = await page.$eval('meta[name="twitter:image"]', el => el.getAttribute('content'))
      } catch {}
    }
    // Try first large img on page
    if (!imageUrl) {
      try {
        imageUrl = await page.$eval('img[src*="fbcdn"]', el => el.getAttribute('src'))
      } catch {}
    }

    await page.close()
    if (imageUrl) cachePreview.set(url.toString(), { imageUrl })
    res.json({ imageUrl })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── Ads Archive (Facebook Graph API proxy) ──────────────────────
app.get('/api/ads-archive', async (req, res) => {
  try {
    const params = new URLSearchParams()
    for (const [key, val] of Object.entries(req.query)) {
      if (Array.isArray(val)) val.forEach(v => params.append(key, String(v)))
      else params.set(key, String(val))
    }
    if (!params.has('access_token')) params.set('access_token', FB_TOKEN)
    const apiUrl = `https://graph.facebook.com/v22.0/ads_archive?${params.toString()}`
    logger.info({ url: apiUrl.replace(FB_TOKEN, '***') }, 'Consultando Facebook Ads Archive')
    const resp = await fetchWithTimeout(apiUrl, {
      headers: {
        'User-Agent': 'MetaSpy/1.0',
        'Authorization': `Bearer ${FB_TOKEN}`
      }
    }, 30000)
    const text = await resp.text()
    logger.info({ status: resp.status, bodyPreview: text.slice(0, 2000) }, 'Resposta do Facebook')
    res.set('Content-Type', 'application/json')
    res.status(resp.status).send(text)
  } catch (err) {
    logger.error({ err }, 'Erro ao consultar ads_archive')
    res.status(500).json({ error: 'Erro ao consultar ads_archive', detalhe: err instanceof Error ? err.message : String(err) })
  }
})

// ─── Subscription Routes ─────────────────────────────────────────
const KIRVANO_API = 'https://api.kirvano.com'

const KIRVANO_STATIC_LINKS = {
  basico: 'https://pay.kirvano.com/c921cdd9-aefd-40db-95a7-fcbd7952006d',
  gold: 'https://pay.kirvano.com/879cf3f0-5be2-42a4-b9bb-f9d0c03a8dcd',
  premium: 'https://pay.kirvano.com/2498bd06-c4e9-412f-ab0d-bd9cededb5ad',
}

const KIRVANO_CHECKOUT_UUIDS = {
  'c921cdd9-aefd-40db-95a7-fcbd7952006d': 'basico',
  '879cf3f0-5be2-42a4-b9bb-f9d0c03a8dcd': 'gold',
  '2498bd06-c4e9-412f-ab0d-bd9cededb5ad': 'premium',
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
  if (!features?.cloaker) return res.status(403).json({ error: 'Disponivel apenas no plano Premium' })
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
  const blocked = checkFeature(req, res, 'cloaker')
  if (blocked) return blocked
  const scripts = await query('SELECT id, target_url, safe_url, created_at FROM cloaker_scripts WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id])
  res.json(scripts)
})

app.delete('/api/cloaker/scripts/:id', authMiddleware, async (req, res) => {
  const blocked = checkFeature(req, res, 'cloaker')
  if (blocked) return blocked
  const result = await run('DELETE FROM cloaker_scripts WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id])
  if (result.changes === 0) return res.status(404).json({ error: 'Script nao encontrado' })
  res.json({ ok: true })
})

app.get('/api/cloaker/scripts/:id/download', authMiddleware, async (req, res) => {
  const blocked = checkFeature(req, res, 'cloaker')
  if (blocked) return blocked
  const script = await one('SELECT script_code FROM cloaker_scripts WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id])
  if (!script) return res.status(404).json({ error: 'Script nao encontrado' })
  res.setHeader('Content-Type', 'application/javascript')
  res.setHeader('Content-Disposition', `attachment; filename="cloaker-${req.params.id.slice(0, 8)}.js"`)
  res.send(script.script_code)
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
    if (!features?.cloaker) return res.status(403).json({ erro: 'Disponivel apenas no plano Premium.' })
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
    if (!features?.cloaker) return res.status(403).json({ erro: 'Disponivel apenas no plano Premium.' })
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
  if (!features?.cloaker) return res.status(403).json({ erro: 'Disponivel apenas no plano Premium.' })
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
    const scriptCode = generateEnhancedScript(safeUrl, false)
    const fileName = `camuflado-${id}.html`
    let html
    if (isVideo) {
      html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Conteudo Camuflado</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#000;display:flex;align-items:center;justify-content:center;min-height:100dvh;font-family:sans-serif}video{max-width:100%;max-height:100vh;object-fit:contain}.footer{position:fixed;bottom:8px;left:0;right:0;text-align:center;font-size:11px;color:#555}</style>
${scriptCode}</head><body>
<video width="100%" height="auto" controls autoplay muted playsinline>
  <source src="original${ext}" type="${req.file.mimetype}">
</video>
<p class="footer">Conteudo protegido</p>
</body></html>`
    } else {
      html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Conteudo Camuflado</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#000;display:flex;align-items:center;justify-content:center;min-height:100dvh;font-family:sans-serif}img{max-width:100%;max-height:100vh;object-fit:contain}.footer{position:fixed;bottom:8px;left:0;right:0;text-align:center;font-size:11px;color:#555}</style>
${scriptCode}</head><body>
<img src="original${ext}" alt="Conteudo" style="max-width:100%;height:auto">
<p class="footer">Conteudo protegido</p>
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

app.get('/api/cloaker/camouflage-download/:id', authMiddleware, async (req, res) => {
  const blocked = checkFeature(req, res, 'cloaker')
  if (blocked) return blocked
  try {
    const dir = join(CAMO_DIR, req.params.id)
    if (!existsSync(dir)) return res.status(404).json({ erro: 'Arquivo nao encontrado ou expirado.' })
    const files = readdirSync(dir)
    const htmlFile = files.find(f => f.endsWith('.html'))
    const mediaFile = files.find(f => f !== htmlFile)
    if (!htmlFile) return res.status(404).json({ erro: 'Arquivo nao encontrado.' })
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="camuflado-${req.params.id}.zip"`)
    const archive = new ZipArchive({ zlib: { level: 9 } })
    archive.pipe(res)
    archive.file(join(dir, htmlFile), { name: htmlFile })
    if (mediaFile) archive.file(join(dir, mediaFile), { name: mediaFile })
    await archive.finalize()
    setTimeout(() => {
      try { rmSync(dir, { recursive: true, force: true }) } catch {}
    }, 60000)
  } catch {
    res.status(500).json({ erro: 'Erro ao gerar download.' })
  }
})

// ─── Enhanced Anti-Detection Script ───────────────────────────────
function generateEnhancedScript(safeUrl, revealOnClick) {
  const url = JSON.stringify(safeUrl || 'about:blank')
  return `<script>
(function(){
  var ua = navigator.userAgent.toLowerCase();
  var score = 0;
  if (/bot|crawler|spider|scrape|headless|phantom|puppeteer|selenium|playwright|curl|wget|python-requests|java|httpclient|facebookexternalhit|googlebot|bingbot|twitterbot|slack|telegram|whatsapp|discord|applebot|adsbot|medibot|facebot|slurp|duckduckbot|baiduspider|yandexbot|rogerbot|exabot|mj12bot|dotbot|semrush|ahrefsbot|domaincrawler|netcraftsurvey/i.test(ua)) score += 45;
  if (navigator.webdriver) score += 35;
  try { if (window.chrome && !window.chrome.runtime) score += 15; } catch(e) { score += 20; }
  try {
    var c = document.createElement('canvas');
    c.width = 240; c.height = 60;
    var ctx = c.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(0, 0, 240, 60);
    ctx.fillStyle = '#069';
    ctx.fillText('BotDetect', 10, 20);
    if (c.toDataURL().length < 2000) score += 20;
  } catch(e) { score += 25; }
  try {
    var gl = document.createElement('canvas').getContext('webgl');
    if (!gl) score += 15;
    else {
      var ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (ext) {
        var vendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL);
        var renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
        if (/swiftshader|llvmpipe|mesa|vmware|virtual|google\s*inc/i.test(vendor) || /swiftshader|llvmpipe|mesa|vmware|virtual/i.test(renderer)) score += 25;
      }
    }
  } catch(e) { score += 15; }
  if (navigator.plugins && navigator.plugins.length === 0) score += 10;
  if (!navigator.languages || navigator.languages.length === 0) score += 10;
  if (navigator.languages && navigator.languages.length === 1 && navigator.languages[0] === 'en-US') score += 8;
  if (window.screen.width === 0 || window.screen.height === 0) score += 30;
  if (window.screen.width <= 800 && window.screen.height <= 600) score += 15;
  if (!navigator.hardwareConcurrency || navigator.hardwareConcurrency <= 2) score += 10;
  if (navigator.deviceMemory !== undefined && navigator.deviceMemory <= 2) score += 10;
  if (navigator.maxTouchPoints === 0) score += 8;
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) score += 5;
  try {
    var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) score += 10;
  } catch(e) { score += 10; }
  if (score >= 40) {
    var u = ${url};
    if (u !== 'about:blank') window.location.href = u;
    document.body.innerHTML = '';
    return;
  }
  ${revealOnClick ? `
  var revealed = false;
  function reveal() {
    if (revealed) return;
    revealed = true;
    document.getElementById('real').classList.add('show');
    document.getElementById('overlay').classList.add('hidden');
  }
  document.addEventListener('click', reveal);
  document.addEventListener('touchstart', reveal);
  document.addEventListener('scroll', reveal);
  var iv = setInterval(function() {
    if (document.body.scrollTop > 10 || document.documentElement.scrollTop > 10) { reveal(); clearInterval(iv); }
  }, 500);
  setTimeout(reveal, 8000);` : ''}
})();
</script>`
}

// ─── Dual-Layer Media Camouflage ──────────────────────────────────
const CAMO_MEDIA_OUTPUTS = new TtlLRUMap(100, 600_000)

const camoMediaStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!req._camoDirCreated) {
      const dir = join('/tmp', 'metaspy-camo-media', randomUUID())
      mkdirSync(dir, { recursive: true })
      req.camoMediaDir = dir
      req._camoDirCreated = true
    }
    cb(null, req.camoMediaDir)
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
  const ff = await getFFmpeg()
  const realData = readFileSync(realPath)
  const disguiseData = readFileSync(disguisePath)

  const isRealVid = realMime?.startsWith('video/')
  const isDisgVid = disguiseMime?.startsWith('video/')

  const seed = Date.now().toString(36)
  ff.writeFile(`disguise_${seed}.mp4`, new Uint8Array(disguiseData))
  ff.writeFile(`real_${seed}.mp4`, new Uint8Array(realData))

  const args = []

  if (isDisgVid) {
    args.push('-i', `disguise_${seed}.mp4`)
  } else {
    args.push('-loop', '1', '-framerate', '30', '-i', `disguise_${seed}.mp4`, '-t', '2')
  }

  if (isRealVid) {
    args.push('-i', `real_${seed}.mp4`)
  } else {
    args.push('-loop', '1', '-i', `real_${seed}.mp4`)
  }

  // Forced keyframes on disguise segment + moov atom at front
  args.push(
    '-filter_complex',
    `[0:v]scale=trunc(iw/2)*2:trunc(ih/2)*2,setsar=1,force_key_frames=expr:gte(t,0)[0v];` +
    `[1:v]scale=trunc(iw/2)*2:trunc(ih/2)*2,setsar=1[1v];` +
    `[0v][1v]concat=n=2:v=1:a=0`,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-g', '1',
    '-movflags', '+faststart',
    '-y', `output_${seed}.mp4`
  )

  await ff.exec(args)
  const outData = ff.readFile(`output_${seed}.mp4`)
  writeFileSync(outputPath, Buffer.from(outData))

  // Inject fake metadata via ExifTool
  try {
    await exiftool.write(outputPath, {
      Make: 'Apple',
      Model: 'iPhone 15 Pro',
      Software: 'Adobe Photoshop 25.0',
    })
  } catch {}

  return outputPath
}

function generateClickToRevealHTML(dir, realPath, disguisePath, realMime, disguiseMime, safeUrl) {
  const isRealVideo = realMime?.startsWith('video/')
  const isDisguiseVideo = disguiseMime?.startsWith('video/')
  const realExt = extname(realPath)
  const disguiseExt = extname(disguisePath)
  const realName = `real${realExt}`
  const disguiseName = `disguise${disguiseExt}`
  const disguiseSrc = isDisguiseVideo ? `disguise.mp4` : disguiseName
  const realSrc = isRealVideo ? `real.mp4` : realName

  // Copy/rename files to standardized names for HTML reference
  try { copyFileSync(realPath, join(dir, realSrc)) } catch { writeFileSync(join(dir, realSrc), readFileSync(realPath)) }
  try { copyFileSync(disguisePath, join(dir, disguiseSrc)) } catch { writeFileSync(join(dir, disguiseSrc), readFileSync(disguisePath)) }

  const script = generateEnhancedScript(safeUrl, true)

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex,nofollow">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Content Preview</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#000;overflow:hidden;width:100vw;height:100dvh;display:flex;align-items:center;justify-content:center;font-family:sans-serif}
#disguise{position:absolute;inset:0;z-index:1;display:flex;align-items:center;justify-content:center;background:#000}
#disguise img,#disguise video{max-width:100%;max-height:100%;object-fit:contain}
#overlay{position:absolute;inset:0;z-index:2;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.55);cursor:pointer;transition:opacity .4s}
#overlay.hidden{opacity:0;pointer-events:none}
#overlay button{padding:18px 44px;font-size:22px;border:2px solid #fff;background:transparent;color:#fff;border-radius:10px;cursor:pointer;transition:background .2s}
#overlay button:hover{background:rgba(255,255,255,0.12)}
#real{position:absolute;inset:0;z-index:0;display:none;align-items:center;justify-content:center;background:#000}
#real.show{display:flex}
#real img,#real video{max-width:100%;max-height:100%;object-fit:contain}
</style>
</head>
<body>
<div id="disguise">${isDisguiseVideo ? `<video src="${disguiseSrc}" autoplay muted loop playsinline></video>` : `<img src="${disguiseSrc}" alt="">`}</div>
<div id="overlay"><button>Click to Load Content</button></div>
<div id="real">${isRealVideo ? `<video src="${realSrc}" controls autoplay muted playsinline></video>` : `<img src="${realSrc}" alt="">`}</div>
<noscript><meta http-equiv="refresh" content="0;url=${safeUrl || 'about:blank'}"></noscript>
${script}
</body>
</html>`
}

app.post('/api/cloaker/camouflage/media', authMiddleware, camoMediaUpload.fields([
  { name: 'real_media', maxCount: 1 },
  { name: 'disguise_media', maxCount: 1 },
]), async (req, res) => {
  const timer = setTimeout(() => {
    if (!res.headersSent) res.status(504).json({ erro: 'Tempo limite excedido. Tente com arquivos menores.' })
  }, 60000)

  function done(data, status = 200) { clearTimeout(timer); return res.status(status).json(data) }

  function cleanupDirs() {
    try { if (req.camoMediaDir) rmSync(req.camoMediaDir, { recursive: true, force: true }) } catch {}
    try { if (req._camoOutputDir) rmSync(req._camoOutputDir, { recursive: true, force: true }) } catch {}
  }

  try {
    const features = PLAN_FEATURES[req.user.plan]
    if (!features?.cloaker) return done({ erro: 'Disponivel apenas no plano Premium.' }, 403)

    const files = req.files || {}
    const realFile = Array.isArray(files['real_media']) ? files['real_media'][0] : undefined
    const disguiseFile = Array.isArray(files['disguise_media']) ? files['disguise_media'][0] : undefined
    const strategy = req.body.strategy
    const safeUrl = req.body.safe_url || ''

    if (!realFile || !disguiseFile) return done({ erro: 'Envie real_media e disguise_media.' }, 400)
    if (!['thumbnail_spoofing', 'click_to_reveal'].includes(strategy)) return done({ erro: 'Estrategia invalida.' }, 400)

    const dir = req.camoMediaDir
    const realPath = realFile.path
    const disguisePath = disguiseFile.path
    const id = randomUUID()

    // Edge case: same file
    if (realFile.size === disguiseFile.size && realFile.originalname === disguiseFile.originalname) {
      const cleanPath = await cleanFileMeta(realPath, realFile.mimetype)
      const ext = realFile.mimetype.startsWith('video/') ? 'mp4' : 'jpg'
      CAMO_MEDIA_OUTPUTS.set(id, cleanPath)
      setTimeout(() => { CAMO_MEDIA_OUTPUTS.delete(id); try { unlinkSync(cleanPath) } catch {} }, 300000)
      return done({ id, strategy, downloadUrl: `/api/cloaker/camouflage/media/download/${id}`, instructions: 'Arquivos identicos. Nenhuma modificacao aplicada.', fileName: `camouflage-${id}.${ext}` })
    }

    // Reject files too large for in-memory processing
    if (realFile.size > 100 * 1024 * 1024 || disguiseFile.size > 100 * 1024 * 1024) {
      return done({ erro: 'Arquivos muito grandes. Limite: 100MB por arquivo.' }, 400)
    }

    let downloadExt = 'zip'
    let effectiveStrategy = 'click_to_reveal'

    // thumbnail_spoofing via ffmpeg is unreliable; always use click_to_reveal
    const html = generateClickToRevealHTML(dir, realPath, disguisePath, realFile.mimetype, disguiseFile.mimetype, safeUrl)
    const htmlPath = join(dir, 'index.html')
    writeFileSync(htmlPath, html, 'utf-8')

    // zip em diretório separado para evitar recursão (não zipar o próprio zip)
    const outputBase = join('/tmp', 'metaspy-camo-output')
    if (!existsSync(outputBase)) mkdirSync(outputBase, { recursive: true })
    const outputDir = join(outputBase, id)
    mkdirSync(outputDir, { recursive: true })
    req._camoOutputDir = outputDir
    const zipPath = join(outputDir, `output-${id}.zip`)

    const archive = new ZipArchive({ zlib: { level: 6 } })
    const ws = createWriteStream(zipPath)
    await new Promise((resolve, reject) => {
      ws.on('finish', resolve)
      ws.on('error', reject)
      archive.on('error', reject)
      archive.pipe(ws)
      archive.directory(dir, false)
      archive.finalize()
    })

    CAMO_MEDIA_OUTPUTS.set(id, zipPath)
    setTimeout(() => {
      CAMO_MEDIA_OUTPUTS.delete(id)
      cleanupDirs()
    }, 300000)

    done({
      id, strategy: effectiveStrategy,
      downloadUrl: `/api/cloaker/camouflage/media/download/${id}`,
      instructions: 'Extraia o ZIP e hospede os arquivos em um servidor web. O conteudo seguro carrega imediatamente; o real aparece apos clique ou scroll.',
      fileName: `camouflage-${id}.${downloadExt}`,
    })
  } catch (erro) {
    clearTimeout(timer)
    cleanupDirs()
    logger.error({ err: erro }, 'Erro no camouflage media')
    res.status(500).json({ erro: 'Erro ao processar camuflagem de midia.' })
  }
})

app.get('/api/cloaker/camouflage/media/download/:id', authMiddleware, async (req, res) => {
  const blocked = checkFeature(req, res, 'cloaker')
  if (blocked) return blocked
  const filePath = CAMO_MEDIA_OUTPUTS.get(req.params.id)
  if (!filePath || !existsSync(filePath)) return res.status(404).json({ erro: 'Arquivo nao encontrado ou expirado.' })
  const ext = extname(filePath)
  const mime = ext === '.zip' ? 'application/zip' : mime.lookup(ext) || 'application/octet-stream'
  res.setHeader('Content-Type', mime)
  res.setHeader('Content-Disposition', `attachment; filename="camouflage-${req.params.id}${ext}"`)
  const stream = createReadStream(filePath)
  stream.on('error', () => { try { res.status(500).end() } catch {} })
  stream.pipe(res)
})

// ─── LSB Steganography Routes ───────────────────────────────────
app.post('/api/cloaker/steg/embed', authMiddleware, upload.single('image'), async (req, res) => {
  const blocked = checkFeature(req, res, 'cloaker')
  if (blocked) return blocked
  try {
    if (!req.file) return res.status(400).json({ erro: 'Imagem nao enviada.' })
    if (!req.file.mimetype.startsWith('image/')) return res.status(400).json({ erro: 'Envie uma imagem valida.' })

    const { message, secret_file } = req.body
    let secretData
    if (secret_file && req.file.buffer) {
      secretData = Buffer.from(req.file.buffer)
    } else if (message) {
      secretData = Buffer.from(message, 'utf-8')
    } else {
      return res.status(400).json({ erro: 'Envie uma mensagem ou arquivo secreto.' })
    }

    if (req.file.size < secretData.length * 8) {
      return res.status(400).json({ erro: 'Imagem muito pequena para o payload. Use uma imagem maior.' })
    }

    const stegoBuffer = embedLSB(req.file.buffer, secretData)
    const id = randomUUID()
    const stegoDir = join('/tmp', 'metaspy-steg')
    if (!existsSync(stegoDir)) mkdirSync(stegoDir, { recursive: true })
    const stegoPath = join(stegoDir, `stego-${id}${extname(req.file.originalname)}`)
    writeFileSync(stegoPath, stegoBuffer)

    res.json({
      id,
      fileName: `stego-${id}${extname(req.file.originalname)}`,
      originalSize: req.file.size,
      stegoSize: stegoBuffer.length,
      downloadUrl: `/api/cloaker/steg/download/${id}`,
      instructions: 'A imagem resultante contem os dados ocultos no canal Alpha. Baixe e distribua normalmente. Para extrair, use a ferramenta de extracao.',
    })
  } catch (erro) {
    logger.error({ err: erro }, 'Steg embed error')
    res.status(500).json({ erro: erro.message || 'Erro ao incorporar dados' })
  }
})

app.post('/api/cloaker/steg/extract', authMiddleware, upload.single('image'), async (req, res) => {
  const blocked = checkFeature(req, res, 'cloaker')
  if (blocked) return blocked
  try {
    if (!req.file) return res.status(400).json({ erro: 'Imagem nao enviada.' })
    if (!req.file.mimetype.startsWith('image/')) return res.status(400).json({ erro: 'Envie uma imagem valida.' })

    const extracted = extractLSB(req.file.buffer)
    if (!extracted) return res.status(400).json({ erro: 'Nenhum dado oculto encontrado ou chave invalida.' })

    const text = extracted.toString('utf-8')
    const isText = /^[\x20-\x7E\s\p{L}]/u.test(text)

    res.json({
      success: true,
      data: isText ? text : extracted.toString('base64'),
      format: isText ? 'text' : 'binary',
      sizeBytes: extracted.length,
    })
  } catch (erro) {
    logger.error({ err: erro }, 'Steg extract error')
    res.status(500).json({ erro: 'Erro ao extrair dados' })
  }
})

app.get('/api/cloaker/steg/download/:id', authMiddleware, async (req, res) => {
  const blocked = checkFeature(req, res, 'cloaker')
  if (blocked) return blocked
  const path = join('/tmp', 'metaspy-steg', `stego-${req.params.id}`)
  const files = existsSync(join('/tmp', 'metaspy-steg')) ? readdirSync(join('/tmp', 'metaspy-steg')) : []
  const match = files.find(f => f.startsWith(`stego-${req.params.id}`))
  if (!match) return res.status(404).json({ erro: 'Arquivo nao encontrado' })
  const filePath = join('/tmp', 'metaspy-steg', match)
  res.setHeader('Content-Type', mime.lookup(match) || 'image/png')
  res.setHeader('Content-Disposition', `attachment; filename="${match}"`)
  createReadStream(filePath).pipe(res)
})

// ─── Cloaker Campaign Engine ─────────────────────────────────────
app.post('/api/cloaker/campaign', authMiddleware, async (req, res) => {
  const blocked = checkFeature(req, res, 'cloaker')
  if (blocked) return blocked
  try {
    const { name, default_safe_url } = req.body
    if (!name || !default_safe_url) return res.status(400).json({ error: 'Nome e URL segura sao obrigatorios' })
    const id = randomUUID()
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    await run('INSERT INTO cloaker_campaigns (id, user_id, name, default_safe_url, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, req.user.id, name, default_safe_url, now, now])
    res.json({ id, name, default_safe_url, created_at: now })
  } catch { res.status(500).json({ error: 'Erro ao criar campanha' }) }
})

app.get('/api/cloaker/campaigns', authMiddleware, async (req, res) => {
  const blocked = checkFeature(req, res, 'cloaker')
  if (blocked) return blocked
  const campaigns = await query('SELECT id, name, default_safe_url, is_active, created_at FROM cloaker_campaigns WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id])
  res.json(campaigns)
})

app.post('/api/cloaker/campaign/:id/url', authMiddleware, async (req, res) => {
  const blocked = checkFeature(req, res, 'cloaker')
  if (blocked) return blocked
  try {
    const { url, weight, max_hits } = req.body
    if (!url) return res.status(400).json({ error: 'URL obrigatoria' })
    const urlId = await addUrlToPool(req.params.id, url, weight || 10, max_hits || null)
    res.json({ id: urlId, url, weight: weight || 10 })
  } catch { res.status(500).json({ error: 'Erro ao adicionar URL' }) }
})

app.put('/api/cloaker/campaign/:id', authMiddleware, async (req, res) => {
  const blocked = checkFeature(req, res, 'cloaker')
  if (blocked) return blocked
  try {
    const { name, default_safe_url, is_active } = req.body
    const existing = await one('SELECT id FROM cloaker_campaigns WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id])
    if (!existing) return res.status(404).json({ error: 'Campanha nao encontrada' })
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const sets = []
    const vals = []
    if (name !== undefined) { sets.push('name = $' + (vals.length + 1)); vals.push(name) }
    if (default_safe_url !== undefined) { sets.push('default_safe_url = $' + (vals.length + 1)); vals.push(default_safe_url) }
    if (is_active !== undefined) { sets.push('is_active = $' + (vals.length + 1)); vals.push(is_active ? 1 : 0) }
    if (sets.length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar' })
    sets.push('updated_at = $' + (vals.length + 1)); vals.push(now)
    vals.push(req.params.id)
    await run(`UPDATE cloaker_campaigns SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals)
    res.json({ ok: true })
  } catch { res.status(500).json({ error: 'Erro ao atualizar campanha' }) }
})

app.delete('/api/cloaker/campaign/:id', authMiddleware, async (req, res) => {
  const blocked = checkFeature(req, res, 'cloaker')
  if (blocked) return blocked
  try {
    const existing = await one('SELECT id FROM cloaker_campaigns WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id])
    if (!existing) return res.status(404).json({ error: 'Campanha nao encontrada' })
    await run('DELETE FROM url_pool_urls WHERE pool_id = $1', [req.params.id])
    await run('DELETE FROM redirect_logs WHERE campaign_id = $1', [req.params.id])
    await run('DELETE FROM cloaker_campaigns WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  } catch { res.status(500).json({ error: 'Erro ao excluir campanha' }) }
})

// Enhanced generate with fraud score script
app.post('/api/cloaker/generate-enhanced', authMiddleware, validate(cloakerSchema), async (req, res) => {
  const blocked = checkFeature(req, res, 'cloaker')
  if (blocked) return blocked
  try {
    const { target_url, safe_url } = req.body
    const id = randomUUID()
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const scriptCode = generateEnhancedCloakerScript(id, target_url, safe_url)
    await run('INSERT INTO cloaker_scripts (id, user_id, target_url, safe_url, script_code, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, req.user.id, target_url, safe_url, scriptCode, now])
    res.json({
      id, target_url, safe_url, script_code: scriptCode, created_at: now,
      version: 'enhanced',
      instructions: 'Script com sistema de pontuacao de fraude multi-camada. Bloqueia bots, headless browsers e scrapers.',
    })
  } catch { res.status(500).json({ error: 'Erro ao gerar script enhanced' }) }
})

// ─── SSE Logs Infrastructure ────────────────────────────────────
const sseClients = new Set()

function notifySSEClients(logEntry) {
  const msg = JSON.stringify(logEntry)
  for (const client of sseClients) {
    try { client.write(`data: ${msg}\n\n`) } catch { sseClients.delete(client) }
  }
}

// ─── Circuit Breaker ────────────────────────────────────────────
const circuitBreakerState = { failures: 0, lastFailure: 0, open: false }
const CIRCUIT_THRESHOLD = 5
const CIRCUIT_RESET_MS = 30000

function isCircuitOpen() {
  if (!circuitBreakerState.open) return false
  if (Date.now() - circuitBreakerState.lastFailure > CIRCUIT_RESET_MS) {
    circuitBreakerState.open = false
    circuitBreakerState.failures = 0
    return false
  }
  return true
}

function recordCircuitFailure() {
  circuitBreakerState.failures++
  circuitBreakerState.lastFailure = Date.now()
  if (circuitBreakerState.failures >= CIRCUIT_THRESHOLD) {
    circuitBreakerState.open = true
    logger.warn('Circuit breaker OPEN — falling back to safe page for all requests')
  }
}

// ─── Enhanced White Page (topic-based) ──────────────────────────
const WHITE_TOPICS = {
  tecnologia: {
    headlines: ['Inteligencia Artificial Transforma Setor de Tecnologia no Brasil', 'Startups Brasileiras Captam R$ 2 Bilhoes no Primeiro Trimestre', 'Novo Framework JavaScript Promete Revolucionar Desenvolvimento Web', '5G Impulsiona Internet das Coisas na Agricultura Nacional', 'Ciberseguranca: Empresas Investem em Protecao de Dados', 'Mercado de Cloud Computing Cresce 35% no Pais', 'Realidade Aumentada Ganha Espaco no Varejo Online'],
    paragraphs: ['O setor de tecnologia brasileiro vive um momento de expansao sem precedentes, impulsionado pela digitalizacao acelerada de empresas de todos os portes. Dados recentes apontam que os investimentos em inovacao alcancaram patamares historicos, consolidando o pais como um dos polos tecnologicos mais promissores da America Latina. Especialistas creditam esse crescimento ao amadurecimento do ecossistema de startups e ao aumento da conectividade.', 'Com a chegada do 5G e a expansao da fibra otica, novas possibilidades surgem para aplicacoes que exigem baixa latencia e alta capacidade de transmissao. Setores como saude, educacao e agronegocio ja comecam a colher os frutos dessa revolucao, com solucoes que antes pareciam distantes da realidade nacional. A tendencia e que nos proximos anos vejamos uma integracao ainda maior entre o mundo fisico e o digital.', 'Empresas de todos os segmentos estao repensando suas estrategias digitais para se manterem competitivas em um mercado cada vez mais exigente. A adocao de ferramentas baseadas em inteligencia artificial, automatizacao de processos e analise de dados deixou de ser diferencial para se tornar requisito basico de sobrevivencia corporativa. Os profissionais da area precisam se atualizar constantemente para acompanhar esse ritmo acelerado de mudancas.'],
    footnotes: ['Artigo atualizado em', 'Fonte: Observatorio de Tecnologia', 'Publicado originalmente em']
  },
  negocios: {
    headlines: ['Mercado Financeiro Projeta Crescimento de 3.5% para Economia', 'Pequenas e Medias Empresas Lideram Geracao de Empregos', 'Investimentos em Startup Brasileiras Aumentam 45%', 'Nova Lei Traz Mudancas na Tributacao de Empresas', 'Exportacoes Agricolas Batem Recorde no Primeiro Semestre', 'Selic Deve Encerrar Ano em Queda, Projetam Analistas'],
    paragraphs: ['O cenario economico brasileiro apresenta sinais de recuperacao consistente, com indicadores apontando para um crescimento sustentavel nos proximos meses. A combinacao de controle inflacionario, juros em trajetoria de queda e avanco das reformas estruturais tem gerado um ambiente mais favoravel para investimentos produtivos e geracao de empregos formais em diversas regiões do pais.', 'O empreendedorismo brasileiro continua demonstrando resiliencia e capacidade de inovacao. Milhares de novos negocios surgem a cada mes, impulsionados por programas de incentivo, acesso a credito e a digitalizacao dos processos comerciais. As micro e pequenas empresas ja representam a maior parte dos empregos formais gerados no pais, consolidando sua importancia estrategica para a economia nacional.', 'O mercado de capitais brasileiro atrai cada vez mais investidores estrangeiros interessados em oportunidades com bom potencial de retorno. A bolsa de valores registra sucessivos recordes de negociacao, refletindo a confianca do mercado nas perspectivas economicas do pais. Setores como agronegocio, energia renovavel e tecnologia lideram a preferencia dos investidores institucionais.'],
    footnotes: ['Dados atualizados em', 'Fonte: Banco Central do Brasil', 'Ultima actualizacao']
  },
  saude: {
    headlines: ['Pesquisadores Brasileiros Avancam em Nova Terapia Genetica', 'Telemedicina Revoluciona Atendimento no Interior do Pais', 'Alimentacao Saudavel: 5 Habitos que Transformam a Saude', 'Novos Protocolos de Prevencao Reduzem Internacoes em 30%', 'Saude Mental Ganha Atencao nas Empresas Brasileiras', 'Exercicio Fisico Regular Previne Doencas Cronicas', 'Tecnologia Vestivel Monitora Saude em Tempo Real'],
    paragraphs: ['A saude publica brasileira tem se beneficiado de avancos tecnologicos significativos nos ultimos anos. A implementacao de prontuarios eletronicos, sistemas de telemedicina e plataformas de agendamento online tem democratizado o acesso a cuidados medicos, especialmente em regioes remotas onde a presenca de especialistas e limitada. Essas inovacoes representam um salto qualitativo na atencao basica a saude.', 'Estudos recentes comprovam que a combinacao de alimentacao equilibrada, atividade fisica regular e acompanhamento medico preventivo pode reduzir significativamente a incidencia de doencas cronicas nao transmissiveis, como diabetes, hipertensao e obesidade. Especialistas recomendam a adocao de habitos saudaveis desde cedo como a melhor estrategia de prevencao e promocao da qualidade de vida.', 'A saude mental emergiu como uma das principais preocupacoes da sociedade contemporanea. Cada vez mais empresas implementam programas de apoio psicologico e politicas de bem-estar para seus funcionarios, reconhecendo que a saude emocional impacta diretamente a produtividade, o clima organizacional e a qualidade de vida no trabalho.'],
    footnotes: ['Revisao medica em', 'Fonte: Ministerio da Saude', 'Estudo publicado em']
  },
  educacao: {
    headlines: ['Ensino a Distancia Supera Presencial em Matriculas no Ensino Superior', 'Novo Programa de Bolsas Beneficia Estudantes de Baixa Renda', 'Metodologias Ativas Transformam Aprendizagem nas Escolas', 'Inteligencia Artificial Personaliza Ensino nas Universidades', 'Brasil Avanca em Ranking Internacional de Educacao', 'Cursos Tecnicos Ganham Espaco no Mercado de Trabalho'],
    paragraphs: ['A educacao brasileira passa por uma transformacao profunda impulsionada pela tecnologia e por novas metodologias de ensino. O crescimento do ensino a distancia, combinado com ferramentas interativas e plataformas adaptativas, tem permitido que milhares de estudantes tenham acesso a educacao de qualidade independentemente de sua localizacao geografica ou condicao socioeconomica.', 'Metodologias ativas de aprendizagem, como sala de aula invertida, aprendizagem baseada em projetos e gamificacao, ganham cada vez mais espaco nas instituicoes de ensino brasileiras. Essas abordagens colocam o aluno como protagonista do processo educativo, estimulando o pensamento critico, a criatividade e a capacidade de resolucao de problemas.', 'A formacao profissional tem se tornado cada vez mais relevante em um mercado de trabalho dinâmico e exigente. Cursos tecnicos e profissionalizantes oferecem uma alternativa rapida e eficaz para quem busca ingressar ou se recolocar no mercado, com taxas de empregabilidade que superam 70% nos primeiros meses apos a conclusao.'],
    footnotes: ['Dados do Censo Educacional', 'Fonte: MEC/INEP', 'Ultima atualizacao']
  }
}

function generateEnhancedWhitePage(seedStr, topic = 'tecnologia') {
  const seeds = WHITE_TOPICS[topic] || WHITE_TOPICS.tecnologia
  const seed = createHash('sha256').update(seedStr).digest().readUInt32BE(0)
  const rand = pseudoRandom(seed)
  const pick = (arr) => arr[Math.floor(rand() * arr.length)]
  const date = new Date(Date.now() - Math.floor(rand() * 1209600000))
  const dateStr = date.toLocaleDateString('pt-BR')
  const title = pick(seeds.headlines)
  const p1 = pick(seeds.paragraphs)
  const p2 = pick(seeds.paragraphs)
  const p3 = pick(seeds.paragraphs)
  const footnote = pick(seeds.footnotes)

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;background:#f9f9f9;max-width:720px;margin:0 auto;padding:20px}h1{font-size:24px;margin:20px 0 10px;color:#111}p{margin:12px 0;font-size:15px;color:#444}.meta{font-size:13px;color:#888;margin-bottom:20px}.footer{margin-top:30px;padding-top:15px;border-top:1px solid #ddd;font-size:12px;color:#999}
</style>
</head>
<body>
<h1>${title}</h1>
<div class="meta">Por Redacao &bull; ${dateStr}</div>
<p>${p1}</p>
<p>${p2}</p>
<p>${p3}</p>
<div class="footer"><p>${footnote} ${dateStr}</p></div>
</body>
</html>`
}

// ─── Logs Endpoint ──────────────────────────────────────────────
app.get('/api/cloaker/logs', authMiddleware, async (req, res) => {
  const blocked = checkFeature(req, res, 'cloaker')
  if (blocked) return blocked
  const limit = Math.min(parseInt(req.query.limit) || 100, 500)
  const logs = await query(
    'SELECT id, campaign_id, ip_hash as ip, user_agent, fraud_score as score, decision, redirect_url as url_destino, created_at FROM redirect_logs ORDER BY created_at DESC LIMIT $1',
    [limit]
  )
  const decMap = { bot: 'block', human: 'redirect', challenge: 'challenge', safe_page: 'safe_page' }
  res.json((logs || []).map(l => ({ ...l, score: l.score || 0, decision: decMap[l.decision] || l.decision })))
})

// SSE endpoint for live logs
app.get('/api/cloaker/logs/sse', (req, res) => {
  const token = req.query.token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null)
  if (!token) return res.status(401).end()
  try {
    jwt.verify(token, JWT_SECRET)
  } catch {
    return res.status(401).end()
  }
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  })
  res.write('data: {"connected":true}\n\n')
  sseClients.add(res)
  req.on('close', () => { sseClients.delete(res) })
})

// ─── Campaign URL Pool endpoint ─────────────────────────────────
app.get('/api/cloaker/campaign/:id/urls', authMiddleware, async (req, res) => {
  const blocked = checkFeature(req, res, 'cloaker')
  if (blocked) return blocked
  const urls = await query('SELECT id, url, weight, hit_count, max_hits FROM url_pool_urls WHERE pool_id = $1', [req.params.id])
  res.json(urls || [])
})

// ─── Rate limiter for public redirect endpoint ──────────────────
const redirectRateMap = new Map()
const REDIRECT_RATE_LIMIT = 50
const REDIRECT_RATE_WINDOW = 60000

function checkRedirectRateLimit(ip) {
  const now = Date.now()
  const entry = redirectRateMap.get(ip) || { count: 0, windowStart: now }
  if (now - entry.windowStart > REDIRECT_RATE_WINDOW) {
    entry.count = 0
    entry.windowStart = now
  }
  entry.count++
  redirectRateMap.set(ip, entry)
  return entry.count <= REDIRECT_RATE_LIMIT
}

// Periodic cleanup of expired rate limit entries (every 5 min)
setInterval(() => {
  const cutoff = Date.now() - REDIRECT_RATE_WINDOW
  for (const [ip, entry] of redirectRateMap) {
    if (entry.windowStart < cutoff) redirectRateMap.delete(ip)
  }
}, 300000)

// Public redirect endpoint: multi-stage chain
app.get('/go/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params
    const { signature, timestamp, nonce, target } = req.query
    const startTime = Date.now()
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '0.0.0.0'
    const ipHash = createHash('sha256').update(ip + HMAC_SECRET).digest('hex').slice(0, 16)

    // Rate limit: 50 req/min per IP
    if (!checkRedirectRateLimit(ip)) {
      return res.status(429).send(generateEnhancedWhitePage(`${ipHash}:429`, 'tecnologia'))
    }

    // Load campaign
    const campaign = await one('SELECT id, name, default_safe_url, is_active FROM cloaker_campaigns WHERE id = $1', [campaignId])
    if (!campaign) return res.status(404).send('Campaign not found')

    const defaultSafeUrl = campaign.default_safe_url || 'about:blank'

    // Circuit breaker check
    if (isCircuitOpen()) {
      return res.send(generateEnhancedWhitePage(`${campaignId}:circuit`, 'tecnologia'))
    }

    const ua = req.headers['user-agent'] || ''
    const headers = { 'user-agent': ua, 'accept-language': req.headers['accept-language'] || '', referer: req.headers['referer'] || '', via: req.headers['via'] || '', 'x-forwarded-for': req.headers['x-forwarded-for'] || '' }
    const fraudScore = calculateFraudScore(headers, ip, { country: req.headers['cf-ipcountry'] || '' })
    const elapsed = Date.now() - startTime

    // Validate HMAC if present, resolve target
    let finalTarget
    if (signature && timestamp && nonce && target) {
      const valid = verifyHMACSignature(campaignId, target, timestamp, nonce, signature)
      const timeDrift = Math.abs(Date.now() - parseInt(timestamp))
      if (!valid || timeDrift > 60000) {
        finalTarget = defaultSafeUrl
      } else {
        finalTarget = decodeURIComponent(target)
      }
    } else {
      // No HMAC — try URL pool, fall back to default_safe_url
      const poolUrl = await getNextUrlFromPool(campaignId)
      finalTarget = poolUrl || defaultSafeUrl
    }

    let decision = 'human'
    if (fraudScore >= 70) decision = 'bot'
    else if (fraudScore >= 40) decision = 'challenge'

    // Log and notify SSE
    const logId = randomUUID()
    run(`INSERT INTO redirect_logs (id, campaign_id, ip_hash, decision, fraud_score, redirect_url, user_agent, elapsed_ms, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [logId, campaignId, ipHash, decision, fraudScore, finalTarget, (ua || '').slice(0, 255), elapsed, new Date().toISOString()]
    ).then(() => {
      notifySSEClients({
        id: logId, campaign_id: campaignId, ip: ipHash, user_agent: (ua || '').slice(0, 80),
        score: fraudScore, decision: decision === 'bot' ? 'block' : decision === 'challenge' ? 'challenge' : 'redirect',
        url_destino: finalTarget, created_at: new Date().toISOString()
      })
    }).catch(() => {})

    if (fraudScore >= 70) {
      recordCircuitFailure()
      return res.send(generateEnhancedWhitePage(`${ipHash}:${campaignId}`, 'tecnologia'))
    }

    if (fraudScore >= 40) {
      return res.send(generateJSChallenge(campaignId, defaultSafeUrl, finalTarget))
    }

    // Human: redirect with honeypot meta-refresh page
    const honeypotLink = `${finalTarget}?ref=${ipHash}&h=1`
    const stage2Html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0;url=${finalTarget}">
<script>
window.location.replace(${JSON.stringify(finalTarget)});
</script>
<noscript><meta http-equiv="refresh" content="0;url=${finalTarget}"></noscript>
</head>
<body>
<p>Redirecionando...</p>
<a href="${honeypotLink}" style="display:none" rel="nofollow">.</a>
<div style="position:absolute;left:-9999px"><a href="${honeypotLink}" rel="nofollow">clique aqui</a></div>
</body>
</html>`
    res.send(stage2Html)
  } catch (err) {
    logger.error({ err }, 'Redirect error')
    recordCircuitFailure()
    res.status(500).send('Erro no redirecionamento')
  }
})

// Test fingerprint (for debugging)
app.post('/api/cloaker/fingerprint', authMiddleware, async (req, res) => {
  const blocked = checkFeature(req, res, 'cloaker')
  if (blocked) return blocked
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '0.0.0.0'
  const ua = req.headers['user-agent'] || ''
  const acceptLang = req.headers['accept-language'] || ''
  const referer = req.headers['referer'] || ''
  const via = req.headers['via'] || ''
  const xForwardedFor = req.headers['x-forwarded-for'] || ''
  const headers = { 'user-agent': ua, 'accept-language': acceptLang, referer, via, 'x-forwarded-for': xForwardedFor }

  const score = calculateFraudScore(headers, ip, { country: req.headers['cf-ipcountry'] || '' })
  const uaLower = ua.toLowerCase()
  const suspicious_reasons = []
  const details = {
    user_agent_mismatch: !(/windows|macintosh|linux|android|iphone|ipad/i.test(uaLower)),
    headless_chrome: /headlesschrome|headless/i.test(uaLower),
    missing_plugins: false,
    missing_mime_types: false,
    no_touch_support: false,
    webdriver_detected: /webdriver/i.test(uaLower),
    languages_mismatch: !!(acceptLang && req.headers['cf-ipcountry'] && !acceptLang.includes(req.headers['cf-ipcountry'])),
    inconsistent_platform: false,
    screen_anomaly: false,
    no_battery: false,
    missing_webgl: false,
    memory_anomaly: false,
    canvas_fingerprint: 'simulated',
    timezone_mismatch: false,
    storage_inconsistent: false,
  }

  if (score >= 70) suspicious_reasons.push('User-agent indicando bot/headless')
  if (!referer) suspicious_reasons.push('Sem referrer')
  if (/curl|python|wget|httpie/i.test(uaLower)) suspicious_reasons.push('UA de ferramenta de linha de comando')
  if (via || xForwardedFor.split(',').length > 2) suspicious_reasons.push('Proxy/VPN detectado via headers')
  if (details.languages_mismatch) suspicious_reasons.push('Idioma do navegador incompativel com pais de origem')
  if (score >= 40 && score < 70) suspicious_reasons.push('Comportamento misto — possivel browser automatizado')

  res.json({ score, suspicious_reasons, details })
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

// ─── Debug (protegido — apenas admin) ─────────────────────────────
const WEBHOOK_LOG = []

app.get('/api/debug/user', adminMiddleware, async (req, res) => {
  const { email } = req.query
  if (!email) return res.status(400).json({ error: '?email= obrigatorio' })
  try {
    const user = await one('SELECT id, name, email, plan, subscription_status, subscription_expiry, pending_plan, clones_used FROM users WHERE email = $1', [email.toString().toLowerCase().trim()])
    if (!user) return res.json({ error: 'Usuario nao encontrado' })
    res.json({ user })
  } catch { res.status(500).json({ error: 'Erro' }) }
})

app.get('/api/debug/webhooks', adminMiddleware, (req, res) => {
  res.json({ webhooks: WEBHOOK_LOG })
})


// ─── Health ───────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  })
})

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
  const blocked = checkFeature(req, res, 'cleaner')
  if (blocked) return blocked
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

app.post('/api/pages/upload', authMiddleware, async (req, res, next) => {
  const blocked = checkFeature(req, res, 'pagevault')
  if (blocked) return blocked
  if (req.user.plan === 'nenhum') {
    const count = await one('SELECT COUNT(*) AS cnt FROM pages WHERE user_id = $1 AND type = $2', [req.user.id, 'hosted'])
    if (count && count.cnt >= 1) return res.status(403).json({ error: 'Limite gratuito: 1 pagina. Faca upgrade para publicar mais paginas.' })
  }
  next()
}, uploadPage.array('files', 500), async (req, res) => {
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
      run('UPDATE pages SET html = $1 WHERE id = $2', [indexHtml, id]).catch(() => {})
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

// List hosted pages for the current user
app.get('/api/pages', authMiddleware, async (req, res) => {
  try {
    const rows = await query(`
      SELECT id, slug, title, type, published, cf_url, created_at, updated_at
      FROM pages WHERE user_id = $1 AND type = 'hosted'
      ORDER BY created_at DESC
    `, [req.user.id])
    const list = (rows || []).map(r => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      published: !!r.published,
      cfUrl: r.cf_url,
      url: r.published ? `https://centralspyads.netlify.app/p/${r.slug}` : null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }))
    res.json(list)
  } catch (err) {
    logger.error({ err }, 'Erro ao listar paginas')
    res.status(500).json({ error: 'Erro ao listar paginas.' })
  }
})

// Delete a hosted page
app.delete('/api/pages/:id', authMiddleware, async (req, res) => {
  try {
    const page = await one('SELECT id, slug, user_id FROM pages WHERE id = $1 AND type = $2', [req.params.id, 'hosted'])
    if (!page) return res.status(404).json({ error: 'Pagina nao encontrada.' })
    if (page.user_id !== req.user.id) return res.status(403).json({ error: 'Acesso negado.' })

    // Remove from R2
    if (USE_CF_STORAGE) {
      try { await deletePageFromR2(page.slug) } catch {}
    }

    // Remove from filesystem
    try {
      const pageDir = join(PAGES_DIR, page.slug)
      if (existsSync(pageDir)) {
        const rmDir = (dir) => {
          for (const entry of readdirSync(dir)) {
            const full = join(dir, entry)
            if (statSync(full).isDirectory()) rmDir(full)
            else unlinkSync(full)
          }
          try { unlinkSync(dir) } catch {}
        }
        rmDir(pageDir)
      }
    } catch {}

    // Remove from DB
    await run('DELETE FROM pages WHERE id = $1', [page.id])

    res.json({ success: true })
  } catch (err) {
    logger.error({ err }, 'Erro ao deletar pagina')
    res.status(500).json({ error: 'Erro ao deletar pagina.' })
  }
})

async function servePage(slug, fileName, res) {
  const mimeType = mime.lookup(fileName) || 'application/octet-stream'
  // Try R2 first
  if (USE_CF_STORAGE) {
    try {
      const r2Data = await getPageContentFromR2(slug, fileName)
      if (r2Data) {
        res.set('Content-Type', mimeType)
        res.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=600')
        res.set('X-Cache', 'R2-HIT')
        res.send(r2Data)
        return true
      }
    } catch {}
  }
  // Filesystem fallback
  const filePath = join(PAGES_DIR, slug, fileName)
  if (existsSync(filePath)) {
    try {
      const stat = statSync(filePath)
      if (stat.isFile()) {
        const data = readFileSync(filePath)
        res.set('Content-Type', mimeType)
        res.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=600')
        res.send(data)
        return true
      }
    } catch {}
  }
  return false
}

// Serve hosted page index.html
app.get('/api/page/:slug', async (req, res) => {
  try {
    const slug = req.params.slug.toLowerCase()
    const served = await servePage(slug, 'index.html', res)
    if (served) return
    const page = await one('SELECT html FROM pages WHERE slug = $1 AND published = 1', [slug])
    if (!page) return res.status(404).send('Pagina nao encontrada.')
    res.set('Content-Type', 'text/html; charset=utf-8')
    res.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=600')
    res.send(page.html || '')
  } catch (err) {
    logger.error({ err }, 'Erro ao servir pagina')
    res.status(500).send('Erro ao carregar pagina.')
  }
})

// Serve hosted page asset by path
app.get('/api/page/:slug/:path(*)', async (req, res) => {
  try {
    const slug = req.params.slug.toLowerCase()
    const assetPath = req.params.path
    if (!assetPath) return res.status(404).send('Caminho do arquivo nao especificado.')
    const served = await servePage(slug, assetPath, res)
    if (served) return
    res.status(404).send('Arquivo nao encontrado.')
  } catch (err) {
    logger.error({ err }, 'Erro ao servir arquivo')
    res.status(500).send('Erro ao carregar arquivo.')
  }
})

// ─── Error Handler ────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ erro: 'Arquivo muito grande. Maximo: 200MB.' })
  if (err?.message && /formato/i.test(err.message)) return res.status(400).json({ erro: err.message })
  logger.error({ err }, 'Erro nao tratado')
  res.status(500).json({ erro: 'Erro interno do servidor.' })
})

// ─── Start ───────────────────────────────────────────────────────
app.listen(PORT, async () => {
  // Redis init
  const redisClient = getRedis()
  if (redisClient) {
    try {
      await redisClient.connect()
      startWorker({
        CF_WORKER_URL: process.env.CF_WORKER_URL || 'https://metaspy-host.09santos-felipe.workers.dev',
        PORT,
        FB_TOKEN,
      })
      logger.info('[redis] conectado e worker iniciado')
    } catch (err) {
      logger.warn({ err: err.message }, '[redis] falha ao conectar')
    }
  }
  logger.info({ port: PORT, frontend: process.env.FRONTEND_URL || '*', kirvano: !!KIRVANO_API_KEY, facebook: !!FB_TOKEN, db: 'PostgreSQL', env: IS_RENDER ? 'Render' : 'dev', redis: !!redisClient }, 'MetaSpy Server iniciado')
})

// Keep-Alive: ping a cada 60s para evitar cold start no Render
// NOTA: Ping interno (localhost) NAO impede o Render de dormir.
// O Render free tier hiberna apos ~15min sem TRÁFEGO EXTERNO.
// Para manter ativo 24/7, configure um cron EXTERNO (ex: UptimeRobot.com - gratis)
// para pingar https://metaspy-saas.onrender.com/api/health a cada 5 minutos.
if (IS_RENDER) {
  const EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL || 'https://metaspy-saas.onrender.com'
  const KEEP_ALIVE_URL = process.env.KEEP_ALIVE_URL || `${EXTERNAL_URL}/api/health`
  setInterval(async () => {
    try {
      const resp = await fetch(KEEP_ALIVE_URL, { signal: AbortSignal.timeout(8000) })
      if (resp.ok) logger.debug({ url: KEEP_ALIVE_URL }, 'Keep-Alive OK')
    } catch { /* silent */ }
  }, 300000)
  logger.warn({ url: KEEP_ALIVE_URL }, 'Keep-Alive externo ativado (5min). AINDA ASSIM, Render free tier pode dormir sem cron externo. Configure UptimeRobot (gratis) para ping a cada 5min.')
}
