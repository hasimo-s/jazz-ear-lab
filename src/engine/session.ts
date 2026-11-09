import { deriveSeed } from '../theory/rng';
import { generateIntervalQuestion } from './intervalGenerator';
import { generateChordQuestion } from './chordGenerator';
import { generateProgressionQuestion } from './progressionGenerator';
import type { Question, QuizSettings } from './types';

export const DEFAULT_SESSION_LENGTH = 10;

/** セッションの i 番目の問題。sessionSeed と i が同じなら同じ問題 */
export function questionAt(settings: QuizSettings, sessionSeed: number, index: number): Question {
  const seed = deriveSeed(sessionSeed, index);
  switch (settings.category) {
    case 'interval':
      return generateIntervalQuestion(settings, seed);
    case 'chord':
      return generateChordQuestion(settings, seed);
    case 'progression':
      return generateProgressionQuestion(settings, seed);
  }
}
