import { Queue, Worker } from 'bullmq'
import redis from './redis.js'

const FILA_NOME = 'thumbnail-extraction'

let queue = null
let worker = null

export function getQueue() {
  if (!redis) return null
  if (!queue) {
    queue = new Queue(FILA_NOME, { connection: redis })
  }
  return queue
}

export async function enqueueThumbnailExtraction(adId, snapshotUrl, linkUrl) {
  const q = getQueue()
  if (!q) return null
  const job = await q.add('extract', { adId, snapshotUrl, linkUrl }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 10000 },
    removeOnComplete: { age: 86400, count: 100 },
    removeOnFail: { age: 86400 },
  })
  return job.id
}

export function startWorker(env) {
  if (!redis || worker) return

  worker = new Worker(FILA_NOME, async job => {
    const { adId, snapshotUrl, linkUrl } = job.data
    console.log(`[thumbnail-worker] processando ${adId}...`)

    let imageUrl = null

    // Tenta Cloudflare Worker primeiro (Browser Run)
    if (env.CF_WORKER_URL) {
      try {
        const body = { snapshotUrl }
        if (linkUrl) body.linkUrl = linkUrl
        const resp = await fetch(`${env.CF_WORKER_URL}/api/ad-preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(30000),
        })
        if (resp.ok) {
          const data = await resp.json()
          if (data.imageUrl) imageUrl = data.imageUrl
        }
      } catch (e) { console.error(`[thumbnail] CF Worker falhou ${adId}:`, e?.message || e) }
    }

    // Fallback: Puppeteer local
    if (!imageUrl) {
      try {
        const resp = await fetch(`http://localhost:${env.PORT || 3001}/api/ad-snapshot-image?url=${encodeURIComponent(snapshotUrl)}`, {
          signal: AbortSignal.timeout(45000),
        })
        if (resp.ok) {
          const data = await resp.json()
          if (data.imageUrl) imageUrl = data.imageUrl
        }
      } catch (e) { console.error(`[thumbnail] Puppeteer local falhou ${adId}:`, e?.message || e) }
    }

    // Fallback: Graph API direct
    if (!imageUrl && adId && env.FB_TOKEN) {
      try {
        const params = new URLSearchParams({ access_token: env.FB_TOKEN, fields: 'ad_creative_thumbnail_url' })
        const resp = await fetch(`https://graph.facebook.com/v22.0/${adId}?${params.toString()}`, {
          signal: AbortSignal.timeout(15000),
        })
        if (resp.ok) {
          const data = await resp.json()
          if (data.ad_creative_thumbnail_url) imageUrl = data.ad_creative_thumbnail_url
        }
      } catch (e) { console.error(`[thumbnail] Graph API direta falhou ${adId}:`, e?.message || e) }
    }

    // Proxy the image through our own proxy to cache it
    if (imageUrl && imageUrl.includes('fbcdn')) {
      try {
        await fetch(`http://localhost:${env.PORT || 3001}/api/image-proxy?url=${encodeURIComponent(imageUrl)}`, {
          signal: AbortSignal.timeout(15000),
        })
      } catch (e) { console.error(`[thumbnail] proxy cache falhou ${adId}:`, e?.message || e) }
    }

    console.log(`[thumbnail-worker] ${adId}: ${imageUrl ? 'encontrada' : 'nao encontrada'}`)
    return { adId, imageUrl }
  }, {
    connection: redis,
    concurrency: 2,
    limiter: { max: 5, duration: 1000 },
  })

  worker.on('completed', job => {
    console.log(`[thumbnail-worker] job ${job.id} concluido`)
  })

  worker.on('failed', (job, err) => {
    console.error(`[thumbnail-worker] job ${job?.id} falhou:`, err.message)
  })

  console.log('[thumbnail-worker] worker iniciado')
}

export function stopWorker() {
  if (worker) {
    worker.close()
    worker = null
  }
  if (queue) {
    queue.close()
    queue = null
  }
}
