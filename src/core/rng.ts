// Seeded randomness (00-README, 06 §7.2). Never Math.random() in src/core/.

/** 32-bit FNV-1a over the UTF-8 bytes of `text`, unsigned. */
export function fnv1a32(text: string): number {
  let h = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(text)) {
    h ^= byte;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 generator: floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One stream's seed: fnv1a32 of "runSeed:stream:key…"; 0 becomes 1 (06 §7.2). */
export function deriveSeed(runSeed: number, stream: string, ...keys: (string | number)[]): number {
  return fnv1a32([runSeed, stream, ...keys].join(':')) || 1;
}

export class Rng {
  private readonly gen: () => number;

  constructor(seed: number) {
    this.gen = mulberry32(seed);
  }

  next(): number {
    return this.gen();
  }

  /** Integer in [0, n). */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  /** Weighted pick using exactly one draw. */
  pickWeighted<T>(items: { item: T; weight: number }[]): T {
    const total = items.reduce((s, i) => s + i.weight, 0);
    let r = this.next() * total;
    for (const i of items) {
      if (r < i.weight) return i.item;
      r -= i.weight;
    }
    return items[items.length - 1].item;
  }
}
