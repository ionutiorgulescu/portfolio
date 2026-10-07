import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import { and, eq, lt, sql } from 'drizzle-orm'
import { createUser, EmailTakenError, normalizeEmail, type PublicUser } from './auth'
import { db } from './db'
import { emailVerificationCodes, users } from './db/schema'
import { env } from './env'
import { sendVerificationEmail } from './mailer'

export const CODE_TTL_MINUTES = 15
const MAX_ATTEMPTS = 5
const RESEND_COOLDOWN_MS = 60_000
const CODE_PATTERN = /^\d{6}$/

export class VerificationEmailError extends Error {}

function hashCode(email: string, code: string): string {
  // Keyed with the server secret: a leaked DB row cannot be brute-forced across the 10^6 code space offline.
  return createHmac('sha256', env.SESSION_SECRET).update(`${email}:${code}`).digest('hex')
}

function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0')
}

async function emailIsRegistered(email: string): Promise<boolean> {
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  return Boolean(user)
}

/**
 * Starts (or restarts) a sign-up by emailing a one-time code. Calling it again acts as "resend":
 * a new code replaces the old one, except within the cooldown, when the code already sent stays valid.
 */
export async function startRegistration(rawEmail: string): Promise<void> {
  const email = normalizeEmail(rawEmail)
  if (await emailIsRegistered(email)) {
    throw new EmailTakenError(email)
  }

  const now = Date.now()
  await db.delete(emailVerificationCodes).where(lt(emailVerificationCodes.expiresAt, new Date(now)))

  const [pending] = await db
    .select({ createdAt: emailVerificationCodes.createdAt })
    .from(emailVerificationCodes)
    .where(eq(emailVerificationCodes.email, email))
    .limit(1)
  if (pending && pending.createdAt.getTime() + RESEND_COOLDOWN_MS > now) {
    return
  }

  const code = generateCode()
  const row = {
    codeHash: hashCode(email, code),
    attempts: 0,
    expiresAt: new Date(now + CODE_TTL_MINUTES * 60_000),
    createdAt: new Date(now),
  }
  await db
    .insert(emailVerificationCodes)
    .values({ email, ...row })
    .onConflictDoUpdate({ target: emailVerificationCodes.email, set: row })

  try {
    await sendVerificationEmail(email, code, CODE_TTL_MINUTES)
  } catch (error) {
    // Drop the unsent code so the cooldown does not block an immediate retry.
    await db.delete(emailVerificationCodes).where(eq(emailVerificationCodes.email, email))
    console.error(`[verification] failed to send code to ${email}`, error)
    throw new VerificationEmailError('Could not send the verification email')
  }
}

/**
 * Confirms the emailed code and creates the account with the given password. The password is only
 * stored here, so whoever can read the inbox is the one who chooses it.
 * Returns null for a wrong, expired or exhausted code.
 */
export async function completeRegistration(
  rawEmail: string,
  code: string,
  password: string,
): Promise<PublicUser | null> {
  const email = normalizeEmail(rawEmail)
  const trimmedCode = code.trim()
  if (!CODE_PATTERN.test(trimmedCode)) {
    return null
  }

  // Spend an attempt before comparing, atomically, so parallel guesses cannot exceed the budget.
  const [pending] = await db
    .update(emailVerificationCodes)
    .set({ attempts: sql`${emailVerificationCodes.attempts} + 1` })
    .where(
      and(
        eq(emailVerificationCodes.email, email),
        lt(emailVerificationCodes.attempts, MAX_ATTEMPTS),
      ),
    )
    .returning()
  if (!pending || pending.expiresAt.getTime() <= Date.now()) {
    return null
  }

  const expected = Buffer.from(pending.codeHash, 'hex')
  const actual = Buffer.from(hashCode(email, trimmedCode), 'hex')
  if (!timingSafeEqual(expected, actual)) {
    return null
  }

  const deleted = await db
    .delete(emailVerificationCodes)
    .where(eq(emailVerificationCodes.email, email))
    .returning({ email: emailVerificationCodes.email })
  if (deleted.length === 0) {
    // A concurrent request already used this code.
    return null
  }

  return createUser(email, password)
}
