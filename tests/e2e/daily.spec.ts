import { test, expect, type Page } from '@playwright/test';

// M19 (06 §14.1a): Title → Daily: the Daily Sprint (one stage, the practice preset, best of the day), the Weekly Run
// (the full run on this week's seed) and the seed challenge.
const frames = (page: Page) => page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
const g = (page: Page, fn: string, ...a: unknown[]) => page.evaluate(([fn, a]) => (window as any).__game?.[fn as string]?.(...(a as unknown[])), [fn, a] as const);
const today = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');
async function openDaily(page: Page) {
  await page.goto('/?debug=1&records=1');
  await page.waitForFunction(() => (window as any).__game?.ready);
  await page.keyboard.press('Space'); await frames(page);
  await g(page, 'titleRun', 'daily');
  await expect.poll(async () => (await g(page, 'screenState')).screen).toBe('daily');
}

test('Daily Sprint: one stage with its preset; the boss down ends it; the best of the day and Share', async ({ page, context }) => {
  test.setTimeout(90_000);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await openDaily(page);
  await frames(page); await page.screenshot({ path: 'test-results/m19-daily-menu.png' });
  await g(page, 'screenAction', 'confirm');
  await page.waitForFunction(() => (window as any).__game?.ready === true && (window as any).__game.runState);
  const run = await g(page, 'runState');
  expect(run).toMatchObject({ seedText: `DAILY-${today()}`, daily: today(), dailyKind: 'sprint', seeded: true });
  expect(run.twist).toBeTruthy();
  expect((await g(page, 'practice')).setup.levelId).toBe(await g(page, 'levelId'));
  await page.waitForTimeout(400); await frames(page); await page.screenshot({ path: 'test-results/m19-sprint-start.png' });
  expect(await g(page, 'toBossArena')).toBe(true);
  await expect.poll(async () => { await g(page, 'killAll'); return (await g(page, 'practice'))?.clear?.ticks ?? null; }, { timeout: 40_000, intervals: [300] }).not.toBeNull();
  await expect.poll(() => g(page, 'practiceResultRows'), { timeout: 10_000 }).toEqual(['Retry', 'Share', 'Title']);
  const save = await g(page, 'save');
  expect(save.daily[today()].bestTicks).toBeGreaterThan(0);
  await page.waitForTimeout(600);
  await g(page, 'screenAction', 'down'); await g(page, 'screenAction', 'confirm');
  await expect.poll(() => g(page, 'lastShared')).toMatch(/^RUSHBLADE Daily \d{4}-\d{2}-\d{2} · (Plains|Mountains|Swamps|Kingdom|Castle) · .+ · .+ \(.+\) · \d+:\d{2}\.\d{2}/);
  await frames(page); await page.screenshot({ path: 'test-results/m19-sprint-result.png' });
  expect(errors).toEqual([]);
});

test('Weekly Run: the full run on this week\'s seed; a death counts an attempt and offers Share', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await openDaily(page);
  await g(page, 'screenAction', 'down'); await g(page, 'screenAction', 'confirm');
  await page.waitForFunction(() => (window as any).__game?.ready === true && (window as any).__game.runState);
  const run = await g(page, 'runState');
  expect(run.seedText).toMatch(/^WEEKLY-\d{8}$/); expect(run.dailyKind).toBe('weekly');
  expect(await g(page, 'levelId')).toBe('plains');
  for (let i = 0; i < 20 && (await g(page, 'deathRows')) === null; i++) { await g(page, 'hurtPlayer', 999); await page.waitForTimeout(300); }
  await expect.poll(() => g(page, 'deathRows'), { timeout: 10000 }).toEqual(['Restart', 'Change class', 'Title', 'Share']);
  const monday = run.seedText.slice(7);
  expect((await g(page, 'save')).weekly[monday]).toMatchObject({ attempts: 1, bestTicks: null });
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(400); await page.keyboard.press('Enter');
  await expect.poll(() => g(page, 'lastShared')).toMatch(/^RUSHBLADE Weekly \d{4}-W\d{2} · .+ · 💀 Stage 1/);
  expect(errors).toEqual([]);
});

test('Seed challenge: a past day plays that day\'s Sprint, never official', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (e) => { errors.push(e.message); });
  await openDaily(page);
  for (let i = 0; i < 2; i++) await g(page, 'screenAction', 'down');
  await g(page, 'screenAction', 'left');                                     // two days ago
  await g(page, 'screenAction', 'confirm');
  await page.waitForFunction(() => (window as any).__game?.ready === true && (window as any).__game.runState);
  const run = await g(page, 'runState');
  const d = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10).replace(/-/g, '');
  expect(run).toMatchObject({ seedText: `DAILY-${d}`, challenge: true, dailyKind: 'sprint' });
  expect(run.daily).toBeUndefined();
  expect(errors).toEqual([]);
});
