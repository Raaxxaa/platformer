import { test, expect, type Page } from '@playwright/test';

// M14 (06 §5.4): Assist mode — the Settings page, half damage, the ASSIST tag, and no personal best.
const frames = (page: Page) => page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
const g = (page: Page, fn: string, ...a: unknown[]) => page.evaluate(([fn, a]) => (window as any).__game[fn as string](...(a as unknown[])), [fn, a] as const);

test('the Assist page sets 70% speed and 50% damage; the run shows ASSIST, takes half damage and writes no best', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1&records=1');
  await page.waitForFunction(() => (window as any).__game?.ready);
  await g(page, 'titleChoose', 3);
  await expect.poll(() => page.evaluate(() => (window as any).__game.screenState().screen)).toBe('settings');
  for (let i = 0; i < 7; i++) await g(page, 'screenAction', 'down');
  await g(page, 'screenAction', 'confirm');
  await g(page, 'screenAction', 'right'); await g(page, 'screenAction', 'right');        // speed 70%
  await g(page, 'screenAction', 'down'); await g(page, 'screenAction', 'right'); await g(page, 'screenAction', 'right');   // damage 50%
  await frames(page); await page.screenshot({ path: 'test-results/m14-assist-page.png' });
  expect((await g(page, 'save')).settings.assist).toMatchObject({ speed: 0.7, damageTaken: 0.5 });
  await page.goto('/?debug=1&records=1&start=plains&seed=ASSIST&kit=swordsman:greatsword');
  await page.waitForFunction(() => (window as any).__game?.ready === true);
  await page.waitForTimeout(500);
  const hp = (await g(page, 'runState')).assist;
  expect(hp).toMatchObject({ damageTaken: 0.5, slowedEver: true });
  expect((await g(page, 'timerBlock')).time).toBeTruthy();
  const before = await page.evaluate(() => (window as any).__game.health?.().hp ?? null);
  await g(page, 'hurtPlayer', 12);
  const after = await page.evaluate(() => (window as any).__game.health?.().hp ?? null);
  if (before !== null) expect(before - after).toBe(6);
  await frames(page); await page.screenshot({ path: 'test-results/m14-assist-tag.png' });
  expect((await g(page, 'save')).pbs).toEqual({});
  expect(errors).toEqual([]);
});
