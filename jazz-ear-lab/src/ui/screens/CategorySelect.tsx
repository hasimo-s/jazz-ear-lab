import { useState } from 'react';
import { t } from '../../i18n';
import type { Category, Difficulty, DirectionSetting, QuizSettings } from '../../engine/types';
import { DEFAULT_SESSION_LENGTH } from '../../engine/session';
import { Button } from '../components/Button';
import { Layout } from '../components/Layout';

function Segmented<T extends string | number>({ name, label, value, options, onChange, render }: {
  name: string; label: string; value: T; options: readonly T[]; onChange: (v: T) => void; render: (v: T) => string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-bold text-ink-300">{label}</legend>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((o) => (
          <label key={o} className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border px-2 text-center has-focus-visible:outline-3 has-focus-visible:outline-brass-400 ${value === o ? 'border-brass-400 bg-ink-800 font-bold text-brass-400' : 'border-ink-700 text-ink-300'}`}>
            <input type="radio" className="sr-only" name={name} checked={value === o} onChange={() => onChange(o)} />
            {value === o && <span aria-hidden className="mr-1">●</span>}
            {render(o)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const CATEGORIES: { id: Category; available: boolean }[] = [
  { id: 'interval', available: true },
  { id: 'chord', available: true },
  { id: 'progression', available: false },
];

export function CategorySelect({ onBack, onStart }: { onBack: () => void; onStart: (s: QuizSettings, length: number) => void }) {
  const [category, setCategory] = useState<'interval' | 'chord'>('interval');
  const [difficulty, setDifficulty] = useState<Difficulty>('beginner');
  const [direction, setDirection] = useState<DirectionSetting>('ascending');
  const [length, setLength] = useState(DEFAULT_SESSION_LENGTH);

  const start = () => {
    const settings: QuizSettings = category === 'interval'
      ? { category, difficulty, direction }
      : { category, difficulty };
    onStart(settings, length);
  };

  return (
    <Layout title={t('category.title')} left={<Button variant="ghost" onClick={onBack}>← {t('nav.back')}</Button>}>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('category.title')}>
        {CATEGORIES.map(({ id, available }) => {
          const selected = available && id === category;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={!available}
              onClick={() => available && setCategory(id as 'interval' | 'chord')}
              data-testid={`category-${id}`}
              className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border-2 px-1 text-center disabled:cursor-not-allowed disabled:opacity-50 ${selected ? 'border-brass-400 bg-ink-800 text-brass-400' : 'border-ink-700 bg-ink-900'}`}
            >
              <span className="font-bold">{selected && <span aria-hidden>● </span>}{t(`category.${id}`)}</span>
              {!available && <span className="rounded-full bg-ink-800 px-2 text-xs text-ink-300">{t('category.comingSoon')}</span>}
            </button>
          );
        })}
      </div>

      <section className="rounded-2xl border border-brass-500/50 bg-ink-900 p-4" aria-labelledby="cat-title">
        <h2 id="cat-title" className="text-xl font-bold">{t(`category.${category}`)}</h2>
        <p className="mb-4 text-sm text-ink-300">{t(`category.${category}.desc`)}</p>
        <div className="flex flex-col gap-5">
          <div>
            <Segmented name="difficulty" label={t('settings.difficulty')} value={difficulty} options={['beginner', 'intermediate', 'advanced'] as const}
              onChange={setDifficulty} render={(d) => t(`difficulty.${d}`)} />
            <p className="mt-2 text-xs text-ink-300" data-testid="difficulty-desc">{t(`difficulty.${category}.${difficulty}`)}</p>
          </div>
          {category === 'interval' && (
            <Segmented name="direction" label={t('settings.direction')} value={direction} options={['ascending', 'descending', 'both'] as const}
              onChange={setDirection} render={(d) => t(`direction.${d}`)} />
          )}
          <Segmented name="length" label={t('settings.length')} value={length} options={[5, 10, 20] as const} onChange={setLength} render={String} />
          <Button variant="primary" className="text-lg" onClick={start}>{t('settings.start')}</Button>
        </div>
      </section>

      <p className="text-sm text-ink-500">{t('category.progression')}: {t('category.progression.desc')}（{t('category.comingSoon')}）</p>
    </Layout>
  );
}
