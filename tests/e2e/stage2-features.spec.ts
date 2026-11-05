import { expect, test, type Page } from '@playwright/test';

async function boot(page: Page, road: 'mountains' | 'swamps', section: number) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.url().includes('/assets/') && response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  await page.goto(`/?debug=1&start=${road}&section=${section}&seed=STAGE2-FEATURES`);
  await page.waitForFunction(() => (window as any).__game?.ready === true);
  await page.evaluate(() => (window as any).__game.setManual(true));
  return errors;
}

async function draw(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}


/** Read the live cart; send only ordinary fixed inputs after the initial test placement. */

test('normal movement enters real swamp water, wades at 85 px/s and uses the water jump', async ({ page }) => {
  const errors = await boot(page, 'swamps', 3);
  const before = await page.evaluate(() => {
    const g = (window as any).__game;
    g.teleport(155 * 16 + 8, 56 * 16); g.step(1, {});
    return g.body();
  });
  expect(before.inWater).toBe(false);
  const wading = await page.evaluate(() => { const g = (window as any).__game; g.step(60, { moveX: 1 }); return g.body(); });
  expect(wading.x).toBeGreaterThan(before.x); expect(wading.inWater).toBe(true);
  expect(wading.grounded).toBe(true); expect(wading.onIce).toBe(false); expect(wading.vx).toBe(85);
  await draw(page); await page.screenshot({ path: 'test-results/m71-water-wading.png' });
  const jump = await page.evaluate(() => { const g = (window as any).__game; g.step(1, { jump: true }); return g.body(); });
  expect(jump.state).toBe('air'); expect(jump.vy).toBe(-327.5); expect(jump.y).toBeLessThan(wading.y);
  expect(errors).toEqual([]);
});

test('walking into the dark hollow shows a clear player light and dim unlit fog', async ({ page }) => {
  const errors = await boot(page, 'swamps', 3);
  const outside = await page.evaluate(() => {
    const g = (window as any).__game, w = (window as any).PHASER_GAME.scene.getScene('Stage').world;
    g.teleport(146 * 16 + 8, 56 * 16); g.step(1, {});
    return w.darkZones.some((z: any) => w.body.x >= z.x && w.body.x < z.x + z.w && w.body.y - w.body.h / 2 >= z.y && w.body.y - w.body.h / 2 < z.y + z.h);
  });
  expect(outside).toBe(false);
  const inside = await page.evaluate(() => {
    const g = (window as any).__game, w = (window as any).PHASER_GAME.scene.getScene('Stage').world;
    g.step(40, { moveX: 1 });
    const body = g.body(), camera = g.camera();
    return { inside: w.darkZones.some((z: any) => body.x >= z.x && body.x < z.x + z.w && body.y - body.h / 2 >= z.y && body.y - body.h / 2 < z.y + z.h),
      baseline: { x: body.x, y: body.y - 80 },
      points: [{ x: body.x - camera.x, y: body.y - 50 - camera.y }, { x: body.x + 230 - camera.x, y: body.y - 130 - camera.y },
        { x: body.x - camera.x, y: body.y - 80 - camera.y }] };
  });
  expect(inside.inside).toBe(true);
  await draw(page);
  const shot = await page.locator('canvas').screenshot({ path: 'test-results/m71-darkness-entry.png' });
  const brightness = await page.evaluate(async ({ png, points }) => {
    const image = new Image(); image.src = `data:image/png;base64,${png}`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0);
    return points.map((p) => {
      const [r, g, b] = ctx.getImageData(Math.round(p.x * image.width / 640), Math.round(p.y * image.height / 360), 1, 1).data;
      return r + g + b;
    });
  }, { png: shot.toString('base64'), points: inside.points });
  expect(brightness[0], `lit/unlit RGB sums: ${brightness}`).toBeGreaterThan(0);
  expect(brightness[1], `lit/unlit RGB sums: ${brightness}`).toBeLessThan(brightness[0] * 0.6);
  const later = await page.evaluate((baseline) => {
    const g = (window as any).__game, w = (window as any).PHASER_GAME.scene.getScene('Stage').world;
    for (let i = 0; i < 600 && g.body().x < baseline.x + 180; i++) g.step(1, { moveX: 1 });
    const body = g.body(), camera = g.camera();
    return { distance: Math.hypot(body.x - baseline.x, body.y - body.h / 2 - baseline.y),
      otherLight: w.fireflies.some((fly: any) => Math.hypot(fly.x - baseline.x, fly.y - baseline.y) <= fly.radius + Math.SQRT2 * 6),
      point: { x: baseline.x - camera.x, y: baseline.y - camera.y } };
  }, inside.baseline);
  expect(later.distance).toBeGreaterThan(112); expect(later.otherLight).toBe(false);
  await draw(page);
  const unlit = await page.locator('canvas').screenshot({ path: 'test-results/m71-darkness-same-point-unlit.png' });
  const samePoint = await page.evaluate(async ({ png, point }) => {
    const image = new Image(); image.src = `data:image/png;base64,${png}`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0);
    const [r, g, b] = ctx.getImageData(Math.round(point.x * image.width / 640), Math.round(point.y * image.height / 360), 1, 1).data;
    return r + g + b;
  }, { png: unlit.toString('base64'), point: later.point });
  expect(samePoint, `same world point lit/unlit RGB sums: ${brightness[2]},${samePoint}`).toBeLessThan(brightness[2] * 0.6);
  expect(errors).toEqual([]);
});
