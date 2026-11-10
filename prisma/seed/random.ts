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

export function pickFrom<T>(random: () => number, pool: readonly T[]): T {
  const value = pool[Math.floor(random() * pool.length)]
  if (value === undefined) throw new Error('Cannot pick from an empty pool')
  return value
}

export function sampleFrom<T>(random: () => number, pool: readonly T[], count: number): T[] {
  const chosen = new Set<T>()
  const wanted = Math.min(count, pool.length)

  while (chosen.size < wanted) chosen.add(pickFrom(random, pool))

  return pool.filter((value) => chosen.has(value))
}

export function pickInt(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1))
}
