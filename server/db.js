import pkg from 'pg'
const { Pool } = pkg

let pool

export function initDb(connectionString) {
  pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
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
  `)
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_plan TEXT`).catch(() => {})
}
