import { getChordQuality, isChordQualityId, isValidVoicingOf, pitchClassSet } from '../theory/chords';
import { accidentalCount, midiOf, pitchClass } from '../theory/pitch';
import { CHORD_BASS_RANGE, CHORD_POOLS, CHORD_TOP_LIMIT, LOW_INTERVAL_RULES } from './chordConfig';
import { CHOICE_COUNT } from './intervalConfig';
import type { ChordQuestion } from './types';

/** 音域と低音の濁りに関する問題（低→高の MIDI 列） */
export function voicingProblems(midis: readonly number[]): string[] {
  const errors: string[] = [];
  const sorted = [...midis].sort((a, b) => a - b);
  if (new Set(sorted).size !== sorted.length) errors.push('duplicate notes');
  if (sorted.at(-1)! > CHORD_TOP_LIMIT) errors.push(`top note ${sorted.at(-1)} above limit`);
  for (let i = 0; i + 1 < sorted.length; i++) {
    const lo = sorted[i]!, gap = sorted[i + 1]! - lo;
    for (const r of LOW_INTERVAL_RULES) {
      if (lo < r.below && gap < r.minInterval) errors.push(`low interval: ${gap} semitones above midi ${lo}`);
    }
  }
  return errors;
}

/**
 * コード問題が「聴いて一意に答えられる」ことを検証する。空配列なら妥当。
 * 前提: ベース（最低音）＝ルート。問題は「ベース上に何のコードが鳴ったか」を問う。
 */
export function validateChordQuestion(q: ChordQuestion): string[] {
  const errors: string[] = [];
  const ids = q.choices.map((c) => c.id);

  // 1. 選択肢
  if (ids.length !== CHOICE_COUNT) errors.push(`choice count ${ids.length}`);
  if (new Set(ids).size !== ids.length) errors.push('duplicate choice ids');
  if (!ids.includes(q.answerId)) errors.push('answer not in choices');
  if (q.answerId !== q.payload.qualityId) errors.push('answerId != payload.qualityId');
  if (!ids.every(isChordQualityId)) return [...errors, 'unknown choice id'];
  for (const id of ids) if (!CHORD_POOLS[q.difficulty].includes(id as never)) errors.push(`choice ${id} outside pool`);
  const defs = ids.map((id) => getChordQuality(id as never));

  // 2. 選択肢どうしの構成音が異なる（同じ音集合に複数の名前がない）
  const keys = defs.map((d) => [...pitchClassSet(d.degrees)].sort((a, b) => a - b).join(','));
  if (new Set(keys).size !== keys.length) errors.push('two choices share the same pitch-class set');

  // 3. 再生内容
  const pb = q.playback;
  const midis = pb.map((e) => e.midi);
  if (pb.length < 3) errors.push('chord must have at least 3 notes');
  if (!pb.every((e) => e.time === pb[0]!.time && e.duration === pb[0]!.duration && e.velocity === pb[0]!.velocity)) {
    errors.push('block chord notes must share time, duration and velocity');
  }
  const voiceMidis = q.payload.voices.map((v) => v.midi);
  if (midis.join() !== voiceMidis.join()) errors.push('playback != payload voices');
  const bass = Math.min(...midis);
  if (bass !== q.payload.voicing.bassMidi) errors.push('lowest note is not the bass');
  const root = q.payload.voices.find((v) => v.degree === '1');
  if (!root || root.midi !== bass) errors.push('bass is not the root');

  // 4. 正解のボイシングとして正しい（必須音をすべて含み、構成音以外を含まない）
  const voiced = new Set(midis.map((m) => pitchClass(m - bass)));
  const answer = getChordQuality(q.payload.qualityId);
  if (!isValidVoicingOf(voiced, answer)) errors.push(`voicing is not a valid ${answer.id}`);

  // 5. 曖昧さの排除: 鳴った音が他の選択肢の正しいボイシングとしても成立しない
  for (const d of defs) {
    if (d.id !== answer.id && isValidVoicingOf(voiced, d)) errors.push(`voicing is also a valid ${d.id}`);
  }

  // 6. 度数と実音の整合、綴り
  for (const v of q.payload.voices) {
    const def = getChordQuality(q.payload.qualityId);
    if (!def.degrees.includes(v.degree)) errors.push(`degree ${v.degree} not in ${def.id}`);
    try {
      if (midiOf(v.note) !== v.midi) errors.push(`spelling ${v.note} != midi ${v.midi}`);
      if (accidentalCount(v.note) > 1) errors.push(`double accidental ${v.note}`);
    } catch {
      errors.push(`invalid note ${v.note}`);
    }
  }

  // 7. 音域・低音の濁り
  const range = CHORD_BASS_RANGE[q.difficulty];
  if (bass < range.low || bass > range.high) errors.push(`bass ${bass} outside range`);
  errors.push(...voicingProblems(midis));

  return errors;
}
