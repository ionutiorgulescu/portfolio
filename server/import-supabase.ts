import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import postgres from 'postgres'
import { db } from './db'
import { portfolios, positions, users } from './db/schema'
import { env } from './env'

const BCRYPT_ROUNDS = 12
const INSERT_CHUNK_SIZE = 100

type AuthUserRow = {
  id: string
  email: string
  created_at: Date
}

type PortfolioRow = {
  id: string
  user_id: string
  name: string
  description: string | null
  created_at: Date
  updated_at: Date
}

type PositionRow = {
  id: string
  ticker_symbol: string
  asset_name: string
  quantity: unknown
  price: unknown
  buy_date: string
  currency: string
  status: string
  transaction_type: string
  portfolio_id: string
  user_id: string
  created_at: Date
  updated_at: Date
}

function requireSupabaseDbUrl(): string {
  const value = env.SUPABASE_DB_URL?.trim()
  if (!value) {
    throw new Error('SUPABASE_DB_URL is required in server/.env')
  }
  return value
}

function postgresSsl(url: string): 'require' | false {
  try {
    const parsed = new URL(url)
    const sslmode = parsed.searchParams.get('sslmode')
    if (sslmode === 'disable') return false
    const host = parsed.hostname
    if (host === 'localhost' || host === '127.0.0.1') return false
    return 'require'
  } catch {
    return 'require'
  }
}

function toDate(value: Date | string | number, label: string): Date {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${label}`)
  }
  return date
}

function toNumber(value: unknown, label: string): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${label}: ${String(value)}`)
  }
  return parsed
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size))
  }
  return batches
}

async function main(): Promise<void> {
  const supabaseDbUrl = requireSupabaseDbUrl()
  const email = env.SEED_EMAIL.trim().toLowerCase()
  const sql = postgres(supabaseDbUrl, {
    max: 1,
    prepare: false,
    ssl: postgresSsl(supabaseDbUrl),
  })

  try {
    const [authUser] = await sql<AuthUserRow[]>`
      select id::text as id, email, created_at
      from auth.users
      where lower(email) = ${email}
      limit 1
    `

    if (!authUser) {
      throw new Error(`No auth.users row found for ${email}`)
    }

    const pgPortfolios = await sql<PortfolioRow[]>`
      select
        id::text as id,
        user_id::text as user_id,
        name,
        description,
        created_at,
        updated_at
      from public.portfolios
      where user_id = ${authUser.id}
      order by created_at
    `

    const pgPositions = await sql<PositionRow[]>`
      select
        id::text as id,
        ticker_symbol,
        asset_name,
        quantity,
        price,
        to_char(buy_date, 'YYYY-MM-DD') as buy_date,
        currency,
        status,
        transaction_type,
        portfolio_id::text as portfolio_id,
        user_id::text as user_id,
        created_at,
        updated_at
      from public.positions
      where user_id = ${authUser.id}
      order by buy_date desc, created_at desc
    `

    const passwordHash = await bcrypt.hash(env.SEED_PASSWORD, BCRYPT_ROUNDS)
    const userId = authUser.id
    const createdAt = toDate(authUser.created_at, 'auth.users.created_at')

    const portfolioValues = pgPortfolios.map((row) => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      createdAt: toDate(row.created_at, `portfolios.created_at (${row.id})`),
      updatedAt: toDate(row.updated_at, `portfolios.updated_at (${row.id})`),
    }))

    const positionValues = pgPositions.map((row) => ({
      id: row.id,
      tickerSymbol: row.ticker_symbol,
      assetName: row.asset_name,
      quantity: toNumber(row.quantity, `positions.quantity (${row.id})`),
      price: toNumber(row.price, `positions.price (${row.id})`),
      buyDate: row.buy_date,
      currency: row.currency,
      status: row.status,
      transactionType: row.transaction_type,
      portfolioId: row.portfolio_id,
      userId: row.user_id,
      createdAt: toDate(row.created_at, `positions.created_at (${row.id})`),
      updatedAt: toDate(row.updated_at, `positions.updated_at (${row.id})`),
    }))

    db.transaction((tx) => {
      const existingByEmail = tx.select().from(users).where(eq(users.email, email)).get()
      if (existingByEmail && existingByEmail.id !== userId) {
        tx.delete(users).where(eq(users.id, existingByEmail.id)).run()
      }

      tx.insert(users)
        .values({ id: userId, email, passwordHash, createdAt })
        .onConflictDoUpdate({
          target: users.id,
          set: { email, passwordHash, createdAt },
        })
        .run()

      tx.delete(positions).where(eq(positions.userId, userId)).run()
      tx.delete(portfolios).where(eq(portfolios.userId, userId)).run()

      for (const batch of chunk(portfolioValues, INSERT_CHUNK_SIZE)) {
        tx.insert(portfolios).values(batch).run()
      }

      for (const batch of chunk(positionValues, INSERT_CHUNK_SIZE)) {
        tx.insert(positions).values(batch).run()
      }
    })

    console.log(`Imported ${email} (${userId})`)
    console.log(`  portfolios: ${portfolioValues.length}`)
    console.log(`  positions: ${positionValues.length}`)
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
