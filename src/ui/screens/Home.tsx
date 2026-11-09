import { useState } from 'react';
import { t } from '../../i18n';
import { player } from '../../audio/player';
import { overallStats, weakItems } from '../../engine/stats';
import { reviewSettings } from '../../engine/review';
import type { QuizSettings } from '../../engine/types';
import { Button } from '../components/Button';
import { Layout } from '../components/Layout';
import { useAttempts } from '../useAttempts';
import { pct } from '../format';

export function Home({ onStart, onHistory, onReview }: { onStart: () => void; onHistory: () => void; onReview: (s: QuizSettings) => void }) {
  const { attempts, error } = useAttempts();
  const overall = attempts ? overallStats(attempts) : null;
  const weak = attempts ? weakItems(attempts) : [];
  const review = reviewSettings(weak);
  const [soundStatus, setSoundStatus] = useState<string | null>(null);

  // C メジャーの和音を鳴らし、音源と AudioContext の状態を表示する（スマホで鳴らないときの切り分け用）
  const soundTest = () => {
    setSoundStatus(t('home.soundTestResult', { mode: t(`audio.mode.${player.mode}`), state: player.contextState }));
    const events = [60, 64, 67].map((midi) => ({ midi, time: 0, duration: 1.2, velocity: 0.8 }));
    player.play(events).finally(() => {
      setSoundStatus(t('home.soundTestResult', { mode: t(`audio.mode.${player.mode}`), state: player.contextState }));
    });
  };

  return (
    <Layout title="">
      <section className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
        <p className="text-5xl" aria-hidden>🎷</p>
        <h1 className="text-3xl font-black tracking-tight text-brass-400">{t('app.title')}</h1>
        <p className="text-ink-300">{t('app.tagline')}</p>
        <p className="mt-4 text-sm text-ink-300" data-testid="home-overall">
          {attempts === null
            ? '\u00a0' /* 読み込み中は空欄（「まだ回答履歴はありません」と誤表示しない） */
            : error
            ? t('history.storageError')
            : overall && overall.attempts > 0
              ? t('home.overall', { attempts: overall.attempts, accuracy: pct(overall.accuracy) })
              : t('home.noHistory')}
        </p>
      </section>
      <div className="flex flex-col gap-3">
        <Button variant="primary" className="text-lg" onClick={onStart}>{t('home.start')}</Button>
        {review && (
          <Button onClick={() => onReview(review)}>{t('home.review', { count: review.focus?.length ?? 0 })}</Button>
        )}
        <Button onClick={onHistory}>{t('home.history')}</Button>
        <Button variant="ghost" onClick={soundTest} data-testid="sound-test">{t('home.soundTest')}</Button>
        {soundStatus && (
          <div className="rounded-xl bg-ink-900 p-3 text-xs text-ink-300" aria-live="polite" data-testid="sound-status">
            <p className="font-bold text-ink-100">{soundStatus}</p>
            <p className="mt-1">{t('home.soundTestHint')}</p>
          </div>
        )}
      </div>
      {/* CC BY 3.0 の表示: 作者名・作品名・出典 URI・ライセンス名と URI・改変（形式変換）の有無 */}
      <p className="pt-4 text-center text-xs text-ink-500" data-testid="credit">
        {t('home.credit.prefix')}{' '}
        <a className="underline" href="https://archive.org/details/SalamanderGrandPianoV3" target="_blank" rel="noopener noreferrer">{t('home.credit.work')}</a>{' '}
        {t('home.credit.by')},{' '}
        <a className="underline" href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener noreferrer">{t('home.credit.license')}</a>
        {t('home.credit.note')}
      </p>
    </Layout>
  );
}
