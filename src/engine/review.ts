import { isIntervalId, type IntervalId } from '../theory/intervals';
import { isChordQualityId, type ChordQualityId } from '../theory/chords';
import { INTERVAL_POOLS } from './intervalConfig';
import { CHORD_POOLS } from './chordConfig';
import { PROGRESSION_POOLS } from './progressionConfig';
import { isProgressionId, type ProgressionId } from '../theory/progressions';
import type { WeakItem } from './stats';
import type { Difficulty, QuizSettings } from './types';

const ORDER: Difficulty[] = ['beginner', 'intermediate', 'advanced'];

/** 対象をすべて含む最も易しい難易度（誤答の選択肢もその母集団から出る） */
function easiestContaining<T>(pools: Record<Difficulty, readonly T[]>, ids: T[]): Difficulty | undefined {
  return ORDER.find((d) => ids.every((id) => pools[d].includes(id)));
}

/**
 * 苦手項目から復習用の出題設定を作る。最も苦手な項目のカテゴリを対象にする。対象がなければ null。
 * コード・進行は難易度ごとに母集団が分かれているため、最も苦手なコードと同じ難易度に入るものだけを集める。
 */
export function reviewSettings(weak: readonly WeakItem[]): QuizSettings | null {
  const first = weak[0];
  if (!first) return null;
  if (first.category === 'interval') {
    const focus = weak.filter((w) => w.category === 'interval' && isIntervalId(w.answerId)).map((w) => w.answerId as IntervalId);
    const difficulty = easiestContaining(INTERVAL_POOLS, focus);
    return difficulty ? { category: 'interval', difficulty, direction: 'both', focus } : null;
  }
  if (first.category === 'chord' && isChordQualityId(first.answerId)) {
    const difficulty = easiestContaining(CHORD_POOLS, [first.answerId])!;
    const focus = weak
      .filter((w) => w.category === 'chord' && isChordQualityId(w.answerId) && CHORD_POOLS[difficulty].includes(w.answerId))
      .map((w) => w.answerId as ChordQualityId);
    return { category: 'chord', difficulty, focus };
  }
  if (first.category === 'progression' && isProgressionId(first.answerId)) {
    const difficulty = easiestContaining(PROGRESSION_POOLS, [first.answerId])!;
    const focus = weak
      .filter((w) => w.category === 'progression' && isProgressionId(w.answerId) && PROGRESSION_POOLS[difficulty].includes(w.answerId))
      .map((w) => w.answerId as ProgressionId);
    return { category: 'progression', difficulty, focus };
  }
  return null;
}
