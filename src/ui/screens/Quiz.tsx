import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../../i18n';
import { questionAt } from '../../engine/session';
import { grade } from '../../engine/grading';
import type { GradeResult, NoteEvent } from '../../engine/types';
import { uiFor } from '../categoryUi';
import { choiceLabelKey } from '../../engine/labels';
import type { AttemptRecord } from '../../engine/stats';
import { addAttempt } from '../../storage/db';
import { player, type AudioMode } from '../../audio/player';
import { Button } from '../components/Button';
import { Layout } from '../components/Layout';
import type { QuizConfig } from '../App';

export interface SessionSummary {
  config: QuizConfig;
  attempts: AttemptRecord[];
}

function useAudioMode(): AudioMode {
  const [mode, setMode] = useState<AudioMode>(player.mode);
  useEffect(() => player.subscribe(setMode), []);
  return mode;
}

export function Quiz({ config, onQuit, onFinish }: { config: QuizConfig; onQuit: () => void; onFinish: (s: SessionSummary) => void }) {
  const { settings, sessionSeed, length } = config;
  const [index, setIndex] = useState(0);
  const q = useMemo(() => questionAt(settings, sessionSeed, index), [settings, sessionSeed, index]);
  const ui = uiFor(q);
  const [playCount, setPlayCount] = useState(0);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [storageError, setStorageError] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const shownAt = useRef(performance.now());
  const sessionId = useRef(`${sessionSeed}-${Date.now()}`);
  const audioMode = useAudioMode();
  const nextRef = useRef<HTMLButtonElement>(null);
  const playRef = useRef<HTMLButtonElement>(null);

  const playEvents = useCallback((events: readonly NoteEvent[]) => {
    const p = player.play(events);
    p.then(() => setAudioError(false), () => setAudioError(true));
    return p;
  }, []);

  const playQuestion = useCallback(() => {
    if (!result) setPlayCount((c) => c + 1);
    playEvents(q.playback);
  }, [q, result, playEvents]);

  // 開始時・次の問題へ進んだときに自動再生（いずれもユーザー操作の直後）
  // 回答時間は「問題の音が鳴り始めた時点」から測る（初回の音源読み込み時間を含めない）
  useEffect(() => {
    shownAt.current = performance.now();
    setPlayCount(1);
    let active = true;
    playEvents(q.playback).then((started) => {
      if (active && started) shownAt.current = performance.now();
    }, () => {});
    // 前の問題の「次へ」ボタンが消えるとフォーカスが失われるので、再生ボタンへ移す
    playRef.current?.focus({ preventScroll: true });
    return () => {
      active = false;
      player.stop();
    };
  }, [q, playEvents]);

  // 連打・同時押しで1問に複数回答が記録されたり、問題が飛んだりしないよう、
  // 再描画を待たずに参照できる ref で「この問題は回答済み／次へ進行済み」を管理する
  const answeredIndex = useRef(-1);
  const advancedIndex = useRef(-1);

  const answer = useCallback((choiceId: string) => {
    if (result || answeredIndex.current === index) return;
    answeredIndex.current = index;
    const r = grade(q, choiceId);
    setResult(r);
    const rec: AttemptRecord = {
      id: `${sessionId.current}-${index}`,
      sessionId: sessionId.current,
      questionId: q.id,
      seed: q.seed,
      category: q.category,
      difficulty: q.difficulty,
      itemKey: q.itemKey,
      answerId: q.answerId,
      chosenId: choiceId,
      correct: r.correct,
      playCount,
      responseMs: Math.round(performance.now() - shownAt.current),
      timestamp: Date.now(),
    };
    setAttempts((a) => [...a, rec]);
    addAttempt(rec).catch(() => setStorageError(true));
    requestAnimationFrame(() => nextRef.current?.focus());
  }, [q, result, index, playCount]);

  const isLast = index + 1 >= length;
  const next = useCallback(() => {
    if (!result || advancedIndex.current === index) return;
    advancedIndex.current = index;
    if (isLast) {
      onFinish({ config, attempts });
      return;
    }
    setResult(null);
    setIndex((i) => i + 1);
  }, [result, index, isLast, onFinish, config, attempts]);

  const playAnswer = useCallback(() => playEvents(q.playback), [q, playEvents]);
  const playMine = useCallback(() => {
    if (result && !result.correct) playEvents(ui.comparison(q, result.chosenId));
  }, [q, ui, result, playEvents]);
  const playAlternate = useCallback(() => {
    if (!ui.alternatePlayback) return;
    if (!result) setPlayCount((c) => c + 1);
    playEvents(ui.alternatePlayback.events(q));
  }, [q, ui, result, playEvents]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // キーを押しっぱなしにしたときの自動リピートは無視する（再生の連打・誤操作の防止）
      if (e.repeat) {
        if (e.key === ' ') e.preventDefault();
        return;
      }
      const target = e.target as HTMLElement;
      const onButton = target.tagName === 'BUTTON';
      // ▶ 以外のボタンにフォーカスがあるときの Space は、そのボタンの操作に任せる
      if (e.key === ' ' && onButton && target !== playRef.current) return;
      if (e.key === ' ' || e.key.toLowerCase() === 'r') {
        e.preventDefault();
        playQuestion();
      } else if (e.key.toLowerCase() === 'd' && ui.alternatePlayback) {
        playAlternate();
      } else if (/^[1-4]$/.test(e.key)) {
        const c = q.choices[Number(e.key) - 1];
        if (c) answer(c.id);
      } else if (e.key.toLowerCase() === 'a' && result) {
        playAnswer();
      } else if (e.key.toLowerCase() === 's' && result) {
        playMine();
      } else if ((e.key === 'Enter' || e.key.toLowerCase() === 'n') && result) {
        // 「正解の音を再生」などの操作ボタン上の Enter はそのボタンに任せる。
        // ▶ や「次へ」の上（回答直後でフォーカス移動が間に合わない場合を含む）では次の問題へ進む
        if (onButton && e.key === 'Enter' && target !== playRef.current && target !== nextRef.current) return;
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [q, ui, result, answer, next, playQuestion, playAnswer, playMine, playAlternate]);

  const answerLabel = t(q.choices.find((c) => c.id === q.answerId)!.labelKey);

  return (
    <Layout
      title={t(ui.titleKey)}
      left={<Button variant="ghost" onClick={onQuit}>✕ {t('nav.quit')}</Button>}
      right={<span className="text-sm tabular-nums text-ink-300" data-testid="progress">{t('quiz.progress', { current: index + 1, total: length })}</span>}
    >
      {settings.focus && settings.focus.length > 0 && (
        <p className="rounded-xl border border-brass-500/50 bg-ink-900 px-3 py-2 text-sm" data-testid="review-badge">
          <span className="font-bold text-brass-400">{t('quiz.reviewBadge', { items: settings.focus.map((id) => t(choiceLabelKey(settings.category, id))).join('、') })}</span>
          <span className="block text-xs text-ink-300">{t('quiz.reviewNote')}</span>
        </p>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-800" aria-hidden>
        <div className="h-full bg-brass-500 transition-all" style={{ width: `${((index + (result ? 1 : 0)) / length) * 100}%` }} />
      </div>

      <section className="flex flex-col items-center gap-2 py-4">
        <button
          type="button"
          ref={playRef}
          onClick={playQuestion}
          aria-label={`${t('quiz.replay')} (Space)`}
          data-testid="play"
          className="flex h-28 w-28 items-center justify-center rounded-full bg-brass-500 text-4xl text-ink-950 shadow-lg shadow-brass-500/20 hover:bg-brass-400 active:scale-95"
        >
          ▶
        </button>
        <p className="text-sm text-ink-300" aria-live="polite">
          {audioMode === 'loading' ? t('quiz.loading') : t('quiz.playCount', { count: playCount })}
        </p>
        {audioMode === 'synth' && <p className="text-xs text-brass-400">{t('quiz.synthFallback')}</p>}
        {audioError && <p role="alert" className="text-xs text-ng-400">{t('quiz.audioError')}</p>}
        {ui.alternatePlayback && (
          <Button variant="ghost" className="text-sm" onClick={playAlternate} data-testid="play-alt">
            ♪ {t(ui.alternatePlayback.labelKey)} (D)
          </Button>
        )}
        <p className="text-center text-base">{t(ui.promptKey)}</p>
      </section>

      <div className="grid grid-cols-2 gap-3" role="group" aria-label={t(ui.promptKey)}>
        {q.choices.map((c, i) => {
          const isAnswer = c.id === q.answerId;
          const isChosen = result?.chosenId === c.id;
          let cls = 'border-ink-700 bg-ink-800 hover:border-ink-500';
          let mark = '';
          if (result) {
            if (isAnswer) { cls = 'border-ok-400 bg-ok-900 text-ok-400 font-bold'; mark = '✓'; }
            else if (isChosen) { cls = 'border-ng-400 bg-ng-900 text-ng-400 line-through decoration-2'; mark = '✗'; }
            else cls = 'border-ink-800 bg-ink-900 text-ink-500';
          }
          return (
            <button
              key={c.id}
              type="button"
              disabled={!!result}
              onClick={() => answer(c.id)}
              data-testid={`choice-${c.id}`}
              data-state={result ? (isAnswer ? 'answer' : isChosen ? 'wrong' : 'other') : 'open'}
              className={`relative flex min-h-16 items-center justify-center rounded-xl border-2 px-3 py-3 text-center text-base disabled:cursor-default ${cls}`}
            >
              <span className="absolute left-2 top-1 text-xs text-ink-500" aria-hidden>{i + 1}</span>
              {mark && <span className="mr-1 text-lg" aria-hidden>{mark}</span>}
              {t(c.labelKey)}
              {result && isAnswer && <span className="sr-only">（{t('quiz.correct')}）</span>}
              {result && isChosen && !isAnswer && <span className="sr-only">（{t('quiz.yourAnswer')}・{t('quiz.incorrect')}）</span>}
            </button>
          );
        })}
      </div>

      {/* 読み上げは正誤と正解だけを短く伝える */}
      <p aria-live="polite" className="sr-only" data-testid="sr-feedback">
        {result ? (result.correct ? t('quiz.correct') : `${t('quiz.incorrect')}。${t('quiz.answerIs', { answer: answerLabel })}`) : ''}
      </p>
      <div className="flex flex-col gap-3">
        {result && (
          <>
            <p data-testid="feedback" data-correct={result.correct}
              className={`flex items-center justify-center gap-2 rounded-xl py-3 text-xl font-bold ${result.correct ? 'bg-ok-900 text-ok-400' : 'bg-ng-900 text-ng-400'}`}>
              <span aria-hidden>{result.correct ? '◯' : '✕'}</span>
              {result.correct ? t('quiz.correct') : `${t('quiz.incorrect')} — ${t('quiz.answerIs', { answer: answerLabel })}`}
            </p>
            <div className="rounded-xl bg-ink-900 p-4 text-sm leading-relaxed" data-testid="explanation">
              {ui.explanation(q, result.chosenId)}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={playAnswer}>♪ {t('quiz.playAnswer')}</Button>
              <Button onClick={playMine} disabled={result.correct}>♪ {t('quiz.playMine')}</Button>
            </div>
            <Button ref={nextRef} variant="primary" className="text-lg" onClick={next} data-testid="next">
              {isLast ? t('quiz.finish') : t('quiz.next')} →
            </Button>
          </>
        )}
      </div>

      {storageError && <p role="alert" className="text-xs text-ng-400">{t('history.storageError')}</p>}
      <p className="mt-auto hidden text-center text-xs text-ink-500 sm:block">{t(ui.shortcutsKey)}</p>
      <p className="text-center text-xs text-ink-500" data-testid="seed">{t('quiz.seed', { seed: sessionSeed })}</p>
    </Layout>
  );
}
