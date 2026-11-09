import { Note } from 'tonal';
import { createRng } from '../theory/rng';
import { DEGREES, getChordQuality, type Degree } from '../theory/chords';
import { accidentalCount, pitchClass, spellingCandidates } from '../theory/pitch';
import { getProgression, SLOTS_PER_PROGRESSION, type ProgressionId } from '../theory/progressions';
import {
  PROGRESSION_GAP, PROGRESSION_PARAMS, PROGRESSION_POOLS, PROGRESSION_RANGES, PROGRESSION_VELOCITY, progressionLabelKey,
} from './progressionConfig';
import { voicingProblems } from './chordValidation';
import { CHOICE_COUNT } from './intervalConfig';
import type { NoteEvent, ProgressionParams, ProgressionQuestion, ProgressionSettings, RenderedChord } from './types';
import { validateProgressionQuestion } from './progressionValidation';

/** 上部構造に使う度数（ルートを除く。省略可能な完全5度は省いて3声にそろえる） */
function upperDegrees(qualityId: Parameters<typeof getChordQuality>[0]): Degree[] {
  const q = getChordQuality(qualityId);
  const tones = q.degrees.filter((d) => d !== '1');
  const withoutFifth = tones.filter((d) => d !== '5');
  return !q.essential.includes('5') && withoutFifth.length >= 3 ? withoutFifth : tones;
}

/** 指定ピッチクラスの密集配置の候補（全転回 × 音域内の全オクターブ） */
function upperCandidates(bass: number, degrees: Degree[]): number[][] {
  const pcs = degrees.map((d) => (pitchClass(bass) + DEGREES[d].semitones) % 12);
  const out: number[][] = [];
  for (let r = 0; r < pcs.length; r++) {
    const order = [...pcs.slice(r), ...pcs.slice(0, r)];
    for (let start = PROGRESSION_RANGES.upper.low; start < PROGRESSION_RANGES.upper.low + 12; start++) {
      if (pitchClass(start) !== order[0]) continue;
      for (let shift = 0; shift <= 24; shift += 12) {
        const notes: number[] = [];
        let prev = start + shift - 1;
        for (const pc of order) {
          let m = prev + 1;
          while (pitchClass(m) !== pc) m++;
          notes.push(m);
          prev = m;
        }
        if (notes.at(-1)! <= PROGRESSION_RANGES.upper.high) out.push(notes);
      }
    }
  }
  return out;
}

const mean = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

/** 声部の移動量（音数が違う場合は、各音から最も近い前の音までの距離） */
function movement(prev: readonly number[], next: readonly number[]): number {
  return next.reduce((s, n) => s + Math.min(...prev.map((p) => Math.abs(p - n))), 0);
}

/**
 * 進行をキー・テンポ・音域パラメータに従って決定的に鳴らす。
 * ベースは前の音に近いオクターブ、上部構造は声部の移動が最小で目標音域に近い配置を選ぶ。
 */
export function renderProgression(id: ProgressionId, params: ProgressionParams): RenderedChord[] {
  const def = getProgression(id);
  const tonicPc = pitchClass(params.tonicMidi);
  let prevBass = params.bassAnchor;
  let prevUpper: number[] | null = null;
  const chords: RenderedChord[] = [];
  let slot = 0;
  for (const ch of def.chords) {
    const rootPc = (tonicPc + DEGREES_BY_INTERVAL(ch.rootInterval)) % 12;
    // ベース: 音域内で直前のベースに最も近い同じピッチクラス
    let bass = -1;
    for (let m = PROGRESSION_RANGES.bass.low; m <= PROGRESSION_RANGES.bass.high; m++) {
      if (pitchClass(m) === rootPc && (bass < 0 || Math.abs(m - prevBass) < Math.abs(bass - prevBass))) bass = m;
    }
    const degrees = upperDegrees(ch.quality);
    const candidates = upperCandidates(bass, degrees).filter((u) => voicingProblems([bass, ...u]).length === 0);
    if (candidates.length === 0) throw new Error(`no voicing for ${ch.roman} in ${id}`);
    const cost = (u: number[]) => (prevUpper ? movement(prevUpper, u) : 0) + 1.5 * Math.abs(mean(u) - params.center);
    const upper = candidates.reduce((best, u) => (cost(u) < cost(best) ? u : best));
    chords.push({ roman: ch.roman, quality: ch.quality, startSlot: slot, slots: ch.slots, bass, upper });
    slot += ch.slots;
    prevBass = bass;
    prevUpper = upper;
  }
  return chords;
}

const DEGREES_BY_INTERVAL = (iv: string): number => {
  const map: Record<string, number> = { '1P': 0, '2m': 1, '2M': 2, '3m': 3, '3M': 4, '4P': 5, '5d': 6, '5P': 7, '6m': 8, '6M': 9, '7m': 10, '7M': 11 };
  const s = map[iv];
  if (s === undefined) throw new Error(`unsupported root interval ${iv}`);
  return s;
};

export function slotSeconds(params: ProgressionParams): number {
  return (60 / params.bpm) * PROGRESSION_PARAMS.beatsPerSlot;
}

export function progressionPlayback(chords: readonly RenderedChord[], params: ProgressionParams): NoteEvent[] {
  const sec = slotSeconds(params);
  return chords.flatMap((ch) => [ch.bass, ...ch.upper].map((midi) => ({
    midi,
    time: ch.startSlot * sec,
    duration: ch.slots * sec - PROGRESSION_GAP,
    velocity: PROGRESSION_VELOCITY,
  })));
}

/** ベースラインだけ（ルートの動きの確認用） */
export function bassLinePlayback(chords: readonly RenderedChord[], params: ProgressionParams): NoteEvent[] {
  return progressionPlayback(chords.map((c) => ({ ...c, upper: [] })), params);
}

const AWKWARD = new Set(['Cb', 'Fb', 'E#', 'B#']);

/** トニックの綴り（ダブル臨時記号を避ける）と各和音のコードシンボル */
export function spellProgression(id: ProgressionId, tonicMidi: number): { tonic: string; symbols: string[] } {
  const def = getProgression(id);
  for (const cand of spellingCandidates(tonicMidi)) {
    const tonic = Note.pitchClass(cand);
    const roots = def.chords.map((ch) => {
      const r = Note.pitchClass(Note.transpose(tonic, ch.rootInterval));
      // ダブル臨時記号や C♭・F♭・E♯・B♯ は、譜面で一般的な異名同音に置き換える
      return accidentalCount(r) > 1 || AWKWARD.has(r) ? Note.enharmonic(r) : r;
    });
    if (roots.every((r) => accidentalCount(r) <= 1)) {
      return { tonic, symbols: def.chords.map((ch, i) => `${roots[i]}${getChordQuality(ch.quality).symbol}`) };
    }
  }
  throw new Error(`no clean spelling for ${id} in ${tonicMidi}`);
}

export function generateProgressionQuestion(settings: ProgressionSettings, seed: number): ProgressionQuestion {
  const rng = createRng(seed);
  const pool = PROGRESSION_POOLS[settings.difficulty];
  const focus = settings.focus?.filter((id) => pool.includes(id)) ?? [];
  const answer = rng.pick(focus.length > 0 ? focus : pool);
  const P = PROGRESSION_PARAMS;
  const params: ProgressionParams = {
    tonicMidi: 60 + rng.int(0, 11),
    bpm: rng.int(P.bpm.low, P.bpm.high),
    center: rng.int(P.center.low, P.center.high),
    bassAnchor: rng.int(P.bassAnchor.low, P.bassAnchor.high),
  };
  const distractors = rng.shuffle(pool.filter((id) => id !== answer)).slice(0, CHOICE_COUNT - 1);
  const choices = rng.shuffle([answer, ...distractors]).map((id) => ({ id, labelKey: progressionLabelKey(id) }));
  const chords = renderProgression(answer, params);
  const q: ProgressionQuestion = {
    id: `progression:${seed}`,
    category: 'progression',
    difficulty: settings.difficulty,
    seed,
    choices,
    answerId: answer,
    playback: progressionPlayback(chords, params),
    itemKey: `progression:${answer}`,
    payload: { progressionId: answer, params, chords, ...spellProgression(answer, params.tonicMidi) },
  };
  const errors = validateProgressionQuestion(q);
  if (errors.length > 0) throw new Error(`generated invalid progression question (seed ${seed}): ${errors.join('; ')}`);
  return q;
}

/** 「自分の回答を再生」: 同じキー・テンポ・音域で選んだ進行を鳴らす */
export function progressionComparisonPlayback(q: ProgressionQuestion, id: ProgressionId): NoteEvent[] {
  return progressionPlayback(renderProgression(id, q.payload.params), q.payload.params);
}

export const TOTAL_SLOTS = SLOTS_PER_PROGRESSION;
