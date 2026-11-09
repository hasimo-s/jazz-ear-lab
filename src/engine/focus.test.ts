import { describe, expect, it } from 'vitest';
import { generateChordQuestion } from './chordGenerator';
import { questionAt } from './session';
import { CHORD_POOLS } from './chordConfig';

describe('苦手復習の出題', () => {
  it('苦手が1種類（例: マイナー）だけでも、他のコードも出題される', () => {
    const answers = Array.from({ length: 500 }, (_, s) => generateChordQuestion({ category: 'chord', difficulty: 'beginner', focus: ['min'] }, s).answerId);
    expect(new Set(answers)).toEqual(new Set(CHORD_POOLS.beginner));
    const ratio = answers.filter((a) => a === 'min').length / answers.length;
    // 0.7 + 0.3 × 1/5 ≈ 0.76
    expect(ratio).toBeGreaterThan(0.68);
    expect(ratio).toBeLessThan(0.84);
  });

  it('focus なしの問題は導入前と同じ（乱数の消費が変わらない）', () => {
    // スナップショットテストと合わせ、既存シードの再現性を保証
    const a = questionAt({ category: 'chord', difficulty: 'beginner' }, 1, 0);
    const b = questionAt({ category: 'chord', difficulty: 'beginner', focus: [] }, 1, 0);
    expect(a).toEqual(b);
  });
});
