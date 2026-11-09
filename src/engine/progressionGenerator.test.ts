import { describe, expect, it } from 'vitest';
import {
  bassLinePlayback, generateProgressionQuestion, progressionComparisonPlayback, progressionPlayback, renderProgression, spellProgression,
} from './progressionGenerator';
import { progressionsDistinguishable, validateProgressionQuestion } from './progressionValidation';
import { MAX_REGISTER_DIFF, PROGRESSION_POOLS } from './progressionConfig';
import { getChordQuality, isValidVoicingOf } from '../theory/chords';
import { PROGRESSIONS, SLOTS_PER_PROGRESSION, type ProgressionId } from '../theory/progressions';
import { pitchClass } from '../theory/pitch';
import type { Difficulty, ProgressionParams, ProgressionQuestion, ProgressionSettings } from './types';

const DIFFICULTIES: Difficulty[] = ['beginner', 'intermediate', 'advanced'];
const N = 2000;
const settings = (difficulty: Difficulty): ProgressionSettings => ({ category: 'progression', difficulty });

describe('進行の定義', () => {
  it('すべて同じ長さで、トニックの maj7 / m7 で終わる', () => {
    for (const p of PROGRESSIONS) {
      expect(p.chords.reduce((s, c) => s + c.slots, 0), p.id).toBe(SLOTS_PER_PROGRESSION);
      const last = p.chords.at(-1)!;
      expect(last.rootInterval).toBe('1P');
      expect(last.quality).toBe(p.mode === 'major' ? 'maj7' : 'm7');
    }
  });

  it('どの2つの進行も、移調して同じ響きにならない', () => {
    for (const a of PROGRESSIONS) for (const b of PROGRESSIONS) {
      if (a.id !== b.id) expect(progressionsDistinguishable(a.id, b.id), `${a.id} vs ${b.id}`).toBe(true);
    }
  });

  it('同じ進行どうしは区別不能と判定される（判定器の自己チェック）', () => {
    expect(progressionsDistinguishable('ii-V-I', 'ii-V-I')).toBe(false);
  });

  it('全キーでコードシンボルの綴りが成立する', () => {
    for (const p of PROGRESSIONS) for (let t = 60; t < 72; t++) {
      const { symbols } = spellProgression(p.id, t);
      expect(symbols.every((s) => !/^([A-G](bb|##)|Cb|Fb|E#|B#)/.test(s)), `${p.id} ${symbols}`).toBe(true);
    }
  });
});

describe('進行の表記', () => {
  it('E♭ キーの ♭VIm7–♭II7 は Bm7–E7 と表記する', () => {
    expect(spellProgression('bvi-bII7-I', 63).symbols).toEqual(['Bm7', 'E7', 'Ebmaj7']);
  });
  it('G♭/F♯ キーの ♭VIm7–♭II7–I は、置き換えのない F♯ で表記する', () => {
    expect(spellProgression('bvi-bII7-I', 66)).toEqual({ tonic: 'F#', symbols: ['Dm7', 'G7', 'F#maj7'] });
  });
  it('短調は C♯m・F♯m・G♯m と表記する', () => {
    expect(spellProgression('minor-ii-V-i', 61).tonic).toBe('C#');
    expect(spellProgression('minor-ii-V-i', 66).tonic).toBe('F#');
    expect(spellProgression('minor-ii-V-i', 68).tonic).toBe('G#');
    expect(spellProgression('minor-ii-V-i', 70).tonic).toBe('Bb');
  });
  it('長調は D♭・A♭・E♭・B♭ と表記する', () => {
    for (const [m, k] of [[61, 'Db'], [68, 'Ab'], [63, 'Eb'], [70, 'Bb']] as const) expect(spellProgression('ii-V-I', m).tonic).toBe(k);
  });
  it('C キーの II–V–I', () => {
    expect(spellProgression('ii-V-I', 60)).toEqual({ tonic: 'C', symbols: ['Dm7', 'G7', 'Cmaj7'] });
  });
});

describe('進行のボイシング', () => {
  it('全進行 × 全キー × 全パラメータ範囲で、正しいボイシングが作れる', () => {
    for (const p of PROGRESSIONS) for (let tonic = 60; tonic < 72; tonic++) for (const center of [58, 62, 66]) for (const bassAnchor of [40, 44, 47]) {
      const params: ProgressionParams = { tonicMidi: tonic, bpm: 90, center, bassAnchor };
      const chords = renderProgression(p.id, params);
      chords.forEach((ch, i) => {
        const rel = new Set([ch.bass, ...ch.upper].map((m) => pitchClass(m - ch.bass)));
        expect(isValidVoicingOf(rel, getChordQuality(p.chords[i]!.quality)), `${p.id} ${i}`).toBe(true);
      });
    }
  });

  it('上部構造の声部の動きが滑らか（隣り合う和音で各声部の移動が平均4半音以内）', () => {
    for (const p of PROGRESSIONS) for (let tonic = 60; tonic < 72; tonic++) {
      const chords = renderProgression(p.id, { tonicMidi: tonic, bpm: 90, center: 62, bassAnchor: 43 });
      for (let i = 1; i < chords.length; i++) {
        const a = chords[i - 1]!.upper, b = chords[i]!.upper;
        const moved = b.reduce((s, n) => s + Math.min(...a.map((x) => Math.abs(x - n))), 0) / b.length;
        expect(moved, `${p.id} tonic ${tonic} chord ${i}`).toBeLessThanOrEqual(4);
      }
    }
  });

  it('ベースラインは低い順に鳴るのではなく、各和音の頭でルートを鳴らす', () => {
    const params: ProgressionParams = { tonicMidi: 60, bpm: 90, center: 62, bassAnchor: 43 };
    const chords = renderProgression('ii-V-I', params);
    expect(bassLinePlayback(chords, params).map((e) => pitchClass(e.midi))).toEqual([2, 7, 0]);
  });
});

describe('進行問題: 生成と検証（大量シード）', () => {
  for (const d of DIFFICULTIES) {
    it(`${d}: ${N}問すべて validate を通過`, () => {
      for (let s = 0; s < N; s++) {
        const q = generateProgressionQuestion(settings(d), s * 7919 + 5);
        const errors = validateProgressionQuestion(q);
        expect(errors, `seed ${s}: ${errors.join(', ')}`).toEqual([]);
      }
    });

    it(`${d}: 母集団のすべての進行が出題される`, () => {
      const seen = new Set<string>();
      for (let s = 0; s < 500; s++) seen.add(generateProgressionQuestion(settings(d), s).answerId);
      expect([...seen].sort()).toEqual([...PROGRESSION_POOLS[d]].sort());
    });
  }

  it('同じシードなら同じ問題', () => {
    expect(generateProgressionQuestion(settings('advanced'), 9)).toEqual(generateProgressionQuestion(settings('advanced'), 9));
  });

  it('既知シードのスナップショット', () => {
    const q = generateProgressionQuestion(settings('intermediate'), 777);
    expect({ answer: q.answerId, tonic: q.payload.tonic, symbols: q.payload.symbols, choices: q.choices.map((c) => c.id), bpm: q.payload.params.bpm }).toMatchSnapshot();
  });

  it('比較再生: 同じキー・テンポ・長さ・音量で、平均音高の差が許容範囲内', () => {
    for (let s = 0; s < 300; s++) {
      const q = generateProgressionQuestion(settings('intermediate'), s);
      const end = (evs: { time: number; duration: number }[]) => Math.max(...evs.map((e) => e.time + e.duration));
      const avg = (evs: { midi: number }[]) => evs.reduce((x, e) => x + e.midi, 0) / evs.length;
      for (const c of q.choices) {
        const evs = progressionComparisonPlayback(q, c.id as ProgressionId);
        expect(end(evs)).toBeCloseTo(end(q.playback), 9);
        expect(Math.abs(avg(evs) - avg(q.playback))).toBeLessThanOrEqual(MAX_REGISTER_DIFF);
        expect(new Set(evs.map((e) => e.velocity))).toEqual(new Set(q.playback.map((e) => e.velocity)));
      }
    }
  });

  it('focus 指定時も、苦手以外の進行が混ざる', () => {
    const answers = Array.from({ length: 300 }, (_, s) => generateProgressionQuestion({ ...settings('advanced'), focus: ['backdoor'] }, s).answerId);
    const ratio = answers.filter((a) => a === 'backdoor').length / answers.length;
    expect(ratio).toBeGreaterThan(0.65);
    expect(new Set(answers).size).toBe(PROGRESSION_POOLS.advanced.length);
  });
});

describe('validateProgressionQuestion: 不正な問題を検出できる', () => {
  const base = generateProgressionQuestion(settings('intermediate'), 3);
  const mutate = (f: (q: ProgressionQuestion) => void) => {
    const q = structuredClone(base);
    f(q);
    return validateProgressionQuestion(q);
  };
  it('正常', () => expect(validateProgressionQuestion(base)).toEqual([]));
  it('再生音が正解の進行と違う', () => expect(mutate((q) => { q.playback[0]!.midi += 1; })).not.toEqual([]));
  it('音量が違う', () => expect(mutate((q) => { q.playback[2]!.velocity = 0.3; })).not.toEqual([]));
  it('同じ選択肢の重複', () => expect(mutate((q) => { q.choices[0] = { ...q.choices[1]! }; })).not.toEqual([]));
  it('ベースがルートでない', () => expect(mutate((q) => { q.payload.chords[0]!.bass += 3; })).not.toEqual([]));
  it('コードシンボルの綴りが実音と違う', () => expect(mutate((q) => {
    const wrong = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'][(pitchClass(q.payload.chords[0]!.bass) + 1) % 12];
    q.payload.symbols[0] = `${wrong}m7`;
  })).not.toEqual([]));
});

describe('playback', () => {
  it('和音の切れ目にわずかな隙間がある（同音連打を聴き取れる）', () => {
    const params: ProgressionParams = { tonicMidi: 60, bpm: 90, center: 62, bassAnchor: 43 };
    const evs = progressionPlayback(renderProgression('V-I', params), params);
    const firstEnd = Math.max(...evs.filter((e) => e.time === 0).map((e) => e.time + e.duration));
    const second = Math.min(...evs.filter((e) => e.time > 0).map((e) => e.time));
    expect(firstEnd).toBeLessThan(second);
  });
});
