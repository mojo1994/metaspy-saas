import { createWriteStream, mkdirSync, existsSync } from 'node:fs'
import { join, dirname, extname } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const FETCH_TIMEOUT = 30000
const MAX_CONCURRENT = 5

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeout || FETCH_TIMEOUT)
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal })
    return resp
  } finally {
    clearTimeout(timer)
  }
}

function resolveUrl(base, href) {
  try {
    return new URL(href, base).href
  } catch {
    return null
  }
}

function extractResources(html, baseUrl) {
  const resources = []
  const links = []
  const srcsetImages = []

  const linkRegex = /<link[^>]+href=["']([^"']+)["'][^>]*>/gi
  let m
  while ((m = linkRegex.exec(html)) !== null) {
    const url = resolveUrl(baseUrl, m[1])
    if (url) links.push(url)
  }

  const scriptRegex = /<script[^>]+src=["']([^"']+)["'][^>]*>/gi
  while ((m = scriptRegex.exec(html)) !== null) {
    const url = resolveUrl(baseUrl, m[1])
    if (url) links.push(url)
  }

  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
  while ((m = imgRegex.exec(html)) !== null) {
    const url = resolveUrl(baseUrl, m[1])
    if (url) links.push(url)
  }

  const imgSrcsetRegex = /<img[^>]+srcset=["']([^"']+)["'][^>]*>/gi
  while ((m = imgSrcsetRegex.exec(html)) !== null) {
    const parts = m[1].split(',')
    for (const part of parts) {
      const urlStr = part.trim().split(/\s+/)[0]
      const url = resolveUrl(baseUrl, urlStr)
      if (url) srcsetImages.push(url)
    }
  }

  const sourceRegex = /<source[^>]+src=["']([^"']+)["'][^>]*>/gi
  while ((m = sourceRegex.exec(html)) !== null) {
    const url = resolveUrl(baseUrl, m[1])
    if (url) links.push(url)
  }

  const videoRegex = /<video[^>]+src=["']([^"']+)["'][^>]*>/gi
  while ((m = videoRegex.exec(html)) !== null) {
    const url = resolveUrl(baseUrl, m[1])
    if (url) links.push(url)
  }

  const bgImageRegex = /background-image:\s*url\(['"]?([^'")\s]+)['"]?\)/gi
  while ((m = bgImageRegex.exec(html)) !== null) {
    const url = resolveUrl(baseUrl, m[1])
    if (url) links.push(url)
  }

  const fontsRegex = /url\(['"]?([^'")\s]+)['"]?\)/gi
  while ((m = fontsRegex.exec(html)) !== null) {
    const url = resolveUrl(baseUrl, m[1])
    if (url) links.push(url)
  }

  return [...new Set([...links, ...srcsetImages])]
}

function rewriteHtmlPaths(html, baseUrl, fileMap) {
  let result = html

  for (const [original, local] of Object.entries(fileMap)) {
    const relativePath = local.split('/').filter(Boolean).join('/')
    const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    result = result.replace(new RegExp(escaped, 'g'), relativePath)
  }

  result = result.replace(/<base[^>]*>/gi, '')

  return result
}

async function downloadFile(url, outputPath) {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false

    const dir = dirname(outputPath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    const resp = await fetchWithTimeout(url)
    if (!resp.ok) return false

    const body = Readable.fromWeb(resp.body)
    const writeStream = createWriteStream(outputPath)
    await pipeline(body, writeStream)
    return true
  } catch {
    return false
  }
}

async function downloadSite(url, { outputDir, fbToken, deep = false } = {}) {
  const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url
  const parsedUrl = new URL(url)
  const domain = parsedUrl.hostname

  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  }

  if (fbToken) headers['Authorization'] = `Bearer ${fbToken}`

  const resp = await fetchWithTimeout(url, { headers })
  if (!resp.ok) throw new Error(`Falha ao baixar pagina: ${resp.status}`)

  let html = await resp.text()

  const resources = extractResources(html, baseUrl)

  const uniqueResources = [...new Set(resources)]
  const fileMap = {}

  let index = 0
  const queue = uniqueResources.map(resUrl => ({ url: resUrl, index: index++ }))

  const seen = new Set()
  const downloaded = []

  const pending = queue.slice(0, MAX_CONCURRENT)
  const remaining = queue.slice(MAX_CONCURRENT)

  async function processItem(item) {
    if (seen.has(item.url)) return
    seen.add(item.url)
    try {
      const parsed = new URL(item.url)
      let ext = extname(parsed.pathname) || '.html'
      if (!ext || ext === '.') ext = '.bin'
      const filename = `resource_${item.index}${ext}`
      const outputPath = join(outputDir, 'assets', filename)
      const success = await downloadFile(item.url, outputPath)
      if (success) {
        const relativePath = `assets/${filename}`
        fileMap[item.url] = relativePath
        downloaded.push({ url: item.url, path: relativePath })
      }
    } catch {}
  }

  await Promise.all(pending.map(processItem))
  for (const item of remaining) {
    await processItem(item)
  }

  html = rewriteHtmlPaths(html, baseUrl, fileMap)
  const htmlPath = join(outputDir, 'index.html')
  const { writeFileSync } = await import('node:fs')
  writeFileSync(htmlPath, html, 'utf-8')

  return { html, resources: downloaded, fileMap }
}

async function clonePage(url, { fbToken, userId } = {}) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  }
  if (fbToken) headers['Authorization'] = `Bearer ${fbToken}`

  const resp = await fetchWithTimeout(url, { headers })
  if (!resp.ok) throw new Error(`Falha ao baixar pagina: ${resp.status}`)

  const html = await resp.text()

  return {
    html,
    url,
    userId,
    timestamp: new Date().toISOString(),
  }
}

export { clonePage as default }
export { downloadSite, clonePage }
