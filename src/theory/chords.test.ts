import { describe, expect, it } from 'vitest';
import { ChordType, Interval } from 'tonal';
import { CHORD_QUALITIES, DEGREES, isValidVoicingOf, pitchClassSet, type Degree } from './chords';

describe('degree table', () => {
  it('半音数は tonal.js の計算と一致する（全綴り候補）', () => {
    for (const [d, def] of Object.entries(DEGREES)) {
      for (const s of def.spellings) expect(Interval.semitones(s), `${d} ${s}`).toBe(def.semitones);
    }
  });
});

describe('chord quality table', () => {
  it('構成音は tonal.js の ChordType と一致する（意図的な省略を除く）', () => {
    for (const q of CHORD_QUALITIES) {
      const t = ChordType.get(q.tonalType);
      expect(t.empty, q.tonalType).toBe(false);
      const tonalSemis = new Set(t.intervals.map((i) => Interval.semitones(i)! % 12));
      const omit = new Set((q.tonalOmit ?? []).map((d) => DEGREES[d].semitones % 12));
      const expected = new Set([...tonalSemis].filter((s) => !omit.has(s)));
      expect([...pitchClassSet(q.degrees)].sort(), q.id).toEqual([...expected].sort());
    }
  });

  it('essential は degrees の部分集合で、ルートと3度系（3/♭3/4）を必ず含む', () => {
    for (const q of CHORD_QUALITIES) {
      for (const d of q.essential) expect(q.degrees, q.id).toContain(d);
      expect(q.essential).toContain('1');
      expect(q.essential.some((d) => (['3', 'b3', '4'] as Degree[]).includes(d)), q.id).toBe(true);
    }
  });

  it('7th 以上のコードは 7度を省略しない', () => {
    for (const q of CHORD_QUALITIES) {
      const seventh = q.degrees.find((d) => d === '7' || d === 'b7' || d === 'bb7');
      if (seventh) expect(q.essential, q.id).toContain(seventh);
    }
  });

  it('同じ構成音（ピッチクラス集合）のコードが2つ定義されていない', () => {
    const keys = CHORD_QUALITIES.map((q) => [...pitchClassSet(q.degrees)].sort((a, b) => a - b).join(','));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('isValidVoicingOf: 5度省略の 9th は 9th として有効、7th としては無効', () => {
    const nine = CHORD_QUALITIES.find((q) => q.id === '9')!;
    const seven = CHORD_QUALITIES.find((q) => q.id === '7')!;
    const voiced = pitchClassSet(['1', '3', 'b7', '9']);
    expect(isValidVoicingOf(voiced, nine)).toBe(true);
    expect(isValidVoicingOf(voiced, seven)).toBe(false);
  });
});
