import { describe, expect, it } from 'vitest';
import { arpeggioPlayback, chordComparisonPlayback, generateChordQuestion, spellChord, voiceChord } from './chordGenerator';
import { CHORD_BASS_RANGE, CHORD_POOLS, CHORD_STYLE } from './chordConfig';
import { validateChordQuestion, voicingProblems } from './chordValidation';
import { CHORD_QUALITIES, getChordQuality, isValidVoicingOf, pitchClassSet, type ChordQualityId } from '../theory/chords';
import { accidentalCount, pitchClass } from '../theory/pitch';
import type { ChordQuestion, ChordSettings, Difficulty } from './types';

const DIFFICULTIES: Difficulty[] = ['beginner', 'intermediate', 'advanced'];
const N = 3000;
const settings = (difficulty: Difficulty): ChordSettings => ({ category: 'chord', difficulty });

describe('コード問題: 再現性', () => {
  it('同じシードなら同じ問題', () => {
    for (const d of DIFFICULTIES) for (let s = 0; s < 50; s++) {
      expect(generateChordQuestion(settings(d), s)).toEqual(generateChordQuestion(settings(d), s));
    }
  });

  it('既知シードのスナップショット', () => {
    const q = generateChordQuestion(settings('advanced'), 2024);
    expect({ answer: q.answerId, notes: q.payload.voices.map((v) => v.note), choices: q.choices.map((c) => c.id) }).toMatchSnapshot();
  });
});

describe('コード問題: 曖昧さの排除（大量シード検証）', () => {
  for (const d of DIFFICULTIES) {
    it(`${d}: ${N}問すべて validate を通過`, () => {
      for (let s = 0; s < N; s++) {
        const q = generateChordQuestion(settings(d), s * 104729 + 3);
        const errors = validateChordQuestion(q);
        expect(errors, `seed ${s}: ${errors.join(', ')}`).toEqual([]);
      }
    });

    it(`${d}: 母集団の全コードが正解として出題される`, () => {
      const seen = new Set<string>();
      for (let s = 0; s < N; s++) seen.add(generateChordQuestion(settings(d), s).answerId);
      expect([...seen].sort()).toEqual([...CHORD_POOLS[d]].sort());
    });
  }

  it('正解の位置が偏らない', () => {
    const pos = [0, 0, 0, 0];
    for (let s = 0; s < 4000; s++) {
      const q = generateChordQuestion(settings('intermediate'), s);
      pos[q.choices.findIndex((c) => c.id === q.answerId)]!++;
    }
    for (const p of pos) expect(p).toBeGreaterThan(850);
  });

  it('上級では5度省略あり・なしの両方が出る', () => {
    const omit = new Set<boolean>();
    for (let s = 0; s < 200; s++) {
      const q = generateChordQuestion(settings('advanced'), s);
      omit.add(!q.payload.voices.some((v) => v.degree === '5'));
    }
    expect(omit).toEqual(new Set([true, false]));
  });

  it('全ルート × 全コード × 全転回で、その難易度のボイシングが作れて綴りが成立する', () => {
    for (const d of DIFFICULTIES) {
      const { low, high } = CHORD_BASS_RANGE[d];
      for (const id of CHORD_POOLS[d]) {
        let playable = 0;
        for (let bass = low; bass <= high; bass++) {
          for (let inversion = 0; inversion < 4; inversion++) {
            for (const omit5 of [false, true]) {
              const raw = voiceChord(id, { bassMidi: bass, style: CHORD_STYLE[d], inversion, omit5 });
              const rel = new Set(raw.map((v) => pitchClass(v.midi - bass)));
              expect(isValidVoicingOf(rel, getChordQuality(id)), `${id} on ${bass}`).toBe(true);
              const { voices } = spellChord(bass, raw);
              expect(voices.every((v) => accidentalCount(v.note) <= 1), voices.map((v) => v.note).join(' ')).toBe(true);
              if (voicingProblems(raw.map((v) => v.midi)).length === 0) playable++;
            }
          }
        }
        // 各コードとも、音域内に演奏可能なボイシングが十分ある
        expect(playable, `${d} ${id}`).toBeGreaterThan(10);
      }
    }
  });

  it('同じ難易度のどのコードの組でも、片方の完全な構成音がもう片方の正しいボイシングにならない', () => {
    // 例: 7 と 9 を両方出す場合、9 の音（R 3 5 b7 9）は 7 としては不正（9 が余分）であること
    for (const d of DIFFICULTIES) {
      for (const a of CHORD_POOLS[d]) for (const b of CHORD_POOLS[d]) {
        if (a === b) continue;
        expect(isValidVoicingOf(pitchClassSet(getChordQuality(a).degrees), getChordQuality(b)), `${a} as ${b}`).toBe(false);
      }
    }
  });
});

describe('validateChordQuestion: 不正な問題を検出できる', () => {
  const base = generateChordQuestion(settings('intermediate'), 11);
  const mutate = (f: (q: ChordQuestion) => void) => {
    const q = structuredClone(base);
    f(q);
    return validateChordQuestion(q);
  };
  const withAnswer = (id: ChordQualityId, s0 = 0) => {
    for (let s = s0; ; s++) {
      const q = generateChordQuestion({ category: 'chord', difficulty: 'advanced', focus: [id] }, s);
      if (q.answerId === id) return q;
    }
  };

  it('正常', () => expect(validateChordQuestion(base)).toEqual([]));
  it('ベースがルートでない（転回形）', () => expect(mutate((q) => {
    const lowest = q.playback[0]!; lowest.midi += 12; q.payload.voices[0]!.midi += 12;
  })).not.toEqual([]));
  it('3度が欠けている', () => expect(mutate((q) => {
    const i = q.payload.voices.findIndex((v) => v.degree === '3' || v.degree === 'b3' || v.degree === '4');
    q.payload.voices.splice(i, 1); q.playback.splice(i, 1);
  })).not.toEqual([]));
  it('音量が揃っていない', () => expect(mutate((q) => { q.playback[1]!.velocity = 0.2; })).not.toEqual([]));
  it('異名同音的に同じ選択肢（同一ID重複）', () => expect(mutate((q) => { q.choices[0] = { ...q.choices[1]! }; })).not.toEqual([]));

  it('5度を省略した 9th に「7th」を選択肢として入れると曖昧と判定…されない（9 が鳴っているため）', () => {
    const q = withAnswer('9');
    expect(validateChordQuestion(q)).toEqual([]);
  });

  it('鳴った音が他の選択肢でも成立する場合は検出する', () => {
    // 13th の音から 13 を抜くと 9th の正しいボイシングになる → 9 が選択肢にあれば曖昧
    const q = structuredClone(withAnswer('13'));
    const i = q.payload.voices.findIndex((v) => v.degree === '13');
    q.payload.voices.splice(i, 1); q.playback.splice(i, 1);
    if (!q.choices.some((c) => c.id === '9')) q.choices[q.choices.findIndex((c) => c.id !== q.answerId)] = { id: '9', labelKey: '' };
    const errors = validateChordQuestion(q);
    expect(errors.some((e) => e.includes('also a valid 9'))).toBe(true);
  });

  it('低音域の密集（濁り）を検出する', () => {
    expect(voicingProblems([36, 40, 43])).not.toEqual([]);
    expect(voicingProblems([36, 48, 52, 55])).toEqual([]);
  });
});

describe('再生', () => {
  it('比較再生は同じベースで選んだコードを鳴らす', () => {
    const q = generateChordQuestion(settings('intermediate'), 5);
    const other = q.choices.find((c) => c.id !== q.answerId)!.id as ChordQualityId;
    const pb = chordComparisonPlayback(q, other);
    expect(Math.min(...pb.map((e) => e.midi))).toBe(q.payload.voicing.bassMidi);
    const rel = new Set(pb.map((e) => pitchClass(e.midi - q.payload.voicing.bassMidi)));
    expect(isValidVoicingOf(rel, getChordQuality(other))).toBe(true);
  });

  it('分散和音は低い音から順に鳴り、最後は全音が同時に鳴っている', () => {
    const pb = arpeggioPlayback([60, 48, 64]);
    expect(pb.map((e) => e.midi)).toEqual([48, 60, 64]);
    const ends = pb.map((e) => e.time + e.duration);
    expect(new Set(ends).size).toBe(1);
  });

  it('全コード定義がいずれかの難易度で出題される', () => {
    const all = new Set(Object.values(CHORD_POOLS).flat());
    for (const q of CHORD_QUALITIES) expect(all.has(q.id), q.id).toBe(true);
  });
});
