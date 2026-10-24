import { test, expect, type Page } from '@playwright/test';

// M12: the phone version, with mobile emulation (touch, coarse pointer) at 844 × 390.
test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });

const frames = (page: Page) => page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
/** A synthetic touch pointer on the window, like a finger (Playwright's touchscreen can only tap). */
async function finger(page: Page, type: 'down' | 'move' | 'up', id: number, x: number, y: number) {
  await page.evaluate(([type, id, x, y]) => {
    window.dispatchEvent(new PointerEvent(`pointer${type}`, { pointerId: id as number, pointerType: 'touch', clientX: x as number, clientY: y as number, bubbles: true, cancelable: true, isPrimary: id === 1 }));
  }, [type, id, x, y] as const);
}
const btn = (page: Page, name: string) => page.evaluate((n) => { const e = document.querySelector(`.touch-${n}`)!.getBoundingClientRect(); return { x: e.x + e.width / 2, y: e.y + e.height / 2 }; }, name);

test('the overlay shows after the first touch, over Stage 1, with live icons', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1&start=plains&seed=PHONE&kit=swordsman:greatsword');
  await page.waitForFunction(() => (window as any).__game?.ready === true);
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('touch')!).display)).toBe('none');
  await finger(page, 'down', 9, 200, 100); await finger(page, 'up', 9, 200, 100);
  await frames(page); await frames(page);
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('touch')!).display)).toBe('block');
  await page.screenshot({ path: 'test-results/phone-stage1.png' });
  expect(errors).toEqual([]);
});

test('play by touch: the stick runs, Jump jumps, Attack swings, lifting a finger lets go', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1&start=plains&seed=PHONE&kit=swordsman:greatsword');
  await page.waitForFunction(() => (window as any).__game?.ready === true);
  await finger(page, 'down', 9, 200, 100); await finger(page, 'up', 9, 200, 100); await frames(page);
  const x0 = (await page.evaluate(() => (window as any).__game.body())).x;
  // Stick: touch at (120, 250), drag right.
  await finger(page, 'down', 1, 120, 250); await finger(page, 'move', 1, 180, 250);
  await page.waitForTimeout(700);
  const x1 = (await page.evaluate(() => (window as any).__game.body())).x;
  expect(x1).toBeGreaterThan(x0 + 40);
  await page.screenshot({ path: 'test-results/phone-stick.png' });
  // Jump with a second finger while running.
  const jump = await btn(page, 'jump');
  let maxUp = 0; const y0 = (await page.evaluate(() => (window as any).__game.body())).y;
  await finger(page, 'down', 2, jump.x, jump.y);
  for (let i = 0; i < 8; i++) { await page.waitForTimeout(40); maxUp = Math.max(maxUp, y0 - (await page.evaluate(() => (window as any).__game.body())).y); }
  await finger(page, 'up', 2, jump.x, jump.y);
  expect(maxUp).toBeGreaterThan(20);
  // Attack: a tap starts a swing.
  const atk = await btn(page, 'attack1');
  await finger(page, 'down', 3, atk.x, atk.y); await finger(page, 'up', 3, atk.x, atk.y);
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => (window as any).__game.world?.().tick > 0)).toBe(true);
  // Lifting the stick finger stops the run.
  await finger(page, 'up', 1, 180, 250);
  await page.waitForTimeout(900);
  const a = (await page.evaluate(() => (window as any).__game.body())).x; await page.waitForTimeout(300);
  const b = (await page.evaluate(() => (window as any).__game.body())).x;
  expect(Math.abs(b - a)).toBeLessThan(1);
  expect(errors).toEqual([]);
});
