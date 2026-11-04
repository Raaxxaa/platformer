import { test, expect, type Page } from '@playwright/test';

// M17 Task 4: the Controls page (07 §7.8) — rebind Jump to K from Pause → Settings, then jump with K.
const frames = (page: Page) => page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
const g = (page: Page, fn: string, ...a: unknown[]) => page.evaluate(([fn, a]) => (window as any).__game[fn as string](...(a as unknown[])), [fn, a] as const);

test('rebind Jump to K in Pause → Settings → Controls and jump with K', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1&start=plains&seed=REBIND&kit=swordsman:greatsword');
  await page.waitForFunction(() => (window as any).__game?.ready === true);
  await g(page, 'openPause'); await frames(page);
  // The run's pause menu: Resume, Restart run, Settings, Quit.
  await g(page, 'pauseAction', 'down'); await g(page, 'pauseAction', 'down'); await g(page, 'pauseAction', 'confirm');
  await expect.poll(() => page.evaluate(() => (window as any).__game.screenState()?.screen)).toBe('settings');
  await g(page, 'screenAction', 'confirm');                       // Controls ▸ is the first row
  for (let i = 0; i < 4; i++) await g(page, 'screenAction', 'down');
  await g(page, 'screenAction', 'confirm');                       // capture Jump, Key 1
  await frames(page); await page.screenshot({ path: 'test-results/m17-controls-capture.png' });
  await page.keyboard.press('KeyK'); await frames(page);
  expect((await g(page, 'save')).settings.bindings.keyboard.jump[0]).toBe('KeyK');
  await page.screenshot({ path: 'test-results/m17-controls.png' });
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => (window as any).__game.screenState()?.screen ?? null)).toBeNull();
  await page.keyboard.press('Escape');                              // resume
  await page.waitForTimeout(300);
  const y0 = (await g(page, 'body')).y;
  await page.keyboard.down('KeyK'); await page.waitForTimeout(200); await page.keyboard.up('KeyK');
  expect((await g(page, 'body')).y).toBeLessThan(y0 - 8);
  expect(errors).toEqual([]);
});
