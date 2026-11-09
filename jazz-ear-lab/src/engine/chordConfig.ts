import type { ChordQualityId } from '../theory/chords';
import type { Difficulty } from './types';

export const CHORD_POOLS: Record<Difficulty, readonly ChordQualityId[]> = {
  beginner: ['maj', 'min', 'dim', 'aug', '7'],
  intermediate: ['maj7', 'm7', '7', 'm7b5', 'dim7', 'sus4'],
  advanced: ['maj9', 'm9', '9', '7b9', '7s9', '7s11', 'maj7s11', '13', '7alt'],
};

/**
 * ボイシングの方針
 * - close:  ルート・ポジションの密集配置（ベースのすぐ上に積む）
 * - spread: ベース（ルート）＋1オクターブ以上上に上部構造（転回はランダム）
 * - jazz:   低音域のベース＋中音域のガイドトーン（3度・7度）＋その上にテンション。完全5度は省略することがある
 */
export type VoicingStyle = 'close' | 'spread' | 'jazz';

export const CHORD_STYLE: Record<Difficulty, VoicingStyle> = {
  beginner: 'close',
  intermediate: 'spread',
  advanced: 'jazz',
};

/** ベース（ルート）の MIDI 範囲（両端含む） */
export const CHORD_BASS_RANGE: Record<Difficulty, { low: number; high: number }> = {
  beginner: { low: 52, high: 62 }, // E3–D4
  intermediate: { low: 40, high: 52 }, // E2–E3
  advanced: { low: 36, high: 48 }, // C2–C3
};

/** 上部構造の最低音・全体の最高音 */
export const CHORD_UPPER_FLOOR = 52; // E3
export const CHORD_TOP_LIMIT = 86; // D6

/** 低音域で狭い音程が濁るのを避ける（ロー・インターバル・リミットの簡易版） */
export const LOW_INTERVAL_RULES = [
  { below: 48, minInterval: 7 }, // C3 未満では隣り合う音が完全5度以上
  { below: 55, minInterval: 3 }, // G3 未満では2度を作らない
] as const;

export const CHORD_TIMING = { duration: 2.2, velocity: 0.7, arpeggioStep: 0.35 } as const;

export const CHORD_NEAR_DISTRACTORS: Record<Difficulty, number> = { beginner: 0, intermediate: 1, advanced: 2 };

export function chordLabelKey(id: ChordQualityId): string {
  return `chord.name.${id}`;
}
