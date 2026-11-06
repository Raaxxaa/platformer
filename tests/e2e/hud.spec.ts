import { test, expect, type Page } from '@playwright/test';

// M17 Task 5 (07 §4.1a): HUD groups at their new defaults, and the HUD layout editor.
const frames = (page: Page) => page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
const g = (page: Page, fn: string, ...a: unknown[]) => page.evaluate(([fn, a]) => (window as any).__game[fn as string](...(a as unknown[])), [fn, a] as const);

test('new default HUD: health top-left, weapons top-right, timer bottom-right; the editor moves a group and saves it', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1&start=plains&seed=HUD&kit=swordsman:greatsword');
  await page.waitForFunction(() => (window as any).__game?.ready === true);
  await page.waitForTimeout(500); await frames(page);
  await page.screenshot({ path: 'test-results/m17-hud-desktop.png' });
  await g(page, 'openPause'); await g(page, 'pauseAction', 'down'); await g(page, 'pauseAction', 'down'); await g(page, 'pauseAction', 'confirm');
  await expect.poll(() => page.evaluate(() => (window as any).__game.screenState()?.screen)).toBe('settings');
  for (let i = 0; i < 6; i++) await g(page, 'screenAction', 'down');
  await g(page, 'screenAction', 'confirm');
  await expect.poll(() => page.evaluate(() => (window as any).__game.screenState()?.screen)).toBe('hudLayout');
  await page.keyboard.press('Digit4');                             // the Weapons group to Bottom-left
  await frames(page); await page.screenshot({ path: 'test-results/m17-hud-editor.png' });
  await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => (window as any).__game.screenState()?.screen)).toBe('settings');
  expect((await g(page, 'save')).settings.hud.slots).toEqual({ x: 4, y: 276 });
  expect(errors).toEqual([]);
});

test.describe('phone', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  test('on a phone the timer sits top-center', async ({ page }) => {
    await page.goto('/?debug=1&start=plains&seed=HUD&kit=swordsman:greatsword');
    await page.waitForFunction(() => (window as any).__game?.ready === true);
    await page.evaluate(() => { for (const t of ['pointerdown', 'pointerup']) window.dispatchEvent(new PointerEvent(t, { pointerId: 9, pointerType: 'touch', clientX: 300, clientY: 100, bubbles: true })); });
    await page.waitForTimeout(500); await frames(page);
    await page.screenshot({ path: 'test-results/m17-hud-phone.png' });
  });
});
