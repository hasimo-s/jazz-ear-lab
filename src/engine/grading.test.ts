import { describe, expect, it } from 'vitest';
import { grade } from './grading';
import { generateIntervalQuestion } from './intervalGenerator';

describe('grade', () => {
  const q = generateIntervalQuestion({ category: 'interval', difficulty: 'beginner', direction: 'both' }, 5);

  it('正解IDなら correct', () => {
    expect(grade(q, q.answerId)).toEqual({ correct: true, chosenId: q.answerId, answerId: q.answerId });
  });

  it('他の選択肢なら incorrect', () => {
    const wrong = q.choices.find((c) => c.id !== q.answerId)!.id;
    expect(grade(q, wrong).correct).toBe(false);
  });

  it('選択肢にないIDは例外', () => {
    const outside = ['m2', 'M2', 'm3', 'M3', 'P4', 'P5', 'P8'].find((id) => !q.choices.some((c) => c.id === id))!;
    expect(() => grade(q, outside)).toThrow();
  });
});
