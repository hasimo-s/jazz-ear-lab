import type { Rng } from '../theory/rng';

/** 苦手復習で、正解を苦手項目から選ぶ割合。残りは通常の母集団から選ぶ（同じ問題ばかりになるのを防ぐ） */
export const REVIEW_FOCUS_RATIO = 0.7;

/**
 * 正解を選ぶ。focus（母集団内のもの）が空なら母集団から一様に選ぶ。
 * focus がないときは乱数の消費量を変えない（既存のシードの問題を変えないため）。
 */
export function pickAnswer<T>(rng: Rng, pool: readonly T[], focus: readonly T[] | undefined): T {
  const f = focus?.filter((id) => pool.includes(id)) ?? [];
  if (f.length === 0) return rng.pick(pool);
  return rng.next() < REVIEW_FOCUS_RATIO ? rng.pick(f) : rng.pick(pool);
}
