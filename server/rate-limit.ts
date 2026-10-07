import { getConnInfo } from '@hono/node-server/conninfo'
import type { Context } from 'hono'
import { createMiddleware } from 'hono/factory'
import { env } from './env'

type Window = { count: number; resetAt: number }

function clientIp(c: Context): string {
  if (env.TRUST_PROXY) {
    // The proxy appends the address it saw, so the last entry is the one it vouches for.
    const forwarded = c.req.header('x-forwarded-for')?.split(',').at(-1)?.trim()
    if (forwarded) {
      return forwarded
    }
  }
  return getConnInfo(c).remote.address ?? 'unknown'
}

/** Fixed-window, in-memory limit per client IP. Resets when the process restarts. */
export function rateLimit(options: { limit: number; windowMs: number }) {
  const windows = new Map<string, Window>()

  return createMiddleware(async (c, next) => {
    const now = Date.now()
    if (windows.size > 10_000) {
      for (const [key, window] of windows) {
        if (window.resetAt <= now) windows.delete(key)
      }
    }

    const key = clientIp(c)
    let window = windows.get(key)
    if (!window || window.resetAt <= now) {
      window = { count: 0, resetAt: now + options.windowMs }
      windows.set(key, window)
    }

    window.count += 1
    if (window.count > options.limit) {
      c.header('Retry-After', String(Math.ceil((window.resetAt - now) / 1000)))
      return c.json({ error: 'Too many requests. Please try again later.' }, 429)
    }

    await next()
  })
}
