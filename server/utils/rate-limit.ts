interface IRateLimitOptions {
  /** How many calls one key may make inside a window. */
  limit: number
  windowMs: number
  /**
   * How many keys may be tracked at once, or the map is an unbounded write surface and the
   * guard becomes the leak.
   */
  maxKeys: number
}

interface IRateLimitWindow {
  startedAt: number
  count: number
}

export interface IRateLimiter {
  /** `true` when the call is within the limit, `false` when it should be refused. */
  check(key: string, now: number): boolean
}

/**
 * A fixed-window counter, for guarding an endpoint that answers to anyone.
 *
 * **`now` is a parameter**, as `buildErrorLogEntry` takes one, so this is testable without timers
 * and its spec stays in the fast project.
 *
 * Fixed window rather than sliding or a token bucket: the worst case is `2 × limit` across a
 * boundary, which for a guard bounding a log file is not worth a second data structure.
 *
 * **In-memory, so the limit is per process** — behind more than one instance each gets its own
 * allowance, recorded as an accepted limitation.
 */
export function createRateLimiter({ limit, windowMs, maxKeys }: IRateLimitOptions): IRateLimiter {
  const windows = new Map<string, IRateLimitWindow>()

  /** Drops what has expired; if that was not enough, drops everything rather than growing. */
  function evict(now: number): void {
    for (const [key, window] of windows) {
      if (now - window.startedAt >= windowMs) windows.delete(key)
    }

    if (windows.size >= maxKeys) windows.clear()
  }

  return {
    check(key, now) {
      const window = windows.get(key)

      if (window === undefined || now - window.startedAt >= windowMs) {
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
