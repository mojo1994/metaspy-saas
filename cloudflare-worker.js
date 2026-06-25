const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const path = url.pathname

    // Ad preview endpoint — uses Browser Run to extract ad image
    if (path === '/api/ad-preview' && request.method === 'POST') {
      try {
        const { snapshotUrl } = await request.json()
        if (!snapshotUrl) {
          return new Response(JSON.stringify({ error: 'Missing snapshotUrl' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
        }

        // Scrape og:image from the fully rendered Facebook Ads Library page
        const scraped = await env.BROWSER.quickAction('scrape', {
          url: snapshotUrl,
          elements: [
            { selector: "meta[property='og:image']", attribute: 'content' },
            { selector: "meta[name='twitter:image']", attribute: 'content' },
          ],
        })

        const imageUrl = scraped?.[0]?.content?.[0] || scraped?.[1]?.content?.[0] || null

        return new Response(JSON.stringify({ imageUrl }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
      }
    }

    if (path === '/api/ad-preview' && request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS })
    }

    // Existing R2 hosting logic
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

      // R2 miss — fallback to Render origin
      if (filePath === '/index.html' && env.RENDER_ORIGIN) {
        const originUrl = `${env.RENDER_ORIGIN}/api/page/${slug}`
        const originRes = await fetch(originUrl, {
          headers: {
            'User-Agent': 'CloudflareWorker/1.0',
            'Accept': 'text/html',
          },
        })

        if (originRes.ok) {
          const html = await originRes.text()

          // Cache in R2 for future requests
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
