import { expect, test, type Page } from '@playwright/test';
import { questionAt } from '../src/engine/session';
import type { ChordSettings, Difficulty } from '../src/engine/types';

const SEED = 4242;
const option = (page: Page, text: string) => page.locator('label').filter({ hasText: new RegExp(`^●?${text}$`) });

async function startChord(page: Page, difficultyLabel: string) {
  await page.goto(`/?seed=${SEED}`);
  await page.getByRole('button', { name: 'トレーニングを始める' }).click();
  await page.getByTestId('category-chord').click();
  await expect(page.getByTestId('category-chord')).toHaveAttribute('aria-checked', 'true');
  await option(page, difficultyLabel).click();
  await option(page, '5').click();
  await page.getByRole('button', { name: 'スタート' }).click();
}

const levels: [Difficulty, string][] = [['beginner', '初級'], ['intermediate', '中級'], ['advanced', '上級']];

for (const [difficulty, label] of levels) {
  test(`コード認識 ${label}: 5問回答して結果・履歴まで`, async ({ page }) => {
    const settings: ChordSettings = { category: 'chord', difficulty };
    await startChord(page, label);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('コード');

    for (let i = 0; i < 5; i++) {
      const q = questionAt(settings, SEED, i);
      if (q.category !== 'chord') throw new Error('expected chord question');
      const ids = await page.locator('[data-testid^="choice-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.slice(7)));
      expect(ids).toEqual(q.choices.map((c) => c.id));
      await expect.poll(() => page.evaluate(() => window.__jelPlaybackLog?.at(-1))).toEqual(q.playback.map((e) => e.midi));

      // 分散和音（低い音から）
      await page.getByTestId('play-alt').click();
      await expect.poll(() => page.evaluate(() => window.__jelPlaybackLog?.at(-1))).toEqual([...q.playback.map((e) => e.midi)].sort((a, b) => a - b));

      const wrong = q.choices.find((c) => c.id !== q.answerId)!.id;
      const chosen = i < 3 ? q.answerId : wrong;
      await page.getByTestId(`choice-${chosen}`).click();
      await expect(page.getByTestId('feedback')).toHaveAttribute('data-correct', String(chosen === q.answerId));
      await expect(page.getByTestId('chord-voices').locator('li')).toHaveCount(q.payload.voices.length);
      if (chosen !== q.answerId) {
        await expect(page.getByTestId('chord-diff')).toBeVisible();
        await page.getByRole('button', { name: /自分の回答を再生/ }).click();
        await expect.poll(() => page.evaluate(() => Math.min(...window.__jelPlaybackLog!.at(-1)!))).toBe(q.payload.voicing.bassMidi);
      }
      await page.getByTestId('next').click();
    }

    await expect(page.getByTestId('result-score')).toHaveText('3 / 5 問正解');
    await page.getByRole('button', { name: '履歴を見る' }).click();
    await expect(page.getByTestId('history-categories')).toContainText('60%');
    await expect(page.getByTestId('history-items-chord')).toBeVisible();
  });
}

test('キーボード D で分散和音を再生できる', async ({ page }) => {
  await startChord(page, '中級');
  const before = await page.evaluate(() => window.__jelPlaybackLog?.length ?? 0);
  await page.keyboard.press('d');
  await expect.poll(() => page.evaluate(() => window.__jelPlaybackLog!.length)).toBeGreaterThan(before);
  await expect(page.getByText('再生 2回')).toBeVisible();
});

test('履歴の消去は画面内で確認してから行う', async ({ page }) => {
  await startChord(page, '初級');
  const q = questionAt({ category: 'chord', difficulty: 'beginner' }, SEED, 0);
  await page.getByTestId(`choice-${q.answerId}`).click();
  await page.getByRole('button', { name: 'やめる' }).click();
  await page.getByRole('button', { name: '学習履歴を見る' }).click();
  await page.getByRole('button', { name: '履歴を消去' }).click();
  await page.getByRole('button', { name: 'キャンセル' }).click();
  await expect(page.getByTestId('history-recent').locator('li')).toHaveCount(1);
  await page.getByRole('button', { name: '履歴を消去' }).click();
  await page.getByTestId('clear-confirm').click();
  await expect(page.getByTestId('history-empty')).toBeVisible();
});
