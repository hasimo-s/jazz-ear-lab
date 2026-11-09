import { t } from '../../i18n';
import { overallStats } from '../../engine/stats';
import { choiceLabelKey } from '../../engine/labels';
import { Button } from '../components/Button';
import { Layout } from '../components/Layout';
import { pct, secs } from '../format';
import type { SessionSummary } from './Quiz';

export function Result({ summary, onAgain, onNormal, onHome, onHistory }: { summary: SessionSummary; onAgain: () => void; onNormal: () => void; onHome: () => void; onHistory: () => void }) {
  const isReview = (summary.config.settings.focus?.length ?? 0) > 0;
  const s = overallStats(summary.attempts);
  return (
    <Layout title={`${t('result.title')} — ${t(`category.${summary.config.settings.category}`)}`}>
      <section className="flex flex-col items-center gap-1 rounded-2xl bg-ink-900 py-8 text-center">
        <p className="text-5xl font-black text-brass-400" data-testid="result-accuracy">{pct(s.accuracy)}</p>
        <p className="text-lg" data-testid="result-score">{t('result.score', { correct: s.correct, total: s.attempts })}</p>
        <p className="text-sm text-ink-300">{t('result.avgTime', { seconds: secs(s.avgResponseMs) })}</p>
        <p className="text-sm text-ink-300">{t('result.avgPlays', { count: s.avgPlayCount.toFixed(1) })}</p>
      </section>
      <ol className="flex flex-col gap-1 text-sm">
        {summary.attempts.map((a, i) => (
          <li key={a.id} className="flex items-center gap-3 rounded-lg bg-ink-900 px-3 py-2">
            <span className="w-6 text-ink-500">{i + 1}</span>
            <span className={a.correct ? 'text-ok-400' : 'text-ng-400'}>{a.correct ? '✓ ' + t('quiz.correct') : '✗ ' + t('quiz.incorrect')}</span>
            <span className="flex-1">{t(choiceLabelKey(a.category, a.answerId))}</span>
            {!a.correct && <span className="text-ink-500 line-through">{t(choiceLabelKey(a.category, a.chosenId))}</span>}
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-3">
        <Button variant="primary" onClick={onAgain}>{isReview ? t('result.againReview') : t('result.again')}</Button>
        {isReview && <Button onClick={onNormal} data-testid="result-normal">{t('result.normal')}</Button>}
        <Button onClick={onHistory}>{t('result.history')}</Button>
        <Button variant="ghost" onClick={onHome}>{t('result.home')}</Button>
      </div>
    </Layout>
  );
}
