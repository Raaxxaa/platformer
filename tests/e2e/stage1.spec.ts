import { test, expect, type Page } from '@playwright/test';

async function boot(page: Page, query = '') {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`/?debug=1&start=plains&seed=PLAINS${query}`);
  await page.waitForFunction(() => (window as any).__game?.ready === true);
  await page.evaluate(() => (window as any).__game.setManual(true));
  return errors;
}

/** Waits two animation frames so the scene has drawn the latest state. */
async function nextFrames(page: Page) {
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
}

test('boots into Plains with no errors', async ({ page }) => {
  const errors = await boot(page);
  expect(await page.evaluate(() => (window as any).__game.levelId())).toBe('plains');
  const run = await page.evaluate(() => (window as any).__game.runState());
  expect(run.phase).toBe('stage');
  await page.evaluate(() => (window as any).__game.step(2, {}));
  await nextFrames(page);
  await page.screenshot({ path: 'test-results/plains-s1.png' });
  expect(errors).toEqual([]);
});

test('losing focus pauses the exact run phase and freezes its clocks', async ({ page }) => {
  const errors = await boot(page);
  const paused = await page.evaluate(() => {
    const g = (window as any).__game;
    g.step(5, {});
    window.dispatchEvent(new Event('blur'));
    const before = g.runState().runTicks;
    g.step(120, { moveX: 1 });
    return { phase: g.runState().phase, before, after: g.runState().runTicks };
  });
  expect(paused.phase).toBe('paused');
  expect(paused.after).toBe(paused.before);
  await page.evaluate(() => (window as any).__game.pauseAction('back'));
  expect(await page.evaluate(() => (window as any).__game.runState().phase)).toBe('stage');
  expect(errors).toEqual([]);
});

test('every section loads', async ({ page }) => {
  test.slow();   // 16 software-rendered screenshots
  for (let n = 1; n <= 8; n++) {
    const errors = await boot(page, `&section=${n}`);
    await page.evaluate(() => (window as any).__game.step(2, {}));
    const sec = await page.evaluate(() => (window as any).__game.runState().sectionReached);
    expect(sec).toBe(n);
    await nextFrames(page);
    await page.screenshot({ path: `test-results/plains-s${n}.png` });
    await page.evaluate((k) => (window as any).__game.overview(k), n);
    await nextFrames(page);
    await page.screenshot({ path: `test-results/plains-map-s${n}.png` });
    expect(errors).toEqual([]);
  }
});

test('the arena locks and waves spawn', async ({ page }) => {
  const errors = await boot(page, '&section=5');
  const r = await page.evaluate(() => {
    const g = (window as any).__game;
    const a = g.arenas().find((x: any) => x.id === 'a1').rect;
    g.teleport(a.x + a.w / 2, a.y + a.h);
    g.step(5, {});
    const run = g.runState();
    const alive = g.world().enemies.filter((e: any) => !e.dead && e.x >= a.x && e.x <= a.x + a.w).length;
    return { locked: run.arenas.a1.locked, wave: run.arenas.a1.wave, alive };
  });
  expect(r).toEqual({ locked: true, wave: 1, alive: 4 });
  const wave2 = await page.evaluate(() => {
    const g = (window as any).__game;
    g.setHp(9999);
    g.step(60, {});                      // spawn-in ends
    g.killAll();
    g.step(1, {});                       // the kill tick
    g.step(89, {});
    const before = g.runState().arenas.a1.wave;
    g.step(1, {});
    return { before, after: g.runState().arenas.a1.wave };
  });
  expect(wave2).toEqual({ before: 1, after: 2 });
  await page.evaluate(() => (window as any).__game.step(30, {}));
  await nextFrames(page);
  await page.screenshot({ path: 'test-results/plains-arena.png' });
  expect(errors).toEqual([]);
});

test('the boss fight ends in a split, a compulsory stat pick, and the village transition', async ({ page }) => {
  const errors = await boot(page, '&section=8');
  await page.evaluate(() => {
    const g = (window as any).__game;
    for (let i = 0; i < 1200 && !g.runState().arenas.boss1.locked; i++) g.step(1, { moveX: 1 });
    g.setHp(9999);
    g.step(130, {});                     // the 1.0 s intro
    // Let it fight for a moment: its first attack's wind-up.
    for (let i = 0; i < 600 && !g.world().enemies.some((e: any) => e.def === 'great_boar' && e.attack); i++) g.step(1, {});
    g.step(40, {});
  });
  await nextFrames(page);
  await page.screenshot({ path: 'test-results/plains-boss-fight.png' });
  const res = await page.evaluate(() => {
    const g = (window as any).__game;
    g.setHp(9999);
    g.setBossHp(1);
    const boss = g.world().enemies.find((e: any) => e.def === 'great_boar');
    g.teleport(boss.x - 44, boss.y);
    let split = null, runTicks = -1;
    for (let i = 0; i < 300 && split === null; i++) {
      g.step(1, { attack1: i % 20 === 0 });
      const run = g.runState();
      if (run.splits[0] !== null) { split = run.splits[0]; runTicks = run.runTicks; }
    }
    return { split, runTicks };
  });
  expect(res.split).not.toBeNull();
  expect(res.split).toBe(res.runTicks);
  await nextFrames(page);
  await page.screenshot({ path: 'test-results/plains-boss.png' });
  expect(await page.evaluate(() => {
    const g = (window as any).__game;
    g.step(120, {});
    return g.runState().phase;
  })).toBe('statPick');
  const phase = await page.evaluate(() => {
    const g = (window as any).__game;
    g.step(36, {});                      // stat cards cannot confirm for their first 0.30 seconds
    g.confirmStatPick();
    for (let i = 0; i < 2400 && g.runState().phase === 'stage'; i++) g.step(1, { moveX: 1 });
    return g.runState().phase;
  });
  expect(phase).toBe('transition');
  await nextFrames(page);
  await page.screenshot({ path: 'test-results/plains-clear.png' });
  expect(errors).toEqual([]);
});
