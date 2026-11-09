import type { ProgressionId } from '../theory/progressions';
import type { Difficulty } from './types';

export const PROGRESSION_POOLS: Record<Difficulty, readonly ProgressionId[]> = {
  beginner: ['ii-V-I', 'minor-ii-V-i', 'V-I', 'IV-V-I'],
  intermediate: ['ii-V-I', 'minor-ii-V-i', 'V-I', 'IV-V-I', 'ii-bII7-I', 'backdoor'],
  advanced: ['ii-V-I', 'minor-ii-V-i', 'ii-bII7-I', 'backdoor', 'IV-iv-I', 'bvi-bII7-I'],
};

/** 1問ごとにランダムに決め、比較対象の進行すべてに同じ値を使うパラメータの範囲 */
export const PROGRESSION_PARAMS = {
  bpm: { low: 80, high: 104 },
  beatsPerSlot: 2,
  /** 上部構造の平均音高の目標 */
  center: { low: 58, high: 66 },
  /** 最初のベース音の目標 */
  bassAnchor: { low: 40, high: 47 },
} as const;

export const PROGRESSION_RANGES = {
  bass: { low: 36, high: 52 }, // C2–E3
  upper: { low: 52, high: 79 }, // E3–G5
} as const;

export const PROGRESSION_VELOCITY = 0.65;
/** 和音の切れ目を聴き取りやすくするため、枠の長さよりわずかに短く鳴らす */
export const PROGRESSION_GAP = 0.08;
/** 比較対象どうしで平均音高がこれ以上離れていたら「同程度の音域」とみなさない */
export const MAX_REGISTER_DIFF = 5;

export function progressionLabelKey(id: ProgressionId): string {
  return `progression.name.${id}`;
}
