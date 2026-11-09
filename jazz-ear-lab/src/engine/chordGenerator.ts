import { Note } from 'tonal';
import { createRng, type Rng } from '../theory/rng';
import {
  DEGREES, getChordQuality, isTension, isValidVoicingOf, pitchClassSet,
  type ChordQualityDef, type ChordQualityId, type Degree,
} from '../theory/chords';
import { accidentalCount, pitchClass, spellingCandidates } from '../theory/pitch';
import {
  CHORD_BASS_RANGE, CHORD_NEAR_DISTRACTORS, CHORD_POOLS, CHORD_STYLE, CHORD_TIMING, CHORD_UPPER_FLOOR,
  chordLabelKey, type VoicingStyle,
} from './chordConfig';
import { CHOICE_COUNT } from './intervalConfig';
import type { ChordQuestion, ChordSettings, ChordVoice, NoteEvent } from './types';
import { voicingProblems, validateChordQuestion } from './chordValidation';

export interface VoicingParams {
  bassMidi: number;
  style: VoicingStyle;
  /** 上部構造のコード音の転回（回転数） */
  inversion: number;
  /** 完全5度を省略するか（essential に 5 を含まないコードのみ有効） */
  omit5: boolean;
}

/** 上部に積む度数（ルートを除く）。コード音を転回し、テンションはその上に順に積む */
function upperDegrees(q: ChordQualityDef, p: VoicingParams): Degree[] {
  const canOmit5 = !q.essential.includes('5');
  const tones = q.degrees.filter((d) => d !== '1' && !(p.omit5 && canOmit5 && d === '5'));
  const chordTones = tones.filter((d) => !isTension(d));
  const tensions = tones.filter((d) => isTension(d));
  const r = p.style === 'close' ? 0 : ((p.inversion % chordTones.length) + chordTones.length) % chordTones.length;
  return [...chordTones.slice(r), ...chordTones.slice(0, r), ...tensions];
}

/** パラメータから決定的にボイシング（低→高の MIDI と度数）を作る */
export function voiceChord(qualityId: ChordQualityId, p: VoicingParams): { midi: number; degree: Degree }[] {
  const q = getChordQuality(qualityId);
  const voices: { midi: number; degree: Degree }[] = [{ midi: p.bassMidi, degree: '1' }];
  const floor = p.style === 'close' ? p.bassMidi + 1 : p.style === 'spread' ? p.bassMidi + 12 : Math.max(p.bassMidi + 10, CHORD_UPPER_FLOOR);
  let prev = floor - 1;
  for (const d of upperDegrees(q, p)) {
    const pc = (pitchClass(p.bassMidi) + DEGREES[d].semitones) % 12;
    let m = prev + 1;
    while (pitchClass(m) !== pc) m++;
    voices.push({ midi: m, degree: d });
    prev = m;
  }
  return voices;
}

/** ルートの綴りを決め、各音に音名を付ける。ダブル臨時記号を避ける */
export function spellChord(bassMidi: number, voices: { midi: number; degree: Degree }[]): { rootPc: string; voices: ChordVoice[] } {
  for (const rootName of spellingCandidates(bassMidi)) {
    const rootPc = Note.pitchClass(rootName);
    const out: ChordVoice[] = [];
    let ok = true;
    for (const v of voices) {
      const pcName = DEGREES[v.degree].spellings
        .map((iv) => Note.pitchClass(Note.transpose(rootPc, iv)))
        .find((n) => n && accidentalCount(n) <= 1);
      if (!pcName) { ok = false; break; }
      const base = Math.floor(v.midi / 12) - 1;
      const octave = [base, base - 1, base + 1].find((o) => Note.midi(`${pcName}${o}`) === v.midi);
      if (octave === undefined) { ok = false; break; }
      out.push({ midi: v.midi, degree: v.degree, note: `${pcName}${octave}` });
    }
    if (ok) return { rootPc, voices: out };
  }
  throw new Error(`no clean spelling for chord on midi ${bassMidi}`);
}

export function blockPlayback(midis: readonly number[]): NoteEvent[] {
  const { duration, velocity } = CHORD_TIMING;
  return midis.map((midi) => ({ midi, time: 0, duration, velocity }));
}

/** 下から順に1音ずつ鳴らし、最後に全体を伸ばす（構成音の確認用） */
export function arpeggioPlayback(midis: readonly number[]): NoteEvent[] {
  const { duration, velocity, arpeggioStep } = CHORD_TIMING;
  const sorted = [...midis].sort((a, b) => a - b);
  const end = sorted.length * arpeggioStep;
  return sorted.map((midi, i) => ({ midi, time: i * arpeggioStep, duration: end - i * arpeggioStep + duration, velocity }));
}

function relativeSet(voices: readonly { midi: number }[], bassMidi: number): Set<number> {
  return new Set(voices.map((v) => pitchClass(v.midi - bassMidi)));
}

function symmetricDiff(a: Set<number>, b: Set<number>): number {
  let n = 0;
  for (const x of a) if (!b.has(x)) n++;
  for (const x of b) if (!a.has(x)) n++;
  return n;
}

function pickDistractors(rng: Rng, answer: ChordQualityDef, voiced: Set<number>, settings: ChordSettings): ChordQualityDef[] {
  // 鳴った音が「そのコードの正しいボイシング」とも解釈できる候補は除外（曖昧さの排除）
  const candidates = CHORD_POOLS[settings.difficulty]
    .filter((id) => id !== answer.id)
    .map(getChordQuality)
    .filter((q) => !isValidVoicingOf(voiced, q));
  const answerSet = pitchClassSet(answer.degrees);
  const bySimilarity = rng.shuffle(candidates)
    .map((q) => ({ q, d: symmetricDiff(answerSet, pitchClassSet(q.degrees)) }))
    .sort((a, b) => a.d - b.d)
    .map((x) => x.q);
  const chosen = bySimilarity.slice(0, CHORD_NEAR_DISTRACTORS[settings.difficulty]);
  const rest = rng.shuffle(candidates.filter((q) => !chosen.includes(q)));
  while (chosen.length < CHOICE_COUNT - 1) {
    const q = rest.shift();
    if (!q) throw new Error(`not enough unambiguous distractors for ${answer.id}`);
    chosen.push(q);
  }
  return chosen;
}

const MAX_ATTEMPTS = 30;

export function generateChordQuestion(settings: ChordSettings, seed: number): ChordQuestion {
  const rng = createRng(seed);
  const { difficulty } = settings;
  const pool = CHORD_POOLS[difficulty];
  const focus = settings.focus?.filter((id) => pool.includes(id)) ?? [];
  const answer = getChordQuality(rng.pick(focus.length > 0 ? focus : pool));
  const style = CHORD_STYLE[difficulty];
  const range = CHORD_BASS_RANGE[difficulty];

  // 音域・低音の濁りの制約を満たすボイシングが見つかるまで（決定的に）試す
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const params: VoicingParams = {
      bassMidi: rng.int(range.low, range.high),
      style,
      inversion: rng.int(0, 3),
      omit5: style === 'jazz' && rng.next() < 0.5,
    };
    const raw = voiceChord(answer.id, params);
    if (voicingProblems(raw.map((v) => v.midi)).length > 0) continue;
    const { rootPc, voices } = spellChord(params.bassMidi, raw);
    const distractors = pickDistractors(rng, answer, relativeSet(raw, params.bassMidi), settings);
    const choices = rng.shuffle([answer, ...distractors]).map((q) => ({ id: q.id, labelKey: chordLabelKey(q.id) }));
    const q: ChordQuestion = {
      id: `chord:${seed}`,
      category: 'chord',
      difficulty,
      seed,
      choices,
      answerId: answer.id,
      playback: blockPlayback(raw.map((v) => v.midi)),
      itemKey: `chord:${answer.id}`,
      payload: { qualityId: answer.id, rootPc, voices, voicing: params },
    };
    const errors = validateChordQuestion(q);
    if (errors.length > 0) throw new Error(`generated invalid chord question (seed ${seed}): ${errors.join('; ')}`);
    return q;
  }
  throw new Error(`no playable voicing for ${answer.id} (seed ${seed})`);
}

/** 「自分の回答を再生」: 同じルート・同じボイシング方針で選んだコードを鳴らす */
export function chordComparisonPlayback(q: ChordQuestion, choiceId: ChordQualityId): NoteEvent[] {
  return blockPlayback(voiceChord(choiceId, q.payload.voicing).map((v) => v.midi));
}
