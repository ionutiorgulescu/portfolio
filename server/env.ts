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

export const env = {
  SQLITE_PATH: resolveSqlitePath(),
  SESSION_SECRET: required('SESSION_SECRET'),
  SEED_EMAIL: required('SEED_EMAIL'),
  SEED_PASSWORD: required('SEED_PASSWORD'),
  SUPABASE_DB_URL: process.env.SUPABASE_DB_URL,
  PORT: Number(process.env.PORT) || 3000,
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  CORS_ORIGINS: resolveCorsOrigins(),
}
