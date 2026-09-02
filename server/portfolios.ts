import { and, asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { requireAuth, type AuthEnv } from './auth'
import { db } from './db'
import { portfolios } from './db/schema'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type PortfolioRow = typeof portfolios.$inferSelect

function toIso(value: Date | number): string {
  if (value instanceof Date) return value.toISOString()
  return new Date(value).toISOString()
}

function toPortfolio(row: PortfolioRow) {
  return {
    id: row.id,
    user_id: row.userId,
    name: row.name,
    description: row.description ?? undefined,
    created_at: toIso(row.createdAt),
    updated_at: toIso(row.updatedAt),
  }
}

function parseJsonBody(body: unknown): Record<string, unknown> | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return null
  }
  return body as Record<string, unknown>
}

function readName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const name = value.trim()
  return name || undefined
}

function readDescription(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  return value
}

export const portfolioRoutes = new Hono<AuthEnv>()

portfolioRoutes.use(requireAuth)

portfolioRoutes.get('/', async (c) => {
  const user = c.get('user')
  const rows = await db
    .select()
    .from(portfolios)
    .where(eq(portfolios.userId, user.id))
    .orderBy(asc(portfolios.createdAt))

  return c.json({ portfolios: rows.map(toPortfolio) })
})

portfolioRoutes.post('/', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const parsed = parseJsonBody(body)
  if (!parsed) {
    return c.json({ error: 'Name is required' }, 400)
  }

  const name = readName(parsed.name)
  if (!name) {
    return c.json({ error: 'Name is required' }, 400)
  }

  if (parsed.description !== undefined && parsed.description !== null && typeof parsed.description !== 'string') {
    return c.json({ error: 'Description must be a string' }, 400)
  }

  const description = readDescription(parsed.description) ?? null
  const user = c.get('user')

  const [portfolio] = await db
    .insert(portfolios)
    .values({ userId: user.id, name, description })
    .returning()

  return c.json({ portfolio: toPortfolio(portfolio) }, 201)
})

portfolioRoutes.patch('/:id', async (c) => {
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

  const updates: { name?: string; description?: string | null; updatedAt: Date } = {
    updatedAt: new Date(),
  }

  if ('name' in parsed) {
    const name = readName(parsed.name)
    if (!name) {
      return c.json({ error: 'Name is required' }, 400)
    }
    updates.name = name
  }

  if ('description' in parsed) {
    if (parsed.description !== null && typeof parsed.description !== 'string') {
      return c.json({ error: 'Description must be a string' }, 400)
    }
    updates.description = readDescription(parsed.description) ?? null
  }

  if (!('name' in parsed) && !('description' in parsed)) {
    return c.json({ error: 'No fields to update' }, 400)
  }

  const user = c.get('user')
  const [portfolio] = await db
    .update(portfolios)
    .set(updates)
    .where(and(eq(portfolios.id, id), eq(portfolios.userId, user.id)))
    .returning()

  if (!portfolio) {
    return c.json({ error: 'Not found' }, 404)
  }

  return c.json({ portfolio: toPortfolio(portfolio) })
})

portfolioRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  if (!UUID_RE.test(id)) {
    return c.json({ error: 'Not found' }, 404)
  }

  const user = c.get('user')
  const [deleted] = await db
    .delete(portfolios)
    .where(and(eq(portfolios.id, id), eq(portfolios.userId, user.id)))
    .returning({ id: portfolios.id })

  if (!deleted) {
    return c.json({ error: 'Not found' }, 404)
  }

  return c.json({ ok: true })
})
