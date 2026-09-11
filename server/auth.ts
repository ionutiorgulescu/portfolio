import bcrypt from 'bcryptjs'
import { createHash, randomBytes } from 'node:crypto'
import { eq, lt } from 'drizzle-orm'
import type { Context } from 'hono'
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import { db } from './db'
import { refreshTokens, users } from './db/schema'
import { env } from './env'

const LEGACY_SESSION_COOKIE = 'session'
const ACCESS_COOKIE = 'access_token'
const REFRESH_COOKIE = 'refresh_token'
const BCRYPT_ROUNDS = 12
const ACCESS_MAX_AGE_SECONDS = 60 * 60 * 24
const ACCESS_REFRESH_THRESHOLD_SECONDS = 60 * 2
const REFRESH_MAX_AGE_SECONDS = 60 * 60 * 24 * 30
const DUMMY_PASSWORD_HASH = '$2b$12$YLQbgT9Nw.3nUNaIHvnrIeaKhUCAFqcrt.lF9X6cfWzwkj3ITR6Ei'

type CookieOptions = {
  httpOnly: true
  sameSite: 'Lax'
  path: string
  secure: boolean
  maxAge: number
}

function cookieOptions(maxAge: number): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    secure: env.NODE_ENV === 'production',
    maxAge,
  }
}

function cookieClearOptions(maxAge: number) {
  const options = cookieOptions(maxAge)
  return {
    path: options.path,
    secure: options.secure,
    httpOnly: options.httpOnly,
    sameSite: options.sameSite,
  }
}

export type PublicUser = {
  id: string
  email: string
}

type AccessToken = {
  user: PublicUser
  nearExpiry: boolean
}

function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function createRefreshTokenValue(): string {
  return randomBytes(32).toString('base64url')
}

function encodeAccessPayload(userId: string, exp: number): string {
  return `${userId}.${exp}`
}

function decodeAccessPayload(value: string): { id: string; exp: number } | null {
  const separator = value.lastIndexOf('.')
  if (separator <= 0) {
    return null
  }

  const id = value.slice(0, separator)
  const exp = Number(value.slice(separator + 1))
  if (!id || !Number.isFinite(exp)) {
    return null
  }

  return { id, exp }
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

function toMillis(value: Date | number): number {
  return value instanceof Date ? value.getTime() : value
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

async function findUserById(userId: string): Promise<PublicUser | null> {
  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  return user ?? null
}

async function setAccessCookie(c: Context, userId: string): Promise<void> {
  const exp = nowSeconds() + ACCESS_MAX_AGE_SECONDS
  await setSignedCookie(
    c,
    ACCESS_COOKIE,
    encodeAccessPayload(userId, exp),
    env.SESSION_SECRET,
    cookieOptions(ACCESS_MAX_AGE_SECONDS),
  )
}

async function issueRefreshCookie(c: Context, userId: string): Promise<void> {
  const token = createRefreshTokenValue()
  const expiresAt = new Date(Date.now() + REFRESH_MAX_AGE_SECONDS * 1000)

  await db.insert(refreshTokens).values({
    userId,
    tokenHash: hashRefreshToken(token),
    expiresAt,
  })

  await setSignedCookie(
    c,
    REFRESH_COOKIE,
    token,
    env.SESSION_SECRET,
    cookieOptions(REFRESH_MAX_AGE_SECONDS),
  )
}

export async function setAuthCookies(c: Context, userId: string): Promise<void> {
  const existing = await readRefreshTokenValue(c)
  if (existing) {
    await db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, hashRefreshToken(existing)))
  }
  await setAccessCookie(c, userId)
  await issueRefreshCookie(c, userId)
  deleteCookie(c, LEGACY_SESSION_COOKIE, cookieClearOptions(REFRESH_MAX_AGE_SECONDS))
}

function clearCookie(c: Context, name: string, maxAge: number): void {
  deleteCookie(c, name, cookieClearOptions(maxAge))
}

export function clearAuthCookies(c: Context): void {
  clearCookie(c, ACCESS_COOKIE, ACCESS_MAX_AGE_SECONDS)
  clearCookie(c, REFRESH_COOKIE, REFRESH_MAX_AGE_SECONDS)
  clearCookie(c, LEGACY_SESSION_COOKIE, REFRESH_MAX_AGE_SECONDS)
}

async function readRefreshTokenValue(c: Context): Promise<string | null> {
  const token = await getSignedCookie(c, env.SESSION_SECRET, REFRESH_COOKIE)
  if (!token || typeof token !== 'string') {
    return null
  }
  return token
}

async function revokeRefreshCookie(c: Context): Promise<void> {
  const token = await readRefreshTokenValue(c)
  if (token) {
    await db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, hashRefreshToken(token)))
  }
  clearCookie(c, REFRESH_COOKIE, REFRESH_MAX_AGE_SECONDS)
}

export async function clearSession(c: Context): Promise<void> {
  await revokeRefreshCookie(c)
  clearAuthCookies(c)
}

const ROTATION_GRACE_MS = 15_000

type IssuedAuth = {
  user: PublicUser
  accessValue: string
  refreshValue: string
}

const recentRotations = new Map<string, { issued: IssuedAuth; expiresAt: number }>()
const inFlightRotations = new Map<string, Promise<IssuedAuth | null>>()

function rememberRotation(oldTokenHash: string, issued: IssuedAuth): void {
  const now = Date.now()
  for (const [hash, entry] of recentRotations) {
    if (entry.expiresAt <= now) {
      recentRotations.delete(hash)
    }
  }
  recentRotations.set(oldTokenHash, { issued, expiresAt: now + ROTATION_GRACE_MS })
}

function replayRecentRotation(oldTokenHash: string): IssuedAuth | null {
  const entry = recentRotations.get(oldTokenHash)
  if (!entry) {
    return null
  }
  if (entry.expiresAt <= Date.now()) {
    recentRotations.delete(oldTokenHash)
    return null
  }
  return entry.issued
}

async function applyIssuedAuth(c: Context, issued: IssuedAuth): Promise<void> {
  await setSignedCookie(c, ACCESS_COOKIE, issued.accessValue, env.SESSION_SECRET, cookieOptions(ACCESS_MAX_AGE_SECONDS))
  await setSignedCookie(
    c,
    REFRESH_COOKIE,
    issued.refreshValue,
    env.SESSION_SECRET,
    cookieOptions(REFRESH_MAX_AGE_SECONDS),
  )
}

async function pruneExpiredRefreshTokens(): Promise<void> {
  await db.delete(refreshTokens).where(lt(refreshTokens.expiresAt, new Date()))
}

async function readAccessToken(c: Context): Promise<AccessToken | null> {
  const value = await getSignedCookie(c, env.SESSION_SECRET, ACCESS_COOKIE)
  if (!value || typeof value !== 'string') {
    return null
  }

  const payload = decodeAccessPayload(value)
  if (!payload) {
    return null
  }

  const remaining = payload.exp - nowSeconds()
  if (remaining <= 0) {
    return null
  }

  const user = await findUserById(payload.id)
  if (!user) {
    return null
  }

  return {
    user,
    nearExpiry: remaining <= ACCESS_REFRESH_THRESHOLD_SECONDS,
  }
}

async function rotateRefreshSession(c: Context): Promise<PublicUser | null> {
  const token = await readRefreshTokenValue(c)
  if (!token) {
    return null
  }

  const tokenHash = hashRefreshToken(token)
  const issued = await rotateRefreshToken(tokenHash)
  if (!issued) {
    return null
  }

  await applyIssuedAuth(c, issued)
  return issued.user
}

async function rotateRefreshToken(tokenHash: string): Promise<IssuedAuth | null> {
  const replayed = replayRecentRotation(tokenHash)
  if (replayed) {
    return replayed
  }

  const pending = inFlightRotations.get(tokenHash)
  if (pending) {
    return pending
  }

  const rotation = performRefreshRotation(tokenHash).finally(() => {
    inFlightRotations.delete(tokenHash)
  })
  inFlightRotations.set(tokenHash, rotation)
  return rotation
}

async function performRefreshRotation(tokenHash: string): Promise<IssuedAuth | null> {
  const replayed = replayRecentRotation(tokenHash)
  if (replayed) {
    return replayed
  }

  await pruneExpiredRefreshTokens()

  const [stored] = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash)).limit(1)
  if (!stored) {
    return replayRecentRotation(tokenHash)
  }

  if (toMillis(stored.expiresAt) <= Date.now()) {
    await db.delete(refreshTokens).where(eq(refreshTokens.id, stored.id))
    return null
  }

  const user = await findUserById(stored.userId)
  if (!user) {
    await db.delete(refreshTokens).where(eq(refreshTokens.id, stored.id))
    return null
  }

  const issued: IssuedAuth = {
    user,
    accessValue: encodeAccessPayload(user.id, nowSeconds() + ACCESS_MAX_AGE_SECONDS),
    refreshValue: createRefreshTokenValue(),
  }

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: hashRefreshToken(issued.refreshValue),
    expiresAt: new Date(Date.now() + REFRESH_MAX_AGE_SECONDS * 1000),
  })
  rememberRotation(tokenHash, issued)
  await db.delete(refreshTokens).where(eq(refreshTokens.id, stored.id))
  return issued
}

async function migrateLegacySession(c: Context): Promise<PublicUser | null> {
  const userId = await getSignedCookie(c, env.SESSION_SECRET, LEGACY_SESSION_COOKIE)
  if (!userId || typeof userId !== 'string') {
    return null
  }

  const user = await findUserById(userId)
  deleteCookie(c, LEGACY_SESSION_COOKIE, cookieClearOptions(REFRESH_MAX_AGE_SECONDS))
  if (!user) {
    return null
  }

  await setAuthCookies(c, user.id)
  return user
}

/** Valid, non-expired access token only — used by API middleware. */
export async function getAccessUser(c: Context): Promise<PublicUser | null> {
  const access = await readAccessToken(c)
  return access?.user ?? null
}

/**
 * Resolve the current user, renewing the access + refresh pair when the access
 * token is missing, expired, or within 2 minutes of expiry.
 */
export async function getSessionUser(c: Context): Promise<PublicUser | null> {
  const access = await readAccessToken(c)
  if (access?.user && !access.nearExpiry) {
    return access.user
  }

  const refreshed = await rotateRefreshSession(c)
  if (refreshed) {
    return refreshed
  }

  if (access?.user) {
    return access.user
  }

  return migrateLegacySession(c)
}

export type AuthEnv = {
  Variables: {
    user: PublicUser
  }
}

export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const user = await getAccessUser(c)
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  c.set('user', user)
  await next()
})
