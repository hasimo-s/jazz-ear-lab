import type { ChordQualityId } from './chords';

/**
 * コード進行の定義（キーに対する相対表記）。
 * すべての進行は同じ長さ（SLOTS_PER_PROGRESSION 枠）で、最後は必ずトニックで終わる。
 * これにより、比較対象の進行どうしで長さ・終止感が揃い、違いが和声機能だけになる。
 */
export type ProgressionId =
  | 'ii-V-I' | 'minor-ii-V-i' | 'V-I' | 'IV-V-I'
  | 'ii-bII7-I' | 'backdoor' | 'IV-iv-I' | 'bvi-bII7-I';

export interface ProgressionChord {
  /** ローマ数字表記（表示用） */
  roman: string;
  /** トニックからのルートの音程（tonal 形式、綴り計算に使う） */
  rootInterval: string;
  quality: ChordQualityId;
  /** この和音が占める枠数 */
  slots: number;
}

export interface ProgressionDef {
  id: ProgressionId;
  mode: 'major' | 'minor';
  chords: readonly ProgressionChord[];
}

export const SLOTS_PER_PROGRESSION = 4;

const c = (roman: string, rootInterval: string, quality: ChordQualityId, slots = 1): ProgressionChord => ({ roman, rootInterval, quality, slots });

export const PROGRESSIONS: readonly ProgressionDef[] = [
  { id: 'ii-V-I', mode: 'major', chords: [c('IIm7', '2M', 'm7'), c('V7', '5P', '7'), c('Imaj7', '1P', 'maj7', 2)] },
  { id: 'minor-ii-V-i', mode: 'minor', chords: [c('IIm7♭5', '2M', 'm7b5'), c('V7(♭9)', '5P', '7b9'), c('Im7', '1P', 'm7', 2)] },
  { id: 'V-I', mode: 'major', chords: [c('V7', '5P', '7', 2), c('Imaj7', '1P', 'maj7', 2)] },
  { id: 'IV-V-I', mode: 'major', chords: [c('IVmaj7', '4P', 'maj7'), c('V7', '5P', '7'), c('Imaj7', '1P', 'maj7', 2)] },
  // 裏コード（トライトーン代理）: V7 の代わりに ♭II7
  { id: 'ii-bII7-I', mode: 'major', chords: [c('IIm7', '2M', 'm7'), c('♭II7', '2m', '7'), c('Imaj7', '1P', 'maj7', 2)] },
  // バックドア: 同主短調から借りた IVm7–♭VII7
  { id: 'backdoor', mode: 'major', chords: [c('IVm7', '4P', 'm7'), c('♭VII7', '7m', '7'), c('Imaj7', '1P', 'maj7', 2)] },
  // マイナー・サブドミナント（プラガル）
  { id: 'IV-iv-I', mode: 'major', chords: [c('IVmaj7', '4P', 'maj7'), c('IVm7', '4P', 'm7'), c('Imaj7', '1P', 'maj7', 2)] },
  // 裏コードの II–V（♭VIm7–♭II7）
  { id: 'bvi-bII7-I', mode: 'major', chords: [c('♭VIm7', '6m', 'm7'), c('♭II7', '2m', '7'), c('Imaj7', '1P', 'maj7', 2)] },
];

const BY_ID = new Map(PROGRESSIONS.map((p) => [p.id, p]));

export function getProgression(id: ProgressionId): ProgressionDef {
  const p = BY_ID.get(id);
  if (!p) throw new Error(`unknown progression ${id}`);
  return p;
}

export function isProgressionId(id: string): id is ProgressionId {
  return BY_ID.has(id as ProgressionId);
}

/** 枠ごとの和音（長さ SLOTS_PER_PROGRESSION） */
export function slotChords(p: ProgressionDef): ProgressionChord[] {
  return p.chords.flatMap((ch) => Array.from({ length: ch.slots }, () => ch));
}
