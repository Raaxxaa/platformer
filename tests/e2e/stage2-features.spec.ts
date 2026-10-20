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

interface CartRide {
  firstJump: boolean;
  secondJump: boolean;
  jumpLeft: number;
  jumps: number;
  crashes: number;
  ticks: number;
  firstTunnel: boolean;
  secondTunnel: boolean;
  firstUnderRoof: boolean;
  secondUnderRoof: boolean;
  firstTop: number | null;
  secondTop: number | null;
  firstFeet: number | null;
  secondFeet: number | null;
}

/** Read the live cart; send only ordinary fixed inputs after the initial test placement. */
async function rideTo(page: Page, targetX: number, progress: CartRide) {
  return page.evaluate(({ targetX, progress }) => {
    const g = (window as any).__game, scene = (window as any).PHASER_GAME.scene.getScene('Stage'), w = scene.world;
    const cart = w.minecarts[0];
    while (cart.active && cart.x < targetX && progress.ticks < 1800) {
      if (!progress.firstJump && cart.x >= 321 * 16 && cart.x < 324 * 16) { progress.firstJump = true; progress.jumpLeft = 40; }
      if (!progress.secondJump && cart.x >= 394 * 16 && cart.x < 396 * 16) { progress.secondJump = true; progress.jumpLeft = 40; }
      g.step(1, { jump: progress.jumpLeft-- > 0 });
      progress.ticks++;
      progress.jumps += w.events.filter((e: any) => e.t === 'move' && e.e === 'cartJump').length;
      progress.crashes += w.events.filter((e: any) => e.t === 'move' && e.e === 'cartCrash').length;
      const seated = w.body.cartId === cart.id && w.body.state === 'minecart' && w.body.h === 20;
      // Sample only while the entire24px cart is horizontally under the authored roof.
      if (cart.x - cart.w / 2 >= 312 * 16 && cart.x + cart.w / 2 <= 320 * 16) {
        progress.firstTunnel ||= seated;
        progress.firstUnderRoof &&= seated && cart.y - cart.h >= 91 * 16 && cart.y <= 92 * 16;
        progress.firstTop = Math.min(progress.firstTop ?? Infinity, cart.y - cart.h);
        progress.firstFeet = Math.max(progress.firstFeet ?? -Infinity, cart.y);
      }
      if (cart.x - cart.w / 2 >= 386 * 16 && cart.x + cart.w / 2 <= 393 * 16) {
        progress.secondTunnel ||= seated;
        progress.secondUnderRoof &&= seated && cart.y - cart.h >= 131 * 16 && cart.y <= 132 * 16;
        progress.secondTop = Math.min(progress.secondTop ?? Infinity, cart.y - cart.h);
        progress.secondFeet = Math.max(progress.secondFeet ?? -Infinity, cart.y);
      }
    }
    return { progress, cart: { x: cart.x, y: cart.y, active: cart.active }, body: g.body(), dead: w.health.dead };
  }, { targetX, progress });
}

test('the real Mountain cart rides at least 120 tiles, jumps both gaps and passes both low tunnels before its stop', async ({ page }) => {
  const errors = await boot(page, 'mountains', 6);
  const start = await page.evaluate(() => {
    const g = (window as any).__game, w = (window as any).PHASER_GAME.scene.getScene('Stage').world;
    const cart = w.minecarts[0], initialX = cart.x, stop = w.cartStops[0];
    g.teleport(cart.spawnX, cart.spawnY); g.step(1, { interact: true });
    return { initialX, stopX: stop.x, cartWidth: cart.w, boarded: w.body.cartId === cart.id };
  });
  expect(start.boarded).toBe(true);
  let progress: CartRide = { firstJump: false, secondJump: false, jumpLeft: 0, jumps: 0, crashes: 0, ticks: 0, firstTunnel: false, secondTunnel: false,
    firstUnderRoof: true, secondUnderRoof: true, firstTop: null, secondTop: null, firstFeet: null, secondFeet: null };
  const first = await rideTo(page, 318 * 16, progress); progress = first.progress;
  expect(progress.firstTunnel).toBe(true); expect(progress.crashes).toBe(0);
  expect(progress.firstUnderRoof, `first roof bottom1456/floor1472; min cart top ${progress.firstTop}, max feet ${progress.firstFeet}`).toBe(true);
  await draw(page); await page.screenshot({ path: 'test-results/m71-cart-low-tunnel1.png' });
  const second = await rideTo(page, 390 * 16, progress); progress = second.progress;
  expect(progress.secondTunnel).toBe(true); expect(progress.crashes).toBe(0);
  expect(progress.secondUnderRoof, `second roof bottom2096/floor2112; min cart top ${progress.secondTop}, max feet ${progress.secondFeet}`).toBe(true);
  await draw(page); await page.screenshot({ path: 'test-results/m71-cart-low-tunnel2.png' });
  const finish = await rideTo(page, start.stopX + 16, progress);
  expect(finish.progress.jumps).toBe(2); expect(finish.progress.crashes).toBe(1);
  expect(finish.cart.x - start.initialX).toBeGreaterThanOrEqual(120 * 16);
  expect(finish.cart.x).toBeGreaterThanOrEqual(start.stopX - start.cartWidth / 2 - 1);
  expect(finish.cart.active).toBe(false); expect(finish.body.cartId).toBeNull(); expect(finish.dead).toBe(false);
  await draw(page); await page.screenshot({ path: 'test-results/m71-cart-arrival.png' });
  expect(errors).toEqual([]);
});

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
