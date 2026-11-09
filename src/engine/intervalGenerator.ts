import { createRng, type Rng } from '../theory/rng';
import { getInterval, type IntervalDef, type IntervalId } from '../theory/intervals';
import { accidentalCount, spellingCandidates, transposeChecked } from '../theory/pitch';
import type { Difficulty, Direction, IntervalQuestion, IntervalSettings, NoteEvent } from './types';
import { validateIntervalQuestion } from './intervalValidation';
import {
  CHOICE_COUNT, INTERVAL_POOLS, INTERVAL_REGISTERS, INTERVAL_TIMING, NEAR_DISTRACTORS, NEAR_RANGE, intervalLabelKey,
} from './intervalConfig';

export { INTERVAL_POOLS, INTERVAL_REGISTERS, intervalLabelKey } from './intervalConfig';

function pickDistractors(rng: Rng, answer: IntervalDef, difficulty: Difficulty): IntervalDef[] {
  const pool = INTERVAL_POOLS[difficulty].map(getInterval).filter((d) => d.id !== answer.id);
  const near = rng.shuffle(pool.filter((d) => Math.abs(d.semitones - answer.semitones) <= NEAR_RANGE));
  const chosen = near.slice(0, Math.min(NEAR_DISTRACTORS[difficulty], near.length));
  const rest = rng.shuffle(pool.filter((d) => !chosen.includes(d)));
  while (chosen.length < CHOICE_COUNT - 1) {
    const d = rest.shift();
    if (!d) throw new Error(`pool too small for ${difficulty}`);
    chosen.push(d);
  }
  return chosen;
}

/**
 * 1音目の綴りと2音目の綴りを決める。
 * ルートのジャズ的な綴り × 音程の綴り候補を順に試し、ダブルシャープ/フラットを避ける。
 */
export function spellInterval(firstMidi: number, secondMidi: number, def: IntervalDef, direction: Direction): [string, string] {
  for (const first of spellingCandidates(firstMidi)) {
    for (const iv of def.spellings) {
      const tonalIv = direction === 'ascending' ? iv : `-${iv}`;
      const second = transposeChecked(first, tonalIv, secondMidi);
      if (accidentalCount(second) <= 1) return [first, second];
    }
  }
  throw new Error(`no clean spelling for ${def.id} from midi ${firstMidi} (${direction})`);
}

export function buildIntervalPlayback(firstMidi: number, secondMidi: number): NoteEvent[] {
  const { gap, duration, velocity } = INTERVAL_TIMING;
  return [
    { midi: firstMidi, time: 0, duration, velocity },
    { midi: secondMidi, time: gap, duration, velocity },
  ];
}

/**
 * シードから1問を決定的に生成する。
 * 同じ (settings, seed) なら必ず同じ問題になる。
 */
export function generateIntervalQuestion(settings: IntervalSettings, seed: number): IntervalQuestion {
  const rng = createRng(seed);
  const { difficulty } = settings;
  const poolIds = INTERVAL_POOLS[difficulty];
  const answerPool = settings.focus?.filter((id) => poolIds.includes(id)) ?? [];
  const answer = getInterval(rng.pick(answerPool.length > 0 ? answerPool : poolIds));

  const direction: Direction =
    settings.direction === 'both' ? (rng.next() < 0.5 ? 'ascending' : 'descending') : settings.direction;

  const { low, high } = INTERVAL_REGISTERS[difficulty];
  const lowMidi = rng.int(low, high - answer.semitones);
  const highMidi = lowMidi + answer.semitones;
  const [firstMidi, secondMidi] = direction === 'ascending' ? [lowMidi, highMidi] : [highMidi, lowMidi];
  const notes = spellInterval(firstMidi, secondMidi, answer, direction);

  const distractors = pickDistractors(rng, answer, difficulty);
  const choices = rng.shuffle([answer, ...distractors]).map((d) => ({ id: d.id, labelKey: intervalLabelKey(d.id) }));

  const q: IntervalQuestion = {
    id: `interval:${seed}`,
    category: 'interval',
    difficulty,
    seed,
    choices,
    answerId: answer.id,
    playback: buildIntervalPlayback(firstMidi, secondMidi),
    itemKey: `interval:${answer.id}:${direction}`,
    payload: { intervalId: answer.id, direction, notes, midis: [firstMidi, secondMidi] },
  };

  const errors = validateIntervalQuestion(q);
  if (errors.length > 0) {
    throw new Error(`generated invalid question (seed ${seed}): ${errors.join('; ')}`);
  }
  return q;
}

/**
 * 「自分の回答を再生」用: 同じ1音目・同じ方向で、選んだ音程を鳴らす。
 * 音域外になる場合はオクターブを移して範囲に収める。
 */
export function comparisonPlayback(q: IntervalQuestion, choiceId: IntervalId): NoteEvent[] {
  const def = getInterval(choiceId);
  const first = q.payload.midis[0];
  const sign = q.payload.direction === 'ascending' ? 1 : -1;
  let a = first;
  let b = first + sign * def.semitones;
  while (Math.max(a, b) > 96) { a -= 12; b -= 12; }
  while (Math.min(a, b) < 28) { a += 12; b += 12; }
  return buildIntervalPlayback(a, b);
}
