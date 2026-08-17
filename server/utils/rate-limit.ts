interface IRateLimitOptions {
  /** How many calls one key may make inside a window. */
  limit: number
  windowMs: number
  /**
   * How many keys may be tracked at once. Without it the map is an unbounded write surface —
   * one request per forged address would grow it forever, which turns the guard into the leak.
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
 * **`now` is a parameter**, the same way `buildErrorLogEntry` takes one: the whole thing is then
 * testable without timers or a fake clock, which is what keeps its spec in the fast project.
 *
 * Fixed window rather than a sliding one or a token bucket: the worst case is that a caller gets
 * `2 × limit` across a window boundary, which for a guard whose job is to bound a log file is not
 * worth a second data structure to close.
 *
 * **In-memory, so the limit is per process.** Behind more than one instance each gets its own
 * allowance — recorded as an accepted limitation rather than solved, since the shared store that
 * would fix it is the same infrastructure the log file is waiting on.
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
