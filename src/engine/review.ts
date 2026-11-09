import { isIntervalId, type IntervalId } from '../theory/intervals';
import { isChordQualityId, type ChordQualityId } from '../theory/chords';
import { INTERVAL_POOLS } from './intervalConfig';
import { CHORD_POOLS } from './chordConfig';
import { PROGRESSION_POOLS } from './progressionConfig';
import { isProgressionId, type ProgressionId } from '../theory/progressions';
import type { WeakItem } from './stats';
import type { QuizSettings } from './types';

/**
 * 苦手項目から復習用の出題設定を作る。対象がなければ null。
 * 最も苦手な項目と同じカテゴリ・同じ難易度（その項目を間違えたときの難易度）の苦手項目をまとめて復習する。
 */
export function reviewSettings(weak: readonly WeakItem[]): QuizSettings | null {
  const first = weak[0];
  if (!first) return null;
  const same = weak.filter((w) => w.category === first.category && w.difficulty === first.difficulty);
  const { difficulty } = first;
  switch (first.category) {
    case 'interval': {
      const focus = same.map((w) => w.answerId).filter(isIntervalId).filter((id) => INTERVAL_POOLS[difficulty].includes(id)) as IntervalId[];
      return focus.length ? { category: 'interval', difficulty, direction: 'both', focus } : null;
    }
    case 'chord': {
      const focus = same.map((w) => w.answerId).filter(isChordQualityId).filter((id) => CHORD_POOLS[difficulty].includes(id)) as ChordQualityId[];
      return focus.length ? { category: 'chord', difficulty, focus } : null;
    }
    case 'progression': {
      const focus = same.map((w) => w.answerId).filter(isProgressionId).filter((id) => PROGRESSION_POOLS[difficulty].includes(id)) as ProgressionId[];
      return focus.length ? { category: 'progression', difficulty, focus } : null;
    }
  }
}
