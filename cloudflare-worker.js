const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
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
        const { snapshotUrl, linkUrl } = await request.json()
        if (!snapshotUrl) {
          return new Response(JSON.stringify({ error: 'Missing snapshotUrl' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
        }

        let imageUrl = null
        let debugInfo = {}

        // Strategy 1: scrape for og:image + large images
        try {
          const scraped = await env.BROWSER.quickAction('scrape', {
            url: snapshotUrl,
            userAgent: BROWSER_UA,
            setExtraHTTPHeaders: EXTRA_HEADERS,
            gotoOptions: { waitUntil: 'networkidle2', timeout: 45000 },
            bestAttempt: true,
            elements: [
              { selector: 'title' },
              { selector: "meta[property='og:image']" },
              { selector: "meta[name='twitter:image']" },
              { selector: "link[rel='image_src']" },
              { selector: 'img[src*="fbcdn"]' },
              { selector: 'img' },
            ],
          })
          // Check each result type
          for (const item of scraped) {
            if (!item.results?.length) continue
            const sel = item.selector
            for (const r of item.results) {
              if (sel === 'title' && r.text && /^https?:\/\//.test(r.text.trim())) {
                imageUrl = r.text.trim()
                break
              }
              if (r.attributes?.length) {
                const src = r.attributes.find(a => a.name === 'src')?.value
                const content = r.attributes.find(a => a.name === 'content')?.value
                const href = r.attributes.find(a => a.name === 'href')?.value
                const val = src || content || href
                if (val && /^https?:\/\//.test(val) && (val.includes('fbcdn') || val.includes('scontent') || sel.includes('og:image') || sel.includes('image_src'))) {
                  imageUrl = val
                  break
                }
              }
            }
            if (imageUrl) break
          }
        } catch (e) { debugInfo.scrapeError = e.message }

        // Strategy 2: try to get og:image from the link URL (landing page)
        if (!imageUrl && linkUrl) {
          try {
            const scraped = await env.BROWSER.quickAction('scrape', {
              url: linkUrl,
              setJavaScriptEnabled: false,
              gotoOptions: { waitUntil: 'load', timeout: 15000 },
              bestAttempt: true,
              elements: [
                { selector: "meta[property='og:image']" },
                { selector: "meta[name='twitter:image']" },
              ],
            })
            for (const item of scraped) {
              const content = item.results?.[0]?.attributes?.find(a => a.name === 'content')?.value
              if (content && /^https?:\/\//.test(content)) { imageUrl = content; break }
            }
          } catch (e) { debugInfo.linkError = e.message }
        }

        return new Response(JSON.stringify({ imageUrl }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
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
