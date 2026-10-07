import { serve } from '@hono/node-server'
import { Hono, type Context } from 'hono'
import { cors } from 'hono/cors'
import {
  authenticate,
  clearSession,
  EmailTakenError,
  getSessionUser,
  setAuthCookies,
  validateEmail,
  validatePassword,
} from './auth'
import { env } from './env'
import { rateLimit } from './rate-limit'
import { CODE_TTL_MINUTES, completeRegistration, startRegistration, VerificationEmailError } from './verification'
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

const FIFTEEN_MINUTES_MS = 15 * 60_000

async function readBody(c: Context): Promise<Record<string, unknown> | Response> {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  if (typeof body !== 'object' || body === null) {
    return c.json({ error: 'Invalid request body' }, 400)
  }

  return body as Record<string, unknown>
}

function readString(body: Record<string, unknown>, field: string): string | null {
  const value = body[field]
  return typeof value === 'string' && value.trim() ? value : null
}

app.post('/auth/login', rateLimit({ limit: 20, windowMs: FIFTEEN_MINUTES_MS }), async (c) => {
  const body = await readBody(c)
  if (body instanceof Response) {
    return body
  }

  const email = readString(body, 'email')
  const password = readString(body, 'password')
  if (!email || !password) {
    return c.json({ error: 'Email and password are required' }, 400)
  }

  const user = await authenticate(email, password)
  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  await setAuthCookies(c, user.id)
  return c.json({ user })
})

app.get('/auth/registration', (c) => c.json({ enabled: env.ALLOW_REGISTRATION }))

// Step 1: email a code. Calling it again for the same email resends (60s cooldown).
app.post('/auth/register', rateLimit({ limit: 5, windowMs: FIFTEEN_MINUTES_MS }), async (c) => {
  if (!env.ALLOW_REGISTRATION) {
    return c.json({ error: 'Registration is disabled' }, 403)
  }

  const body = await readBody(c)
  if (body instanceof Response) {
    return body
  }

  const email = readString(body, 'email')
  if (!email) {
    return c.json({ error: 'Email is required' }, 400)
  }

  const emailError = validateEmail(email)
  if (emailError) {
    return c.json({ error: emailError }, 400)
  }

  try {
    await startRegistration(email)
  } catch (error) {
    if (error instanceof EmailTakenError) {
      return c.json({ error: 'An account with this email already exists' }, 409)
    }
    if (error instanceof VerificationEmailError) {
      return c.json({ error: 'Could not send the verification email. Please try again.' }, 502)
    }
    throw error
  }

  return c.json({ ok: true, expiresInMinutes: CODE_TTL_MINUTES }, 202)
})

// Step 2: confirm the code, set the password, create the account and sign in.
app.post(
  '/auth/register/verify',
  rateLimit({ limit: 20, windowMs: FIFTEEN_MINUTES_MS }),
  async (c) => {
    if (!env.ALLOW_REGISTRATION) {
      return c.json({ error: 'Registration is disabled' }, 403)
    }

    const body = await readBody(c)
    if (body instanceof Response) {
      return body
    }

    const email = readString(body, 'email')
    const code = readString(body, 'code')
    const password = readString(body, 'password')
    if (!email || !code || !password) {
      return c.json({ error: 'Email, code and password are required' }, 400)
    }

    // Checked before the code so a weak password does not spend a verification attempt.
    const passwordError = validatePassword(password)
    if (passwordError) {
      return c.json({ error: passwordError }, 400)
    }

    try {
      const user = await completeRegistration(email, code, password)
      if (!user) {
        return c.json({ error: 'Invalid or expired code' }, 400)
      }
      await setAuthCookies(c, user.id)
      return c.json({ user }, 201)
    } catch (error) {
      if (error instanceof EmailTakenError) {
        return c.json({ error: 'An account with this email already exists' }, 409)
      }
      throw error
    }
  },
)

app.post('/auth/logout', async (c) => {
  await clearSession(c)
  return c.json({ ok: true })
})

app.post('/auth/refresh', async (c) => {
  const user = await getSessionUser(c)
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  return c.json({ user })
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

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`Server listening on http://localhost:${info.port}`)
})
