import type { ReactNode } from 'react';
import { t } from '../i18n';
import { getInterval, type IntervalId } from '../theory/intervals';
import { DEGREES, degreeDifference, getChordQuality, type ChordQualityId } from '../theory/chords';
import { displayNote } from '../theory/pitch';
import { comparisonPlayback } from '../engine/intervalGenerator';
import { arpeggioPlayback, chordComparisonPlayback } from '../engine/chordGenerator';
import type { ChordQuestion, IntervalQuestion, NoteEvent, Question } from '../engine/types';

/** カテゴリごとに異なる画面上の振る舞い */
export interface CategoryUi<Q extends Question> {
  titleKey: string;
  promptKey: string;
  shortcutsKey: string;
  explanation: (q: Q, chosenId: string) => ReactNode;
  comparison: (q: Q, chosenId: string) => NoteEvent[];
  /** 問題音の別の聴き方（例: 分散和音）。ショートカットは D */
  alternatePlayback?: { labelKey: string; events: (q: Q) => NoteEvent[] };
}

function IntervalExplanation({ q }: { q: IntervalQuestion }) {
  const def = getInterval(q.payload.intervalId);
  return (
    <>
      <p className="font-bold">
        {t('explain.interval', {
          first: displayNote(q.payload.notes[0]),
          second: displayNote(q.payload.notes[1]),
          direction: t(`direction.${q.payload.direction}`),
          name: t(`interval.name.${def.id}`),
          semitones: def.semitones,
        })}
      </p>
      <p className="mt-2 text-ink-300">{t(`interval.tip.${def.id}`)}</p>
      {def.enharmonicKey && <p className="mt-1 text-ink-300">{t(def.enharmonicKey)}</p>}
    </>
  );
}

const degreeLabels = (ds: readonly string[]) => (ds.length === 0 ? t('explain.none') : ds.map((d) => DEGREES[d as keyof typeof DEGREES].label).join(' '));

function ChordExplanation({ q, chosenId }: { q: ChordQuestion; chosenId: string }) {
  const def = getChordQuality(q.payload.qualityId);
  const root = displayNote(q.payload.rootPc);
  const omitted = def.degrees.includes('5') && !q.payload.voices.some((v) => v.degree === '5');
  const diff = chosenId !== def.id ? degreeDifference(def, getChordQuality(chosenId as ChordQualityId)) : null;
  return (
    <>
      <p className="text-lg font-bold">{t('explain.chord.symbol', { symbol: `${root}${def.symbol}`, root })}</p>
      <p className="mt-1 text-ink-300">{t('explain.chord.formula', { formula: degreeLabels(def.degrees) })}</p>
      <p className="mt-2 text-xs text-ink-500">{t('explain.chord.voicing')}</p>
      <ol className="mt-1 flex flex-wrap gap-1" data-testid="chord-voices">
        {q.payload.voices.map((v) => (
          <li key={v.midi} className="rounded-md bg-ink-800 px-2 py-1 tabular-nums">
            {displayNote(v.note)} <span className="text-brass-400">{DEGREES[v.degree].label}</span>
          </li>
        ))}
      </ol>
      {omitted && <p className="mt-2 text-ink-300">{t('explain.chord.omit5')}</p>}
      <p className="mt-2 text-ink-300">{t(`chord.tip.${def.id}`)}</p>
      {diff && (
        <p className="mt-2 text-ink-300" data-testid="chord-diff">
          {t('explain.chord.diff', {
            chosen: t(`chord.name.${chosenId}`),
            onlyAnswer: degreeLabels(diff.onlyA),
            onlyChosen: degreeLabels(diff.onlyB),
          })}
        </p>
      )}
    </>
  );
}

export const intervalUi: CategoryUi<IntervalQuestion> = {
  titleKey: 'category.interval',
  promptKey: 'category.prompt.interval',
  shortcutsKey: 'quiz.shortcuts',
  explanation: (q) => <IntervalExplanation q={q} />,
  comparison: (q, id) => comparisonPlayback(q, id as IntervalId),
};

export const chordUi: CategoryUi<ChordQuestion> = {
  titleKey: 'category.chord',
  promptKey: 'category.prompt.chord',
  shortcutsKey: 'quiz.shortcuts.chord',
  explanation: (q, chosenId) => <ChordExplanation q={q} chosenId={chosenId} />,
  comparison: (q, id) => chordComparisonPlayback(q, id as ChordQualityId),
  alternatePlayback: { labelKey: 'quiz.arpeggio', events: (q) => arpeggioPlayback(q.playback.map((e) => e.midi)) },
};

export function uiFor(q: Question): CategoryUi<Question> {
  return (q.category === 'interval' ? intervalUi : chordUi) as CategoryUi<Question>;
}
