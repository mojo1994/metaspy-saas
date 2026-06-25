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

        // Strategy 1: Scrape OG meta tags from the snapshot page
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
            ],
          })
          for (const item of scraped) {
            const val = item.results?.[0]?.attributes?.find(a => a.name === 'content' || a.name === 'href')?.value
            if (val && /^https?:\/\//.test(val) && val.includes('fbcdn')) { imageUrl = val; break }
          }
        } catch {}

        // Strategy 2: Scrape OG image from the landing page (linkUrl)
        if (!imageUrl && linkUrl) {
          try {
            // First try simple HTTP fetch (faster, works if the page is static)
            const resp = await fetch(linkUrl, {
              headers: {
                'User-Agent': BROWSER_UA,
                'Accept': 'text/html',
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
              },
            })
            if (resp.ok) {
              const html = await resp.text()
              let m = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)
            if (m) {
              imageUrl = m[1].replace(/&amp;/g, '&')
            } else {
              m = html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i)
              if (m) imageUrl = m[1].replace(/&amp;/g, '&')
            }
            }
          } catch {}
          // Fall back to Browser Run for JS-heavy pages
          if (!imageUrl) {
            try {
              const scraped = await env.BROWSER.quickAction('scrape', {
                url: linkUrl,
                userAgent: BROWSER_UA,
                gotoOptions: { waitUntil: 'load', timeout: 15000 },
                bestAttempt: true,
                setJavaScriptEnabled: false,
                elements: [
                  { selector: "meta[property='og:image']" },
                  { selector: "meta[name='twitter:image']" },
                ],
              })
              for (const item of scraped) {
                const val = item.results?.[0]?.attributes?.find(a => a.name === 'content')?.value
                if (val && /^https?:\/\//.test(val)) { imageUrl = val; break }
              }
            } catch {}
          }
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
