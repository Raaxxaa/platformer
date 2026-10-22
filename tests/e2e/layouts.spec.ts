import { test, expect, type Page } from '@playwright/test';

// M11: every Plains section version, zoomed out, via ?layout= (06 §8.7, §16).
const frames = (page: Page) => page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
const code = (section: number, v: number) => [2, 3, 4, 6, 7].map((s) => (s === section ? v : 1)).join('-');

for (const section of [2, 3, 4, 6, 7]) {
  for (const v of [1, 2, 3]) {
    test(`Plains section ${section} version ${v}`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`/?debug=1&start=plains&seed=LAYOUT&section=${section}&layout=${code(section, v)}&kit=swordsman:greatsword`);
      await page.waitForFunction(() => (window as any).__game?.ready === true);
      const got = await page.evaluate((s) => { const g = (window as any).__game; g.setManual(true); g.step(2, {}); g.overview(s); return g.layoutCode(); }, section);
      expect(got).toBe(code(section, v));
      await frames(page);
      await page.screenshot({ path: `test-results/layout-s${section}-v${v}.png` });
      expect(errors).toEqual([]);
    });
  }
}

test('the run picks its layout from the seed, and the same seed gives the same layout', async ({ page }) => {
  const codes: string[] = [];
  for (let i = 0; i < 2; i++) {
    await page.goto('/?debug=1&start=plains&seed=SAMESEED&kit=swordsman:greatsword');
    await page.waitForFunction(() => (window as any).__game?.ready === true);
    codes.push(await page.evaluate(() => (window as any).__game.layoutCode()));
  }
  expect(codes[0]).toBe(codes[1]);
  expect(codes[0]).toMatch(/^[1-3]-[1-3]-[1-3]-[1-3]-[1-3]$/);
});
