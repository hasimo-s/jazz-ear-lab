import { expect, test, type Page } from '@playwright/test';

async function start(page: Page, length = '5') {
  await page.goto('/?seed=1');
  await page.getByRole('button', { name: 'トレーニングを始める' }).click();
  await page.locator('label').filter({ hasText: new RegExp(`^●?${length}$`) }).click();
  await page.getByRole('button', { name: 'スタート' }).click();
}

test('選択肢の同時押しでも1問1回答しか記録されない', async ({ page }) => {
  await start(page);
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => {
      const b = document.querySelectorAll<HTMLButtonElement>('[data-testid^="choice-"]');
      b[0]!.click(); b[1]!.click(); b[2]!.click();
    });
    await page.getByTestId('next').click();
  }
  await expect(page.getByTestId('result-score')).toContainText('/ 5 問正解');
});

test('「次へ」の連打で問題が飛ばない', async ({ page }) => {
  await start(page);
  await page.locator('[data-testid^="choice-"]').first().click();
  await page.evaluate(() => {
    const n = document.querySelector<HTMLButtonElement>('[data-testid="next"]')!;
    n.click(); n.click(); n.click();
  });
  await expect(page.getByTestId('progress')).toHaveText('2 / 5');
});

test('Enter キーの押しっぱなし（自動リピート）で問題が飛ばない', async ({ page }) => {
  await start(page);
  await page.locator('[data-testid^="choice-"]').first().click();
  await page.keyboard.down('Enter');
  for (let i = 0; i < 5; i++) await page.keyboard.down('Enter');
  await page.keyboard.up('Enter');
  await expect(page.getByTestId('progress')).toHaveText('2 / 5');
});

test('ホームの見出しは1つだけ', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
});

test('次の問題に進むと、フォーカスは再生ボタンに移る（body に落ちない）', async ({ page }) => {
  await start(page);
  await page.locator('[data-testid^="choice-"]').first().click();
  await page.getByTestId('next').click();
  await expect(page.getByTestId('play')).toBeFocused();
});

test('ボタンにフォーカスがあるときの Space はそのボタンを押す（問題の再生にならない）', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: /やめる/ }).focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'トレーニングを始める' })).toBeVisible();
});

test('音源の読み込み中に「やめる」を押すと、あとから音が鳴らない', async ({ page }) => {
  // 音源の応答を遅らせる
  await page.route('**/samples/piano/*.mp3', async (route) => {
    await new Promise((r) => setTimeout(r, 2000));
    await route.continue();
  });
  await page.addInitScript(() => {
    (window as unknown as { __starts: number }).__starts = 0;
    const orig = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args: Parameters<typeof orig>) {
      if (this.buffer && this.buffer.duration > 1) (window as unknown as { __starts: number }).__starts++;
      return orig.apply(this, args);
    };
  });
  await start(page);
  await page.getByRole('button', { name: /やめる/ }).click();
  await page.waitForTimeout(4500);
  expect(await page.evaluate(() => (window as unknown as { __starts: number }).__starts)).toBe(0);
});

test('カテゴリは矢印キーで選べる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'トレーニングを始める' }).click();
  await page.getByTestId('category-interval').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('category-chord')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('category-chord')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('category-progression')).toHaveAttribute('aria-checked', 'true');
});

test('音のテスト: 和音が鳴り、音源と音声の状態が表示される', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('sound-test').click();
  await expect.poll(() => page.evaluate(() => window.__jelPlaybackLog?.at(-1))).toEqual([60, 64, 67]);
  await expect(page.getByTestId('sound-status')).toContainText('音源: ピアノ');
  await expect(page.getByTestId('sound-status')).toContainText('running');
});

test('音源のクレジット（作者・作品・出典・ライセンス）が表示され、LICENSES.txt が配信される', async ({ page, request }) => {
  await page.goto('/');
  const credit = page.getByTestId('credit');
  await expect(credit).toContainText('Salamander Grand Piano V3');
  await expect(credit).toContainText('Alexander Holm');
  await expect(credit.getByRole('link', { name: 'CC BY 3.0' })).toHaveAttribute('href', 'https://creativecommons.org/licenses/by/3.0/');
  await expect(credit.getByRole('link', { name: 'Salamander Grand Piano V3' })).toHaveAttribute('href', 'https://archive.org/details/SalamanderGrandPianoV3');
  const res = await request.get('/LICENSES.txt');
  expect(res.ok()).toBe(true);
  expect(await res.text()).toContain('Creative Commons Attribution 3.0');
});
