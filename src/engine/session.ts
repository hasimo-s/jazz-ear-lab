import { deriveSeed } from '../theory/rng';
import { generateIntervalQuestion } from './intervalGenerator';
import { generateChordQuestion } from './chordGenerator';
import { generateProgressionQuestion } from './progressionGenerator';
import type { Question, QuizSettings } from './types';

export const DEFAULT_SESSION_LENGTH = 10;

function generate(settings: QuizSettings, seed: number): Question {
  switch (settings.category) {
    case 'interval':
      return generateIntervalQuestion(settings, seed);
    case 'chord':
      return generateChordQuestion(settings, seed);
    case 'progression':
      return generateProgressionQuestion(settings, seed);
  }
}

/** 生成に失敗したシードは、決定的に別のシードで作り直す（画面が止まらないようにする安全網） */
const MAX_FALLBACKS = 8;

/** セッションの i 番目の問題。sessionSeed と i が同じなら同じ問題 */
export function questionAt(settings: QuizSettings, sessionSeed: number, index: number): Question {
  let seed = deriveSeed(sessionSeed, index);
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_FALLBACKS; attempt++) {
    try {
      return generate(settings, seed);
    } catch (e) {
      lastError = e;
      console.error('[engine] question generation failed; retrying with derived seed', seed, e);
      seed = deriveSeed(seed, 1000 + attempt);
    }
  }
  throw lastError;
}
