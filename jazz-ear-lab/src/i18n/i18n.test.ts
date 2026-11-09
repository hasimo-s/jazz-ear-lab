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
