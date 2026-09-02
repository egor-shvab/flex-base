/**
 * The one source of variation in the seed, and it is not random: a seed that differs between runs
 * is one nobody can write a test or a bug report against. mulberry32 from a constant gives the
 * same sequence every time, on every platform, with no dependency — `Math.random` is exactly
 * what must not be used here.
 */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0

  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** One member of a non-empty pool. Throws rather than returning `undefined` on an empty one. */
export function pickFrom<T>(random: () => number, pool: readonly T[]): T {
  const value = pool[Math.floor(random() * pool.length)]
  if (value === undefined) throw new Error('Cannot pick from an empty pool')
  return value
}

/** `count` distinct members, in pool order — what a multi-value field holds. */
export function sampleFrom<T>(random: () => number, pool: readonly T[], count: number): T[] {
  const chosen = new Set<T>()
  // Bounded by the pool: asking for more than it holds would otherwise spin forever
  const wanted = Math.min(count, pool.length)

  while (chosen.size < wanted) chosen.add(pickFrom(random, pool))

  return pool.filter((value) => chosen.has(value))
}

/** An integer in `[min, max]`. */
export function pickInt(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1))
}
