import { test, expect } from '@playwright/test';

// ART9: the stage music starts after the browser's audio unlock and rises with Rush.
test('Stage 1 plays the plains track after unlock, with no page errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1&start=plains&seed=PLAINS');
  await page.waitForFunction(() => (window as any).__game?.ready === true);
  expect(await page.evaluate(() => (window as any).__game.musicLog())).toEqual([]);   // nothing before unlock
  await page.locator('canvas').click({ position: { x: 320, y: 180 } });
  await expect.poll(() => page.evaluate(() => (window as any).PHASER_GAME.sound.locked)).toBe(false);
  await expect.poll(() => page.evaluate(() => (window as any).__game.musicLog())).toContain('plains');
  // Let the scheduler run for a moment: the context must be running and time must advance.
  const t0 = await page.evaluate(() => (window as any).PHASER_GAME.sound.context.currentTime);
  await page.waitForTimeout(700);
  const t1 = await page.evaluate(() => (window as any).PHASER_GAME.sound.context.currentTime);
  expect(t1).toBeGreaterThan(t0);
  expect(errors).toEqual([]);
});
