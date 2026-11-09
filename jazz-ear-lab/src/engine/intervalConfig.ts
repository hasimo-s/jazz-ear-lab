import { INTERVALS, type IntervalId } from '../theory/intervals';
import type { Difficulty } from './types';

/** 難易度ごとの出題音程（正解・選択肢の母集団） */
export const INTERVAL_POOLS: Record<Difficulty, readonly IntervalId[]> = {
  beginner: ['M2', 'm3', 'M3', 'P4', 'P5', 'P8'],
  intermediate: ['m2', 'M2', 'm3', 'M3', 'P4', 'TT', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8'],
  advanced: INTERVALS.map((d) => d.id),
};

/** 難易度ごとの音域（MIDI、両端含む）。2音とも必ずこの範囲に入る */
export const INTERVAL_REGISTERS: Record<Difficulty, { low: number; high: number }> = {
  beginner: { low: 52, high: 76 }, // E3–E5
  intermediate: { low: 48, high: 79 }, // C3–G5
  advanced: { low: 43, high: 86 }, // G2–D6
};

/** 正解との半音差が小さい（聴き分けが難しい）誤答をいくつ必ず含めるか */
export const NEAR_DISTRACTORS: Record<Difficulty, number> = { beginner: 0, intermediate: 1, advanced: 2 };
export const NEAR_RANGE = 2;

export const INTERVAL_TIMING = { gap: 0.9, duration: 0.85, velocity: 0.8 } as const;

export const CHOICE_COUNT = 4;

export function intervalLabelKey(id: IntervalId): string {
  return `interval.name.${id}`;
}

