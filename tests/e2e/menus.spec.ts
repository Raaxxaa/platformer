import { test, expect, type Page } from '@playwright/test';
import { encodeSave } from '../../src/core/save/codec.ts';
import { defaultSave } from '../../src/data/save.ts';

const frames = (page: Page) => page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
async function title(page: Page) {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1'); await page.waitForFunction(() => (window as any).__game?.ready);
  return errors;
}
async function waitScreen(page: Page, screen: string) {
  await expect.poll(() => page.evaluate(() => (window as any).__game.screenState().screen)).toBe(screen);
}
async function settingsRow(page: Page, row: string) {
  const model = await page.evaluate(() => (window as any).__game.screenState().model);
  const target = model.rows.indexOf(row); expect(target).toBeGreaterThanOrEqual(0);
  await page.evaluate(({ target, from }) => {
    const g = (window as any).__game;
    for (let i = 0; i < Math.abs(target - from); i++) g.screenAction(target > from ? 'down' : 'up');
  }, { target, from: model.cursor });
}
async function change(page: Page, row: string, action: 'left' | 'right' | 'confirm') {
  await settingsRow(page, row); await page.evaluate((a) => (window as any).__game.screenAction(a), action);
}

test('one boot gesture opens the title menu without also starting Play', async ({ page }) => {
  const errors = await title(page);
  expect(await page.evaluate(() => typeof (window as any).__game.screenState)).toBe('function');
  expect(await page.evaluate(() => (window as any).__game.screenState())).toMatchObject({ screen: 'title', model: { step: 1 } });
  await frames(page); await page.screenshot({ path: 'test-results/m7-title-prompt.png' });
  await page.keyboard.press('Enter'); await frames(page);
  expect(await page.evaluate(() => (window as any).__game.screenState())).toMatchObject({ screen: 'title', model: { step: 2, cursor: 0 } });
  await page.screenshot({ path: 'test-results/m7-title-menu.png' });
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game?.levelId?.() === 'training_yard');
  expect(errors).toEqual([]);
});

test('a held gamepad confirm opens Title but needs release before choosing Play', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('rushblade.save', '{"v":2,"future":"preserve"}');
    const pad = { connected: true, mapping: 'standard', axes: [0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })) };
    pad.buttons[0].pressed = true; (window as any).__titlePad = pad;
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad] });
  });
  const errors = await title(page);
  await expect.poll(() => page.evaluate(() => (window as any).__game.screenState())).toMatchObject({ screen: 'title', model: { step: 2, cursor: 0 } });
  await frames(page); await frames(page);
  expect(await page.evaluate(() => (window as any).__game.screenState().screen)).toBe('title');
  await page.screenshot({ path: 'test-results/m7-title-save-warning.png' });
  expect(await page.evaluate(() => localStorage.getItem('rushblade.save'))).toBe('{"v":2,"future":"preserve"}');
  await page.evaluate(() => { (window as any).__titlePad.buttons[0].pressed = false; }); await frames(page);
  await page.evaluate(() => { (window as any).__titlePad.buttons[0].pressed = true; });
  await page.waitForFunction(() => (window as any).__game?.ready && (window as any).__game.levelId?.() === 'home');
  expect(errors).toEqual([]);
});

test('title Settings opens a working screen with only current features', async ({ page }) => {
  const errors = await title(page);
  await page.evaluate(() => (window as any).__game.titleChoose(3)); await waitScreen(page, 'settings');
  const rows: string[] = await page.evaluate(() => (window as any).__game.screenState().model.rows);
  expect(rows).toContain('export'); expect(rows).toContain('import');
  expect(rows).not.toContain('music'); expect(rows).not.toContain('damageNumbers'); expect(rows).not.toContain('damage');
  await frames(page); await page.screenshot({ path: 'test-results/m7-settings.png' });
  await change(page, 'controls', 'confirm');
  expect(await page.evaluate(() => (window as any).__game.screenState().model.controlsOpen)).toBe(true);
  await frames(page); await page.screenshot({ path: 'test-results/m7-settings-controls.png' });
  await page.keyboard.press('Escape'); await waitScreen(page, 'settings');
  await page.keyboard.press('Escape'); await waitScreen(page, 'title');
  expect(errors).toEqual([]);
});

test('all three Records tabs show saved results and return to their source', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('rushblade.save', JSON.stringify({
    v: 1, pbs: { 'tank|forest': { ticks: 12000, splits: [1200, 4000, 8000, 12000], date: '2026-10-17T00:00:00.000Z', seedText: 'RECORD', kit: { weapons: [null, null], abilities: [null, null], displayName: 'Tank' } } },
    bestSegments: { 'tank|forest': [1200, 2800, 4000, 4000] }, progress: { classesDiscovered: ['iron_will'] },
    unlocks: { blueprints: ['scythe'], startWeapons: { tank: ['giant_axe'] } },
  })));
  const errors = await title(page);
  await page.evaluate(() => (window as any).__game.titleChoose(2)); await waitScreen(page, 'records');
  await page.evaluate(() => { const g = (window as any).__game; g.screenAction('down'); g.screenAction('down'); g.screenAction('down'); });
  expect(await page.evaluate(() => (window as any).__game.screenState().model.tab)).toBe(0);
  await frames(page); await page.screenshot({ path: 'test-results/m7-records-best.png' });
  await page.keyboard.press('ArrowRight'); await frames(page);
  expect(await page.evaluate(() => (window as any).__game.screenState().model.tab)).toBe(1);
  await page.screenshot({ path: 'test-results/m7-records-classes.png' });
  await page.keyboard.press('ArrowRight'); await frames(page);
  expect(await page.evaluate(() => (window as any).__game.screenState().model.tab)).toBe(2);
  await page.screenshot({ path: 'test-results/m7-records-unlocks.png' });
  await page.keyboard.press('Escape'); await waitScreen(page, 'title');
  expect(errors).toEqual([]);
});

test('settings save and apply now, survive reload, and affect the actual game HUD', async ({ page }) => {
  const errors = await title(page);
  await page.evaluate(() => (window as any).__game.titleChoose(3)); await waitScreen(page, 'settings');
  await change(page, 'master', 'left'); await change(page, 'timer', 'right'); await change(page, 'shake', 'right');
  await change(page, 'icons', 'right'); await change(page, 'icons', 'right');
  const expected = { volume: { master: 70, music: 70, sfx: 80 }, showTimer: false, screenShake: false, promptStyle: 'xbox' };
  expect(await page.evaluate(() => (window as any).__game.save().settings)).toMatchObject(expected);
  expect(await page.evaluate(() => (window as any).__game.appliedSettings())).toMatchObject(expected);
  await page.reload(); await page.waitForFunction(() => (window as any).__game?.ready);
  expect(await page.evaluate(() => (window as any).__game.save().settings)).toMatchObject(expected);
  expect(await page.evaluate(() => (window as any).__game.appliedSettings())).toMatchObject(expected);
  await page.goto('/?debug=1&start=plains&kit=tank:war_maul'); await page.waitForFunction(() => (window as any).__game?.ready);
  await page.evaluate(() => (window as any).__game.setManual(true)); await frames(page);
  expect(await page.evaluate(() => (window as any).__game.timerBlock().timeVisible)).toBe(false);
  expect(await page.evaluate(() => (window as any).__game.timerBlock().segmentVisible)).toBe(false);
  await page.screenshot({ path: 'test-results/m7-settings-gameplay.png' });
  expect(errors).toEqual([]);
});

test('export selects a copyable code, follows canvas resize, and removes its textarea on Back', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
    writeText: async (value: string) => { (window as any).__copiedSave = value; },
  } }));
  const errors = await title(page);
  await page.evaluate(() => (window as any).__game.titleChoose(3)); await waitScreen(page, 'settings');
  await change(page, 'export', 'confirm'); await waitScreen(page, 'export');
  const area = page.locator('textarea'); await expect(area).toBeVisible(); await expect(area).toHaveAttribute('readonly', '');
  const code = await area.inputValue(); expect(code).toMatch(/^RB1:[A-Za-z0-9_-]+:[0-9A-F]{8}$/);
  expect(await area.evaluate((el: HTMLTextAreaElement) => [el.selectionStart, el.selectionEnd])).toEqual([0, code.length]);
  await page.evaluate(() => (window as any).__game.screenAction('confirm'));
  await expect.poll(() => page.evaluate(() => (window as any).__copiedSave)).toBe(code);
  await frames(page); await page.screenshot({ path: 'test-results/m7-export.png' });
  await page.setViewportSize({ width: 1000, height: 600 }); await frames(page);
  const bounds = await area.boundingBox(), canvas = await page.locator('canvas').boundingBox();
  expect(bounds!.x).toBeGreaterThan(canvas!.x); expect(bounds!.y).toBeGreaterThan(canvas!.y);
  expect(bounds!.x + bounds!.width).toBeLessThan(canvas!.x + canvas!.width);
  expect(bounds!.y + bounds!.height).toBeLessThan(canvas!.y + canvas!.height);
  await page.screenshot({ path: 'test-results/m7-export-resized.png' });
  await area.press('Escape'); await expect(area).toHaveCount(0); await waitScreen(page, 'settings');
  expect(errors).toEqual([]);
});

test('invalid and canceled imports keep the old save; confirmed import replaces it and applies settings', async ({ page }) => {
  const errors = await title(page);
  await page.evaluate(() => (window as any).__game.titleChoose(3)); await waitScreen(page, 'settings');
  await change(page, 'master', 'left'); await change(page, 'export', 'confirm'); await waitScreen(page, 'export');
  const code = await page.locator('textarea').inputValue();
  await page.locator('textarea').press('Escape'); await waitScreen(page, 'settings');
  await change(page, 'master', 'left');
  const old = await page.evaluate(() => localStorage.getItem('rushblade.save'));
  await change(page, 'import', 'confirm'); await waitScreen(page, 'import');
  const area = page.locator('textarea'); await expect(area).toBeFocused();
  await area.pressSequentially('R ACE'); expect(await area.inputValue()).toBe('R ACE');
  await page.evaluate(() => (window as any).__game.screenAction('confirm'));
  expect(await page.evaluate(() => (window as any).__game.screenState().model.error)).toBe("That code isn't valid");
  expect(await page.evaluate(() => localStorage.getItem('rushblade.save'))).toBe(old);
  await frames(page); await page.screenshot({ path: 'test-results/m7-import-invalid.png' });
  await area.fill(code); await page.evaluate(() => (window as any).__game.screenAction('confirm'));
  expect(await page.evaluate(() => (window as any).__game.screenState().model.confirming)).toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => (window as any).__game.screenState().model.confirming)).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem('rushblade.save'))).toBe(old);
  await page.evaluate(() => (window as any).__game.screenAction('confirm'));
  await frames(page); await page.screenshot({ path: 'test-results/m7-import-confirm.png' });
  await page.evaluate(() => (window as any).__game.screenAction('confirm'));
  await expect(area).toHaveCount(0); await waitScreen(page, 'settings');
  expect(await page.evaluate(() => (window as any).__game.save().settings.volume.master)).toBe(70);
  expect(await page.evaluate(() => (window as any).__game.appliedSettings().volume.master)).toBe(70);
  expect(await page.evaluate(() => localStorage.getItem('rushblade.save.bak'))).toBe(old);
  expect(errors).toEqual([]);
});

test('typing in a paused-run import cannot operate menus or the game, and Back keeps the run paused', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1&start=plains&kit=tank:war_maul'); await page.waitForFunction(() => (window as any).__game?.ready);
  const before = await page.evaluate(() => {
    const g = (window as any).__game; g.setManual(true); g.step(120, {}); g.openPause();
    g.pauseAction('down'); g.pauseAction('down'); g.pauseAction('confirm');
    return { ticks: g.runState().runTicks, y: g.body().y };
  });
  await waitScreen(page, 'settings'); await change(page, 'import', 'confirm'); await waitScreen(page, 'import');
  const area = page.locator('textarea'); await expect(area).toBeFocused();
  await page.evaluate(() => (window as any).__game.setManual(false));
  const cursor = await page.evaluate(() => (window as any).__game.screenState().model.cursor);
  await area.pressSequentially('R ACE'); await area.press('ArrowDown'); await frames(page);
  expect(await area.inputValue()).toBe('R ACE');
  expect(await page.evaluate(() => (window as any).__game.screenState().model.cursor)).toBe(cursor);
  expect(await page.evaluate(() => (window as any).__game.runState().phase)).toBe('paused');
  expect(await page.evaluate(() => (window as any).__game.runState().runTicks)).toBe(before.ticks);
  await page.screenshot({ path: 'test-results/m7-import-paused.png' });
  await area.press('Escape'); await expect(area).toHaveCount(0); await waitScreen(page, 'settings');
  expect(await page.evaluate(() => (window as any).__game.runState().phase)).toBe('paused');
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => (window as any).__game.screenState().screen)).toBeNull();
  expect(await page.evaluate(() => (window as any).__game.runState().phase)).toBe('paused');
  await page.evaluate(() => (window as any).__game.pauseAction('back')); await frames(page); await frames(page);
  expect(await page.evaluate(() => (window as any).__game.runState().phase)).toBe('stage');
  expect(await page.evaluate(() => (window as any).__game.body().y)).toBe(before.y);
  expect(errors).toEqual([]);
});

test('confirmed imported bindings and timer settings apply to the already loaded run', async ({ page }) => {
  const imported = defaultSave(); imported.lastKit = { cls: 'tank', weapon: 'war_maul' };
  imported.settings.bindings.keyboard.jump = ['KeyZ', null]; imported.settings.showTimer = false;
  imported.settings.bindings.keyboard.pause = ['Escape', 'KeyT'];
  const code = encodeSave(imported), errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1&start=plains&kit=tank:war_maul'); await page.waitForFunction(() => (window as any).__game?.ready);
  await page.evaluate(() => {
    const g = (window as any).__game; g.setManual(true); g.step(120, {}); g.openPause();
    g.pauseAction('down'); g.pauseAction('down'); g.pauseAction('confirm');
  });
  await waitScreen(page, 'settings'); await change(page, 'import', 'confirm'); await waitScreen(page, 'import');
  await page.locator('textarea').fill(code); await page.evaluate(() => (window as any).__game.screenAction('confirm'));
  expect(await page.evaluate(() => (window as any).__game.screenState().model.confirming)).toBe(true);
  await page.evaluate(() => (window as any).__game.screenAction('confirm')); await waitScreen(page, 'settings');
  await settingsRow(page, 'back'); await page.keyboard.press('z');
  await expect.poll(() => page.evaluate(() => (window as any).__game.screenState().screen)).toBeNull();
  const floor = await page.evaluate(() => {
    const g = (window as any).__game; g.pauseAction('up'); g.pauseAction('up'); g.setManual(false); return g.body().y;
  });
  await page.keyboard.press('z');
  await expect.poll(() => page.evaluate(() => (window as any).__game.runState().phase)).toBe('stage');
  await frames(page);
  expect(await page.evaluate(() => (window as any).__game.body().y)).toBe(floor);
  expect(await page.evaluate(() => (window as any).__game.timerBlock().timeVisible)).toBe(false);
  await page.keyboard.press('z');
  await expect.poll(() => page.evaluate(() => (window as any).__game.body().y)).toBeLessThan(floor);
  await expect.poll(() => page.evaluate(() => (window as any).__game.body().y)).toBe(floor);
  await page.keyboard.press('Space'); await frames(page); await frames(page);
  expect(await page.evaluate(() => (window as any).__game.body().y)).toBe(floor);
  await page.keyboard.press('p'); await frames(page);
  expect(await page.evaluate(() => (window as any).__game.runState().phase)).toBe('stage');
  await page.keyboard.press('t');
  await expect.poll(() => page.evaluate(() => (window as any).__game.runState().phase)).toBe('paused');
  await page.keyboard.press('t');
  await expect.poll(() => page.evaluate(() => (window as any).__game.runState().phase)).toBe('stage');
  expect(errors).toEqual([]);
});

test('fresh gamepad Start resumes the same road popup after pausing it', async ({ page }) => {
  await page.addInitScript(() => {
    const pad = { connected: true, mapping: 'standard', axes: [0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })) };
    (window as any).__menuPad = pad; Object.defineProperty(navigator, 'getGamepads', { value: () => [pad] });
  });
  await page.goto('/?debug=1&start=crossroads&kit=tank:war_maul'); await page.waitForFunction(() => (window as any).__game?.ready);
  await page.evaluate(() => { const g = (window as any).__game; g.setManual(true); g.step(1, {}); g.teleport(680, 320); g.step(1, { interact: true }); g.setManual(false); });
  await expect.poll(() => page.evaluate(() => (window as any).__game.runState().phase)).toBe('routeChoice');
  await frames(page);
  await page.evaluate(() => { (window as any).__menuPad.buttons[9].pressed = true; });
  await expect.poll(() => page.evaluate(() => (window as any).__game.runState().phase)).toBe('paused');
  await page.evaluate(() => { (window as any).__menuPad.buttons[9].pressed = false; }); await frames(page); await frames(page);
  await page.evaluate(() => { (window as any).__menuPad.buttons[9].pressed = true; });
  await expect.poll(() => page.evaluate(() => (window as any).__game.runState().phase)).toBe('routeChoice');
});

test('focused export and import allow controller Copy and Back', async ({ page }) => {
  await page.addInitScript(() => {
    const pad = { connected: true, mapping: 'standard', axes: [0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })) };
    (window as any).__menuPad = pad; Object.defineProperty(navigator, 'getGamepads', { value: () => [pad] });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value: string) => { (window as any).__copiedSave = value; } } });
  });
  await title(page); await page.evaluate(() => (window as any).__game.titleChoose(3)); await waitScreen(page, 'settings');
  await change(page, 'export', 'confirm'); await waitScreen(page, 'export'); await expect(page.locator('textarea')).toBeFocused();
  await frames(page); await page.evaluate(() => { (window as any).__menuPad.buttons[0].pressed = true; });
  await expect.poll(() => page.evaluate(() => (window as any).__copiedSave)).toMatch(/^RB1:/);
  await page.evaluate(() => { (window as any).__menuPad.buttons[0].pressed = false; }); await frames(page);
  await page.evaluate(() => { (window as any).__menuPad.buttons[1].pressed = true; }); await waitScreen(page, 'settings');
  await page.evaluate(() => { (window as any).__menuPad.buttons[1].pressed = false; }); await frames(page);
  await change(page, 'import', 'confirm'); await waitScreen(page, 'import'); await expect(page.locator('textarea')).toBeFocused();
  await frames(page); await page.evaluate(() => { (window as any).__menuPad.buttons[1].pressed = true; }); await waitScreen(page, 'settings');
  await expect(page.locator('textarea')).toHaveCount(0);
});

test('fixed menu navigation wins over an imported Pause key in Pause and stat choice', async ({ page }) => {
  const saved = defaultSave(); saved.lastKit = { cls: 'tank', weapon: 'war_maul' };
  saved.settings.bindings.keyboard.left = ['KeyH', 'ArrowLeft']; saved.settings.bindings.keyboard.pause = ['Escape', 'KeyA'];
  await page.addInitScript((value) => localStorage.setItem('rushblade.save', value), JSON.stringify(saved));
  await page.goto('/?debug=1&start=plains&kit=tank:war_maul'); await page.waitForFunction(() => (window as any).__game?.ready);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => (window as any).__game.runState().phase)).toBe('paused');
  await page.evaluate(() => (window as any).__game.pauseAction('right'));
  expect(await page.evaluate(() => (window as any).__game.pauseState().tab)).toBe('LOADOUT');
  await page.keyboard.press('a'); await frames(page);
  expect(await page.evaluate(() => (window as any).__game.runState().phase)).toBe('paused');
  expect(await page.evaluate(() => (window as any).__game.pauseState().tab)).toBe('MENU');
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => (window as any).__game.runState().phase)).toBe('stage');
  await page.evaluate(() => {
    const g = (window as any).__game; g.setManual(true); const a = g.arenas().find((x: any) => x.kind === 'boss').rect;
    g.teleport(a.x + a.w / 2, a.y + a.h); g.step(1, {}); g.killAll(); g.step(121, {}); g.setManual(false);
  });
  await expect.poll(() => page.evaluate(() => (window as any).__game.runState().phase)).toBe('statPick');
  await page.keyboard.press('a'); await frames(page);
  expect(await page.evaluate(() => (window as any).__game.runState().phase)).toBe('statPick');
  expect(await page.evaluate(() => (window as any).__game.statPick().cursor)).toBe(0);
});

test('a real death opens a guarded summary and Change class loads Home without duplicate history', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1&start=plains&kit=tank:war_maul'); await page.waitForFunction(() => (window as any).__game?.ready);
  const death = await page.evaluate(() => {
    const g = (window as any).__game; g.setManual(true); g.setHp(1);
    const b = g.body(); g.spawn('bandit', b.x + 20, b.y, -1);
    for (let i = 0; i < 1200 && g.runState().phase !== 'dead'; i++) g.step(1, {});
    return g.runState();
  });
  expect(death.phase).toBe('dead');
  await page.evaluate(() => (window as any).__game.step(119, {})); await frames(page);
  expect(await page.evaluate(() => (window as any).__game.screenState().screen)).toBeNull();
  await page.evaluate(() => (window as any).__game.step(1, {})); await frames(page); await waitScreen(page, 'death');
  expect(await page.evaluate(() => (window as any).__game.screenState().model.canConfirm)).toBe(false);
  await page.evaluate(() => (window as any).__game.screenAction('confirm'));
  expect(await page.evaluate(() => (window as any).__game.runState().phase)).toBe('dead');
  await page.evaluate(() => (window as any).__game.openPause());
  expect(await page.evaluate(() => (window as any).__game.runState().phase)).toBe('dead');
  await expect.poll(() => page.evaluate(() => (window as any).__game.screenState().model.canConfirm)).toBe(true);
  expect(await page.evaluate(() => (window as any).__game.runState().runTicks)).toBe(death.runTicks);
  await frames(page); await page.screenshot({ path: 'test-results/m7-death.png' });
  await page.evaluate(() => { const g = (window as any).__game; g.screenAction('down'); g.screenAction('confirm'); g.step(60, {}); });
  await page.waitForFunction(() => (window as any).__game?.ready && (window as any).__game.levelId?.() === 'home');
  await page.evaluate(() => { const g = (window as any).__game; g.setManual(true); g.step(61, {}); });
  expect(await page.evaluate(() => (window as any).__game.runState().phase)).toBe('homeVillage');
  const saved = await page.evaluate(() => (window as any).__game.save());
  expect(saved.stats.deaths).toBe(1); expect(saved.history).toHaveLength(1); expect(saved.history[0].result).toBe('death');
  expect(errors).toEqual([]);
});
