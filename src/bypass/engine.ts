/**
 * MetaSpy Bypass Engine — Núcleo avançado de clonagem
 * Suporte: SSL, Cloudflare, Inlead, quizzes, paywalls
 * Estratégias: headless browser injection, polyfill de captcha, renderização full page
 */

export type BypassStrategy = 'standard' | 'headless' | 'dom-inject' | 'api-intercept' | 'hybrid'

export interface BypassOptions {
  url: string
  strategy: BypassStrategy
  cookies?: Record<string, string>
  headers?: Record<string, string>
  userAgent?: string
  proxy?: string
  waitForSelector?: string
  stripScripts?: boolean
  stripIframes?: boolean
  resolveJs?: boolean
  screenshot?: boolean
  timeout: number
}

export interface BypassResult {
  html: string
  status: number
  headers: Record<string, string>
  strategy: BypassStrategy
  resources: { css: string[]; js: string[]; images: string[] }
  elapsed: number
}

const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

export async function bypassFetch(opts: BypassOptions): Promise<BypassResult> {
  const start = performance.now()
  const { url, strategy, cookies, userAgent, headers, stripScripts, stripIframes, timeout } = opts

  const mergedHeaders: Record<string, string> = {
    'User-Agent': userAgent || DEFAULT_UA,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    ...headers,
  }

  if (cookies) {
    mergedHeaders['Cookie'] = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
  }

  let html: string
  let status = 200
  let responseHeaders: Record<string, string> = {}

  if (strategy === 'standard') {
    const resp = await fetch(`/api/page-fetch?url=${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(timeout)
    })
    status = resp.status
    html = await resp.text()
    resp.headers.forEach((v, k) => { responseHeaders[k] = v })
  } else {
    const resp = await fetch('/api/bypass', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        strategy,
        userAgent: mergedHeaders['User-Agent'],
        cookies,
        waitForSelector: opts.waitForSelector,
        stripScripts,
        stripIframes,
        resolveJs: opts.resolveJs,
        screenshot: opts.screenshot,
        proxy: opts.proxy,
        timeout
      }),
      signal: AbortSignal.timeout(timeout + 5000)
    })
    const data = await resp.json()
    status = data.status || 200
    html = data.html || ''
    responseHeaders = data.headers || {}
  }

  if (stripScripts) {
    html = html.replace(/<script[\s\S]*?<\/script>/gi, '')
  }
  if (stripIframes) {
    html = html.replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
  }

  const css: string[] = []
  const js: string[] = []
  const images: string[] = []

  const cssRe = /<link[^>]*href=["']([^"']+\.css[^"']*)["'][^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = cssRe.exec(html)) !== null) css.push(m[1])

  const jsRe = /<script[^>]*src=["']([^"']+)["'][^>]*>/gi
  while ((m = jsRe.exec(html)) !== null) js.push(m[1])

  const imgRe = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi
  while ((m = imgRe.exec(html)) !== null) images.push(m[1])

  const elapsed = performance.now() - start

  return { html, status, headers: responseHeaders, strategy, resources: { css, js, images }, elapsed }
}

export function detectStrategy(url: string, html?: string): BypassStrategy {
  const u = url.toLowerCase()
  if (u.includes('inlead') || u.includes('quiz')) return 'hybrid'
  if (html) {
    if (html.includes('__cf_chl') || html.includes('cf-browser-verification')) return 'headless'
    if (html.includes('recaptcha') || html.includes('hcaptcha')) return 'dom-inject'
  }
  return 'standard'
}

export const SCRIPTS = {
  python: `src/bypass/engine.py`,
  node: `src/bypass/engine.js`,
  php: `src/bypass/engine.php`,
}

export function getScriptContent(lang: 'python' | 'node' | 'php'): string {
  switch (lang) {
    case 'python': return `# engine.py — Python bypass\n# pip install requests beautifulsoup4\n# python engine.py <url> [--strategy headless] [--output ./clones]`
    case 'node': return `// engine.js — Node.js bypass\n// npm install node-fetch jsdom\n// node engine.js <url> [--strategy headless] [--output ./clones]`
    case 'php': return `<?php\n// engine.php — PHP bypass\n// php engine.php <url> [--strategy headless] [--output ./clones]`
  }
}
