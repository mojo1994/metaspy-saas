import { createWriteStream, mkdirSync, existsSync, writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, extname, basename } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { lookup } from 'node:dns/promises'
import { parseHTML } from 'linkedom'

const FETCH_TIMEOUT = 30000
const MAX_CONCURRENT = 8
const ALLOWED_PORTS = [80, 443]

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

function isPrivateIp(ip) {
  if (!ip) return true
  if (ip.includes(':')) {
    const low = ip.toLowerCase()
    if (low === '::1' || low === '::') return true
    if (low.startsWith('::ffff:')) {
      const rest = low.slice(7)
      if (rest.includes('.')) return isPrivateIp(rest)
      const groups = rest.split(':')
      if (groups.length === 2) {
        const hi = parseInt(groups[0], 16)
        const lo = parseInt(groups[1], 16)
        if (!Number.isNaN(hi) && !Number.isNaN(lo)) {
          return isPrivateIp(`${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`)
        }
      }
      return true
    }
    if (low.startsWith('fc') || low.startsWith('fd') || low.startsWith('fe80')) return true
    return false
  }
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true
  const [a, b] = parts
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  if (a >= 224) return true
  return false
}

// Protecao contra SSRF: valida protocolo, porta e destino (DNS + faixas privadas/loopback/link-local)
async function validateExternalUrl(rawUrl, { allowPorts = ALLOWED_PORTS } = {}) {
  let parsed
  try {
    parsed = new URL(String(rawUrl))
  } catch {
    return { ok: false, code: 'INVALID_URL', message: 'URL invalida.' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, code: 'INVALID_PROTOCOL', message: 'Apenas http:// ou https:// sao permitidos.' }
  }
  const port = parsed.port ? Number(parsed.port) : parsed.protocol === 'https:' ? 443 : 80
  if (!allowPorts.includes(port)) {
    return { ok: false, code: 'INVALID_PORT', message: `Porta nao permitida (${port}). Use 80 ou 443.` }
  }
  const host = parsed.hostname.replace(/^\[/, '').replace(/\]$/, '')
  const isIpLiteral = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')
  if (isIpLiteral) {
    if (isPrivateIp(host)) return { ok: false, code: 'BLOCKED_HOST', message: 'Destino nao permitido.' }
    return { ok: true, url: parsed.href }
  }
  try {
    const records = await lookup(host, { all: true })
    if (!records || records.length === 0) {
      return { ok: false, code: 'DNS_FAIL', message: 'Host nao encontrado.' }
    }
    for (const record of records) {
      if (isPrivateIp(record.address)) {
        return { ok: false, code: 'BLOCKED_HOST', message: 'Destino nao permitido.' }
      }
    }
  } catch {
    return { ok: false, code: 'DNS_FAIL', message: 'Host nao encontrado.' }
  }
  return { ok: true, url: parsed.href }
}

async function readBodyWithCharset(resp) {
  const buffer = Buffer.from(await resp.arrayBuffer())
  const contentType = resp.headers.get('content-type') || ''
  let charset = (contentType.match(/charset=([^;]+)/i) || [])[1]
  if (charset) charset = charset.trim().replace(/["']/g, '')
  if (!charset) {
    const head = buffer.subarray(0, 4096).toString('latin1')
    charset = (head.match(/charset=["']?([\w-]+)/i) || [])[1]
  }
  charset = (charset || 'utf-8').toLowerCase()
  try {
    return new TextDecoder(charset).decode(buffer)
  } catch {
    return buffer.toString('utf-8')
  }
}

const CSS_URL_RE = /url\(\s*(['"]?)([^'")\s]+)\1\s*\)/gi
const CSS_IMPORT_RE = /@import\s+(?:url\(\s*)?['"]([^'"]+)['"](?:\s*\))?\s*;?/gi
const CSS_FONT_RE = /src:\s*(?:local\([^)]+\)\s*,\s*)?url\(\s*(['"]?)([^'")\s]+)\1\s*\)/gi

const ASSET_FOLDER = 'assets'

const EXT_MAP = {
  '.css': 'css', '.js': 'js',
  '.jpg': 'img', '.jpeg': 'img', '.png': 'img', '.gif': 'img',
  '.svg': 'img', '.webp': 'img', '.ico': 'img', '.avif': 'img',
  '.bmp': 'img', '.tiff': 'img', '.tif': 'img',
  '.woff': 'fonts', '.woff2': 'fonts', '.ttf': 'fonts', '.otf': 'fonts', '.eot': 'fonts',
  '.mp4': 'media', '.webm': 'media', '.avi': 'media', '.mov': 'media',
  '.wmv': 'media', '.flv': 'media', '.mkv': 'media',
  '.mp3': 'media', '.wav': 'media', '.aac': 'media', '.flac': 'media',
  '.m4a': 'media', '.wma': 'media', '.ogg': 'media',
  '.json': 'data', '.xml': 'data', '.pdf': 'documents',
}

function getAssetType(url) {
  try {
    const p = new URL(url)
    const ext = extname(p.pathname).toLowerCase()
    return EXT_MAP[ext] || 'other'
  } catch {
    return 'other'
  }
}

function resolveUrl(base, href) {
  try {
    return new URL(href, base).href
  } catch {
    return null
  }
}

function isDataUri(url) {
  return typeof url === 'string' && url.startsWith('data:')
}

function isBlobUri(url) {
  return typeof url === 'string' && url.startsWith('blob:')
}

function isJavascriptUri(url) {
  return typeof url === 'string' && url.startsWith('javascript:')
}

function isMailtoUri(url) {
  return typeof url === 'string' && url.startsWith('mailto:')
}

function isValidResourceUrl(url) {
  if (!url || typeof url !== 'string') return false
  if (isDataUri(url) || isBlobUri(url) || isJavascriptUri(url) || isMailtoUri(url)) return false
  try {
    const p = new URL(url)
    return p.protocol === 'http:' || p.protocol === 'https:'
  } catch {
    return false
  }
}

function sanitizeFilename(name, maxLen = 120) {
  if (!name || name === '.') return 'file'
  let sanitized = name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/^\./, '')
    .trim()
  if (!sanitized) return 'file'
  if (sanitized.length > maxLen) {
    const ext = extname(sanitized)
    const base = basename(sanitized, ext)
    sanitized = base.slice(0, maxLen - ext.length) + ext
  }
  return sanitized
}

function filenameFromUrl(url) {
  try {
    const p = new URL(url)
    let name = basename(p.pathname)
    if (!name || name === '/' || name === '.') {
      name = p.hostname + '_' + Math.random().toString(36).slice(2, 6)
    }
    const qIndex = name.indexOf('?')
    if (qIndex !== -1) name = name.slice(0, qIndex)
    return sanitizeFilename(name)
  } catch {
    return 'resource_' + Math.random().toString(36).slice(2, 8)
  }
}

function uniqueFilename(usedNames, baseName, folder) {
  const key = folder ? `${folder}/${baseName}` : baseName
  if (!usedNames.has(key)) {
    usedNames.add(key)
    return baseName
  }
  const ext = extname(baseName)
  const stem = basename(baseName, ext)
  let counter = 1
  let candidate = `${stem}_${counter}${ext}`
  while (usedNames.has(folder ? `${folder}/${candidate}` : candidate)) {
    counter++
    candidate = `${stem}_${counter}${ext}`
  }
  usedNames.add(folder ? `${folder}/${candidate}` : candidate)
  return candidate
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeout || FETCH_TIMEOUT)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

// Retry unico com backoff em falha de rede; nao repete em 4xx
async function fetchWithRetry(url, options = {}) {
  const { retries = 1, ...rest } = options
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await fetchWithTimeout(url, rest)
      if (resp.status >= 400 && resp.status < 500) return resp
      if (resp.ok) return resp
      lastErr = new Error(`Falha ao baixar pagina: ${resp.status}`)
    } catch (err) {
      lastErr = err
    }
    if (attempt < retries) await delay(500 * (attempt + 1))
  }
  throw lastErr
}

function extractUrlsFromCssText(cssText, baseUrl) {
  const urls = []
  let m
  while ((m = CSS_URL_RE.exec(cssText)) !== null) {
    const resolved = resolveUrl(baseUrl, m[2])
    if (resolved) urls.push(resolved)
  }
  CSS_IMPORT_RE.lastIndex = 0
  while ((m = CSS_IMPORT_RE.exec(cssText)) !== null) {
    const resolved = resolveUrl(baseUrl, m[1])
    if (resolved) urls.push(resolved)
  }
  return [...new Set(urls)]
}

function extractResourceUrls(document, baseUrl) {
  const urls = new Set()

  function add(url) {
    const resolved = resolveUrl(baseUrl, url)
    if (resolved && isValidResourceUrl(resolved)) urls.add(resolved)
  }

  function addSrcset(srcset) {
    if (!srcset) return
    srcset.split(',').forEach(part => {
      const url = part.trim().split(/\s+/)[0]
      if (url) add(url)
    })
  }

  const selectors = [
    { el: 'link[rel="stylesheet"]', attr: 'href' },
    { el: 'link[rel="preload"][as="style"]', attr: 'href' },
    { el: 'link[rel="icon"]', attr: 'href' },
    { el: 'link[rel="shortcut icon"]', attr: 'href' },
    { el: 'link[rel="apple-touch-icon"]', attr: 'href' },
    { el: 'link[rel="apple-touch-icon-precomposed"]', attr: 'href' },
    { el: 'link[rel="preload"][href]', attr: 'href' },
    { el: 'link[rel="prefetch"][href]', attr: 'href' },
    { el: 'link[rel="dns-prefetch"][href]', attr: 'href' },
    { el: 'link[rel="manifest"]', attr: 'href' },
  ]
  for (const { el, attr } of selectors) {
    document.querySelectorAll(el).forEach(node => add(node.getAttribute(attr)))
  }

  document.querySelectorAll('script[src]').forEach(node => add(node.getAttribute('src')))

  document.querySelectorAll('img[src]').forEach(node => add(node.getAttribute('src')))
  document.querySelectorAll('img[data-src]').forEach(node => add(node.getAttribute('data-src')))
  document.querySelectorAll('img[data-lazy-src]').forEach(node => add(node.getAttribute('data-lazy-src')))
  document.querySelectorAll('img[data-original]').forEach(node => add(node.getAttribute('data-original')))
  document.querySelectorAll('img[data-url]').forEach(node => add(node.getAttribute('data-url')))
  document.querySelectorAll('img[data-lazy]').forEach(node => add(node.getAttribute('data-lazy')))
  document.querySelectorAll('img[data-echo]').forEach(node => add(node.getAttribute('data-echo')))
  document.querySelectorAll('img[data-load]').forEach(node => add(node.getAttribute('data-load')))

  document.querySelectorAll('img[srcset]').forEach(node => addSrcset(node.getAttribute('srcset')))

  document.querySelectorAll('source[src]').forEach(node => add(node.getAttribute('src')))
  document.querySelectorAll('source[srcset]').forEach(node => addSrcset(node.getAttribute('srcset')))

  document.querySelectorAll('video[src]').forEach(node => add(node.getAttribute('src')))
  document.querySelectorAll('video[poster]').forEach(node => add(node.getAttribute('poster')))
  document.querySelectorAll('audio[src]').forEach(node => add(node.getAttribute('src')))

  document.querySelectorAll('video source[src], audio source[src]').forEach(node => add(node.getAttribute('src')))

  document.querySelectorAll('iframe[src]').forEach(node => add(node.getAttribute('src')))
  document.querySelectorAll('object[data]').forEach(node => add(node.getAttribute('data')))
  document.querySelectorAll('embed[src]').forEach(node => add(node.getAttribute('src')))

  document.querySelectorAll('meta[property="og:image"]').forEach(node => add(node.getAttribute('content')))
  document.querySelectorAll('meta[property="og:image:secure_url"]').forEach(node => add(node.getAttribute('content')))
  document.querySelectorAll('meta[property="og:video"]').forEach(node => add(node.getAttribute('content')))
  document.querySelectorAll('meta[property="og:video:secure_url"]').forEach(node => add(node.getAttribute('content')))
  document.querySelectorAll('meta[property="og:audio"]').forEach(node => add(node.getAttribute('content')))
  document.querySelectorAll('meta[name="twitter:image"]').forEach(node => add(node.getAttribute('content')))
  document.querySelectorAll('meta[name="twitter:image:src"]').forEach(node => add(node.getAttribute('content')))

  document.querySelectorAll('[style]').forEach(node => {
    const styleText = node.getAttribute('style')
    if (styleText) {
      extractUrlsFromCssText(styleText, baseUrl).forEach(u => add(u))
    }
  })

  document.querySelectorAll('style').forEach(node => {
    const cssText = node.textContent
    if (cssText) {
      extractUrlsFromCssText(cssText, baseUrl).forEach(u => add(u))
    }
  })

  document.querySelectorAll('link[as="font"][href], link[as="image"][href], link[as="script"][href]').forEach(node => add(node.getAttribute('href')))

  return [...urls]
}

function extractInlineStylesToFiles(document, outputDir, usedNames) {
  const results = []
  const styleNodes = document.querySelectorAll('style')
  let counter = 0
  for (const node of styleNodes) {
    const cssText = node.textContent
    if (!cssText || !cssText.trim()) continue
    counter++
    const filename = uniqueFilename(usedNames, `inline_${counter}.css`, `${ASSET_FOLDER}/css`)
    const filePath = join(outputDir, ASSET_FOLDER, 'css', filename)
    const relativePath = `${ASSET_FOLDER}/css/${filename}`
    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, cssText, 'utf-8')

    const linkEl = document.createElement('link')
    linkEl.setAttribute('rel', 'stylesheet')
    linkEl.setAttribute('href', relativePath)
    if (node.getAttribute('media')) linkEl.setAttribute('media', node.getAttribute('media'))
    node.replaceWith(linkEl)

    results.push({ path: relativePath, content: cssText, originalNode: 'style' })
  }
  return results
}

function extractInlineScriptsToFiles(document, outputDir, usedNames) {
  const results = []
  const scriptNodes = document.querySelectorAll('script:not([src])')
  let counter = 0
  for (const node of scriptNodes) {
    const jsText = node.textContent
    if (!jsText || !jsText.trim()) continue
    counter++
    const filename = uniqueFilename(usedNames, `inline_${counter}.js`, `${ASSET_FOLDER}/js`)
    const filePath = join(outputDir, ASSET_FOLDER, 'js', filename)
    const relativePath = `${ASSET_FOLDER}/js/${filename}`
    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, jsText, 'utf-8')

    const newScript = document.createElement('script')
    newScript.setAttribute('src', relativePath)
    for (let i = 0; i < node.attributes.length; i++) {
      const attr = node.attributes[i]
      if (attr.name !== 'src') newScript.setAttribute(attr.name, attr.value)
    }
    node.replaceWith(newScript)

    results.push({ path: relativePath, content: jsText })
  }
  return results
}

async function downloadFile(url, outputPath) {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
    const check = await validateExternalUrl(url)
    if (!check.ok) return false
    const dir = dirname(outputPath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const resp = await fetchWithRetry(url, { retries: 0 })
    if (!resp.ok) return false
    const body = Readable.fromWeb(resp.body)
    const writeStream = createWriteStream(outputPath)
    await pipeline(body, writeStream)
    return true
  } catch {
    return false
  }
}

async function downloadResources(urls, baseUrl, outputDir, usedNames) {
  const fileMap = {}
  const uniqueUrls = [...new Set(urls)]

  const queue = uniqueUrls.map(url => ({ url }))
  const results = []
  const seen = new Set()

  async function processItem(item) {
    if (seen.has(item.url)) return
    seen.add(item.url)
    try {
      const type = getAssetType(item.url)
      const originalName = filenameFromUrl(item.url)
      const filename = uniqueFilename(usedNames, originalName, `${ASSET_FOLDER}/${type}`)
      const outputPath = join(outputDir, ASSET_FOLDER, type, filename)
      const success = await downloadFile(item.url, outputPath)
      if (success) {
        const relativePath = `${ASSET_FOLDER}/${type}/${filename}`
        fileMap[item.url] = relativePath
        results.push({ url: item.url, path: relativePath })
      }
    } catch {}
  }

  const pending = queue.slice(0, MAX_CONCURRENT)
  const remaining = queue.slice(MAX_CONCURRENT)
  await Promise.all(pending.map(processItem))
  for (const item of remaining) {
    await processItem(item)
  }

  return fileMap
}

function rewriteCssUrls(cssText, baseUrl, fileMap) {
  let result = cssText

  CSS_IMPORT_RE.lastIndex = 0
  result = result.replace(CSS_IMPORT_RE, (match, importUrl) => {
    const resolved = resolveUrl(baseUrl, importUrl)
    if (resolved && fileMap[resolved]) {
      return `@import '${fileMap[resolved]}';`
    }
    if (resolved && !isValidResourceUrl(resolved)) {
      return ''
    }
    return match
  })

  CSS_URL_RE.lastIndex = 0
  result = result.replace(CSS_URL_RE, (match, quote, urlPath) => {
    const resolved = resolveUrl(baseUrl, urlPath)
    if (resolved && fileMap[resolved]) {
      return `url('${fileMap[resolved]}')`
    }
    if (resolved && isDataUri(resolved)) {
      return match
    }
    return match
  })

  return result
}

function rewriteDownloadedCssFiles(fileMap, outputDir) {
  for (const [originalUrl, relativePath] of Object.entries(fileMap)) {
    if (!relativePath.startsWith('assets/css/')) continue
    const fullPath = join(outputDir, relativePath)
    if (!existsSync(fullPath)) continue
    try {
      const content = readFileSync(fullPath, 'utf-8')
      const baseUrl = originalUrl
      const rewritten = rewriteCssUrls(content, baseUrl, fileMap)
      writeFileSync(fullPath, rewritten, 'utf-8')
    } catch {}
  }
}

function rewriteHtmlPaths(document, fileMap, baseUrl) {
  function rewriteAttr(selector, attr) {
    document.querySelectorAll(selector).forEach(node => {
      const val = node.getAttribute(attr)
      if (!val) return
      if (isDataUri(val) || isBlobUri(val) || isJavascriptUri(val) || isMailtoUri(val)) return
      const localPath = fileMap[val]
      if (localPath) {
        node.setAttribute(attr, localPath)
      }
    })
  }

  rewriteAttr('link[href]', 'href')
  rewriteAttr('script[src]', 'src')
  rewriteAttr('img[src]', 'src')
  rewriteAttr('video[src]', 'src')
  rewriteAttr('video[poster]', 'poster')
  rewriteAttr('audio[src]', 'src')
  rewriteAttr('source[src]', 'src')
  rewriteAttr('iframe[src]', 'src')
  rewriteAttr('object[data]', 'data')
  rewriteAttr('embed[src]', 'src')

  document.querySelectorAll('img[srcset]').forEach(node => {
    const srcset = node.getAttribute('srcset')
    if (!srcset) return
    const parts = srcset.split(',').map(part => {
      const trimmed = part.trim()
      const url = trimmed.split(/\s+/)[0]
      const local = fileMap[url]
      if (local) return trimmed.replace(url, local)
      return trimmed
    })
    node.setAttribute('srcset', parts.join(', '))
  })

  document.querySelectorAll('source[srcset]').forEach(node => {
    const srcset = node.getAttribute('srcset')
    if (!srcset) return
    const parts = srcset.split(',').map(part => {
      const trimmed = part.trim()
      const url = trimmed.split(/\s+/)[0]
      const local = fileMap[url]
      if (local) return trimmed.replace(url, local)
      return trimmed
    })
    node.setAttribute('srcset', parts.join(', '))
  })

  if (baseUrl) {
    document.querySelectorAll('[style]').forEach(node => {
      const styleText = node.getAttribute('style')
      if (!styleText) return
      const rewritten = rewriteCssUrls(styleText, baseUrl, fileMap)
      node.setAttribute('style', rewritten)
    })
  }
}

async function downloadSite(url, { outputDir, fbToken, deep = false } = {}) {
  const check = await validateExternalUrl(url)
  if (!check.ok) {
    const err = new Error(check.message)
    err.code = check.code
    throw err
  }

  const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url

  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  }
  if (fbToken) headers['Authorization'] = `Bearer ${fbToken}`

  const resp = await fetchWithRetry(url, { headers })
  if (!resp.ok) throw new Error(`Falha ao baixar pagina: ${resp.status}`)

  const html = await readBodyWithCharset(resp)

  const { document } = parseHTML(html)

  const metaBase = document.querySelector('base[href]')
  const effectiveBaseUrl = metaBase ? resolveUrl(baseUrl, metaBase.getAttribute('href')) || baseUrl : baseUrl

  const usedNames = new Set()

  const inlineCssResults = extractInlineStylesToFiles(document, outputDir, usedNames)
  const inlineJsResults = extractInlineScriptsToFiles(document, outputDir, usedNames)

  const resourceUrls = extractResourceUrls(document, effectiveBaseUrl)

  for (const cssRes of inlineCssResults) {
    const refs = extractUrlsFromCssText(cssRes.content, effectiveBaseUrl)
    for (const ref of refs) resourceUrls.push(ref)
  }

  const allUrls = [...new Set(resourceUrls.filter(u => isValidResourceUrl(u)))]

  mkdirSync(join(outputDir, ASSET_FOLDER, 'css'), { recursive: true })
  mkdirSync(join(outputDir, ASSET_FOLDER, 'js'), { recursive: true })
  mkdirSync(join(outputDir, ASSET_FOLDER, 'img'), { recursive: true })
  mkdirSync(join(outputDir, ASSET_FOLDER, 'fonts'), { recursive: true })
  mkdirSync(join(outputDir, ASSET_FOLDER, 'media'), { recursive: true })
  mkdirSync(join(outputDir, ASSET_FOLDER, 'other'), { recursive: true })

  const fileMap = await downloadResources(allUrls, effectiveBaseUrl, outputDir, usedNames)

  rewriteDownloadedCssFiles(fileMap, outputDir)

  for (const cssRes of inlineCssResults) {
    const fullPath = join(outputDir, cssRes.path)
    if (existsSync(fullPath)) {
      const content = readFileSync(fullPath, 'utf-8')
      const baseUrlForCss = effectiveBaseUrl
      const rewritten = rewriteCssUrls(content, baseUrlForCss, fileMap)
      writeFileSync(fullPath, rewritten, 'utf-8')
    }
  }

  const baseTag = document.querySelector('base')
  if (baseTag) baseTag.remove()

  rewriteHtmlPaths(document, fileMap, effectiveBaseUrl)

  const doctype = html.trim().startsWith('<!') ? '' : '<!DOCTYPE html>\n'
  const finalHtml = doctype + document.toString()
  writeFileSync(join(outputDir, 'index.html'), finalHtml, 'utf-8')

  const resources = Object.entries(fileMap).map(([url, path]) => ({ url, path }))

  return { html: finalHtml, resources, fileMap }
}

function buildFileTree(dirPath, basePath = '') {
  const entries = readdirSync(dirPath, { withFileTypes: true })
  const items = []
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const fullPath = join(dirPath, entry.name)
    const stats = statSync(fullPath)
    const relPath = basePath ? `${basePath}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      items.push({
        name: entry.name,
        type: 'directory',
        path: relPath,
        size: stats.size,
        children: buildFileTree(fullPath, relPath),
      })
    } else {
      items.push({ name: entry.name, type: 'file', path: relPath, size: stats.size })
    }
  }
  items.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return items
}

async function clonePage(url, { fbToken, userId } = {}) {
  const check = await validateExternalUrl(url)
  if (!check.ok) {
    const err = new Error(check.message)
    err.code = check.code
    throw err
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  }
  if (fbToken) headers['Authorization'] = `Bearer ${fbToken}`

  const resp = await fetchWithRetry(url, { headers })
  if (!resp.ok) throw new Error(`Falha ao baixar pagina: ${resp.status}`)

  const html = await readBodyWithCharset(resp)

  return {
    html,
    url,
    userId,
    timestamp: new Date().toISOString(),
  }
}

export { clonePage as default }
export { downloadSite, clonePage, buildFileTree, validateExternalUrl }
