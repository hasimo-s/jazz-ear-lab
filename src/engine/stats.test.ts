import { describe, expect, it } from 'vitest';
import { groupStats, overallStats, weakItems, type AttemptRecord } from './stats';

let n = 0;
function rec(answerId: string, correct: boolean, extra: Partial<AttemptRecord> = {}): AttemptRecord {
  n++;
  return {
    id: `a${n}`, sessionId: 's', questionId: `interval:${n}`, seed: n, category: 'interval', difficulty: 'beginner',
    itemKey: `interval:${answerId}:ascending`, answerId, chosenId: correct ? answerId : 'P8', correct,
    playCount: 2, responseMs: 1000, timestamp: n, ...extra,
  };
}

describe('stats', () => {
  it('全体正答率・平均', () => {
    const s = overallStats([rec('M3', true), rec('M3', false, { responseMs: 3000, playCount: 4 })]);
    expect(s).toMatchObject({ attempts: 2, correct: 1, accuracy: 0.5, avgResponseMs: 2000, avgPlayCount: 3 });
  });

  it('空配列で NaN にならない', () => {
    expect(overallStats([]).accuracy).toBe(0);
  });

  it('カテゴリ別集計', () => {
    const g = groupStats([rec('M3', true), rec('P5', false)], (a) => a.category);
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({ key: 'interval', attempts: 2, correct: 1 });
  });

  it('苦手項目は試行数と正答率で判定し、低い順', () => {
    const data = [
      rec('M3', true), rec('M3', true), rec('M3', true),
      rec('TT', false), rec('TT', false), rec('TT', true),
      rec('m6', false), rec('m6', false),
      rec('M7', false), // 1回のみ → 対象外
    ];
    expect(weakItems(data).map((w) => w.answerId)).toEqual(['m6', 'TT']);
  });
});

import { reviewSettings } from './review';
describe('reviewSettings', () => {
  it('苦手音程を含む最も易しい難易度を選ぶ', () => {
    const w = (answerId: string) => ({ key: '', attempts: 2, correct: 0, accuracy: 0, avgResponseMs: 0, avgPlayCount: 0, category: 'interval' as const, answerId });
    expect(reviewSettings([w('M3')])?.difficulty).toBe('beginner');
    expect(reviewSettings([w('M3'), w('TT')])?.difficulty).toBe('intermediate');
    expect(reviewSettings([w('s9')])).toMatchObject({ difficulty: 'advanced', focus: ['s9'] });
    expect(reviewSettings([])).toBeNull();
  });
  it('コードの苦手は最も苦手なコードの難易度に合わせる', () => {
    const w = (answerId: string) => ({ key: '', attempts: 2, correct: 0, accuracy: 0, avgResponseMs: 0, avgPlayCount: 0, category: 'chord' as const, answerId });
    expect(reviewSettings([w('m7b5'), w('dim7'), w('aug')])).toEqual({ category: 'chord', difficulty: 'intermediate', focus: ['m7b5', 'dim7'] });
    // 7 は初級・中級の両方にある → 初級
    expect(reviewSettings([w('7')])).toEqual({ category: 'chord', difficulty: 'beginner', focus: ['7'] });
  });
});
