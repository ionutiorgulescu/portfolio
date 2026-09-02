import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { defineConfig } from 'drizzle-kit'
import { env } from './env'

mkdirSync(dirname(env.SQLITE_PATH), { recursive: true })

export default defineConfig({
  dialect: 'sqlite',
  schema: './db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: env.SQLITE_PATH,
  },
})
