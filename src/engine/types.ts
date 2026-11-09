import type { IntervalId } from '../theory/intervals';
import type { ChordQualityId, Degree } from '../theory/chords';
import type { VoicingStyle } from './chordConfig';
import type { ProgressionId } from '../theory/progressions';

export type Category = 'interval' | 'chord' | 'progression';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export type Direction = 'ascending' | 'descending';
export type DirectionSetting = Direction | 'both';

/** 再生する1音。time/duration は秒、問題の再生開始を 0 とする */
export interface NoteEvent {
  midi: number;
  time: number;
  duration: number;
  /** 0..1 */
  velocity: number;
}

export interface Choice {
  id: string;
  /** i18n キー（表示文字列はUI層で解決する） */
  labelKey: string;
}

interface QuestionBase {
  /** `${category}:${seed}` — 同じシードなら同じ ID・同じ内容 */
  id: string;
  category: Category;
  difficulty: Difficulty;
  seed: number;
  /** 4択。表示順はこの配列順 */
  choices: Choice[];
  answerId: string;
  playback: NoteEvent[];
  /** 苦手分析用の集計キー（例: 'interval:M3:ascending'） */
  itemKey: string;
}

export interface IntervalPayload {
  intervalId: IntervalId;
  direction: Direction;
  /** 鳴らす順の音名（例: ['C4', 'E4']） */
  notes: [string, string];
  midis: [number, number];
}

export interface IntervalQuestion extends QuestionBase {
  category: 'interval';
  payload: IntervalPayload;
}

export interface ChordVoice {
  midi: number;
  degree: Degree;
  /** 綴り（例: 'Bb3'） */
  note: string;
}

export interface ChordPayload {
  qualityId: ChordQualityId;
  /** ルートの音名（オクターブなし、例 'Db'） */
  rootPc: string;
  /** 低→高 */
  voices: ChordVoice[];
  /** 比較再生で同じ方針のボイシングを作るためのパラメータ */
  voicing: { bassMidi: number; style: VoicingStyle; inversion: number; omit5: boolean };
}

export interface ChordQuestion extends QuestionBase {
  category: 'chord';
  payload: ChordPayload;
}

/** 進行の鳴らし方。1問の中で、比較対象の進行すべてに同じ値を使う */
export interface ProgressionParams {
  tonicMidi: number;
  bpm: number;
  /** 上部構造の平均音高の目標 */
  center: number;
  /** 最初のベース音の目標 */
  bassAnchor: number;
}

export interface RenderedChord {
  roman: string;
  quality: ChordQualityId;
  startSlot: number;
  slots: number;
  bass: number;
  /** 上部構造（低→高） */
  upper: number[];
}

export interface ProgressionPayload {
  progressionId: ProgressionId;
  params: ProgressionParams;
  chords: RenderedChord[];
  /** トニックの音名（例 'Eb'） */
  tonic: string;
  /** 各和音のコードシンボル（例 'Fm7'） */
  symbols: string[];
}

export interface ProgressionQuestion extends QuestionBase {
  category: 'progression';
  payload: ProgressionPayload;
}

export type Question = IntervalQuestion | ChordQuestion | ProgressionQuestion;

export interface IntervalSettings {
  category: 'interval';
  difficulty: Difficulty;
  direction: DirectionSetting;
  /** 出題する正解の候補を絞る（苦手復習用）。未指定なら難易度の全音程 */
  focus?: IntervalId[];
}

export interface ChordSettings {
  category: 'chord';
  difficulty: Difficulty;
  /** 苦手復習用 */
  focus?: ChordQualityId[];
}

export interface ProgressionSettings {
  category: 'progression';
  difficulty: Difficulty;
  focus?: ProgressionId[];
}

export type QuizSettings = IntervalSettings | ChordSettings | ProgressionSettings;

export interface GradeResult {
  correct: boolean;
  chosenId: string;
  answerId: string;
}
