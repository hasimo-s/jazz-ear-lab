/**
 * シード付き疑似乱数生成器 (mulberry32)。
 * 同じシードからは常に同じ数列が得られるため、問題をテストで再現できる。
 */
export interface Rng {
  /** [0, 1) の一様乱数 */
  next(): number;
  /** [min, max] の整数（両端含む） */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new RangeError(`invalid int range [${min}, ${max}]`);
    }
    return min + Math.floor(next() * (max - min + 1));
  };
  const pick = <T,>(items: readonly T[]): T => {
    if (items.length === 0) throw new RangeError('pick from empty array');
    return items[int(0, items.length - 1)] as T;
  };
  const shuffle = <T,>(items: readonly T[]): T[] => {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = int(0, i);
      [out[i], out[j]] = [out[j] as T, out[i] as T];
    }
    return out;
  };
  return { next, int, pick, shuffle };
}

/** セッションシードと問題番号から、問題ごとの独立したシードを導出する */
export function deriveSeed(sessionSeed: number, index: number): number {
  // 32bit整数ハッシュ (splitmix32 系)
  let h = (sessionSeed >>> 0) ^ Math.imul(index + 1, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

export function randomSeed(): number {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    return crypto.getRandomValues(new Uint32Array(1))[0]!;
  }
  return Math.floor(Math.random() * 2 ** 32);
}
