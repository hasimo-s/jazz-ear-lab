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
  const w = (category: 'interval' | 'chord' | 'progression', difficulty: 'beginner' | 'intermediate' | 'advanced', answerId: string, accuracy = 0) =>
    ({ key: '', attempts: 3, correct: 0, accuracy, avgResponseMs: 0, avgPlayCount: 0, category, difficulty, answerId });

  it('苦手を間違えたときの難易度で復習する（中級の 7 は中級で）', () => {
    // レビューで見つかった不具合: 中級の 7・m7・maj7 が、初級の 7 だけの復習になっていた
    expect(reviewSettings([w('chord', 'intermediate', '7', 0), w('chord', 'intermediate', 'm7', 0.33), w('chord', 'intermediate', 'maj7', 0.33)]))
      .toEqual({ category: 'chord', difficulty: 'intermediate', focus: ['7', 'm7', 'maj7'] });
  });
  it('上級の進行の苦手は上級で復習する', () => {
    expect(reviewSettings([w('progression', 'advanced', 'ii-V-I'), w('progression', 'advanced', 'IV-iv-I', 0.3)]))
      .toEqual({ category: 'progression', difficulty: 'advanced', focus: ['ii-V-I', 'IV-iv-I'] });
  });
  it('最も苦手な項目と同じカテゴリ・難易度のものだけをまとめる', () => {
    expect(reviewSettings([w('interval', 'advanced', 's9'), w('chord', 'beginner', 'aug', 0.2), w('interval', 'beginner', 'M3', 0.5)]))
      .toEqual({ category: 'interval', difficulty: 'advanced', direction: 'both', focus: ['s9'] });
  });
  it('苦手がなければ null', () => expect(reviewSettings([])).toBeNull());
});

describe('weakItems: 難易度別に集計', () => {
  it('同じコードでも難易度が違えば別項目', () => {
    const data = [
      rec('7', false, { difficulty: 'beginner' }), rec('7', false, { difficulty: 'beginner' }),
      rec('7', true, { difficulty: 'intermediate' }), rec('7', true, { difficulty: 'intermediate' }),
    ];
    expect(weakItems(data).map((x) => `${x.difficulty}:${x.answerId}`)).toEqual(['beginner:7']);
  });
});
