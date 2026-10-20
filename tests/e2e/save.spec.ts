import { test, expect, type Page } from '@playwright/test';

async function open(page: Page, level = 'home') {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`/?debug=1&start=${level}&kit=tank:war_maul`);
  await page.waitForFunction(() => (window as any).__game?.ready);
  await page.evaluate(() => (window as any).__game.setManual(true));
  return errors;
}

test('damaged main JSON recovers the valid backup in a real browser', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('rushblade.save', '{damaged');
    localStorage.setItem('rushblade.save.bak', JSON.stringify({ v: 1, lastKit: { cls: 'tank', weapon: 'war_maul' }, lastRoad: 'forest', typedSeed: 'RESCUE', training: [2, 8] }));
  });
  const errors = await open(page);
  const save = await page.evaluate(() => (window as any).__game.save());
  expect(save.lastRoad).toBe('forest'); expect(save.typedSeed).toBe('RESCUE'); expect(save.training).toEqual([2, 8]);
  expect(errors).toEqual([]);
});

test('two damaged copies preserve the original text and keep the game playable', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('rushblade.save', '{damaged-main'); localStorage.setItem('rushblade.save.bak', '{damaged-backup');
  });
  const errors = await open(page);
  expect(await page.evaluate(() => localStorage.getItem('rushblade.save.corrupt'))).toBe('{damaged-main');
  expect(await page.evaluate(() => (window as any).__game.save().history)).toEqual([]);
  expect(await page.evaluate(() => (window as any).__game.runState().phase)).toBe('homeVillage');
  expect(errors).toEqual([]);
});

test('a newer save prevents every write to the save family', async ({ page }) => {
  const future = '{"v":2,"future":"keep exactly"}', backup = '{"v":1,"typedSeed":"OLD"}';
  await page.addInitScript(({ future, backup }) => {
    localStorage.setItem('rushblade.save', future); localStorage.setItem('rushblade.save.bak', backup);
    const original = Storage.prototype.setItem; (window as any).__saveWrites = [];
    Storage.prototype.setItem = function(key, value) {
      if (key.startsWith('rushblade.save')) (window as any).__saveWrites.push(key);
      return original.call(this, key, value);
    };
  }, { future, backup });
  const errors = await open(page);
  await page.evaluate(() => { const g = (window as any).__game; g.setKit('archer', 'bow'); g.step(3, {}); });
  expect(await page.evaluate(() => (window as any).__saveWrites)).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('rushblade.save'))).toBe(future);
  expect(await page.evaluate(() => localStorage.getItem('rushblade.save.bak'))).toBe(backup);
  expect(await page.evaluate(() => localStorage.getItem('rushblade.save.corrupt'))).toBeNull();
  expect(errors).toEqual([]);
});

test('a long village restart records the old run once with the last played stage', async ({ page }) => {
  const errors = await open(page, 'crossroads');
  const old = await page.evaluate(() => {
    const g = (window as any).__game; g.giveWeapon(0, 'bow'); g.setGold(321); g.step(3600, {});
    const run = g.runState(); g.restartRun(); g.step(1, {}); return run;
  });
  await expect.poll(() => page.evaluate(() => (window as any).__game.save().history.length)).toBe(1);
  const history = await page.evaluate(() => (window as any).__game.save().history);
  expect(history[0]).toMatchObject({ result: 'restart', stageReached: 1, startClass: 'tank', startWeapon: 'war_maul', seedText: old.seedText, runTicks: old.runTicks, stats: old.stats });
  expect(history[0].kit.weapons[0].weaponId).toBe('bow');
  expect(history[0].date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  await page.waitForFunction(() => (window as any).__game?.levelId?.() === 'plains');
  await page.evaluate(() => { const g = (window as any).__game; g.setManual(true); g.step(30, {}); });
  expect(await page.evaluate(() => (window as any).__game.save().history)).toEqual(history);
  await page.reload(); await page.waitForFunction(() => (window as any).__game?.ready);
  expect(await page.evaluate(() => (window as any).__game.save().history)).toEqual(history);
  expect(errors).toEqual([]);
});

test('a restart below thirty seconds creates no history row', async ({ page }) => {
  const errors = await open(page, 'crossroads');
  await page.evaluate(() => { const g = (window as any).__game; g.step(100, {}); g.restartRun(); g.step(1, {}); });
  await page.waitForFunction(() => (window as any).__game?.levelId?.() === 'plains');
  expect(await page.evaluate(() => (window as any).__game.save().history)).toEqual([]);
  expect(errors).toEqual([]);
});

test('a failed storage write keeps playing in memory and shows the save warning', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem; (window as any).__failedSaveWrites = 0;
    Storage.prototype.setItem = function(key, value) {
      if (key.startsWith('rushblade.save')) { (window as any).__failedSaveWrites++; throw new DOMException('Full', 'QuotaExceededError'); }
      return original.call(this, key, value);
    };
  });
  const errors = await open(page);
  await page.evaluate(() => { const g = (window as any).__game; g.homeAction('back'); g.setKit('archer', 'bow'); g.setKit('tank', 'war_maul'); g.step(3, {}); });
  expect(await page.evaluate(() => (window as any).__game.save().lastKit)).toEqual({ cls: 'tank', weapon: 'war_maul' });
  expect(await page.evaluate(() => (window as any).__failedSaveWrites)).toBe(1);
  expect(await page.evaluate(() => (window as any).__game.runState().phase)).toBe('homeVillage');
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.screenshot({ path: 'test-results/m7-save-warning.png' });
  expect(errors).toEqual([]);
});

test('a valid save with the unlocked third starter boots Home with it equipped and keeps the saved kit', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('rushblade.save', JSON.stringify({
    v: 1, lastKit: { cls: 'tank', weapon: 'giant_axe' }, unlocks: { startWeapons: { tank: ['giant_axe'] } },
  })));
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1&start=home');
  await page.waitForFunction(() => (window as any).__game?.ready, undefined, { timeout: 5000 });
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => (window as any).__game.save().lastKit)).toEqual({ cls: 'tank', weapon: 'giant_axe' });
  expect(await page.evaluate(() => (window as any).__game.save().unlocks.startWeapons.tank)).toEqual(['giant_axe']);
  expect(await page.evaluate(() => (window as any).__game.loadout().weapons[0].weaponId)).toBe('giant_axe');          // built in M9 part 2
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.screenshot({ path: 'test-results/m7-unbuilt-kit.png' });
});
