import { getInterval, isIntervalId } from '../theory/intervals';
import { accidentalCount, midiOf } from '../theory/pitch';
import type { IntervalQuestion } from './types';
import { CHOICE_COUNT, INTERVAL_POOLS, INTERVAL_REGISTERS } from './intervalConfig';

/**
 * インターバル問題が「聴覚的に一意に答えられる」ことを検証する。
 * 空配列なら妥当。生成器は生成のたびにこれを実行し、テストでも全面的に使う。
 */
export function validateIntervalQuestion(q: IntervalQuestion): string[] {
  const errors: string[] = [];
  const { payload, choices } = q;

  // 1. 選択肢の数・重複
  if (choices.length !== CHOICE_COUNT) errors.push(`choice count ${choices.length}`);
  const ids = choices.map((c) => c.id);
  if (new Set(ids).size !== ids.length) errors.push('duplicate choice ids');
  if (!ids.includes(q.answerId)) errors.push('answer not in choices');
  if (q.answerId !== payload.intervalId) errors.push('answerId != payload.intervalId');

  // 2. 異名同音の排除: 選択肢の半音数がすべて異なること
  const unknown = ids.filter((id) => !isIntervalId(id));
  if (unknown.length > 0) {
    errors.push(`unknown choice ids ${unknown.join(',')}`);
    return errors;
  }
  const semis = ids.map((id) => getInterval(id as never).semitones);
  if (new Set(semis).size !== semis.length) errors.push('choices contain enharmonically identical intervals');

  // 3. 難易度の母集団に含まれること
  const pool = INTERVAL_POOLS[q.difficulty];
  for (const id of ids) if (!pool.includes(id as never)) errors.push(`choice ${id} outside ${q.difficulty} pool`);

  // 4. 鳴る音が正解の音程・方向と一致すること
  const [m1, m2] = payload.midis;
  const answerSemis = getInterval(payload.intervalId).semitones;
  const diff = m2 - m1;
  if (Math.abs(diff) !== answerSemis) errors.push(`played distance ${diff} != ${answerSemis}`);
  if (payload.direction === 'ascending' && diff <= 0) errors.push('direction mismatch (ascending)');
  if (payload.direction === 'descending' && diff >= 0) errors.push('direction mismatch (descending)');

  // 5. playback が payload と一致し、2音が同じ音量・長さで順に鳴ること（公平性）
  const pb = q.playback;
  if (pb.length !== 2) errors.push('playback must have 2 notes');
  else {
    if (pb[0]!.midi !== m1 || pb[1]!.midi !== m2) errors.push('playback midi != payload');
    if (pb[0]!.velocity !== pb[1]!.velocity || pb[0]!.duration !== pb[1]!.duration) errors.push('unequal note dynamics');
    if (!(pb[1]!.time > pb[0]!.time)) errors.push('notes must be sequential (melodic)');
    if (pb[0]!.time + pb[0]!.duration > pb[1]!.time + 1e-9) errors.push('notes overlap (would be harmonic)');
  }

  // 6. 音域
  const { low, high } = INTERVAL_REGISTERS[q.difficulty];
  for (const m of payload.midis) if (m < low || m > high) errors.push(`midi ${m} outside register`);

  // 7. 綴りと鳴る音の整合、ダブル臨時記号の回避
  payload.notes.forEach((n, i) => {
    try {
      if (midiOf(n) !== payload.midis[i]) errors.push(`spelling ${n} != midi ${payload.midis[i]}`);
      if (accidentalCount(n) > 1) errors.push(`double accidental ${n}`);
    } catch {
      errors.push(`invalid note name ${n}`);
    }
  });

  return errors;
}
