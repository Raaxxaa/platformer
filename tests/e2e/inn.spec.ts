import { test, expect } from '@playwright/test';
import { defaultSave } from '../../src/core/save/schema.ts';

async function arrive(page: import('@playwright/test').Page, id: string) {
  await page.waitForFunction(target => {
    const g = (window as any).__game;
    if (!g?.ready || g.levelId?.() !== target) return false;
    g.setManual(true); return true;
  }, id);
  await page.evaluate(() => {
    const g = (window as any).__game, t = g.runState().transition;
    if (t?.part === 'in') g.step(t.left, {});
  });
}
test('P and gamepad Start pause an open road choice and resume the same popup', async ({ page }) => {
  await page.addInitScript(() => {
    const pad = { connected: true, mapping: 'standard', axes: [0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })) };
    (window as any).__testPad = pad; Object.defineProperty(navigator, 'getGamepads', { value: () => [pad] });
  });
  await page.goto('/?debug=1&start=crossroads&kit=tank:war_maul'); await page.waitForFunction(() => (window as any).__game?.ready);
  await page.evaluate(() => { const g = (window as any).__game; g.setManual(true); g.step(1, {}); g.teleport(680, 320); g.step(1, { interact: true }); g.setManual(false); });
  await page.waitForFunction(() => (window as any).__game.routeChoice?.() !== null);
  await page.keyboard.press('p'); await expect.poll(() => page.evaluate(() => (window as any).__game.runState().phase)).toBe('paused');
  const ticks = await page.evaluate(() => (window as any).__game.runState().runTicks);
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
  expect(await page.evaluate(() => (window as any).__game.runState().runTicks)).toBe(ticks);
  await page.keyboard.press('p'); await expect.poll(() => page.evaluate(() => (window as any).__game.runState().phase)).toBe('routeChoice');
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
  await page.evaluate(() => { (window as any).__testPad.buttons[9].pressed = true; });
  await expect.poll(() => page.evaluate(() => (window as any).__game.runState().phase)).toBe('paused');
  await page.evaluate(() => { (window as any).__testPad.buttons[9].pressed = false; (window as any).__game.pauseAction('back'); });
  expect(await page.evaluate(() => (window as any).__game.runState().phase)).toBe('routeChoice');
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
  const fade = await page.evaluate(() => { const g = (window as any).__game; g.setManual(true); g.routeAction('confirm'); g.openPause(); return g.runState().phase; });
  expect(fade).toBe('transition');
  await page.evaluate(() => { window.dispatchEvent(new Event('blur')); });
  expect(await page.evaluate(() => (window as any).__game.runState().phase)).toBe('paused');
  await page.evaluate(() => { const g = (window as any).__game; g.pauseAction('back'); g.step(60, {}); g.openPause(); });
  expect(await page.evaluate(() => (window as any).__game.runState().phase)).toBe('loading');
});
test('Crossroads inn saves the road, sleeps exactly120ticks, and loads the real Forest road', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1&start=crossroads&kit=tank:war_maul');
  await page.waitForFunction(() => (window as any).__game?.ready);
  await page.evaluate(() => { const g = (window as any).__game; g.setManual(true); g.step(1, {}); g.setHp(21); g.teleport(680, 320); g.step(1, { interact: true }); });
  await page.waitForFunction(() => (window as any).__game.routeChoice?.() !== null);
  await page.evaluate(() => (window as any).__game.routeAction('right'));
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
  await page.screenshot({ path: 'test-results/m7-route-choice.png' });
  const ticks = await page.evaluate(() => { const g = (window as any).__game; const before = g.runState().runTicks; g.routeAction('confirm'); g.step(60, {}); return before; });
  await arrive(page, 'swamps');
  expect(await page.evaluate(() => (window as any).__game.runState().phase)).toBe('stage');
  expect(await page.evaluate(() => (window as any).__game.runState().runTicks)).toBe(ticks + 120);
  expect(await page.evaluate(() => (window as any).__game.save().lastRoad)).toBe('forest');
  expect(await page.evaluate(() => (window as any).__game.save().progress.levelsReached)).toContain('swamps');
  expect(await page.evaluate(() => (window as any).__game.save().stats.runsCompleted)).toBe(0);
  expect(await page.evaluate(() => Object.keys((window as any).__game.save().pbs))).toEqual([]);
  expect(await page.evaluate(() => (window as any).__game.world().hp)).toBe(await page.evaluate(() => (window as any).__game.world().maxHp));
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
  await page.screenshot({ path: 'test-results/m71-inn-forest-arrival.png' });
  expect(errors).toEqual([]);
});
test('The Rebel Camp inn leads to the castle; the victory summary Home restores the saved starting kit and Crossroads keeps the saved road', async ({ page }) => {
  const saved = defaultSave(); saved.lastKit = { cls: 'tank', weapon: 'war_maul' }; saved.lastRoad = 'forest';
  await page.addInitScript(save => localStorage.setItem('rushblade.save', JSON.stringify(save)), saved);
  await page.goto('/?debug=1&start=rebel_camp');
  await page.waitForFunction(() => (window as any).__game?.ready);
  await page.evaluate(() => { const g = (window as any).__game; g.setManual(true); g.step(1, {}); g.setGold(999); g.teleport(680, 320); g.step(1, { interact: true }); });
  await page.evaluate(() => { const g = (window as any).__game; g.step(60, {}); });
  await page.waitForFunction(() => { const g = (window as any).__game; if (!g?.ready || g.levelId?.() !== 'castle') return false; g.setManual(true); return true; });
  await page.evaluate(() => { const g = (window as any).__game, t = g.runState().transition; if (t?.part === 'in') g.step(t.left, {}); });
  expect(await page.evaluate(() => (window as any).__game.runState().stage)).toBe(4);
  await page.evaluate(() => { const g = (window as any).__game, boss = g.arenas().find((a: any) => a.kind === 'boss').rect; g.teleport(boss.x + boss.w / 2, boss.y + boss.h); g.step(1, {}); g.killAll(); g.step(1, {}); });
  await page.waitForFunction(() => (window as any).__game.victory?.() !== null, undefined, { timeout: 10000 });
  const frozen = await page.evaluate(() => (window as any).__game.runState().runTicks);
  await page.keyboard.press('Escape');
  await page.evaluate(() => (window as any).__game.step(100, { restart: true }));
  expect(await page.evaluate(() => ({ phase: (window as any).__game.runState().phase, ticks: (window as any).__game.runState().runTicks }))).toEqual({ phase: 'runComplete', ticks: frozen });
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
  await page.waitForTimeout(1200);                       // the victory screen ignores input for its first 1.0 s (07 §7.11)
  await page.evaluate(() => { const g = (window as any).__game; g.summaryAction('right'); g.summaryAction('confirm'); g.step(60, {}); });
  await page.waitForFunction(() => (window as any).__game?.ready && (window as any).__game.levelId?.() === 'home');
  await page.evaluate(() => { const g = (window as any).__game; g.setManual(true); g.step(120, {}); });
  expect(await page.evaluate(() => ({ phase: (window as any).__game.runState().phase, ticks: (window as any).__game.runState().runTicks, gold: (window as any).__game.loot().gold, kit: (window as any).__game.save().lastKit }))).toEqual({ phase: 'homeVillage', ticks: 0, gold: 0, kit: { cls: 'tank', weapon: 'war_maul' } });
  await page.goto('/?debug=1&start=crossroads&kit=tank:war_maul');
  await page.waitForFunction(() => (window as any).__game?.ready);
  await page.evaluate(() => { const g = (window as any).__game; g.setManual(true); g.step(1, {}); g.teleport(680, 320); g.step(1, { interact: true }); });
  await page.waitForFunction(() => (window as any).__game.routeChoice?.() !== null);
  expect(await page.evaluate(() => (window as any).__game.routeChoice().road)).toBe('forest');
});
