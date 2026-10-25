import { test, expect, type Page } from '@playwright/test';

// M13 on the emulated phone: the wardrobe works by tapping (07 §8.6).
test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const frames = (page: Page) => page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
async function tapGame(page: Page, gx: number, gy: number) {
  const p = await page.evaluate(([gx, gy]) => { const r = document.querySelector('canvas')!.getBoundingClientRect(); const k = r.width / 640; return { x: r.x + (gx as number) * k, y: r.y + (gy as number) * k }; }, [gx, gy] as const);
  await page.touchscreen.tap(p.x, p.y); await frames(page);
}
const state = (page: Page) => page.evaluate(() => (window as any).__game.wardrobe());

test('tap tabs, option arrows, Random and Confirm in the wardrobe', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1&start=home&intro=1&seed=PHONE');
  await page.waitForFunction(() => (window as any).__game?.ready === true && (window as any).__game.wardrobe() !== null);
  await frames(page); await page.screenshot({ path: 'test-results/phone-wardrobe.png' });
  // Race row: the right arrow (game x ≈ 328+80+168-12) cycles Human → Elf.
  await tapGame(page, 560, 62);
  expect((await state(page)).look.race).toBe('elf');
  await tapGame(page, 424, 62);                                     // the left arrow goes back
  expect((await state(page)).look.race).toBe('human');
  await tapGame(page, 433, 29);                                     // the Clothes tab
  expect((await state(page)).tab).toBe('clothes');
  await tapGame(page, 560, 62);                                     // outfit → Plate
  expect((await state(page)).look.outfit).toBe('plate');
  await page.screenshot({ path: 'test-results/phone-wardrobe-clothes.png' });
  await tapGame(page, 573, 29);                                     // the Collection tab (4th)
  expect((await state(page)).tab).toBe('collection');
  await page.screenshot({ path: 'test-results/phone-wardrobe-collection.png' });
  await tapGame(page, 372, 328);                                    // Random
  const afterRandom = await state(page);
  await tapGame(page, 564, 328);                                    // Confirm
  expect(await state(page)).toBeNull();
  expect((await page.evaluate(() => (window as any).__game.save())).look).toMatchObject({ race: afterRandom.look.race, outfit: afterRandom.look.outfit });
  expect(errors).toEqual([]);
});
