import { describe, expect, it } from 'vitest';
import { generateIntervalQuestion, comparisonPlayback, spellInterval } from './intervalGenerator';
import { INTERVAL_POOLS, INTERVAL_REGISTERS } from './intervalConfig';
import { accidentalCount } from '../theory/pitch';
import { validateIntervalQuestion } from './intervalValidation';
import { getInterval } from '../theory/intervals';
import { questionAt } from './session';
import type { Difficulty, DirectionSetting, IntervalQuestion, IntervalSettings } from './types';

const DIFFICULTIES: Difficulty[] = ['beginner', 'intermediate', 'advanced'];
const DIRECTIONS: DirectionSetting[] = ['ascending', 'descending', 'both'];
const N = 3000;

function settings(difficulty: Difficulty, direction: DirectionSetting = 'both'): IntervalSettings {
  return { category: 'interval', difficulty, direction };
}

describe('generateIntervalQuestion: 再現性', () => {
  it('同じシード・設定なら完全に同じ問題', () => {
    for (const d of DIFFICULTIES) {
      for (let seed = 0; seed < 50; seed++) {
        expect(generateIntervalQuestion(settings(d), seed)).toEqual(generateIntervalQuestion(settings(d), seed));
      }
    }
  });

  it('セッション内の問題は sessionSeed と index で再現できる', () => {
    const s = settings('intermediate');
    expect(questionAt(s, 999, 3)).toEqual(questionAt(s, 999, 3));
    expect(questionAt(s, 999, 3).id).not.toEqual(questionAt(s, 999, 4).id);
  });

  it('既知シードのスナップショット（生成ロジック変更の検知用）', () => {
    const q = generateIntervalQuestion(settings('beginner', 'ascending'), 12345);
    expect({ answer: q.answerId, notes: q.payload.notes, choices: q.choices.map((c) => c.id) }).toMatchSnapshot();
  });
});

describe('generateIntervalQuestion: 曖昧さの排除（大量シード検証）', () => {
  for (const d of DIFFICULTIES) {
    for (const dir of DIRECTIONS) {
      it(`${d} / ${dir}: ${N}問すべて validate を通過`, () => {
        for (let seed = 0; seed < N; seed++) {
          const q = generateIntervalQuestion(settings(d, dir), seed * 7919 + 1);
          const errors = validateIntervalQuestion(q);
          expect(errors, `seed ${seed}: ${errors.join(', ')}`).toEqual([]);
          if (dir !== 'both') expect(q.payload.direction).toBe(dir);
        }
      });
    }
  }

  it('各難易度で母集団のすべての音程が正解として出題される', () => {
    for (const d of DIFFICULTIES) {
      const seen = new Set<string>();
      for (let seed = 0; seed < N; seed++) seen.add(generateIntervalQuestion(settings(d), seed).answerId);
      expect([...seen].sort()).toEqual([...INTERVAL_POOLS[d]].sort());
    }
  });

  it('正解の位置（1〜4番）が偏らない', () => {
    const pos = [0, 0, 0, 0];
    for (let seed = 0; seed < 4000; seed++) {
      const q = generateIntervalQuestion(settings('intermediate'), seed);
      pos[q.choices.findIndex((c) => c.id === q.answerId)]!++;
    }
    for (const p of pos) expect(p).toBeGreaterThan(850);
  });

  it('both 設定では上行・下行の両方が出る', () => {
    const dirs = new Set(Array.from({ length: 100 }, (_, i) => generateIntervalQuestion(settings('beginner'), i).payload.direction));
    expect(dirs).toEqual(new Set(['ascending', 'descending']));
  });

  it('上級では半音差2以内の紛らわしい誤答が（存在する限り）最低2つ含まれる', () => {
    for (let seed = 0; seed < 500; seed++) {
      const q = generateIntervalQuestion(settings('advanced'), seed);
      const a = getInterval(q.payload.intervalId).semitones;
      const isNear = (id: string) => id !== q.answerId && Math.abs(getInterval(id as never).semitones - a) <= 2;
      const available = INTERVAL_POOLS.advanced.filter(isNear).length;
      const near = q.choices.filter((c) => isNear(c.id));
      expect(near.length).toBeGreaterThanOrEqual(Math.min(2, available));
    }
  });

  it('全音域 × 全音程 × 両方向で、ダブル臨時記号なしの綴りが存在する', () => {
    for (const d of DIFFICULTIES) {
      const { low, high } = INTERVAL_REGISTERS[d];
      for (const id of INTERVAL_POOLS[d]) {
        const semis = getInterval(id).semitones;
        for (let m = low; m + semis <= high; m++) {
          for (const dir of ['ascending', 'descending'] as const) {
            const [a, b] = dir === 'ascending' ? [m, m + semis] : [m + semis, m];
            const notes = spellInterval(a, b, getInterval(id), dir);
            expect(notes.every((n) => accidentalCount(n) <= 1), `${id} ${dir} ${notes}`).toBe(true);
          }
        }
      }
    }
  });

  it('focus 指定時は正解が focus に限定される', () => {
    for (let seed = 0; seed < 200; seed++) {
      const q = generateIntervalQuestion({ ...settings('intermediate'), focus: ['TT', 'm6'] }, seed);
      expect(['TT', 'm6']).toContain(q.answerId);
    }
  });
});

describe('validateIntervalQuestion: 不正な問題を検出できる', () => {
  const base = generateIntervalQuestion(settings('intermediate', 'ascending'), 1);
  const mutate = (f: (q: IntervalQuestion) => void) => {
    const q = structuredClone(base);
    f(q);
    return validateIntervalQuestion(q);
  };

  it('正常な問題はエラーなし', () => expect(validateIntervalQuestion(base)).toEqual([]));
  it('鳴る音と正解の不一致', () => expect(mutate((q) => { q.payload.midis[1] += 1; q.playback[1]!.midi += 1; })).not.toEqual([]));
  it('正解が選択肢にない', () => expect(mutate((q) => { q.choices = q.choices.filter((c) => c.id !== q.answerId).concat({ id: 'P8', labelKey: '' }); })).not.toEqual([]));
  it('異名同音の重複', () => expect(mutate((q) => { q.choices[0] = { ...q.choices[1]! }; })).not.toEqual([]));
  it('方向の不一致', () => expect(mutate((q) => { q.payload.direction = 'descending'; })).not.toEqual([]));
  it('2音が重なる（和声的になる）', () => expect(mutate((q) => { q.playback[1]!.time = 0.1; })).not.toEqual([]));
  it('音量が不揃い', () => expect(mutate((q) => { q.playback[1]!.velocity = 0.3; })).not.toEqual([]));
  it('綴りと MIDI の不一致', () => expect(mutate((q) => { q.payload.notes[0] = 'C#1'; })).not.toEqual([]));
  it('音域外', () => expect(mutate((q) => { q.payload.midis = [20, 20 + (q.payload.midis[1] - q.payload.midis[0])]; })).not.toEqual([]));
});

describe('comparisonPlayback', () => {
  it('同じ1音目・同じ方向で選んだ音程を鳴らす', () => {
    const q = generateIntervalQuestion(settings('intermediate', 'descending'), 77);
    const pb = comparisonPlayback(q, 'P5');
    expect(pb[0]!.midi - pb[1]!.midi).toBe(7);
  });
});
