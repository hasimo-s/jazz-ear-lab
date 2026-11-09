import { useState } from 'react';
import { t } from '../../i18n';
import { groupStats, weakItems } from '../../engine/stats';
import { reviewSettings } from '../../engine/review';
import { INTERVALS } from '../../theory/intervals';
import { CHORD_QUALITIES } from '../../theory/chords';
import { PROGRESSIONS } from '../../theory/progressions';
import { choiceLabelKey } from '../../engine/labels';
import type { Category, QuizSettings } from '../../engine/types';
import { clearAttempts } from '../../storage/db';
import { Button } from '../components/Button';
import { Layout } from '../components/Layout';
import { useAttempts } from '../useAttempts';
import { pct, secs } from '../format';

const CATEGORIES: Category[] = ['interval', 'chord', 'progression'];
const IMPLEMENTED: Category[] = ['interval', 'chord', 'progression'];
const ITEM_ORDER: Record<string, Map<string, number>> = {
  interval: new Map(INTERVALS.map((d, i) => [d.id as string, i])),
  chord: new Map(CHORD_QUALITIES.map((d, i) => [d.id as string, i])),
  progression: new Map(PROGRESSIONS.map((d, i) => [d.id as string, i])),
};

function Bar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-ink-800" aria-hidden>
      <div className="h-full bg-brass-500" style={{ width: pct(value) }} />
    </div>
  );
}

export function History({ onBack, onReview }: { onBack: () => void; onReview: (s: QuizSettings) => void }) {
  const { attempts, error, reload } = useAttempts();
  const [confirming, setConfirming] = useState(false);
  const back = <Button variant="ghost" onClick={onBack}>← {t('nav.back')}</Button>;
  if (!attempts) return <Layout title={t('history.title')} left={back}><p>…</p></Layout>;

  const byCategory = new Map(groupStats(attempts, (a) => a.category).map((s) => [s.key, s]));
  const byItem = IMPLEMENTED.map((c) => ({
    category: c,
    stats: groupStats(attempts.filter((a) => a.category === c), (a) => a.answerId)
      .sort((a, b) => (ITEM_ORDER[c]!.get(a.key) ?? 0) - (ITEM_ORDER[c]!.get(b.key) ?? 0)),
  })).filter((g) => g.stats.length > 0);
  const weak = weakItems(attempts);
  const review = reviewSettings(weak);
  const recent = [...attempts].reverse().slice(0, 30);

  // confirm() は埋め込み表示などで使えないことがあるため、画面内で確認する
  const clear = async () => {
    await clearAttempts().catch(() => {});
    setConfirming(false);
    reload();
  };

  return (
    <Layout title={t('history.title')} left={back}>
      {error && <p role="alert" className="text-sm text-ng-400">{t('history.storageError')}</p>}

      <section>
        <h2 className="mb-2 font-bold">{t('history.byCategory')}</h2>
        <ul className="flex flex-col gap-2" data-testid="history-categories">
          {CATEGORIES.map((c) => {
            const s = byCategory.get(c);
            return (
              <li key={c} className="rounded-xl bg-ink-900 p-3">
                <div className="flex justify-between text-sm">
                  <span className="font-bold">{t(`category.${c}`)}</span>
                  <span className="tabular-nums text-ink-300">
                    {!IMPLEMENTED.includes(c) ? t('history.notImplemented')
                      : s ? `${pct(s.accuracy)}（${t('history.attempts', { count: s.attempts })}）` : '—'}
                  </span>
                </div>
                {s && <Bar value={s.accuracy} />}
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-bold">{t('history.weak')}</h2>
        {weak.length === 0 ? <p className="text-sm text-ink-300">{t('history.weakNone')}</p> : (
          <>
            <ul className="mb-3 flex flex-wrap gap-2">
              {weak.map((w) => (
                <li key={w.key} className="rounded-full border border-ng-400/60 px-3 py-1 text-sm">
                  {t(choiceLabelKey(w.category, w.answerId))} <span className="tabular-nums text-ink-300">{pct(w.accuracy)}</span>
                </li>
              ))}
            </ul>
            {review && <Button variant="primary" className="w-full" onClick={() => onReview(review)}>{t('history.reviewWeak')}</Button>}
          </>
        )}
      </section>

      {attempts.length === 0 ? <p className="text-ink-300" data-testid="history-empty">{t('history.empty')}</p> : (
        <>
          {byItem.map((g) => (
            <section key={g.category}>
              <h2 className="mb-2 font-bold">{t(`history.byItem.${g.category}`)}</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid={`history-items-${g.category}`}>
                  <thead className="text-left text-ink-300">
                    <tr><th className="py-1 font-normal"></th><th className="font-normal">{t('history.accuracy')}</th><th className="font-normal">{t('history.avgTime')}</th><th className="font-normal">{t('history.avgPlays')}</th></tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {g.stats.map((s) => (
                      <tr key={s.key} className="border-t border-ink-800">
                        <td className="py-2 pr-2">{t(choiceLabelKey(g.category, s.key))}</td>
                        <td>{pct(s.accuracy)} <span className="text-ink-500">({s.correct}/{s.attempts})</span></td>
                        <td>{secs(s.avgResponseMs)}s</td>
                        <td>{s.avgPlayCount.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}

          <section>
            <h2 className="mb-2 font-bold">{t('history.recent')}</h2>
            <ul className="flex flex-col gap-1 text-sm" data-testid="history-recent">
              {recent.map((a) => (
                <li key={a.id} className="flex items-center gap-2 rounded-lg bg-ink-900 px-3 py-2">
                  <span className={a.correct ? 'text-ok-400' : 'text-ng-400'} aria-label={a.correct ? t('quiz.correct') : t('quiz.incorrect')}>{a.correct ? '✓' : '✗'}</span>
                  <span className="flex-1">{t(choiceLabelKey(a.category, a.answerId))}<span className="text-ink-500"> · {a.category === 'interval' ? t(`direction.${a.itemKey.split(':')[2]}`) : t(`category.${a.category}`)}</span></span>
                  <span className="tabular-nums text-ink-500">{secs(a.responseMs)}s · ▶{a.playCount}</span>
                </li>
              ))}
            </ul>
          </section>

          {confirming ? (
            <div role="alertdialog" aria-label={t('history.clear')} className="flex flex-col gap-3 rounded-xl border border-ng-400/60 p-4">
              <p className="text-sm">{t('history.clearConfirm')}</p>
              <div className="grid grid-cols-2 gap-3">
                <Button onClick={() => setConfirming(false)}>{t('history.cancel')}</Button>
                <Button className="border-ng-400 text-ng-400" onClick={clear} data-testid="clear-confirm">{t('history.clearYes')}</Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" className="text-ng-400" onClick={() => setConfirming(true)}>{t('history.clear')}</Button>
          )}
        </>
      )}
    </Layout>
  );
}
