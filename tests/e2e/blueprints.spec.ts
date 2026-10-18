import { test, expect, type Page } from '@playwright/test';

async function boot(page: Page, typed = false) {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`/?debug=1&start=plains&kit=tank:war_maul${typed ? '&seed=BLUEPRINT' : ''}`);
  await page.waitForFunction(() => (window as any).__game?.ready);
  await page.evaluate(() => (window as any).__game.setManual(true));
  return errors;
}
const frames = (page: Page) => page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));

test('touch saves a blueprint now, while a same-world restart refreshes the loot snapshot', async ({ page }) => {
  const errors = await boot(page);
  expect(await page.evaluate(() => typeof (window as any).__game.poolSnapshot)).toBe('function');
  expect(await page.evaluate(() => (window as any).__game.poolSnapshot().unlocked)).not.toContain('scythe');
  await page.evaluate(() => (window as any).__game.dropBlueprint('scythe'));
  expect(await page.evaluate(() => (window as any).__game.save().unlocks.blueprints)).not.toContain('scythe');
  await page.evaluate(() => (window as any).__game.step(1, {}));
  expect(await page.evaluate(() => (window as any).__game.save().unlocks.blueprints)).toContain('scythe');
  expect(await page.evaluate(() => (window as any).__game.poolSnapshot().unlocked)).not.toContain('scythe');
  await frames(page); await page.screenshot({ path: 'test-results/m7-blueprint-found.png' });
  await page.evaluate(() => { const g = (window as any).__game; g.restartRun(); g.step(31, {}); });
  expect(await page.evaluate(() => (window as any).__game.levelId())).toBe('plains');
  expect(await page.evaluate(() => (window as any).__game.poolSnapshot().unlocked)).toContain('scythe');
  expect(await page.evaluate(() => (window as any).__game.poolSnapshot().dropped)).toEqual([]);
  expect(errors).toEqual([]);
});

test('the current loot snapshot survives the real Stage 1 to village load', async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => { const g = (window as any).__game; g.dropBlueprint('scythe'); g.step(1, {}); });
  expect(await page.evaluate(() => (window as any).__game.save().unlocks.blueprints)).toContain('scythe');
  await page.evaluate(() => {
    const g = (window as any).__game, a = g.arenas().find((a: any) => a.kind === 'boss').rect;
    g.teleport(a.x + a.w / 2, a.y + a.h); g.step(1, {}); g.killAll(); g.step(121, {}); g.step(36, {}); g.confirmStatPick();
    for (let i = 0; i < 2400 && g.runState().phase === 'stage'; i++) g.step(1, { moveX: 1 });
    g.step(60, {});
  });
  await page.waitForFunction(() => (window as any).__game?.ready && (window as any).__game.levelId?.() === 'crossroads');
  await page.evaluate(() => { const g = (window as any).__game; g.setManual(true); g.step(61, {}); });
  expect(await page.evaluate(() => (window as any).__game.poolSnapshot().unlocked)).not.toContain('scythe');
  expect(await page.evaluate(() => (window as any).__game.save().unlocks.blueprints)).toContain('scythe');
  expect(errors).toEqual([]);
});

test('typed seeds use the full raw pool and never create blueprint pickups', async ({ page }) => {
  const errors = await boot(page, true);
  const before = await page.evaluate(() => (window as any).__game.groundItems());
  await page.evaluate(() => { const g = (window as any).__game; g.dropBlueprint('scythe'); g.step(1, {}); });
  expect(await page.evaluate(() => (window as any).__game.poolSnapshot().unlocked)).toContain('scythe');
  expect(await page.evaluate(() => (window as any).__game.poolSnapshot().unlocked)).toContain('time_slow');
  expect(await page.evaluate(() => (window as any).__game.save().unlocks.blueprints)).toEqual([]);
  expect(await page.evaluate(() => (window as any).__game.groundItems().length)).toBe(before.length);
  expect(errors).toEqual([]);
});

for (const typedInitially of [true, false]) test(`the Home seed board refreshes the next run pool after ${typedInitially ? 'Clear' : 'Use'}`, async ({ page }) => {
  await page.addInitScript((typed) => localStorage.setItem('rushblade.save', JSON.stringify({
    v: 1, lastKit: { cls: 'tank', weapon: 'war_maul' }, typedSeed: typed ? 'RACE' : null,
  })), typedInitially);
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1&start=home'); await page.waitForFunction(() => (window as any).__game?.ready);
  await page.evaluate((typed) => {
    const g = (window as any).__game; g.setManual(true); g.openHomePanel('seed');
    if (typed) for (let i = 0; i < 10; i++) g.homeAction('right'); // RACE ends at cursor4; Clear is cursor14.
    else g.homeAction({ text: 'N' });
    g.homeAction('confirm');
  }, typedInitially);
  expect(await page.evaluate(() => (window as any).__game.save().typedSeed)).toBe(typedInitially ? null : 'N');
  await page.evaluate(() => { const g = (window as any).__game; g.teleport(730, 320); g.step(61, {}); });
  await page.waitForFunction(() => (window as any).__game?.ready && (window as any).__game.levelId?.() === 'plains');
  await page.evaluate(() => { const g = (window as any).__game; g.setManual(true); g.step(61, {}); });
  expect(await page.evaluate(() => (window as any).__game.runState().seeded)).toBe(!typedInitially);
  const catalog = await page.evaluate(() => (window as any).__game.poolSnapshot().unlocked);
  if (typedInitially) expect(catalog).not.toContain('scythe');
  else expect(catalog).toContain('scythe');
  expect(errors).toEqual([]);
});
