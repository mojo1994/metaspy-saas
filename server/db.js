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
    CREATE TABLE IF NOT EXISTS pages (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL DEFAULT 'Sem titulo',
      html TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'page',
      published INTEGER NOT NULL DEFAULT 0,
      cf_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_plan TEXT`).catch(() => {})
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified INTEGER NOT NULL DEFAULT 0`).catch(() => {})
  await pool.query(`ALTER TABLE email_codes ADD COLUMN IF NOT EXISTS metadata TEXT`).catch(() => {})
  await pool.query(`ALTER TABLE pages ADD COLUMN IF NOT EXISTS cf_url TEXT`).catch(() => {})

  // Pillar 1: Versioning
  await pool.query(`ALTER TABLE pages ADD COLUMN IF NOT EXISTS draft_ast TEXT`).catch(() => {})
  await pool.query(`ALTER TABLE pages ADD COLUMN IF NOT EXISTS published_ast TEXT`).catch(() => {})
  await pool.query(`ALTER TABLE pages ADD COLUMN IF NOT EXISTS version INT DEFAULT 1`).catch(() => {})
  await pool.query(`
    CREATE TABLE IF NOT EXISTS page_history (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL,
      ast_snapshot TEXT NOT NULL,
      snapshot_hash TEXT,
      created_at TEXT NOT NULL
    )
  `).catch(() => {})
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_page_history_page_id ON page_history(page_id)`).catch(() => {})
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_page_history_created ON page_history(created_at)`).catch(() => {})

  // Pillar 4: Media Assets
  await pool.query(`
    CREATE TABLE IF NOT EXISTS media_assets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INT NOT NULL DEFAULT 0,
      storage_path TEXT,
      thumbnail_path TEXT,
      uploaded_at TEXT NOT NULL,
      last_used_at TEXT,
      is_archived INT NOT NULL DEFAULT 0
    )
  `).catch(() => {})

  // Security: Idempotency keys for webhook
  await pool.query(`
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      key TEXT PRIMARY KEY,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `).catch(() => {})

  // Performance: Index on pages.slug for public queries
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_pages_slug ON pages(slug)`).catch(() => {})

  // Cloaker: Campaigns for URL pool / redirect engine
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cloaker_campaigns (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      default_safe_url TEXT NOT NULL,
      is_active INT NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).catch(() => {})
  await pool.query(`
    CREATE TABLE IF NOT EXISTS url_pool_urls (
      id TEXT PRIMARY KEY,
      pool_id TEXT NOT NULL,
      url TEXT NOT NULL,
      weight INT NOT NULL DEFAULT 10,
      hit_count INT NOT NULL DEFAULT 0,
      max_hits INT,
      is_active INT NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )
  `).catch(() => {})
  await pool.query(`
    CREATE TABLE IF NOT EXISTS redirect_logs (
      id TEXT PRIMARY KEY,
      campaign_id TEXT,
      user_id TEXT,
      ip_hash TEXT,
      ja4_hash TEXT,
      decision TEXT NOT NULL,
      fraud_score INT NOT NULL DEFAULT 0,
      redirect_url TEXT,
      geo_country TEXT,
      device TEXT,
      elapsed_ms INT,
      user_agent TEXT,
      created_at TEXT NOT NULL
    )
  `).catch(() => {})
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_redirect_logs_campaign ON redirect_logs(campaign_id, created_at DESC)`).catch(() => {})
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_url_pool_pool_id ON url_pool_urls(pool_id)`).catch(() => {})

  // Pillar 6: Form Submissions
  await pool.query(`
    CREATE TABLE IF NOT EXISTS form_submissions (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL,
      user_id TEXT,
      form_data TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL
    )
  `).catch(() => {})
  await pool.query(`
    CREATE TABLE IF NOT EXISTS webhook_failures (
      id TEXT PRIMARY KEY,
      submission_id TEXT NOT NULL,
      attempt_count INT NOT NULL DEFAULT 0,
      next_retry_at TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL
    )
  `).catch(() => {})
}
