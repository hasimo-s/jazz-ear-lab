import { describe, expect, it } from 'vitest';
import { hasMessage, t } from './index';
import { INTERVALS } from '../theory/intervals';
import { intervalLabelKey } from '../engine/intervalConfig';

describe('i18n', () => {
  it('パラメータ置換', () => {
    expect(t('quiz.progress', { current: 3, total: 10 })).toBe('3 / 10');
  });
  it('全音程の名前・解説・異名同音キーが定義されている', () => {
    for (const d of INTERVALS) {
      expect(hasMessage(intervalLabelKey(d.id)), d.id).toBe(true);
      expect(hasMessage(`interval.tip.${d.id}`), d.id).toBe(true);
      if (d.enharmonicKey) expect(hasMessage(d.enharmonicKey), d.id).toBe(true);
    }
  });
});

import { CHORD_QUALITIES } from '../theory/chords';
import { chordLabelKey } from '../engine/chordConfig';
describe('i18n: chords', () => {
  it('全コードの名前・解説が定義されている', () => {
    for (const q of CHORD_QUALITIES) {
      expect(hasMessage(chordLabelKey(q.id)), q.id).toBe(true);
      expect(hasMessage(`chord.tip.${q.id}`), q.id).toBe(true);
    }
  });
});

import { PROGRESSIONS } from '../theory/progressions';
describe('i18n: progressions', () => {
  it('全進行の名前・解説が定義されている', () => {
    for (const p of PROGRESSIONS) {
      expect(hasMessage(`progression.name.${p.id}`), p.id).toBe(true);
      expect(hasMessage(`progression.tip.${p.id}`), p.id).toBe(true);
    }
  });
});

import { choiceLabelKey } from '../engine/labels';
import { INTERVAL_POOLS } from '../engine/intervalConfig';
import { CHORD_POOLS } from '../engine/chordConfig';
import { PROGRESSION_POOLS } from '../engine/progressionConfig';
import { ja } from './ja';

describe('i18n: 画面で組み立てて使うキーがすべて存在する', () => {
  const categories = ['interval', 'chord', 'progression'] as const;
  const difficulties = ['beginner', 'intermediate', 'advanced'] as const;
  it('カテゴリ・難易度・方向・履歴', () => {
    const keys = [
      ...categories.flatMap((c) => [`category.${c}`, `category.${c}.desc`, `category.prompt.${c}`, `history.byItem.${c}`]),
      ...difficulties.map((d) => `difficulty.${d}`),
      ...categories.flatMap((c) => difficulties.map((d) => `difficulty.${c}.${d}`)),
      ...['ascending', 'descending', 'both'].map((d) => `direction.${d}`),
      'explain.progression.major', 'explain.progression.minor',
    ];
    for (const k of keys) expect(hasMessage(k), k).toBe(true);
  });
  it('全カテゴリ・全難易度の選択肢ラベル', () => {
    const pools = { interval: INTERVAL_POOLS, chord: CHORD_POOLS, progression: PROGRESSION_POOLS } as const;
    for (const c of categories) for (const d of difficulties) for (const id of pools[c][d]) {
      expect(hasMessage(choiceLabelKey(c, id)), `${c} ${id}`).toBe(true);
    }
  });
  it('{パラメータ} の書き間違い（閉じ括弧忘れ等）がない', () => {
    for (const [k, v] of Object.entries(ja)) {
      expect((v.match(/\{/g) ?? []).length, k).toBe((v.match(/\}/g) ?? []).length);
    }
  });
});
