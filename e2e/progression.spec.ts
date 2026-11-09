import { expect, test, type Page } from '@playwright/test';
import { questionAt } from '../src/engine/session';
import { progressionComparisonPlayback } from '../src/engine/progressionGenerator';
import type { Difficulty, ProgressionSettings } from '../src/engine/types';
import type { ProgressionId } from '../src/theory/progressions';

const SEED = 9001;
const option = (page: Page, text: string) => page.locator('label').filter({ hasText: new RegExp(`^●?${text}$`) });

async function startProgression(page: Page, difficultyLabel: string) {
  await page.goto(`/?seed=${SEED}`);
  await page.getByRole('button', { name: 'トレーニングを始める' }).click();
  await page.getByTestId('category-progression').click();
  await expect(page.getByTestId('category-progression')).toHaveAttribute('aria-checked', 'true');
  await option(page, difficultyLabel).click();
  await option(page, '5').click();
  await page.getByRole('button', { name: 'スタート' }).click();
}

const levels: [Difficulty, string][] = [['beginner', '初級'], ['intermediate', '中級'], ['advanced', '上級']];

for (const [difficulty, label] of levels) {
  test(`コード進行 ${label}: 5問回答して結果・履歴まで`, async ({ page }) => {
    const settings: ProgressionSettings = { category: 'progression', difficulty };
    await startProgression(page, label);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('コード進行');

    for (let i = 0; i < 5; i++) {
      const q = questionAt(settings, SEED, i);
      if (q.category !== 'progression') throw new Error('expected progression');
      const ids = await page.locator('[data-testid^="choice-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.slice(7)));
      expect(ids).toEqual(q.choices.map((c) => c.id));
      await expect.poll(() => page.evaluate(() => window.__jelPlaybackLog?.at(-1))).toEqual(q.playback.map((e) => e.midi));

      // ベースだけ
      await page.getByTestId('play-alt').click();
      await expect.poll(() => page.evaluate(() => window.__jelPlaybackLog?.at(-1))).toEqual(q.payload.chords.map((c) => c.bass));

      const wrong = q.choices.find((c) => c.id !== q.answerId)!.id;
      const chosen = i % 2 === 0 ? q.answerId : wrong;
      await page.getByTestId(`choice-${chosen}`).click();
      await expect(page.getByTestId('feedback')).toHaveAttribute('data-correct', String(chosen === q.answerId));
      await expect(page.getByTestId('progression-chords').locator('li')).toHaveCount(q.payload.symbols.length);
      if (chosen !== q.answerId) {
        await expect(page.getByTestId('progression-diff')).toBeVisible();
        await page.getByRole('button', { name: /自分の回答を再生/ }).click();
        const expected = progressionComparisonPlayback(q, chosen as ProgressionId).map((e) => e.midi);
        await expect.poll(() => page.evaluate(() => window.__jelPlaybackLog?.at(-1))).toEqual(expected);
      }
      await page.getByTestId('next').click();
    }

    await expect(page.getByTestId('result-score')).toHaveText('3 / 5 問正解');
    await page.getByRole('button', { name: '履歴を見る' }).click();
    await expect(page.getByTestId('history-items-progression')).toBeVisible();
  });
}
