export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const path = url.pathname

    if (!path.startsWith('/p/')) {
      return new Response('Not found', { status: 404 })
    }

    const slugPath = path.slice(3)
    const slug = slugPath.split('/')[0]
    const filePath = slugPath.slice(slug.length) || '/index.html'
    const key = `pages/${slug}${filePath}`

    try {
      const object = await env.METASPY_BUCKET.get(key)
      if (!object) {
        return new Response('Not found', { status: 404 })
      }

      const headers = new Headers()
      object.writeHttpMetadata(headers)
      headers.set('Access-Control-Allow-Origin', '*')

      const cache = key.endsWith('/index.html') ? 'no-cache' : 'public, max-age=31536000, immutable'
      headers.set('Cache-Control', cache)

      return new Response(object.body, { headers })
    } catch {
      return new Response('Internal error', { status: 500 })
    }
  },
}
