import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import type { Context } from 'hono'
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import { db } from './db'
import { users } from './db/schema'
import { env } from './env'

const SESSION_COOKIE = 'session'
const BCRYPT_ROUNDS = 12
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30
const DUMMY_PASSWORD_HASH = '$2b$12$YLQbgT9Nw.3nUNaIHvnrIeaKhUCAFqcrt.lF9X6cfWzwkj3ITR6Ei'

const cookieOptions = {
  httpOnly: true,
  sameSite: 'Lax' as const,
  path: '/',
  secure: env.NODE_ENV === 'production',
  maxAge: SESSION_MAX_AGE_SECONDS,
}

export type PublicUser = {
  id: string
  email: string
}

export async function seedUser(): Promise<void> {
  const email = env.SEED_EMAIL.trim().toLowerCase()
  const passwordHash = await bcrypt.hash(env.SEED_PASSWORD, BCRYPT_ROUNDS)

  await db
    .insert(users)
    .values({ email, passwordHash })
    .onConflictDoUpdate({
      target: users.email,
      set: { passwordHash },
    })

  console.log(`Seeded user ${email}`)
}

export async function authenticate(email: string, password: string): Promise<PublicUser | null> {
  const normalizedEmail = email.trim().toLowerCase()
  const [user] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1)

  if (!user) {
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH)
    return null
  }

  const matches = await bcrypt.compare(password, user.passwordHash)
  if (!matches) {
    return null
  }

  return { id: user.id, email: user.email }
}

export async function setSessionCookie(c: Context, userId: string): Promise<void> {
  await setSignedCookie(c, SESSION_COOKIE, userId, env.SESSION_SECRET, cookieOptions)
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, SESSION_COOKIE, {
    path: cookieOptions.path,
    secure: cookieOptions.secure,
    httpOnly: cookieOptions.httpOnly,
    sameSite: cookieOptions.sameSite,
  })
}

export async function getSessionUser(c: Context): Promise<PublicUser | null> {
  const userId = await getSignedCookie(c, env.SESSION_SECRET, SESSION_COOKIE)
  if (!userId || typeof userId !== 'string') {
    return null
  }

  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  return user ?? null
}

export type AuthEnv = {
  Variables: {
    user: PublicUser
  }
}

export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const user = await getSessionUser(c)
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  c.set('user', user)
  await next()
})
