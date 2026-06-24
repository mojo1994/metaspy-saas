import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { join, dirname } from 'node:path'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN
const BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET || 'metaspy-pages'
const PAGES_WORKER_HOST = process.env.PAGES_WORKER_HOST || 'metaspy-host.09santos-felipe.workers.dev'

export function getWorkerUrl(slug) {
  return `https://${PAGES_WORKER_HOST}/p/${slug}`
}

let s3Client = null

function getS3Client() {
  if (!s3Client) {
    if (!ACCOUNT_ID || !API_TOKEN) {
      throw new Error('CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_API_TOKEN sao obrigatorios')
    }
    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: API_TOKEN,
        secretAccessKey: API_TOKEN,
      },
    })
  }
  return s3Client
}

export async function uploadPageToR2(slug, files) {
  const client = getS3Client()
  for (const { path, buffer, contentType } of files) {
    const key = `pages/${slug}/${path}`
    await client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType || 'application/octet-stream',
    }))
  }
}

export async function downloadPageFromR2(slug, pagesDir) {
  const client = getS3Client()
  let continuationToken
  let found = false
  do {
    const list = await client.send(new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: `pages/${slug}/`,
      ContinuationToken: continuationToken,
    }))
    for (const obj of list.Contents || []) {
      const key = obj.Key
      const relativePath = key.slice(`pages/${slug}/`.length)
      if (!relativePath) continue
      const getResult = await client.send(new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      }))
      const chunks = []
      for await (const chunk of getResult.Body) chunks.push(chunk)
      const buffer = Buffer.concat(chunks)
      const filePath = join(pagesDir, slug, relativePath)
      mkdirSync(dirname(filePath), { recursive: true })
      writeFileSync(filePath, buffer)
      found = true
    }
    continuationToken = list.NextContinuationToken
  } while (continuationToken)
  return found
}

export async function getPageContentFromR2(slug, filePath = 'index.html') {
  const client = getS3Client()
  try {
    const key = `pages/${slug}/${filePath}`
    const result = await client.send(new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    }))
    const chunks = []
    for await (const chunk of result.Body) chunks.push(chunk)
    return Buffer.concat(chunks)
  } catch (err) {
    if (err.name === 'NoSuchKey') return null
    throw err
  }
}

export async function deletePageFromR2(slug) {
  const client = getS3Client()
  try {
    const listed = await client.send(new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: `pages/${slug}/`,
    }))
    const objects = (listed.Contents || []).map(o => ({ Key: o.Key }))
    if (objects.length === 0) return
    await client.send(new DeleteObjectsCommand({
      Bucket: BUCKET_NAME,
      Delete: { Objects: objects },
    }))
  } catch {}
}
