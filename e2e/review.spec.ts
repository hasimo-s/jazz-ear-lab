import { expect, test } from '@playwright/test';
import { questionAt } from '../src/engine/session';

const SEED = 555;

test('苦手復習: 表示があり、他のコードも混ざり、通常の出題に戻せる', async ({ page }) => {
  // マイナーを2回間違えて「苦手」にする（初級コード 5問）
  await page.goto(`/?seed=${SEED}`);
  await page.getByRole('button', { name: 'トレーニングを始める' }).click();
  await page.getByTestId('category-chord').click();
  await page.locator('label').filter({ hasText: /^●?5$/ }).click();
  await page.getByRole('button', { name: 'スタート' }).click();
  for (let i = 0; i < 5; i++) {
    const q = questionAt({ category: 'chord', difficulty: 'beginner' }, SEED, i);
    const wrong = q.choices.find((c) => c.id !== q.answerId)!.id;
    await page.getByTestId(`choice-${wrong}`).click(); // 全問不正解 → 出題されたコードが苦手になる
    await page.getByTestId('next').click();
  }
  await page.getByRole('button', { name: 'ホームへ' }).click();

  await page.getByRole('button', { name: /苦手を復習/ }).click();
  await expect(page.getByTestId('review-badge')).toContainText('苦手の復習');
  const badge = await page.getByTestId('review-badge').innerText();
  const answers: string[] = [];
  for (let i = 0; i < 10; i++) { // 復習は10問
    await page.locator('[data-testid^="choice-"]').first().click();
    answers.push(await page.locator('[data-state="answer"]').innerText());
    await page.getByTestId('next').click();
  }
  // 苦手として表示されていないコードも出題されている
  expect(answers.some((a) => !badge.includes(a.replace(/[✓\s]/g, '').replace(/（正解）$/, '')))).toBe(true);
  await expect(page.getByRole('button', { name: 'もう一度復習する' })).toBeVisible();
  await page.getByTestId('result-normal').click();
  await expect(page.getByTestId('progress')).toHaveText('1 / 10');
  await expect(page.getByTestId('review-badge')).toHaveCount(0);
});
