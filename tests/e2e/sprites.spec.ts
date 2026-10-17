import { test, expect, type Page } from '@playwright/test';

// V1 Task 6: real sprites, overlays, VFX and sound triggers in Stage 1.
async function boot(page: Page, query = '') {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`/?debug=1&start=plains&seed=PLAINS${query}`);
  await page.waitForFunction(() => (window as any).__game?.ready === true);
  await page.evaluate(() => (window as any).__game.setManual(true));
  return errors;
}
async function nextFrames(page: Page) {
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
}

test('a wolf mid-telegraph flashes orange', async ({ page }) => {
  const errors = await boot(page, '&section=2');
  const found = await page.evaluate(() => {
    const g = (window as any).__game;
    g.setHp(9999);
    const wolf = g.world().enemies.find((e: any) => e.def === 'wolf');
    g.teleport(wolf.x - 60, wolf.y);
    for (let i = 0; i < 900; i++) {
      g.step(1, {});
      const w = g.world().enemies.find((e: any) => e.id === wolf.id);
      if (w.attack && w.attack.endsWith(':tele')) { g.step(12, {}); return true; }
    }
    return false;
  });
  expect(found).toBe(true);
  await nextFrames(page);
  await page.screenshot({ path: 'test-results/sprites-wolf-telegraph.png' });
  const sounds = await page.evaluate(() => (window as any).__game.sfxLog());
  expect(sounds).toContain('vo_wolf');
  expect(errors).toEqual([]);
});

test('the Great Boar in its charge wind-up', async ({ page }) => {
  const errors = await boot(page, '&section=8');
  const found = await page.evaluate(() => {
    const g = (window as any).__game;
    for (let i = 0; i < 1200 && !g.runState().arenas.boss1.locked; i++) g.step(1, { moveX: 1 });
    g.setHp(9999);
    g.step(130, {});
    const boss = g.world().enemies.find((e: any) => e.def === 'great_boar');
    g.teleport(boss.x - 200, boss.y);                       // far enough to pick Charge
    for (let i = 0; i < 2400; i++) {
      g.step(1, {});
      const b = g.world().enemies.find((e: any) => e.def === 'great_boar');
      if (b.attack === 'charge:tele') { g.step(12, {}); return true; }
    }
    return false;
  });
  expect(found).toBe(true);
  await nextFrames(page);
  await page.screenshot({ path: 'test-results/sprites-boar-charge-tele.png' });
  await nextFrames(page);
  expect(await page.evaluate(() => (window as any).__game.sfxLog())).toContain('boss_roar_great_boar');
  expect(errors).toEqual([]);
});

test('swings, effects and sounds: Greatsword and War Maul on a bandit, hitbox outlines on sprites', async ({ page }) => {
  const errors = await boot(page, '&section=2');
  await page.evaluate(() => {
    const g = (window as any).__game;
    g.setHp(9999);
    const b = g.world().enemies.find((e: any) => e.def === 'bandit');
    g.teleport(b.x - 30, b.y);
    g.step(1, { attack1: true });
    g.step(16, {});
  });
  await nextFrames(page);
  await page.screenshot({ path: 'test-results/sprites-greatsword.png' });
  await page.evaluate(() => {
    const g = (window as any).__game;
    g.step(80, {});
    g.setHp(9999);
    const b = g.world().enemies.find((e: any) => e.def === 'bandit' && !e.dead);
    if (b) g.teleport(b.x - 30, b.y);
    g.step(1, { attack2: true });
    g.step(10, {});
  });
  await nextFrames(page);
  const counts = await page.evaluate(() => (window as any).__game.vfx());
  await page.screenshot({ path: 'test-results/sprites-war-maul.png' });
  const log: string[] = await page.evaluate(() => (window as any).__game.sfxLog());
  expect(log).toContain('swing_heavy');
  expect(log.some((s) => s.startsWith('hit_'))).toBe(true);
  expect((counts.spawned.hit_spark ?? 0) + (counts.spawned.hit_heavy ?? 0)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('movement anims: jump dust, double-jump ring, dash afterimage', async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => {
    const g = (window as any).__game;
    g.step(2, {});
    g.step(1, { jump: true });
    g.step(14, { jump: true });
    g.step(1, { jump: false });
    g.step(1, { jump: true });
    g.step(4, { jump: true });
    g.step(1, { dash: true, moveX: 1 });
    g.step(5, { moveX: 1 });
  });
  await nextFrames(page);
  const r = await page.evaluate(() => ({ vfx: (window as any).__game.vfx(), log: (window as any).__game.sfxLog() }));
  await page.screenshot({ path: 'test-results/sprites-movement.png' });
  expect(r.log).toEqual(expect.arrayContaining(['jump', 'double_jump', 'dash']));
  expect(r.vfx.spawned.dust_jump ?? 0).toBeGreaterThan(0);
  expect(r.vfx.spawned.ring_djump ?? 0).toBeGreaterThan(0);
  expect(r.vfx.spawned.ghost ?? 0).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('?boxes=1 still draws grey boxes', async ({ page }) => {
  const errors = await boot(page, '&boxes=1&section=2');
  await page.evaluate(() => (window as any).__game.step(2, {}));
  await nextFrames(page);
  await page.screenshot({ path: 'test-results/sprites-boxes.png' });
  expect(errors).toEqual([]);
});
