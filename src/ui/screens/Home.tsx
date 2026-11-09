import { t } from '../../i18n';
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

  return (
    <Layout title="">
      <section className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
        <p className="text-5xl" aria-hidden>🎷</p>
        <h1 className="text-3xl font-black tracking-tight text-brass-400">{t('app.title')}</h1>
        <p className="text-ink-300">{t('app.tagline')}</p>
        <p className="mt-4 text-sm text-ink-300" data-testid="home-overall">
          {error
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
      </div>
      <p className="pt-4 text-center text-xs text-ink-500">{t('home.credit')}</p>
    </Layout>
  );
}
