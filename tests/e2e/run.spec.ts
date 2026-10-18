import { test, expect, type Page } from '@playwright/test';

const frames = (page: Page) => page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
async function shot(page: Page, name: string) { await frames(page); await page.screenshot({ path: `test-results/m7-run-${name}.png` }); }
async function level(page: Page, id: string) {
  await page.waitForFunction((target) => {
    const g = (window as any).__game;
    if (!g?.ready || g.levelId?.() !== target) return false;
    g.setManual(true); return true;
  }, id);
}
async function finishFade(page: Page) { await page.evaluate(() => { const g = (window as any).__game, t = g.runState().transition; if (t?.part === 'in') g.step(t.left, {}); }); }

test('a full saved run: Title, Tank, Plains, Crossroads services, Forest Guardian, Border and continuation', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1'); await page.waitForFunction(() => (window as any).__game?.title);
  await page.keyboard.press('Enter'); await expect.poll(() => page.evaluate(() => (window as any).__game.screenState().model.step)).toBe(2);
  await shot(page, 'title'); await page.keyboard.press('Enter'); await level(page, 'home');
  // Let the actual Title→Home fade finish before the first gameplay input.
  await page.waitForFunction(() => (window as any).PHASER_GAME.scene.getScene('Village').titleFadeLeft === 0);
  expect(await page.evaluate(() => (window as any).__game.save().lastKit)).toBeNull(); await shot(page, 'home');
  await page.evaluate(() => { const g = (window as any).__game; g.teleport(216, 320); g.step(1, { interact: true }); });
  await page.waitForFunction(() => (window as any).__game.classPickOpen()); await shot(page, 'tank-statue');
  await page.keyboard.press('Enter'); await page.waitForFunction(() => (window as any).__game.homePanel() === 'training');
  await shot(page, 'first-kit-prompt'); await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => (window as any).__game.homePanel())).toBeNull();
  expect(await page.evaluate(() => (window as any).__game.save().lastKit)).toEqual({ cls: 'tank', weapon: 'war_maul' });
  await page.evaluate(() => { const g = (window as any).__game; g.teleport(730, 320); g.step(61, {}); });
  await level(page, 'plains'); await page.evaluate(() => (window as any).__game.step(61, {}));
  expect(await page.evaluate(() => (window as any).__game.save().stats.runsStarted)).toBe(1); await shot(page, 'plains');
  const split = await page.evaluate(() => {
    const g = (window as any).__game, boss = g.arenas().find((a: any) => a.kind === 'boss').rect;
    g.teleport(boss.x + boss.w / 2, boss.y + boss.h); g.step(1, {}); g.killAll(); g.step(1, {});
    const split = g.runState().splits[0]; g.step(120, {}); return split;
  });
  expect(split).toBeGreaterThan(0); expect(await page.evaluate(() => (window as any).__game.runState().phase)).toBe('statPick');
  await shot(page, 'stat-pick');
  await page.evaluate(() => { const g = (window as any).__game; g.step(36, {}); g.confirmStatPick();
    const exit = g.levelObjects('exit')[0]; g.teleport(exit.x + exit.w / 2, exit.y + exit.h); g.step(61, {}); });
  await level(page, 'crossroads'); await page.evaluate(() => (window as any).__game.step(61, {}));
  expect(await page.evaluate(() => (window as any).__game.runState().phase)).toBe('village');
  expect(await page.evaluate(() => (window as any).__game.runState().stage)).toBe(0);
  await shot(page, 'crossroads-arrival'); // Normal carried kit and earned gold, before the service-test budget.
  // Skipping the stage skips its coin route. Supply a test budget only to exercise every service.
  const before = await page.evaluate(() => { const g = (window as any).__game; g.setGold(2000); return g.loot().gold; });
  await page.evaluate(() => { const g = (window as any).__game; g.teleport(152, 320); g.step(1, { interact: true }); });
  expect(await page.evaluate(() => (window as any).__game.shop().slots[0])).toBe('sold');
  expect(await page.evaluate(() => (window as any).__game.loot().gold)).toBeLessThan(before); await shot(page, 'purchase');
  await page.evaluate(() => { const g = (window as any).__game; g.teleport(312, 320); g.step(1, {}); g.step(1, { interact: true }); g.step(1, {}); });
  expect(await page.evaluate(() => (window as any).__game.loadout().abilities[0].level)).toBe(2); await shot(page, 'upgrade');
  const saleGold = await page.evaluate(() => { const g = (window as any).__game, before = g.loot().gold; g.step(90, { interact: true }); g.step(1, {}); return before; });
  expect(await page.evaluate(() => (window as any).__game.loadout().abilities[0])).toBeNull();
  expect(await page.evaluate(() => (window as any).__game.loot().gold)).toBe(saleGold + 110); await shot(page, 'sale');
  await page.evaluate(() => { const g = (window as any).__game; g.teleport(680, 320); g.step(1, { interact: true }); });
  await page.waitForFunction(() => (window as any).__game.routeChoice?.() !== null);
  await page.keyboard.press('ArrowRight'); await expect.poll(() => page.evaluate(() => (window as any).__game.routeChoice().road)).toBe('forest');
  await shot(page, 'forest-road');
  const beforeSleep = await page.evaluate(() => ({ ticks: (window as any).__game.runState().runTicks, gear: (window as any).__game.loadout() }));
  await page.keyboard.press('Enter'); await expect.poll(() => page.evaluate(() => (window as any).__game.runState().phase)).toBe('transition');
  await page.evaluate(() => (window as any).__game.step(60, {}));
  await level(page, 'swamps'); await finishFade(page);
  expect(await page.evaluate(() => (window as any).__game.runState().phase)).toBe('stage');
  expect(await page.evaluate(() => (window as any).__game.runState().runTicks)).toBe(beforeSleep.ticks + 120);
  expect(await page.evaluate(() => (window as any).__game.loadout())).toEqual(beforeSleep.gear);
  await shot(page, 'forest-arrival');
  const split2 = await page.evaluate(() => {
    const g = (window as any).__game, boss = g.arenas().find((a: any) => a.kind === 'boss').rect;
    g.teleport(boss.x + boss.w / 2, boss.y + boss.h); g.step(1, {}); g.killAll(); g.step(1, {});
    const split = g.runState().splits[1]; g.step(120, {}); return split;
  });
  expect(split2).toBeGreaterThan(split); await shot(page, 'forest-stat-pick');
  await page.evaluate(() => {
    const g = (window as any).__game; g.step(36, {}); g.confirmStatPick();
    const exit = g.levelObjects('exit')[0]; g.teleport(exit.x + exit.w / 2, exit.y + exit.h); g.step(61, {});
  });
  await level(page, 'border'); await finishFade(page); await shot(page, 'border');
  expect(await page.evaluate(() => (window as any).__game.shop().villageIndex)).toBe(2);
  await page.evaluate(() => { const g = (window as any).__game; g.teleport(680, 320); g.step(1, { interact: true }); g.step(60, {}); });
  await page.waitForFunction(() => (window as any).__game.runState().transition?.part === 'in');
  await finishFade(page);
  expect(await page.evaluate(() => (window as any).__game.runState().phase)).toBe('runSoFar'); await shot(page, 'continued');
  await page.reload(); await page.waitForFunction(() => (window as any).__game?.title);
  const saved = await page.evaluate(() => (window as any).__game.save());
  expect(saved.lastKit).toEqual({ cls: 'tank', weapon: 'war_maul' }); expect(saved.lastRoad).toBe('forest');
  expect(saved.bestSegments['tank|mountain'][0]).toBe(split); expect(saved.bestSegments['tank|forest'][0]).toBe(split);
  expect(saved.bestSegments['tank|forest'][1]).toBe(split2 - split);
  expect(saved.pbs).toEqual({}); expect(saved.stats.runsCompleted).toBe(0); expect(saved.progress.levelsReached).toEqual(['plains', 'swamps']);
  await page.evaluate(() => { const g = (window as any).__game; g.titleChoose(2); g.screenAction('down'); g.screenAction('down'); g.screenAction('down'); });
  expect(await page.evaluate(() => (window as any).__game.screenState().model.cell)).toBe(3); await shot(page, 'saved-records');
  expect(errors).toEqual([]);
});
