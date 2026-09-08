// Seeded PRNG (mulberry32 over a string seed hash).
// Rules code must NEVER call Math.random(); all randomness flows through Rng
// so that same seed + same actions = identical run (spec REQ-INV-3).

export class Rng {
  #state: number;
  #cursor = 0;

  constructor(seed: string) {
    this.#state = hashSeed(seed);
  }

  /** Monotonic count of draws — recorded in the replay log. */
  get cursor(): number {
    return this.#cursor;
  }

  /** Next float in [0, 1). */
  next(): number {
    this.#cursor++;
    // mulberry32
    this.#state |= 0;
    this.#state = (this.#state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.#state ^ (this.#state >>> 15), 1 | this.#state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [0, n). */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  /** In-place Fisher–Yates shuffle. */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

function hashSeed(seed: string): number {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
