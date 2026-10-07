import { config } from 'dotenv'
import { dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const serverDir = dirname(fileURLToPath(import.meta.url))

config({ path: join(serverDir, '.env') })

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is required`)
  }
  return value
}

function resolveSqlitePath(): string {
  const raw = process.env.SQLITE_PATH
  if (!raw) {
    return join(serverDir, 'data', 'portfolio.db')
  }
  return isAbsolute(raw) ? raw : join(serverDir, raw)
}

function resolveCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGIN
  if (raw?.trim()) {
    return raw.split(',').map((origin) => origin.trim()).filter(Boolean)
  }
  return ['http://localhost:3000', 'http://127.0.0.1:3000']
}

function resolveSmtp() {
  const host = process.env.SMTP_HOST?.trim()
  if (!host) {
    return null
  }
  const port = Number(process.env.SMTP_PORT) || 587
  return {
    host,
    port,
    // 465 is implicit TLS; other ports upgrade with STARTTLS.
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: required('MAIL_FROM'),
  }
}

export const env = {
  SQLITE_PATH: resolveSqlitePath(),
  SESSION_SECRET: required('SESSION_SECRET'),
  SUPABASE_DB_URL: process.env.SUPABASE_DB_URL,
  PORT: Number(process.env.PORT) || 3000,
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  CORS_ORIGINS: resolveCorsOrigins(),
  ALLOW_REGISTRATION: process.env.ALLOW_REGISTRATION === 'true',
  // Set when a reverse proxy sits in front of the API so rate limits use the client IP from X-Forwarded-For.
  TRUST_PROXY: process.env.TRUST_PROXY === 'true',
  SMTP: resolveSmtp(),
}

if (env.ALLOW_REGISTRATION && env.NODE_ENV === 'production' && !env.SMTP) {
  throw new Error('SMTP_HOST is required when ALLOW_REGISTRATION=true in production')
}
