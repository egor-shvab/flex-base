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
  check(key: string, now: number): boolean
}

export function createRateLimiter({ limit, windowMs, maxKeys }: IRateLimitOptions): IRateLimiter {
  const windows = new Map<string, IRateLimitWindow>()

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
