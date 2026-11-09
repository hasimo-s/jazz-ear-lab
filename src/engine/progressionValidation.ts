import { Note } from 'tonal';
import { getChordQuality, isValidVoicingOf } from '../theory/chords';
import { accidentalCount, pitchClass } from '../theory/pitch';
import {
  getProgression, isProgressionId, slotChords, SLOTS_PER_PROGRESSION, type ProgressionDef, type ProgressionId,
} from '../theory/progressions';
import { CHOICE_COUNT } from './intervalConfig';
import { MAX_REGISTER_DIFF, PROGRESSION_POOLS, PROGRESSION_RANGES } from './progressionConfig';
import { voicingProblems } from './chordValidation';
import { progressionPlayback, renderProgression } from './progressionGenerator';
import type { ProgressionQuestion } from './types';

const ROOT_SEMIS: Record<string, number> = { '1P': 0, '2m': 1, '2M': 2, '3m': 3, '3M': 4, '4P': 5, '5d': 6, '5P': 7, '6m': 8, '6M': 9, '7m': 10, '7M': 11 };

/** 枠ごとの (ルート, コード種) 列。移調して一致するかの比較に使う */
function signature(p: ProgressionDef, transpose: number): string {
  return slotChords(p).map((ch) => `${(ROOT_SEMIS[ch.rootInterval]! + transpose) % 12}:${ch.quality}`).join('|');
}

/**
 * 2つの進行が「どのキーで鳴らしても」同じ響きにならないか。
 * 聴き手はキーを知らないので、移調して一致するなら聴き分け不能とみなす。
 */
export function progressionsDistinguishable(a: ProgressionId, b: ProgressionId): boolean {
  const pa = getProgression(a), pb = getProgression(b);
  const sa = signature(pa, 0);
  for (let t = 0; t < 12; t++) if (signature(pb, t) === sa) return false;
  return true;
}

export function validateProgressionQuestion(q: ProgressionQuestion): string[] {
  const errors: string[] = [];
  const ids = q.choices.map((c) => c.id);
  const { params } = q.payload;

  // 1. 選択肢
  if (ids.length !== CHOICE_COUNT) errors.push(`choice count ${ids.length}`);
  if (new Set(ids).size !== ids.length) errors.push('duplicate choice ids');
  if (!ids.includes(q.answerId)) errors.push('answer not in choices');
  if (q.answerId !== q.payload.progressionId) errors.push('answerId != payload.progressionId');
  if (!ids.every(isProgressionId)) return [...errors, 'unknown choice id'];
  for (const id of ids) if (!PROGRESSION_POOLS[q.difficulty].includes(id as ProgressionId)) errors.push(`choice ${id} outside pool`);

  // 2. 聴き分け可能性（移調しても一致しない）
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    if (!progressionsDistinguishable(ids[i] as ProgressionId, ids[j] as ProgressionId)) errors.push(`${ids[i]} and ${ids[j]} sound identical`);
  }

  // 3. 再生内容 = 正解の進行を同じパラメータで鳴らしたもの
  const expected = progressionPlayback(renderProgression(q.answerId as ProgressionId, params), params);
  if (JSON.stringify(expected) !== JSON.stringify(q.playback)) errors.push('playback != rendered answer');

  // 4. 各和音: ベース＝ルート、正しいボイシング、音域、低音の濁り
  const def = getProgression(q.payload.progressionId);
  if (q.payload.chords.length !== def.chords.length) errors.push('chord count mismatch');
  q.payload.chords.forEach((ch, i) => {
    const d = def.chords[i];
    if (!d) return;
    const rootPc = (pitchClass(params.tonicMidi) + ROOT_SEMIS[d.rootInterval]!) % 12;
    if (pitchClass(ch.bass) !== rootPc) errors.push(`chord ${i}: bass is not the root`);
    const rel = new Set([ch.bass, ...ch.upper].map((m) => pitchClass(m - ch.bass)));
    if (!isValidVoicingOf(rel, getChordQuality(d.quality))) errors.push(`chord ${i}: not a valid ${d.quality}`);
    if (ch.bass < PROGRESSION_RANGES.bass.low || ch.bass > PROGRESSION_RANGES.bass.high) errors.push(`chord ${i}: bass out of range`);
    if (ch.upper.some((m) => m < PROGRESSION_RANGES.upper.low || m > PROGRESSION_RANGES.upper.high)) errors.push(`chord ${i}: upper out of range`);
    if (Math.min(...ch.upper) <= ch.bass) errors.push(`chord ${i}: upper voice below bass`);
    errors.push(...voicingProblems([ch.bass, ...ch.upper]).map((e) => `chord ${i}: ${e}`));
  });

  // 5. 公平性: 選択肢の進行を同じパラメータで鳴らしたとき、長さ・音量・音域が揃う
  const answerEvents = expected;
  const end = (evs: typeof expected) => Math.max(...evs.map((e) => e.time + e.duration));
  const answerMean = answerEvents.reduce((s, e) => s + e.midi, 0) / answerEvents.length;
  for (const id of ids) {
    const evs = progressionPlayback(renderProgression(id as ProgressionId, params), params);
    if (Math.abs(end(evs) - end(answerEvents)) > 1e-9) errors.push(`${id}: total length differs`);
    if (new Set(evs.map((e) => e.velocity)).size !== 1 || evs[0]!.velocity !== answerEvents[0]!.velocity) errors.push(`${id}: velocity differs`);
    const m = evs.reduce((s, e) => s + e.midi, 0) / evs.length;
    if (Math.abs(m - answerMean) > MAX_REGISTER_DIFF) errors.push(`${id}: register differs by ${(m - answerMean).toFixed(1)}`);
  }
  if (def.chords.reduce((s, c) => s + c.slots, 0) !== SLOTS_PER_PROGRESSION) errors.push('progression length != slots');

  // 6. 綴り
  if (accidentalCount(q.payload.tonic) > 1 || Note.chroma(q.payload.tonic) !== pitchClass(params.tonicMidi)) errors.push('tonic spelling');
  q.payload.symbols.forEach((s, i) => {
    const root = /^[A-G][#b]*/.exec(s)?.[0] ?? '';
    if (accidentalCount(root) > 1) errors.push(`symbol ${s}: double accidental`);
    const ch = q.payload.chords[i];
    if (ch && Note.chroma(root) !== pitchClass(ch.bass)) errors.push(`symbol ${s} != bass`);
  });

  return errors;
}
