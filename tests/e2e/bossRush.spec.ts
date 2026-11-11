import { test, expect, type Page } from '@playwright/test';

// M15 (06 §14.2): Boss Rush is locked until the King is beaten; then a setup screen, fights back to back, and a result screen.
const frames = (page: Page) => page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
const g = (page: Page, fn: string, ...a: unknown[]) => page.evaluate(([fn, a]) => (window as any).__game?.[fn as string]?.(...(a as unknown[])), [fn, a] as const);

test('Boss Rush: locked, then setup → all five bosses → result', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1');
  await page.waitForFunction(() => (window as any).__game?.ready);
  await page.keyboard.press('Space');
  await g(page, 'titleRun', 'bossRush');
  expect((await g(page, 'screenState')).screen).toBe('title');             // locked: nothing opens
  await frames(page); await page.screenshot({ path: 'test-results/m15-bossrush-locked.png' });
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('rushblade.save') ?? '{"v":1}'); s.progress = { ...(s.progress ?? {}), kingBeaten: true }; localStorage.setItem('rushblade.save', JSON.stringify(s)); });
  await page.reload();
  await page.waitForFunction(() => (window as any).__game?.ready);
  await page.keyboard.press('Space');
  await g(page, 'titleRun', 'bossRush');
  await expect.poll(async () => (await g(page, 'screenState')).screen).toBe('bossRush');
  await frames(page); await page.screenshot({ path: 'test-results/m15-bossrush-setup.png' });
  for (let i = 0; i < 3; i++) await g(page, 'screenAction', 'down');
  await g(page, 'screenAction', 'confirm');
  await page.waitForFunction(() => (window as any).__game?.ready === true && (window as any).__game.bossRush?.());
  for (const index of [1, 2, 3, 4, 5]) {
    await expect.poll(async () => { await g(page, 'killAll'); return (await g(page, 'bossRush'))?.index; }, { timeout: 30_000, intervals: [300] }).toBe(index);
    if (index === 5) break;
    await page.waitForFunction(() => (window as any).__game?.ready === true && !!(window as any).__game.runState, null, { timeout: 30_000 });
    await page.waitForTimeout(500);
    if (index === 2) {
      expect((await g(page, 'runState')).seedText).toBe('BOSSRUSH');
      await page.waitForTimeout(1500); await frames(page); await page.screenshot({ path: 'test-results/m15-bossrush-queen.png' });
    }
  }
  const a = await g(page, 'bossRush');
  expect(a.splits).toHaveLength(5);
  await expect.poll(() => g(page, 'rushResultOpen')).toBe(true);
  await page.waitForTimeout(600); await frames(page); await page.screenshot({ path: 'test-results/m15-bossrush-result.png' });
  const save = await g(page, 'save');
  expect(Object.keys(save.bossRushBests)).toEqual(['swordsman|no_dragon']);
  expect(save.history).toEqual([]);
  expect(save.stats.runsCompleted).toBe(0);
  expect(errors).toEqual([]);
});
