import { test, expect, type Page } from '@playwright/test';

// ART8: the Stage 3-4 enemies and bosses are drawn from their sprites, not grey boxes. Photos land in test-results/art8-*.png.
const frames = (page: Page) => page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
async function shot(page: Page, name: string) {
  await frames(page);
  await page.screenshot({ path: `test-results/art8-${name}.png` });
}
async function arrive(page: Page, id: string) {
  await page.waitForFunction((target) => {
    const g = (window as any).__game;
    if (!g?.ready || g.levelId?.() !== target) return false;
    g.setManual(true); return true;
  }, id);
  await page.evaluate(() => {
    const g = (window as any).__game, t = g.runState().transition;
    if (t?.part === 'in') g.step(t.left, {});
  });
}
const open = async (page: Page, level: string) => { await page.goto(`/?debug=1&start=${level}&seed=ART8&kit=swordsman:greatsword`); await arrive(page, level); };

const GROUPS: Record<string, string[]> = {
  kingdom: ['soldier', 'crossbowman', 'war_hound', 'battle_mage', 'knight'],
  castle: ['royal_guard', 'gargoyle', 'castle_mage', 'living_armor', 'royal_executioner'],
};

for (const [level, ids] of Object.entries(GROUPS)) {
  for (const id of ids) {
    test(`art8: ${level} ${id} is drawn from its sprite`, async ({ page }) => {
      const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
      await open(page, level);
      const eid = await page.evaluate((def) => {
        const g = (window as any).__game, en = g.world().enemies.find((x: any) => x.def === def);
        if (!en) return null;
        g.setHp(9999); g.teleport(en.x - 70, en.y); g.step(3, {});
        return en.id as number;
      }, id);
      expect(eid, `${id} exists in the ${level} level`).not.toBeNull();
      await page.evaluate(() => { const g = (window as any).__game; g.setHp(9999); g.step(40, {}); });
      expect(await page.evaluate((e) => (window as any).__game.enemyDraw(e), eid)).toBe('sprite');
      await shot(page, `${level}-${id}`);
      expect(errors).toEqual([]);
    });
  }
}

for (const [level, boss] of [['kingdom', 'black_knight'], ['castle', 'enemy_king']] as const) {
  test(`art8: the ${boss} is drawn from its sprite sheet`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
    await open(page, level);
    const arena = await page.evaluate(() => (window as any).__game.arenas().find((a: any) => a.kind === 'boss').rect);
    await page.evaluate((a) => { const g = (window as any).__game; g.setHp(9999); g.teleport(a.x + 120, a.y + a.h); g.step(30, {}); }, arena);
    for (let n = 0; n < 120; n++) {
      const attack = await page.evaluate((def) => { const g = (window as any).__game; g.setHp(9999); g.step(10, {}); return g.world().enemies.find((e: any) => e.def === def).attack; }, boss);
      if (attack) break;
    }
    const eid = await page.evaluate((def) => (window as any).__game.world().enemies.find((e: any) => e.def === def).id, boss);
    expect(await page.evaluate((e) => (window as any).__game.enemyDraw(e), eid)).toBe('sprite');
    await shot(page, boss);
    expect(errors).toEqual([]);
  });
}
