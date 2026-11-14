import { describe, expect, it } from 'vitest'
import { createRateLimiter } from '#server/utils/rate-limit'

const limiter = () => createRateLimiter({ limit: 3, windowMs: 1000, maxKeys: 10 })

describe('createRateLimiter', () => {
  it('allows up to the limit and refuses the next call', () => {
    const rate = limiter()

    expect([1, 2, 3].map(() => rate.shouldAllow('a', 0))).toEqual([true, true, true])
    expect(rate.shouldAllow('a', 0)).toBe(false)
  })

  it('counts each key separately, so one caller cannot exhaust another', () => {
    const rate = limiter()

    for (let call = 0; call < 3; call += 1) rate.shouldAllow('a', 0)

    expect(rate.shouldAllow('a', 0)).toBe(false)
    expect(rate.shouldAllow('b', 0)).toBe(true)
  })

  it('opens a fresh window once the old one has elapsed', () => {
    const rate = limiter()

    for (let call = 0; call < 3; call += 1) rate.shouldAllow('a', 0)
    expect(rate.shouldAllow('a', 999)).toBe(false)

    expect(rate.shouldAllow('a', 1000)).toBe(true)
  })

  it('does not let time inside a window reopen it', () => {
    const rate = limiter()

    rate.shouldAllow('a', 0)
    rate.shouldAllow('a', 400)
    rate.shouldAllow('a', 800)

    expect(rate.shouldAllow('a', 999)).toBe(false)
  })

  describe('the key bound', () => {
    it('stays bounded under keys that never repeat', () => {
      const rate = createRateLimiter({ limit: 3, windowMs: 1000, maxKeys: 4 })

      for (let key = 0; key < 200; key += 1) {
        expect(rate.shouldAllow(`key-${key}`, 0)).toBe(true)
      }
    })

    it('sheds the oldest window when full, keeping every newer caller throttled', () => {
      const rate = createRateLimiter({ limit: 1, windowMs: 1000, maxKeys: 3 })

      rate.shouldAllow('oldest', 0)
      rate.shouldAllow('throttled-1', 10)
      rate.shouldAllow('throttled-2', 20)

      rate.shouldAllow('newcomer', 30)

      expect(rate.shouldAllow('throttled-1', 40)).toBe(false)
      expect(rate.shouldAllow('throttled-2', 40)).toBe(false)
      expect(rate.shouldAllow('oldest', 40)).toBe(true)
    })

    it('counts a reopened window as new, so it is not the next one shed', () => {
      const rate = createRateLimiter({ limit: 1, windowMs: 1000, maxKeys: 2 })

      rate.shouldAllow('a', 0)
      rate.shouldAllow('b', 500)
      rate.shouldAllow('a', 1000)

      rate.shouldAllow('c', 1200)

      expect(rate.shouldAllow('a', 1300)).toBe(false)
    })

    it('drops what has expired before shedding anything live', () => {
      const rate = createRateLimiter({ limit: 3, windowMs: 1000, maxKeys: 3 })

      rate.shouldAllow('old-1', 0)
      rate.shouldAllow('old-2', 0)
      for (let call = 0; call < 3; call += 1) rate.shouldAllow('kept', 1500)

      rate.shouldAllow('new', 2000)

      expect(rate.shouldAllow('kept', 2000)).toBe(false)
    })
  })
})
