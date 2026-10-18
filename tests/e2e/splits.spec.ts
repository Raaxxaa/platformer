import { test, expect, type Page } from '@playwright/test';

const pbs = {
  'tank|mountain': { ticks: 2000, splits: [10, 800, 1400, 2000], date: '2026-10-17T00:00:00.000Z', seedText: 'MOUNTAIN', kit: { weapons: [null, null], abilities: [null, null], displayName: 'Tank' } },
  'tank|forest': { ticks: 1500, splits: [500, 800, 1100, 1500], date: '2026-10-17T00:00:00.000Z', seedText: 'FOREST', kit: { weapons: [null, null], abilities: [null, null], displayName: 'Tank' } },
};
const frames = (page: Page) => page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));

async function boot(page: Page, seeded = false, showTimer = true, level = 'plains') {
  await page.addInitScript(({ pbs, showTimer }) => {
    // Keep this seed setup once-only so a reload tests the actual saved result.
    if (!localStorage.getItem('rushblade.save')) localStorage.setItem('rushblade.save', JSON.stringify({
      v: 1, lastKit: { cls: 'tank', weapon: 'war_maul' }, pbs, bestSegments: {}, settings: { showTimer },
    }));
  }, { pbs, showTimer });
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`/?debug=1&start=${level}&kit=tank:war_maul${seeded ? '&seed=TIMECHECK' : ''}`);
  await page.waitForFunction(() => (window as any).__game?.ready);
  await page.evaluate(() => (window as any).__game.setManual(true));
  return errors;
}

async function defeatBoar(page: Page) {
  return page.evaluate(() => {
    const g = (window as any).__game;
    // The live class changes, but records still belong to the original Tank kit.
    g.giveWeapon(0, 'bow'); g.giveAbility(0, 'arrow_rain'); g.giveAbility(1, null);
    const a = g.arenas().find((a: any) => a.kind === 'boss').rect;
    g.teleport(a.x + a.w / 2, a.y + a.h); g.step(1, {});
    g.killAll(); g.step(1, {});
    const split = g.runState().splits[0]; g.step(120, {});
    return { split, phase: g.runState().phase, startClass: g.runState().startKit.cls };
  });
}

test('a real Guardian split saves both road segments under the original class and shows a comparison', async ({ page }) => {
  const errors = await boot(page);
  expect(await page.evaluate(() => typeof (window as any).__game.timerBlock)).toBe('function');
  const result = await defeatBoar(page);
  expect(result.phase).toBe('statPick'); expect(result.startClass).toBe('tank'); expect(result.split).toBeGreaterThan(0);
  const saved = await page.evaluate(() => (window as any).__game.save());
  expect(saved.bestSegments['tank|mountain']).toEqual([result.split, null, null, null]);
  expect(saved.bestSegments['tank|forest']).toEqual([result.split, null, null, null]);
  expect(Object.keys(saved.bestSegments).sort()).toEqual(['tank|forest', 'tank|mountain']);
  expect(saved.pbs).toEqual(pbs);
  await frames(page);
  const block = await page.evaluate(() => (window as any).__game.timerBlock());
  // Forest wins by final run time. Mountain's faster first split must not be used.
  expect(block.alert.event.deltaTicks).toBe(result.split - 500);
  expect(block.alert.deltaColor).toBe(0x5ce06a); expect(block.alert.delta).toMatch(/^−/);
  expect(block.alert.badge).toBe('★ BEST SEGMENT');
  await page.screenshot({ path: 'test-results/m7-split-faster.png' });
  await page.reload(); await page.waitForFunction(() => (window as any).__game?.ready);
  expect(await page.evaluate(() => (window as any).__game.save().bestSegments)).toEqual(saved.bestSegments);
  expect(errors).toEqual([]);
});

test('a typed seed compares with records but never writes a best segment or PB', async ({ page }) => {
  const errors = await boot(page, true, false);
  const before = await page.evaluate(() => ({ pbs: (window as any).__game.save().pbs, bestSegments: (window as any).__game.save().bestSegments }));
  const result = await defeatBoar(page); expect(result.phase).toBe('statPick');
  expect(await page.evaluate(() => ({ pbs: (window as any).__game.save().pbs, bestSegments: (window as any).__game.save().bestSegments }))).toEqual(before);
  await frames(page);
  const block = await page.evaluate(() => (window as any).__game.timerBlock());
  expect(block.timeVisible).toBe(false); expect(block.segmentVisible).toBe(false); expect(block.infoVisible).toBe(true);
  expect(block.alert.event.deltaTicks).toBe(result.split - 500);
  expect(block.alert.deltaColor).toBe(0x5ce06a);
  await page.screenshot({ path: 'test-results/m7-timer-hidden.png' });
  expect(errors).toEqual([]);
});

test('the village timer names Crossroads and keeps the seeded-run info', async ({ page }) => {
  const errors = await boot(page, true, true, 'crossroads');
  expect(await page.evaluate(() => typeof (window as any).__game.timerBlock)).toBe('function');
  await frames(page);
  const block = await page.evaluate(() => (window as any).__game.timerBlock());
  expect(block.segment).toBe('CROSSROADS'); expect(block.info).toBe('SEED TIMECHECK');
  expect(block.timeVisible).toBe(true); expect(block.segmentVisible).toBe(true); expect(block.infoVisible).toBe(true);
  await page.screenshot({ path: 'test-results/m7-village-timer.png' });
  expect(errors).toEqual([]);
});

test('the split alert freezes in pause and expires while the stat-pick world stays frozen', async ({ page }) => {
  const errors = await boot(page); await defeatBoar(page); await frames(page);
  const paused = await page.evaluate(() => {
    const g = (window as any).__game; g.openPause();
    return { elapsed: g.timerBlock().alert.elapsed, tick: g.tick(), runTicks: g.runState().runTicks };
  });
  await frames(page); await frames(page);
  expect(await page.evaluate(() => (window as any).__game.timerBlock().alert.elapsed)).toBe(paused.elapsed);
  expect(await page.evaluate(() => (window as any).__game.runState().runTicks)).toBe(paused.runTicks);
  await page.evaluate(() => (window as any).__game.pauseAction('back'));
  await expect.poll(() => page.evaluate(() => (window as any).__game.timerBlock().alert), { timeout: 6000 }).toBeNull();
  expect(await page.evaluate(() => (window as any).__game.runState().phase)).toBe('statPick');
  expect(await page.evaluate(() => (window as any).__game.tick())).toBe(paused.tick);
  expect(errors).toEqual([]);
});
