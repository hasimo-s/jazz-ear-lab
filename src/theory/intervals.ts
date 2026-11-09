/**
 * 音程の定義データ。
 * semitones は「鳴る音の距離」、tonal は綴り計算用の音程名。
 * 選択肢に同じ半音数の音程が2つ並ぶこと（例: 増4度と減5度、#9と短10度）は
 * 旋律的2音だけでは聴き分け不可能なので、1半音数につき1つのIDしか定義しない。
 */
export type IntervalId =
  | 'm2' | 'M2' | 'm3' | 'M3' | 'P4' | 'TT' | 'P5' | 'm6' | 'M6' | 'm7' | 'M7' | 'P8'
  | 'b9' | '9' | 's9' | '11' | 's11' | 'b13' | '13';

export interface IntervalDef {
  id: IntervalId;
  semitones: number;
  /** tonal.js の音程表記（綴り計算用）。先頭が優先、綴りが不自然な場合は次候補 */
  spellings: readonly string[];
  /** 同じ半音数を持つ別名（解説で異名同音として示す）。i18n キー */
  enharmonicKey?: string;
}

export const INTERVALS: readonly IntervalDef[] = [
  { id: 'm2', semitones: 1, spellings: ['2m'] },
  { id: 'M2', semitones: 2, spellings: ['2M'] },
  { id: 'm3', semitones: 3, spellings: ['3m', '2A'], enharmonicKey: 'interval.enh.m3' },
  { id: 'M3', semitones: 4, spellings: ['3M'] },
  { id: 'P4', semitones: 5, spellings: ['4P'] },
  { id: 'TT', semitones: 6, spellings: ['4A', '5d'], enharmonicKey: 'interval.enh.TT' },
  { id: 'P5', semitones: 7, spellings: ['5P'] },
  { id: 'm6', semitones: 8, spellings: ['6m', '5A'], enharmonicKey: 'interval.enh.m6' },
  { id: 'M6', semitones: 9, spellings: ['6M'] },
  { id: 'm7', semitones: 10, spellings: ['7m'] },
  { id: 'M7', semitones: 11, spellings: ['7M'] },
  { id: 'P8', semitones: 12, spellings: ['8P'] },
  { id: 'b9', semitones: 13, spellings: ['9m'] },
  { id: '9', semitones: 14, spellings: ['9M'] },
  { id: 's9', semitones: 15, spellings: ['9A', '10m'], enharmonicKey: 'interval.enh.s9' },
  { id: '11', semitones: 17, spellings: ['11P'] },
  { id: 's11', semitones: 18, spellings: ['11A', '12d'], enharmonicKey: 'interval.enh.s11' },
  { id: 'b13', semitones: 20, spellings: ['13m', '12A'], enharmonicKey: 'interval.enh.b13' },
  { id: '13', semitones: 21, spellings: ['13M'] },
];

const BY_ID = new Map(INTERVALS.map((d) => [d.id, d]));

export function getInterval(id: IntervalId): IntervalDef {
  const d = BY_ID.get(id);
  if (!d) throw new Error(`unknown interval id ${id}`);
  return d;
}

export function isIntervalId(id: string): id is IntervalId {
  return BY_ID.has(id as IntervalId);
}
