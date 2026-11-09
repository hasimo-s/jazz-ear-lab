import { describe, expect, it } from 'vitest';
import { createRng, deriveSeed } from './rng';

describe('seeded rng', () => {
  it('同じシードなら同じ数列', () => {
    const a = createRng(42), b = createRng(42);
    expect(Array.from({ length: 20 }, () => a.next())).toEqual(Array.from({ length: 20 }, () => b.next()));
  });

  it('異なるシードなら異なる数列', () => {
    expect(createRng(1).next()).not.toEqual(createRng(2).next());
  });

  it('int は両端を含む範囲内で、おおむね一様', () => {
    const r = createRng(7);
    const counts = new Array(12).fill(0);
    for (let i = 0; i < 12000; i++) counts[r.int(0, 11)]++;
    for (const c of counts) expect(c).toBeGreaterThan(800); // 期待値1000
    expect(counts.reduce((s, c) => s + c, 0)).toBe(12000);
  });

  it('shuffle は要素を保存する', () => {
    const r = createRng(3);
    expect(r.shuffle([1, 2, 3, 4, 5]).sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('deriveSeed は決定的で、index ごとに異なる', () => {
    expect(deriveSeed(123, 0)).toBe(deriveSeed(123, 0));
    const seeds = new Set(Array.from({ length: 1000 }, (_, i) => deriveSeed(123, i)));
    expect(seeds.size).toBe(1000);
  });
});
