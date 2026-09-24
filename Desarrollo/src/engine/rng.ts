/**
 * Deterministic random numbers.
 *
 * Every game carries its seed in the state, so replaying the same actions gives
 * the same world. That is what makes the economy debuggable and the balance
 * tunable: `npm run simulate` reproduces a whole game exactly.
 */

export interface Rng {
  next(): number
  /** Inclusive of `min`, exclusive of `max`. */
  float(min: number, max: number): number
  int(min: number, max: number): number
  pick<T>(items: readonly T[]): T
  sample<T>(items: readonly T[], count: number): T[]
  chance(probability: number): boolean
  /** Weighted draw; `weight` must return a positive number. */
  weighted<T>(items: readonly T[], weight: (item: T) => number): T
  shuffle<T>(items: readonly T[]): T[]
  /** Current cursor, to be stored back into the game state. */
  state(): number
}

export function createRng(seed: number): Rng {
  let s = seed >>> 0

  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const rng: Rng = {
    next,
    float: (min, max) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    pick: (items) => items[Math.floor(next() * items.length)],
    sample: (items, count) => rng.shuffle(items).slice(0, Math.max(0, count)),
    chance: (probability) => next() < probability,
    weighted: (items, weight) => {
      const total = items.reduce((sum, item) => sum + Math.max(0, weight(item)), 0)
      if (total <= 0) return items[0]
      let roll = next() * total
      for (const item of items) {
        roll -= Math.max(0, weight(item))
        if (roll <= 0) return item
      }
      return items[items.length - 1]
    },
    shuffle: (items) => {
      const copy = [...items]
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        ;[copy[i], copy[j]] = [copy[j], copy[i]]
      }
      return copy
    },
    state: () => s,
  }

  return rng
}

/** Normal-ish noise in roughly [-1, 1], cheaper and tamer than Box-Muller. */
export function noise(rng: Rng): number {
  return (rng.next() + rng.next() + rng.next() - 1.5) / 1.5
}
