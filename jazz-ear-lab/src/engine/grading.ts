import type { GradeResult, Question } from './types';

/** 採点。選択肢以外のIDは不正入力として例外にする（ルールベースで決定的） */
export function grade(q: Question, chosenId: string): GradeResult {
  if (!q.choices.some((c) => c.id === chosenId)) {
    throw new Error(`choice ${chosenId} is not an option of ${q.id}`);
  }
  return { correct: chosenId === q.answerId, chosenId, answerId: q.answerId };
}
