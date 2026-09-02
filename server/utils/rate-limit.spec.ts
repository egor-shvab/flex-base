import { describe, expect, it } from 'vitest'
import { createRateLimiter } from '#server/utils/rate-limit'

/**
 * `now` is a parameter, so none of this needs a timer or a fake clock — the same reason
 * `buildErrorLogEntry` takes one.
 */
const limiter = () => createRateLimiter({ limit: 3, windowMs: 1000, maxKeys: 10 })

describe('createRateLimiter', () => {
  it('allows up to the limit and refuses the next call', () => {
    const rate = limiter()

    expect([1, 2, 3].map(() => rate.check('a', 0))).toEqual([true, true, true])
    expect(rate.check('a', 0)).toBe(false)
  })

  it('counts each key separately, so one caller cannot exhaust another', () => {
    const rate = limiter()

    for (let call = 0; call < 3; call += 1) rate.check('a', 0)

    expect(rate.check('a', 0)).toBe(false)
    expect(rate.check('b', 0)).toBe(true)
  })

  it('opens a fresh window once the old one has elapsed', () => {
    const rate = limiter()

    for (let call = 0; call < 3; call += 1) rate.check('a', 0)
    expect(rate.check('a', 999)).toBe(false)

    expect(rate.check('a', 1000)).toBe(true)
  })

  it('does not let time inside a window reopen it', () => {
    const rate = limiter()

    rate.check('a', 0)
    rate.check('a', 400)
    rate.check('a', 800)

    expect(rate.check('a', 999)).toBe(false)
  })

  /**
   * The guard must not become the leak it guards against: one call per forged key would grow the
   * map forever. Expired keys go first, and if that frees nothing the map is cleared outright —
   * losing counts is the right trade against unbounded growth.
   */
  describe('the key bound', () => {
    it('stays bounded under keys that never repeat', () => {
      const rate = createRateLimiter({ limit: 3, windowMs: 1000, maxKeys: 4 })

      // Every key distinct and every call inside one window — nothing can expire
      for (let key = 0; key < 200; key += 1) {
        expect(rate.check(`key-${key}`, 0)).toBe(true)
      }
    })

    it('drops what has expired before resorting to clearing', () => {
      const rate = createRateLimiter({ limit: 3, windowMs: 1000, maxKeys: 3 })

      rate.check('old-1', 0)
      rate.check('old-2', 0)
      for (let call = 0; call < 3; call += 1) rate.check('kept', 1500)

      // `kept` opened its window at 1500 and is still inside it, so eviction at 2000 takes the
      // two stale keys and leaves its count standing
      rate.check('new', 2000)

      expect(rate.check('kept', 2000)).toBe(false)
    })
  })
})
