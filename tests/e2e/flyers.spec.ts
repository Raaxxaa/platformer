import { test, expect, type Page } from '@playwright/test';

// Flying enemies and both Guardians are photographed next to the player; look at test-results/flyers-*.png.
const frames = (page: Page) => page.evaluate(() => new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done()))));

test('swamps: the key platform has a staircase of one-jump steps', async ({ page }) => {
  await page.goto('/?debug=1&start=swamps&seed=FLY&kit=tank:war_maul');
  await page.waitForFunction(() => { const g = (window as any).__game; if (!g?.ready || g.levelId?.() !== 'swamps') return false; g.setManual(true); return true; });
  await page.evaluate(() => { const g = (window as any).__game, t = g.runState().transition; if (t?.part === 'in') g.step(t.left, {}); });
  await page.evaluate(() => { const g = (window as any).__game; g.teleport(238 * 16, 56 * 16); g.step(2, {}); });
  await frames(page);
  await page.screenshot({ path: 'test-results/platform-steps-swamps.png' });
});

for (const [road, enemy] of [['mountains', 'bat_swarm'], ['swamps', 'wisp'], ['mountains', 'stone_colossus'], ['swamps', 'spider_queen']] as const) {
  test(`${road}: ${enemy} is drawn with art`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`/?debug=1&start=${road}&seed=FLY&kit=tank:war_maul`);
    await page.waitForFunction(target => {
      const g = (window as any).__game;
      if (!g?.ready || g.levelId?.() !== target) return false;
      g.setManual(true); return true;
    }, road);
    await page.evaluate(() => { const g = (window as any).__game, t = g.runState().transition; if (t?.part === 'in') g.step(t.left, {}); });
    const target = await page.evaluate(id => {
      const g = (window as any).__game, en = g.world().enemies.find((x: any) => x.def === id);
      if (!en) return null;
      g.teleport(en.x - 70, en.y + 8); g.step(2, {}); return { x: en.x, y: en.y };
    }, enemy);
    expect(target, `${enemy} exists in ${road}`).not.toBeNull();
    await frames(page);
    await page.screenshot({ path: `test-results/flyers-${enemy}.png` });
    expect(errors).toEqual([]);
  });
}
