const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function extrairUrlImg(scraped) {
  for (const item of scraped) {
    if (!item.results?.length) continue
    for (const r of item.results) {
      if (!r.attributes?.length) continue
      if (item.selector.startsWith('img')) {
        const src = r.attributes.find(a => a.name === 'src')?.value
        if (src) return src
      } else if (item.selector.startsWith('link')) {
        const href = r.attributes.find(a => a.name === 'href')?.value
        if (href && href.startsWith('http')) return href
      } else {
        const content = r.attributes.find(a => a.name === 'content')?.value
        if (content && (content.startsWith('http://') || content.startsWith('https://') || content.startsWith('//'))) {
          return content.startsWith('//') ? 'https:' + content : content
        }
      }
    }
  }
  return null
}

function extrairUrlHtml(html) {
  const match = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)
  if (match) return match[1]
  const imgMatch = html.match(/<img[^>]+src="(https:[^"]*fbcdn[^"]+)"/i)
  if (imgMatch) return imgMatch[1]
  const jsonMatch = html.match(/"thumbnails":\s*\["([^"]+)"/)
  if (jsonMatch) return jsonMatch[1]
  return null
}

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const EXTRA_HEADERS = {
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  'Referer': 'https://www.facebook.com/',
  'Origin': 'https://www.facebook.com',
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const path = url.pathname

    if (path === '/api/ad-preview' && request.method === 'POST') {
      try {
        const { snapshotUrl } = await request.json()
        if (!snapshotUrl) {
          return new Response(JSON.stringify({ error: 'Missing snapshotUrl' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
        }

        let imageUrl = null

        // --- Strategy 1: scrape meta tags ---
        try {
          const scraped = await env.BROWSER.quickAction('scrape', {
            url: snapshotUrl,
            userAgent: BROWSER_UA,
            setExtraHTTPHeaders: EXTRA_HEADERS,
            gotoOptions: { waitUntil: 'networkidle2', timeout: 30000 },
            bestAttempt: true,
            elements: [
              { selector: "meta[property='og:image']" },
              { selector: "meta[name='twitter:image']" },
              { selector: "link[rel='image_src']" },
              { selector: "img[src*='fbcdn']" },
              { selector: "img[src*='facebook']" },
            ],
          })
          imageUrl = extrairUrlImg(scraped)
        } catch {}

        // --- Strategy 2: full HTML search ---
        if (!imageUrl) {
          try {
            const html = await env.BROWSER.quickAction('content', {
              url: snapshotUrl,
              userAgent: BROWSER_UA,
              setExtraHTTPHeaders: EXTRA_HEADERS,
              gotoOptions: { waitUntil: 'networkidle2', timeout: 30000 },
              bestAttempt: true,
            })
            imageUrl = extrairUrlHtml(html)
          } catch {}
        }

        return new Response(JSON.stringify({ imageUrl }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
      }
    }

    if (path === '/api/ad-preview' && request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS })
    }

    if (!path.startsWith('/p/')) {
      return new Response('Not found', { status: 404 })
    }

    const slugPath = path.slice(3)
    const slug = slugPath.split('/')[0]
    const filePath = slugPath.slice(slug.length) || '/index.html'
    const key = `pages/${slug}${filePath}`

    try {
      const object = await env.METASPY_BUCKET.get(key)
      if (object) {
        const headers = new Headers()
        object.writeHttpMetadata(headers)
        headers.set('Access-Control-Allow-Origin', '*')
        const cache = key.endsWith('/index.html') ? 'no-cache' : 'public, max-age=31536000, immutable'
        headers.set('Cache-Control', cache)
        return new Response(object.body, { headers })
      }

      if (filePath === '/index.html' && env.RENDER_ORIGIN) {
        const originUrl = `${env.RENDER_ORIGIN}/api/page/${slug}`
        const originRes = await fetch(originUrl, {
          headers: { 'User-Agent': 'CloudflareWorker/1.0', 'Accept': 'text/html' },
        })
        if (originRes.ok) {
          const html = await originRes.text()
          env.METASPY_BUCKET.put(key, html, {
            httpMetadata: { contentType: 'text/html; charset=utf-8' },
          }).catch(() => {})
          const headers = new Headers()
          headers.set('Content-Type', 'text/html; charset=utf-8')
          headers.set('Access-Control-Allow-Origin', '*')
          headers.set('Cache-Control', 'no-cache')
          headers.set('X-Cache', 'MISS')
          return new Response(html, { headers })
        }
      }

      return new Response('Not found', { status: 404 })
    } catch {
      return new Response('Internal error', { status: 500 })
    }
  },
}
