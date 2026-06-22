import pkg from 'pg'
const { Pool } = pkg

let pool

export function initDb(connectionString) {
  const isRender = process.env.RENDER || process.env.NODE_ENV === 'production'
  pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
    ssl: isRender ? { rejectUnauthorized: false } : false,
  })
  pool.on('error', err => console.error('PostgreSQL pool error:', err.message))
  return pool
}

export function getPool() {
  return pool
}

export async function query(sql, params = []) {
  const { rows } = await pool.query(sql, params)
  return rows
}

export async function one(sql, params = []) {
  const { rows } = await pool.query(sql, params)
  return rows[0] || null
}

export async function run(sql, params = []) {
  const { rowCount } = await pool.query(sql, params)
  return { changes: rowCount }
}

export async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT 'nenhum',
      subscription_status TEXT NOT NULL DEFAULT 'inactive',
      subscription_id TEXT,
      subscription_expiry TEXT,
      pending_plan TEXT,
      clones_used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cloaker_scripts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      target_url TEXT NOT NULL,
      safe_url TEXT NOT NULL,
      script_code TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cloak_detections (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      url TEXT NOT NULL,
      tem_cloaking BOOLEAN NOT NULL,
      resultado_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS camouflage_scripts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      url_destino TEXT NOT NULL,
      script_code TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cleaned_assets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_size_bytes INTEGER NOT NULL,
      mime_type TEXT NOT NULL,
      cleaned_file_path TEXT NOT NULL,
      metadata_before TEXT,
      metadata_after TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS email_codes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'recovery',
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `)
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_plan TEXT`).catch(() => {})
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified INTEGER NOT NULL DEFAULT 0`).catch(() => {})
  await pool.query(`ALTER TABLE email_codes ADD COLUMN IF NOT EXISTS metadata TEXT`).catch(() => {})
}
