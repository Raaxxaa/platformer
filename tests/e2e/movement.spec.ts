import { test, expect, type Page } from '@playwright/test';

async function boot(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1&scene=movement');
  await page.waitForFunction(() => (window as any).__game?.ready === true);
  return errors;
}

/** Waits two animation frames so the scene has drawn the latest state. */
async function nextFrames(page: Page) {
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
}

test('a full jump in the real build peaks 56 px', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => { const g = (window as any).__game; g.setManual(true); g.step(30, {}); });
  const startY = await page.evaluate(() => (window as any).__game.body().y);
  const minY = await page.evaluate(() => {
    const g = (window as any).__game; let m = Infinity;
    for (let i = 0; i < 60; i++) { g.step(1, { jump: true }); m = Math.min(m, g.body().y); }
    return m;
  });
  expect(startY - minY).toBeGreaterThanOrEqual(55); expect(startY - minY).toBeLessThanOrEqual(57);
});

test('slides and crawls through the tunnel', async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => {
    const g = (window as any).__game;
    g.setManual(true);
    g.teleport(570, 432);          // just past the 96 px ledge, on the floor before the tunnel wall
    for (let i = 0; i < 200 && g.body().x < 600; i++) g.step(1, { moveX: 1 });
    g.step(1, { moveX: 1, moveY: 1, dash: true });
    g.step(60, { moveX: 1 });
  });
  const mid = await page.evaluate(() => (window as any).__game.body());
  expect(mid.state).toBe('crawl');
  expect(mid.h).toBe(14);
  expect(mid.x).toBeGreaterThan(640);
  expect(mid.x).toBeLessThan(768);
  await nextFrames(page);
  await page.screenshot({ path: 'test-results/movement-tunnel.png' });

  await page.evaluate(() => (window as any).__game.step(90, { moveX: 1 }));
  const end = await page.evaluate(() => (window as any).__game.body());
  expect(end.x).toBeGreaterThan(776);
  expect(end.state).toBe('ground');
  expect(errors).toEqual([]);
});

test('keyboard moves the player and a window blur lets go of held keys', async ({ page }) => {
  await boot(page);
  const x0 = await page.evaluate(() => (window as any).__game.body().x);
  await page.keyboard.down('KeyD');
  await expect.poll(() => page.evaluate(() => (window as any).__game.body().x)).toBeGreaterThan(x0 + 20);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect.poll(() => page.evaluate(() => (window as any).__game.body().vx)).toBe(0);
  const x1 = await page.evaluate(() => (window as any).__game.body().x);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).__game.body().x)).toBe(x1);
  await page.keyboard.up('KeyD');
});

test('screenshots of the test level', async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => (window as any).__game.setManual(true));
  await nextFrames(page);
  await page.screenshot({ path: 'test-results/movement-level.png' });
  for (const [name, x, y] of [['shaft', 900, 432], ['oneway', 1350, 432], ['pit', 1640, 432]] as const) {
    await page.evaluate(([px, py]) => (window as any).__game.teleport(px, py), [x, y]);
    await nextFrames(page);
    await page.screenshot({ path: `test-results/movement-${name}.png` });
  }
  expect(errors).toEqual([]);
});
