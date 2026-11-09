import { expect, test, type Page } from '@playwright/test';
import { questionAt } from '../src/engine/session';
import type { IntervalSettings } from '../src/engine/types';

const SEED = 12345;
const settings: IntervalSettings = { category: 'interval', difficulty: 'beginner', direction: 'ascending' };
const expected = (i: number) => questionAt(settings, SEED, i);

async function startBeginnerAscending(page: Page, length: '5' | '10' = '5') {
  await page.goto(`/?seed=${SEED}`);
  await page.getByRole('button', { name: 'トレーニングを始める' }).click();
  const option = (text: string) => page.locator('label').filter({ hasText: new RegExp(`^●?${text}$`) });
  await option('初級').click();
  await option('上行').click();
  await option(length).click();
  await expect(page.getByRole('radio', { name: length, exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'スタート' }).click();
}

test('ホーム → カテゴリ → 回答 → 結果 → 履歴（シード固定で問題を再現）', async ({ page }) => {
  await startBeginnerAscending(page);
  await expect(page.getByTestId('progress')).toHaveText('1 / 5');
  await expect(page.getByTestId('seed')).toContainText(String(SEED));

  for (let i = 0; i < 5; i++) {
    const q = expected(i);
    // 画面の選択肢がエンジンの生成結果と一致する
    const ids = await page.locator('[data-testid^="choice-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.slice(7)));
    expect(ids).toEqual(q.choices.map((c) => c.id));
    // 自動再生された音がエンジンの問題と一致する
    await expect.poll(() => page.evaluate(() => window.__jelPlaybackLog?.at(-1))).toEqual(q.playback.map((e) => e.midi));

    // 偶数問目は正解、奇数問目は誤答
    const wrong = q.choices.find((c) => c.id !== q.answerId)!.id;
    const chosen = i % 2 === 0 ? q.answerId : wrong;
    await page.getByTestId(`choice-${chosen}`).click();

    const fb = page.getByTestId('feedback');
    await expect(fb).toHaveAttribute('data-correct', String(chosen === q.answerId));
    await expect(fb).toContainText(chosen === q.answerId ? '正解' : '不正解');
    await expect(page.getByTestId(`choice-${q.answerId}`)).toHaveAttribute('data-state', 'answer');
    await expect(page.getByTestId(`choice-${q.answerId}`)).toContainText('✓'); // 色以外の手がかり
    if (chosen !== q.answerId) await expect(page.getByTestId(`choice-${chosen}`)).toContainText('✗');
    await expect(page.getByTestId('explanation')).toBeVisible();

    // 正解音の再生
    const before = await page.evaluate(() => window.__jelPlaybackLog!.length);
    await page.getByRole('button', { name: /正解の音を再生/ }).click();
    await expect.poll(() => page.evaluate(() => window.__jelPlaybackLog!.length)).toBe(before + 1);

    await page.getByTestId('next').click();
  }

  await expect(page.getByTestId('result-score')).toHaveText('3 / 5 問正解');
  await page.getByRole('button', { name: '履歴を見る' }).click();
  await expect(page.getByTestId('history-categories')).toContainText('60%');
  await expect(page.getByTestId('history-recent').locator('li')).toHaveCount(5);

  // 再読み込み後も履歴が残る（IndexedDB）
  await page.reload();
  await expect(page.getByTestId('home-overall')).toContainText('通算 5問');
});

test('キーボードだけで回答できる', async ({ page }) => {
  await startBeginnerAscending(page);
  const q = expected(0);
  const before = await page.evaluate(() => window.__jelPlaybackLog?.length ?? 0);
  await page.keyboard.press('Space'); // 再生
  await expect.poll(() => page.evaluate(() => window.__jelPlaybackLog!.length)).toBeGreaterThan(before);
  const idx = q.choices.findIndex((c) => c.id === q.answerId);
  await page.keyboard.press(String(idx + 1));
  await expect(page.getByTestId('feedback')).toHaveAttribute('data-correct', 'true');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('progress')).toHaveText('2 / 5');
});

test('再生回数が記録される', async ({ page }) => {
  await startBeginnerAscending(page);
  await page.getByTestId('play').click();
  await page.getByTestId('play').click();
  await expect(page.getByText('再生 3回')).toBeVisible(); // 自動再生1 + 手動2
});
