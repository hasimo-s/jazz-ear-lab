import { Interval, Note } from 'tonal';

/**
 * 音名の綴り（スペリング）に関するユーティリティ。
 * MIDI番号が「鳴る音」、音名が「表示・理論上の名前」。両者の整合は常に検証する。
 */

/** ジャズで一般的な綴りを優先したルート音名（ピッチクラス 0..11） */
const PREFERRED_ROOT_SPELLINGS: readonly (readonly string[])[] = [
  ['C'],
  ['Db', 'C#'],
  ['D'],
  ['Eb', 'D#'],
  ['E'],
  ['F'],
  ['Gb', 'F#'],
  ['G'],
  ['Ab', 'G#'],
  ['A'],
  ['Bb', 'A#'],
  ['B'],
];

export function pitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12;
}

/** MIDI番号に対する綴り候補（優先順）をオクターブ付きで返す */
export function spellingCandidates(midi: number): string[] {
  const pc = pitchClass(midi);
  return PREFERRED_ROOT_SPELLINGS[pc]!.map((letter) => {
    // 例: midi 60 = C4。B#やCbは候補にしないので単純計算でよい
    const octave = Math.floor(midi / 12) - 1;
    return `${letter}${octave}`;
  });
}

export function accidentalCount(noteName: string): number {
  return Math.abs(Note.get(noteName).alt);
}

/**
 * start から tonal 形式の音程 (例 '3M', '-9m') だけ移した音名を返す。
 * 返り値の MIDI が期待値と一致することを確認する。
 */
export function transposeChecked(start: string, tonalInterval: string, expectedMidi: number): string {
  const out = Note.transpose(start, tonalInterval);
  if (!out || Note.midi(out) !== expectedMidi) {
    throw new Error(`spelling mismatch: ${start} + ${tonalInterval} = ${out}, expected midi ${expectedMidi}`);
  }
  return out;
}

export function semitonesOf(tonalInterval: string): number {
  const s = Interval.semitones(tonalInterval);
  if (s === undefined || Number.isNaN(s)) throw new Error(`unknown interval ${tonalInterval}`);
  return s;
}

/** 表示用: 'Bb4' -> 'B♭4', 'F#3' -> 'F♯3' */
export function displayNote(noteName: string): string {
  return noteName.replace(/##/g, '𝄪').replace(/#/g, '♯').replace(/(?<=[A-G])bb/g, '𝄫').replace(/(?<=[A-G])b/g, '♭');
}

export function midiOf(noteName: string): number {
  const m = Note.midi(noteName);
  if (m === null || m === undefined) throw new Error(`invalid note ${noteName}`);
  return m;
}

/** 譜面ではあまり使わない綴り（C♭・F♭・E♯・B♯）。ダブル臨時記号は accidentalCount で別に扱う */
export function isAwkward(noteName: string): boolean {
  return /^(Cb|Fb|E#|B#)/.test(noteName);
}
