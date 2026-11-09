/**
 * コードの定義データ。
 * 度数（Degree）は「ルートからの音程」。semitones が鳴る音、spellings が綴り（tonal 形式、先頭優先）。
 * 各コードは
 *   degrees   … 完全な構成音
 *   essential … ボイシングで省略してはいけない音（性格を決める音: 3度/sus4、7度、変化音、テンション）
 * を持つ。「鳴らした音の集合 S が essential ⊆ S ⊆ degrees を満たす」ときに限り、
 * S はそのコードの正しいボイシングとみなす（ベース＝ルートが前提）。
 */
export type Degree =
  | '1' | 'b3' | '3' | '4' | 'b5' | '5' | 's5' | 'bb7' | 'b7' | '7'
  | 'b9' | '9' | 's9' | 's11' | 'b13' | '13';

export interface DegreeDef {
  semitones: number;
  spellings: readonly string[];
  /** 表示用（解説で使う） */
  label: string;
}

export const DEGREES: Record<Degree, DegreeDef> = {
  '1': { semitones: 0, spellings: ['1P'], label: 'R' },
  b3: { semitones: 3, spellings: ['3m'], label: '♭3' },
  '3': { semitones: 4, spellings: ['3M'], label: '3' },
  '4': { semitones: 5, spellings: ['4P'], label: '4' },
  b5: { semitones: 6, spellings: ['5d'], label: '♭5' },
  '5': { semitones: 7, spellings: ['5P'], label: '5' },
  s5: { semitones: 8, spellings: ['5A', '6m'], label: '♯5' },
  bb7: { semitones: 9, spellings: ['7d', '6M'], label: '𝄫7' },
  b7: { semitones: 10, spellings: ['7m'], label: '♭7' },
  '7': { semitones: 11, spellings: ['7M'], label: '7' },
  b9: { semitones: 13, spellings: ['9m'], label: '♭9' },
  '9': { semitones: 14, spellings: ['9M'], label: '9' },
  s9: { semitones: 15, spellings: ['9A', '10m'], label: '♯9' },
  s11: { semitones: 18, spellings: ['11A', '12d'], label: '♯11' },
  b13: { semitones: 20, spellings: ['13m', '12A'], label: '♭13' },
  '13': { semitones: 21, spellings: ['13M'], label: '13' },
};

/** コード音（3・5・7度系）か、上に積むテンションか */
export function isTension(d: Degree): boolean {
  return DEGREES[d].semitones > 12;
}

export type ChordQualityId =
  | 'maj' | 'min' | 'dim' | 'aug' | '7'
  | 'maj7' | 'm7' | 'm7b5' | 'dim7' | 'sus4'
  | 'maj9' | 'm9' | '9' | '7b9' | '7s9' | '7s11' | 'maj7s11' | '13' | '7alt';

export interface ChordQualityDef {
  id: ChordQualityId;
  /** 表示用のコードシンボル接尾辞（C + symbol） */
  symbol: string;
  degrees: readonly Degree[];
  essential: readonly Degree[];
  /** tonal.js の ChordType 名（独立したデータとの照合テスト用） */
  tonalType: string;
  /** tonal の定義から意図的に除いている度数（例: 13th の 11度、alt の 5度） */
  tonalOmit?: readonly Degree[];
}

export const CHORD_QUALITIES: readonly ChordQualityDef[] = [
  // 三和音・7th（全音を鳴らす）
  { id: 'maj', symbol: '', degrees: ['1', '3', '5'], essential: ['1', '3', '5'], tonalType: 'M' },
  { id: 'min', symbol: 'm', degrees: ['1', 'b3', '5'], essential: ['1', 'b3', '5'], tonalType: 'm' },
  { id: 'dim', symbol: 'dim', degrees: ['1', 'b3', 'b5'], essential: ['1', 'b3', 'b5'], tonalType: 'dim' },
  { id: 'aug', symbol: 'aug', degrees: ['1', '3', 's5'], essential: ['1', '3', 's5'], tonalType: 'aug' },
  { id: 'sus4', symbol: 'sus4', degrees: ['1', '4', '5'], essential: ['1', '4', '5'], tonalType: 'sus4' },
  { id: '7', symbol: '7', degrees: ['1', '3', '5', 'b7'], essential: ['1', '3', '5', 'b7'], tonalType: '7' },
  { id: 'maj7', symbol: 'maj7', degrees: ['1', '3', '5', '7'], essential: ['1', '3', '5', '7'], tonalType: 'maj7' },
  { id: 'm7', symbol: 'm7', degrees: ['1', 'b3', '5', 'b7'], essential: ['1', 'b3', '5', 'b7'], tonalType: 'm7' },
  { id: 'm7b5', symbol: 'm7♭5', degrees: ['1', 'b3', 'b5', 'b7'], essential: ['1', 'b3', 'b5', 'b7'], tonalType: 'm7b5' },
  { id: 'dim7', symbol: 'dim7', degrees: ['1', 'b3', 'b5', 'bb7'], essential: ['1', 'b3', 'b5', 'bb7'], tonalType: 'dim7' },
  // テンション・コード（完全5度は省略可）
  { id: 'maj9', symbol: 'maj9', degrees: ['1', '3', '5', '7', '9'], essential: ['1', '3', '7', '9'], tonalType: 'maj9' },
  { id: 'm9', symbol: 'm9', degrees: ['1', 'b3', '5', 'b7', '9'], essential: ['1', 'b3', 'b7', '9'], tonalType: 'm9' },
  { id: '9', symbol: '9', degrees: ['1', '3', '5', 'b7', '9'], essential: ['1', '3', 'b7', '9'], tonalType: '9' },
  { id: '7b9', symbol: '7(♭9)', degrees: ['1', '3', '5', 'b7', 'b9'], essential: ['1', '3', 'b7', 'b9'], tonalType: '7b9' },
  { id: '7s9', symbol: '7(♯9)', degrees: ['1', '3', '5', 'b7', 's9'], essential: ['1', '3', 'b7', 's9'], tonalType: '7#9' },
  { id: '7s11', symbol: '7(♯11)', degrees: ['1', '3', '5', 'b7', 's11'], essential: ['1', '3', 'b7', 's11'], tonalType: '7#11' },
  { id: 'maj7s11', symbol: 'maj7(♯11)', degrees: ['1', '3', '5', '7', 's11'], essential: ['1', '3', '7', 's11'], tonalType: 'maj7#11' },
  { id: '13', symbol: '13', degrees: ['1', '3', '5', 'b7', '9', '13'], essential: ['1', '3', 'b7', '13'], tonalType: '13' },
  // alt: ♯9 と ♭13 を持つドミナント（5度は ♭13 と半音でぶつかるため含めない）
  { id: '7alt', symbol: '7alt', degrees: ['1', '3', 'b7', 's9', 'b13'], essential: ['1', '3', 'b7', 's9', 'b13'], tonalType: '7#9b13', tonalOmit: ['5'] },
];

const BY_ID = new Map(CHORD_QUALITIES.map((q) => [q.id, q]));

export function getChordQuality(id: ChordQualityId): ChordQualityDef {
  const q = BY_ID.get(id);
  if (!q) throw new Error(`unknown chord quality ${id}`);
  return q;
}

export function isChordQualityId(id: string): id is ChordQualityId {
  return BY_ID.has(id as ChordQualityId);
}

/** 度数の集合 → ルートからのピッチクラス集合（0..11） */
export function pitchClassSet(degrees: readonly Degree[]): Set<number> {
  return new Set(degrees.map((d) => DEGREES[d].semitones % 12));
}

/**
 * ルート上に鳴らしたピッチクラス集合 voiced（ルート基準 0..11）が、
 * コード q の正しいボイシングか（essential ⊆ voiced ⊆ degrees）。
 */
export function isValidVoicingOf(voiced: ReadonlySet<number>, q: ChordQualityDef): boolean {
  const full = pitchClassSet(q.degrees);
  const ess = pitchClassSet(q.essential);
  for (const pc of ess) if (!voiced.has(pc)) return false;
  for (const pc of voiced) if (!full.has(pc)) return false;
  return true;
}

/** 2つのコードの構成音の違い（解説用）。ピッチクラスで比較し、度数で返す */
export function degreeDifference(a: ChordQualityDef, b: ChordQualityDef): { onlyA: Degree[]; onlyB: Degree[] } {
  const pa = pitchClassSet(a.degrees), pb = pitchClassSet(b.degrees);
  return {
    onlyA: a.degrees.filter((d) => !pb.has(DEGREES[d].semitones % 12)),
    onlyB: b.degrees.filter((d) => !pa.has(DEGREES[d].semitones % 12)),
  };
}
