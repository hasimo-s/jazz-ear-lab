import { describe, expect, it } from 'vitest';
import { Interval } from 'tonal';
import { INTERVALS } from './intervals';
import { displayNote, spellingCandidates, transposeChecked, midiOf } from './pitch';

describe('interval table', () => {
  it('半音数は tonal.js の計算と一致する（全綴り候補）', () => {
    for (const d of INTERVALS) {
      for (const s of d.spellings) expect(Interval.semitones(s), `${d.id} ${s}`).toBe(d.semitones);
    }
  });

  it('1つの半音数に対して1つのIDしかない（異名同音を選択肢に並べない前提）', () => {
    const semis = INTERVALS.map((d) => d.semitones);
    expect(new Set(semis).size).toBe(semis.length);
  });

  it('IDは一意', () => {
    expect(new Set(INTERVALS.map((d) => d.id)).size).toBe(INTERVALS.length);
  });
});

describe('pitch spelling', () => {
  it('綴り候補はすべて元の MIDI と一致する', () => {
    for (let m = 21; m <= 108; m++) {
      for (const n of spellingCandidates(m)) expect(midiOf(n), n).toBe(m);
    }
  });

  it('ジャズ的なフラット綴りを優先する', () => {
    expect(spellingCandidates(61)[0]).toBe('Db4');
    expect(spellingCandidates(70)[0]).toBe('Bb4');
  });

  it('transposeChecked は MIDI 不一致を検出する', () => {
    expect(transposeChecked('C4', '3M', 64)).toBe('E4');
    expect(transposeChecked('E4', '-3M', 60)).toBe('C4');
    expect(() => transposeChecked('C4', '3M', 63)).toThrow();
  });

  it('表示用の臨時記号変換', () => {
    expect(displayNote('Bb4')).toBe('B♭4');
    expect(displayNote('F#3')).toBe('F♯3');
    expect(displayNote('B4')).toBe('B4');
  });
});
