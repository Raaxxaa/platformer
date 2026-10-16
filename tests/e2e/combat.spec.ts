import { test, expect, type Page } from '@playwright/test';

async function boot(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1');
  await page.waitForFunction(() => (window as any).__game?.ready === true);
  await page.evaluate(() => (window as any).__game.setManual(true));
  return errors;
}

/** Waits two animation frames so the scene has drawn the latest state. */
async function nextFrames(page: Page) {
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
}

test('boots into the combat scene with no errors', async ({ page }) => {
  const errors = await boot(page);
  const w = await page.evaluate(() => (window as any).__game.world());
  expect(w.phase).toBe('stage');
  expect(w.hp).toBe(100);
  expect(w.enemies.map((e: any) => e.def)).toEqual(
    ['training_dummy', 'wolf', 'wolf', 'wolf', 'bandit', 'bandit', 'bandit_archer', 'wild_boar', 'bandit_brute']);
  await nextFrames(page);
  await page.screenshot({ path: 'test-results/combat-start.png' });
  expect(errors).toEqual([]);
});

test('holding J on the training dummy knocks its HP down', async ({ page }) => {
  const errors = await boot(page);
  const dmg = await page.evaluate(() => {
    const g = (window as any).__game;
    for (let i = 0; i < 200 && g.body().x < 96; i++) g.step(1, { moveX: 1 });
    g.step(1, {});
    for (let i = 0; i < 216; i++) g.step(1, { attack1: true });
    const d = g.world().enemies.find((e: any) => e.def === 'training_dummy');
    return d.maxHp - d.hp;
  });
  expect(dmg).toBeGreaterThanOrEqual(66);
  await nextFrames(page);
  await page.screenshot({ path: 'test-results/combat-dummy.png' });
  expect(errors).toEqual([]);
});

test('wolves notice the player and attack', async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => (window as any).__game.teleport(300, 320));
  // Notice 0.35 s + alert reaction 0.25 s + Lunge Bite telegraph 0.40 s + the leap: the first bite lands near tick 146.
  let shot = false;
  for (let i = 0; i < 180; i++) {
    const tele = await page.evaluate(() => {
      const g = (window as any).__game;
      g.step(1, {});
      return g.world().enemies.some((e: any) => e.def === 'wolf' && e.attack?.endsWith(':tele'));
    });
    if (tele && !shot) {
      await nextFrames(page);
      await page.screenshot({ path: 'test-results/combat-wolves.png' });
      shot = true;
    }
  }
  const w = await page.evaluate(() => (window as any).__game.world());
  expect(w.enemies.some((e: any) => e.def === 'wolf' && e.aware)).toBe(true);
  expect(w.hp).toBeLessThan(100);
  expect(shot).toBe(true);
  expect(errors).toEqual([]);
});

test('dying shows the death screen and R restarts', async ({ page }) => {
  const errors = await boot(page);
  const dead = await page.evaluate(() => {
    const g = (window as any).__game;
    g.teleport(570, 320);
    g.setHp(1);
    for (let i = 0; i < 600 && !g.world().dead; i++) g.step(1, {});
    return g.world().dead;
  });
  expect(dead).toBe(true);
  await page.evaluate(() => (window as any).__game.step(130, {}));
  expect(await page.evaluate(() => (window as any).__game.world().phase)).toBe('deathScreen');
  await nextFrames(page);
  await page.screenshot({ path: 'test-results/combat-dead.png' });
  await page.evaluate(() => (window as any).__game.step(1, { restart: true }));
  const w = await page.evaluate(() => (window as any).__game.world());
  expect(w.hp).toBe(100);
  expect(w.phase).toBe('stage');
  expect(w.enemies.every((e: any) => !e.dead)).toBe(true);
  expect(errors).toEqual([]);
});
