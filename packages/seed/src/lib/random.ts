/**
 * Deterministic PRNG (mulberry32) so every `pnpm seed` run produces the exact
 * same dataset — useful for diffing emulator exports and for writing tests
 * against known seed IDs.
 */
export function createRng(seed: number): () => number {
  let a = seed >>> 0
  return function rng() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randomInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min
}

export function pick<T>(rng: () => number, items: readonly T[]): T {
  const item = items[randomInt(rng, 0, items.length - 1)]
  if (item === undefined) throw new Error('pick: items must be non-empty')
  return item
}

export function pickMany<T>(rng: () => number, items: readonly T[], count: number): T[] {
  const pool = [...items]
  const result: T[] = []
  const n = Math.min(count, pool.length)
  for (let i = 0; i < n; i++) {
    const index = randomInt(rng, 0, pool.length - 1)
    result.push(pool[index] as T)
    pool.splice(index, 1)
  }
  return result
}

export function weightedBool(rng: () => number, probabilityTrue: number): boolean {
  return rng() < probabilityTrue
}
