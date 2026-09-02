import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authenticate, clearSessionCookie, getSessionUser, seedUser, setSessionCookie } from './auth'
import { env } from './env'
import { portfolioRoutes } from './portfolios'
import { positionRoutes } from './positions'

const app = new Hono()

app.use(
  '*',
  cors({
    origin: env.CORS_ORIGINS,
    credentials: true,
    allowHeaders: ['Content-Type'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
)

app.get('/health', (c) => c.json({ ok: true }))

app.post('/auth/login', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  if (typeof body !== 'object' || body === null) {
    return c.json({ error: 'Email and password are required' }, 400)
  }

  const { email, password } = body as Record<string, unknown>
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    return c.json({ error: 'Email and password are required' }, 400)
  }

  const user = await authenticate(email, password)
  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  await setSessionCookie(c, user.id)
  return c.json({ user })
})

app.post('/auth/logout', (c) => {
  clearSessionCookie(c)
  return c.json({ ok: true })
})

app.get('/auth/me', async (c) => {
  const user = await getSessionUser(c)
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  return c.json({ user })
})

app.route('/portfolios', portfolioRoutes)
app.route('/positions', positionRoutes)

await seedUser()

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`Server listening on http://localhost:${info.port}`)
})
