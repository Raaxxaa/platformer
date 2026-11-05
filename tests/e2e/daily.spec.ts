import { test, expect, type Page } from '@playwright/test';

// M15 (06 §14.1): Title → Daily starts Stage 1 with the day's seed and kit; a death records the official attempt and offers Share.
const frames = (page: Page) => page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
const g = (page: Page, fn: string, ...a: unknown[]) => page.evaluate(([fn, a]) => (window as any).__game[fn as string](...(a as unknown[])), [fn, a] as const);

test('Daily: the title row, the seeded run, the official death and Share', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1');
  await page.waitForFunction(() => (window as any).__game?.ready);
  await page.keyboard.press('Space'); await frames(page);
  await page.screenshot({ path: 'test-results/m15-title-daily.png' });
  await g(page, 'titleRun', 'daily');
  await expect.poll(async () => (await g(page, 'screenState')).screen).toBe('daily');
  await frames(page); await page.screenshot({ path: 'test-results/m18-daily-menu.png' });
  await g(page, 'screenAction', 'confirm');
  await page.waitForFunction(() => (window as any).__game?.ready === true && (window as any).__game.runState);
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const run = await g(page, 'runState');
  expect(run.seedText).toBe(`DAILY-${day}`);
  expect(run.daily).toBe(day);
  expect(run.seeded).toBe(true);
  for (let i = 0; i < 20 && (await g(page, 'deathRows')) === null; i++) { await g(page, 'hurtPlayer', 999); await page.waitForTimeout(300); }
  await expect.poll(() => g(page, 'deathRows'), { timeout: 10000 }).toEqual(['Restart', 'Change class', 'Title', 'Share']);
  const save = await g(page, 'save');
  expect(save.daily[day].official).toMatchObject({ result: 'death', stageReached: 1 });
  expect(save.history[0].mode).toBe('daily');
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(400);
  await page.keyboard.press('Enter');
  await expect.poll(() => g(page, 'lastShared')).toMatch(/^RUSHBLADE Daily \d{4}-\d{2}-\d{2} · .+ · — · 💀 Stage 1/);
  await frames(page); await page.screenshot({ path: 'test-results/m15-daily-death.png' });
  expect(errors).toEqual([]);
});

test('Seed challenge: a past day plays with that day\'s seed, never official', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1');
  await page.waitForFunction(() => (window as any).__game?.ready);
  await page.keyboard.press('Space');
  await g(page, 'titleRun', 'daily');
  await expect.poll(async () => (await g(page, 'screenState')).screen).toBe('daily');
  await g(page, 'screenAction', 'down'); await g(page, 'screenAction', 'left');     // two days ago
  await g(page, 'screenAction', 'confirm');
  await page.waitForFunction(() => (window as any).__game?.ready === true && (window as any).__game.runState);
  const run = await g(page, 'runState');
  const d = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10).replace(/-/g, '');
  expect(run.seedText).toBe(`DAILY-${d}`);
  expect(run.challenge).toBe(true); expect(run.daily).toBeUndefined(); expect(run.twist).toBeTruthy();
  await page.waitForTimeout(400); await frames(page); await page.screenshot({ path: 'test-results/m18-challenge-start.png' });
  await g(page, 'hurtPlayer', 999);
  await page.waitForTimeout(300);
  expect((await g(page, 'save')).daily).toEqual({});
  expect(errors).toEqual([]);
});
