import { and, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { requireAuth, type AuthEnv } from './auth'
import { db } from './db'
import { portfolios, positions } from './db/schema'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const BUY_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const CURRENCIES = new Set(['USD', 'RON', 'EUR'])
const STATUSES = new Set(['buy', 'sell'])
const TRANSACTION_TYPES = new Set(['stock', 'crypto', 'etf'])

type PositionRow = typeof positions.$inferSelect

type PositionFields = {
  tickerSymbol: string
  assetName: string
  quantity: number
  price: number
  buyDate: string
  currency: string
  status: string
  transactionType: string
  portfolioId: string
}

function parseJsonBody(body: unknown): Record<string, unknown> | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return null
  }
  return body as Record<string, unknown>
}

function toIso(value: Date | number): string {
  if (value instanceof Date) return value.toISOString()
  return new Date(value).toISOString()
}

function toPosition(row: PositionRow) {
  return {
    id: row.id,
    ticker_symbol: row.tickerSymbol,
    asset_name: row.assetName,
    quantity: row.quantity,
    price: row.price,
    buy_date: row.buyDate,
    currency: row.currency,
    status: row.status,
    transaction_type: row.transactionType,
    portfolio_id: row.portfolioId,
    user_id: row.userId,
    created_at: toIso(row.createdAt),
    updated_at: toIso(row.updatedAt),
  }
}

function readTrimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

function readPositiveNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return undefined
}

function isValidBuyDate(value: string): boolean {
  if (!BUY_DATE_RE.test(value)) return false
  const [yearString, monthString, dayString] = value.split('-')
  const year = Number(yearString)
  const month = Number(monthString)
  const day = Number(dayString)
  const parsed = new Date(year, month - 1, day)
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  )
}

function parsePositionFields(
  body: Record<string, unknown>,
  partial: boolean,
): { ok: true; value: Partial<PositionFields> } | { ok: false; error: string } {
  const value: Partial<PositionFields> = {}

  if (!partial || 'ticker_symbol' in body) {
    const tickerSymbol = readTrimmedString(body.ticker_symbol)
    if (!tickerSymbol) return { ok: false, error: 'Ticker symbol is required' }
    value.tickerSymbol = tickerSymbol
  }

  if (!partial || 'asset_name' in body) {
    const assetName = readTrimmedString(body.asset_name)
    if (!assetName) return { ok: false, error: 'Asset name is required' }
    value.assetName = assetName
  }

  if (!partial || 'quantity' in body) {
    const quantity = readPositiveNumber(body.quantity)
    if (quantity === undefined) return { ok: false, error: 'Quantity must be a positive number' }
    value.quantity = quantity
  }

  if (!partial || 'price' in body) {
    const price = readPositiveNumber(body.price)
    if (price === undefined) return { ok: false, error: 'Price must be a positive number' }
    value.price = price
  }

  if (!partial || 'buy_date' in body) {
    const buyDate = readTrimmedString(body.buy_date)
    if (!buyDate || !isValidBuyDate(buyDate)) {
      return { ok: false, error: 'Buy date must be a valid YYYY-MM-DD date' }
    }
    value.buyDate = buyDate
  }

  if (!partial || 'currency' in body) {
    const currency = readTrimmedString(body.currency)?.toUpperCase()
    if (!currency || !CURRENCIES.has(currency)) {
      return { ok: false, error: 'Currency must be USD, RON or EUR' }
    }
    value.currency = currency
  }

  if (!partial || 'status' in body) {
    const status = readTrimmedString(body.status)?.toLowerCase()
    if (!status || !STATUSES.has(status)) {
      return { ok: false, error: 'Status must be buy or sell' }
    }
    value.status = status
  }

  if (!partial || 'transaction_type' in body) {
    const transactionType = readTrimmedString(body.transaction_type)?.toLowerCase()
    if (!transactionType || !TRANSACTION_TYPES.has(transactionType)) {
      return { ok: false, error: 'Transaction type must be stock, crypto or etf' }
    }
    value.transactionType = transactionType
  }

  if (!partial || 'portfolio_id' in body) {
    const portfolioId = readTrimmedString(body.portfolio_id)
    if (!portfolioId || !UUID_RE.test(portfolioId)) {
      return { ok: false, error: 'Portfolio ID is required' }
    }
    value.portfolioId = portfolioId
  }

  return { ok: true, value }
}

async function findOwnedPortfolio(userId: string, portfolioId: string) {
  const [row] = await db
    .select({ id: portfolios.id })
    .from(portfolios)
    .where(and(eq(portfolios.id, portfolioId), eq(portfolios.userId, userId)))
    .limit(1)

  return row ?? null
}

export const positionRoutes = new Hono<AuthEnv>()

positionRoutes.use(requireAuth)

positionRoutes.get('/', async (c) => {
  const user = c.get('user')
  const portfolioId = c.req.query('portfolioId')?.trim()

  if (portfolioId) {
    if (!UUID_RE.test(portfolioId) || !(await findOwnedPortfolio(user.id, portfolioId))) {
      return c.json({ error: 'Not found' }, 404)
    }
  }

  const rows = portfolioId
    ? await db
        .select()
        .from(positions)
        .where(and(eq(positions.userId, user.id), eq(positions.portfolioId, portfolioId)))
        .orderBy(desc(positions.buyDate), desc(positions.createdAt))
    : await db
        .select()
        .from(positions)
        .where(eq(positions.userId, user.id))
        .orderBy(desc(positions.buyDate), desc(positions.createdAt))

  return c.json({ positions: rows.map(toPosition) })
})

positionRoutes.post('/', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const parsed = parseJsonBody(body)
  if (!parsed) {
    return c.json({ error: 'Ticker symbol is required' }, 400)
  }

  const fields = parsePositionFields(parsed, false)
  if (!fields.ok) {
    return c.json({ error: fields.error }, 400)
  }

  const user = c.get('user')
  const value = fields.value as PositionFields

  if (!(await findOwnedPortfolio(user.id, value.portfolioId))) {
    return c.json({ error: 'Not found' }, 404)
  }

  const [position] = await db
    .insert(positions)
    .values({ ...value, userId: user.id })
    .returning()

  return c.json({ position: toPosition(position) }, 201)
})

positionRoutes.post('/import', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const items = Array.isArray(body)
    ? body
    : typeof body === 'object' && body !== null && Array.isArray((body as { positions?: unknown }).positions)
      ? (body as { positions: unknown[] }).positions
      : null

  if (!items) {
    return c.json({ error: 'Positions array is required' }, 400)
  }

  if (items.length === 0) {
    return c.json({ error: 'No positions to import' }, 400)
  }

  const user = c.get('user')
  const values: PositionFields[] = []

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]
    const parsed = parseJsonBody(item)
    if (!parsed) {
      return c.json({ error: `Invalid position at index ${i}` }, 400)
    }

    const fields = parsePositionFields(parsed, false)
    if (!fields.ok) {
      return c.json({ error: `${fields.error} (index ${i})` }, 400)
    }

    values.push(fields.value as PositionFields)
  }

  const portfolioIds = [...new Set(values.map((row) => row.portfolioId))]
  for (const portfolioId of portfolioIds) {
    if (!(await findOwnedPortfolio(user.id, portfolioId))) {
      return c.json({ error: 'Not found' }, 404)
    }
  }

  const rows = await db
    .insert(positions)
    .values(values.map((value) => ({ ...value, userId: user.id })))
    .returning()

  return c.json({ positions: rows.map(toPosition) }, 201)
})

positionRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id')
  if (!UUID_RE.test(id)) {
    return c.json({ error: 'Not found' }, 404)
  }

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const parsed = parseJsonBody(body)
  if (!parsed) {
    return c.json({ error: 'No fields to update' }, 400)
  }

  const fields = parsePositionFields(parsed, true)
  if (!fields.ok) {
    return c.json({ error: fields.error }, 400)
  }

  if (Object.keys(fields.value).length === 0) {
    return c.json({ error: 'No fields to update' }, 400)
  }

  const user = c.get('user')

  if (fields.value.portfolioId && !(await findOwnedPortfolio(user.id, fields.value.portfolioId))) {
    return c.json({ error: 'Not found' }, 404)
  }

  const [position] = await db
    .update(positions)
    .set({ ...fields.value, updatedAt: new Date() })
    .where(and(eq(positions.id, id), eq(positions.userId, user.id)))
    .returning()

  if (!position) {
    return c.json({ error: 'Not found' }, 404)
  }

  return c.json({ position: toPosition(position) })
})

positionRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  if (!UUID_RE.test(id)) {
    return c.json({ error: 'Not found' }, 404)
  }

  const user = c.get('user')
  const [deleted] = await db
    .delete(positions)
    .where(and(eq(positions.id, id), eq(positions.userId, user.id)))
    .returning({ id: positions.id })

  if (!deleted) {
    return c.json({ error: 'Not found' }, 404)
  }

  return c.json({ ok: true })
})
