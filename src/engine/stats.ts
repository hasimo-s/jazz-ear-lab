import type { Category, Difficulty } from './types';

/** 1回の回答記録（IndexedDB に保存する形） */
export interface AttemptRecord {
  id: string;
  sessionId: string;
  questionId: string;
  seed: number;
  category: Category;
  difficulty: Difficulty;
  itemKey: string;
  answerId: string;
  chosenId: string;
  correct: boolean;
  /** 回答までに問題音を再生した回数 */
  playCount: number;
  /** 問題表示から回答までのミリ秒 */
  responseMs: number;
  /** epoch ms */
  timestamp: number;
}

export interface AccuracyStat {
  key: string;
  attempts: number;
  correct: number;
  accuracy: number;
  avgResponseMs: number;
  avgPlayCount: number;
}

function summarize(key: string, items: readonly AttemptRecord[]): AccuracyStat {
  const correct = items.filter((a) => a.correct).length;
  const n = items.length;
  return {
    key,
    attempts: n,
    correct,
    accuracy: n === 0 ? 0 : correct / n,
    avgResponseMs: n === 0 ? 0 : items.reduce((s, a) => s + a.responseMs, 0) / n,
    avgPlayCount: n === 0 ? 0 : items.reduce((s, a) => s + a.playCount, 0) / n,
  };
}

export function groupStats(
  attempts: readonly AttemptRecord[],
  keyOf: (a: AttemptRecord) => string,
): AccuracyStat[] {
  const groups = new Map<string, AttemptRecord[]>();
  for (const a of attempts) {
    const k = keyOf(a);
    const list = groups.get(k);
    if (list) list.push(a);
    else groups.set(k, [a]);
  }
  return [...groups.entries()].map(([k, v]) => summarize(k, v)).sort((a, b) => a.key.localeCompare(b.key));
}

export function overallStats(attempts: readonly AttemptRecord[]): AccuracyStat {
  return summarize('all', attempts);
}

/**
 * 苦手判定の集計キー。同じ項目でも難易度が違えば選択肢の母集団が違う（＝別の課題）なので分けて数える。
 * 例: 'chord|intermediate|7'。進行IDに ':' や '-' が含まれても壊れないよう '|' で区切る。
 */
export function weakKey(a: AttemptRecord): string {
  return `${a.category}|${a.difficulty}|${a.answerId}`;
}

export interface WeakItem extends AccuracyStat {
  category: Category;
  difficulty: Difficulty;
  answerId: string;
}

/**
 * 苦手項目: 直近 `window` 件の回答に絞って、試行回数 minAttempts 以上かつ正答率 threshold 未満。
 * 正答率の低い順。
 */
export function weakItems(
  attempts: readonly AttemptRecord[],
  { minAttempts = 2, threshold = 0.7, window = 200 } = {},
): WeakItem[] {
  const recent = [...attempts].sort((a, b) => b.timestamp - a.timestamp).slice(0, window);
  return groupStats(recent, weakKey)
    .filter((s) => s.attempts >= minAttempts && s.accuracy < threshold)
    .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts)
    .map((s) => {
      const [category, difficulty, answerId] = s.key.split('|') as [Category, Difficulty, string];
      return { ...s, category, difficulty, answerId };
    });
}
