import { test, expect, type Page } from '@playwright/test';

async function openPick(page: Page, pauseBefore = false) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1&start=plains&seed=STATPICK&section=8');
  await page.waitForFunction(() => (window as any).__game?.ready);
  await page.evaluate((pauseBefore) => {
    const g = (window as any).__game; g.setManual(true);
    if (pauseBefore) { g.openPause(); g.pauseAction('back'); }
    const a = g.arenas().find((a: any) => a.kind === 'boss').rect;
    g.teleport(a.x + a.w / 2, a.y + a.h); g.step(1, {});
    g.killAll(); g.step(1, {}); g.step(120, {});
  }, pauseBefore);
  await expect.poll(() => page.evaluate(() => (window as any).__game.runState().phase)).toBe('statPick');
  return errors;
}
const frame = (page: Page) => page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));

test('a pause during play does not swallow the first key of the later stat pick', async ({ page }) => {
  const errors = await openPick(page, true);
  await page.keyboard.press('ArrowRight'); await frame(page);
  expect(await page.evaluate(() => (window as any).__game.statPick().cursor)).toBe(2);
  expect(errors).toEqual([]);
});

test('three stat cards guard confirmation, freeze the world and apply the highlighted choice once', async ({ page }) => {
  const errors = await openPick(page);
  const start = await page.evaluate(() => {
    const g = (window as any).__game;
    return { pick: g.statPick(), body: g.body(), tick: g.tick(), ticks: g.runState().runTicks, early: g.confirmStatPick() };
  });
  expect(start.pick.cursor).toBe(1); expect(new Set(start.pick.offer).size).toBe(3); expect(start.early).toBe(false);
  await page.evaluate(() => (window as any).__game.step(35, {}));
  expect(await page.evaluate(() => (window as any).__game.confirmStatPick())).toBe(false);
  await page.evaluate(() => (window as any).__game.step(1, {})); await frame(page);
  expect(await page.evaluate(() => (window as any).__game.body())).toEqual(start.body);
  expect(await page.evaluate(() => (window as any).__game.tick())).toBe(start.tick);
  expect(await page.evaluate(() => (window as any).__game.runState().runTicks)).toBe(start.ticks + 36);
  await page.screenshot({ path: 'test-results/m7-stat-pick.png' });
  await page.keyboard.press('ArrowLeft'); await frame(page);
  expect(await page.evaluate(() => (window as any).__game.statPick().cursor)).toBe(0);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => (window as any).__game.runState().phase)).toBe('stage');
  expect(await page.evaluate(() => (window as any).__game.confirmStatPick())).toBe(false);
  expect(errors).toEqual([]);
});

test('mouse hover/click selects a card and the guard cannot be skipped', async ({ page }) => {
  const errors = await openPick(page);
  await page.mouse.move((390 + 58) * 2, (110 + 60) * 2); await frame(page);
  expect(await page.evaluate(() => (window as any).__game.statPick().cursor)).toBe(2);
  await page.mouse.click((390 + 58) * 2, (110 + 60) * 2);
  expect(await page.evaluate(() => (window as any).__game.runState().phase)).toBe('statPick');
  await page.evaluate(() => (window as any).__game.step(36, {})); await frame(page);
  for (const button of ['right', 'middle'] as const) {
    await page.mouse.click((390 + 58) * 2, (110 + 60) * 2, { button });
    expect(await page.evaluate(() => (window as any).__game.runState().phase)).toBe('statPick');
  }
  await page.mouse.click((390 + 58) * 2, (110 + 60) * 2);
  await expect.poll(() => page.evaluate(() => (window as any).__game.runState().phase)).toBe('stage');
  expect(errors).toEqual([]);
});

test('gamepad stick and A select a stat, while B cannot skip it', async ({ page }) => {
  const errors = await openPick(page);
  await page.evaluate(() => {
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
    const pad = { connected: true, mapping: 'standard', axes: [-0.6, 0], buttons };
    buttons[1].pressed = true;
    (window as any).statTestPad = pad;
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
  });
  await frame(page); expect(await page.evaluate(() => (window as any).__game.runState().phase)).toBe('statPick');
  expect(await page.evaluate(() => (window as any).__game.statPick().cursor)).toBe(0);
  await page.evaluate(() => {
    (window as any).__game.step(36, {});
    const pad = (window as any).statTestPad; pad.axes[0] = 0; pad.buttons[1].pressed = false; pad.buttons[0].pressed = true;
  });
  await expect.poll(() => page.evaluate(() => (window as any).__game.runState().phase)).toBe('stage');
  expect(errors).toEqual([]);
});

test('pause covers the pick and freezes its guard; restart clears the cards', async ({ page }) => {
  const errors = await openPick(page);
  const ticks = await page.evaluate(() => { const g = (window as any).__game; g.openPause(); g.step(120, {}); return g.runState().runTicks; });
  await frame(page); await page.screenshot({ path: 'test-results/m7-stat-pick-paused.png' });
  expect(await page.evaluate(() => (window as any).__game.runState().phase)).toBe('paused');
  await page.keyboard.press('Escape'); await frame(page);
  expect(await page.evaluate(() => (window as any).__game.runState().runTicks)).toBe(ticks);
  expect(await page.evaluate(() => (window as any).__game.confirmStatPick())).toBe(false);
  await page.evaluate(() => (window as any).__game.step(60, { restart: true })); await frame(page);
  expect(await page.evaluate(() => (window as any).__game.statPick())).toBeNull();
  expect(await page.evaluate(() => (window as any).__game.runState().phase)).toBe('transition');
  expect(errors).toEqual([]);
});

test('holding the confirm key never also jumps after the pick closes', async ({ page }) => {
  const errors = await openPick(page);
  const floor = await page.evaluate(() => {
    const g = (window as any).__game; g.step(36, {}); g.setManual(false); return g.body().y;
  });
  await page.keyboard.down('Space');
  await expect.poll(() => page.evaluate(() => (window as any).__game.runState().phase)).toBe('stage');
  await frame(page); await frame(page);
  expect(await page.evaluate(() => (window as any).__game.body().y)).toBe(floor);
  await page.keyboard.up('Space'); await frame(page); await page.keyboard.down('Space');
  await expect.poll(() => page.evaluate(() => (window as any).__game.body().y)).toBeLessThan(floor);
  await page.keyboard.up('Space'); expect(errors).toEqual([]);
});
