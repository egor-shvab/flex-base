import { createError, getRequestIP } from 'h3'
import type { H3Event } from 'h3'

interface IRateLimitOptions {
  limit: number
  windowMs: number
  maxKeys: number
}

interface IRateLimitWindow {
  startedAt: number
  count: number
}

export interface IRateLimiter {
  shouldAllow(key: string, now: number): boolean
}

/**
 * Windows are kept in the order they opened, so a full map sheds its oldest first. Clearing it
 * instead would hand every throttled caller a fresh allowance — one flood of new keys away.
 */
export function createRateLimiter({ limit, windowMs, maxKeys }: IRateLimitOptions): IRateLimiter {
  const windows = new Map<string, IRateLimitWindow>()

  function evict(now: number): void {
    for (const [key, window] of windows) {
      if (now - window.startedAt >= windowMs) windows.delete(key)
    }

    for (const key of windows.keys()) {
      if (windows.size < maxKeys) break
      windows.delete(key)
    }
  }

  return {
    shouldAllow(key, now) {
      const window = windows.get(key)

      if (window === undefined || now - window.startedAt >= windowMs) {
        windows.delete(key)
        if (windows.size >= maxKeys) evict(now)
        windows.set(key, { startedAt: now, count: 1 })
        return true
      }

      if (window.count >= limit) return false

      window.count += 1
      return true
    },
  }
}

export function assertWithinRateLimit(
  limiter: IRateLimiter,
  key: string,
  statusMessage: string,
): void {
  if (!limiter.shouldAllow(key, Date.now())) {
    throw createError({ statusCode: 429, statusMessage })
  }
}

/**
 * The socket address, not `x-forwarded-for`, which an attacker controls. Behind a proxy this
 * degrades to one shared allowance — too strict rather than bypassable.
 */
export function toClientAddress(event: H3Event): string {
  return getRequestIP(event) ?? 'unknown'
}
