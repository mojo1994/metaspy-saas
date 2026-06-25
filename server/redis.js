import Redis from 'ioredis'

let redis = null

if (process.env.REDIS_URL) {
  try {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy(times) {
        const delay = Math.min(times * 200, 2000)
        return delay
      },
      lazyConnect: true,
    })
    console.log('[redis] cliente configurado')
  } catch (err) {
    console.error('[redis] erro ao configurar:', err.message)
  }
}

export function getRedis() {
  return redis
}

export async function cacheGet(key) {
  if (!redis) return null
  try {
    const val = await redis.get(key)
    return val ? JSON.parse(val) : null
  } catch { return null }
}

export async function cacheSet(key, value, ttl = 300) {
  if (!redis) return
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttl)
  } catch {}
}

export async function cacheDel(key) {
  if (!redis) return
  try { await redis.del(key) } catch {}
}

export default redis
