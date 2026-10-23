import { test, expect, type Page } from '@playwright/test';

// M11: every Plains section version, zoomed out, via ?layout= (06 §8.7, §16).
const frames = (page: Page) => page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
const code = (section: number, v: number) => [2, 3, 4, 6, 7].map((s) => (s === section ? v : 1)).join('-');

// Every stage with section versions (06 §8.7): one screenshot per version, with all other sections classic.
const STAGES = ['plains', 'mountains', 'swamps', 'kingdom'];
for (const level of STAGES) {
  for (const section of [2, 3, 4, 6, 7]) {
    for (const v of [1, 2, 3]) {
      test(`${level} section ${section} version ${v}`, async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.goto(`/?debug=1&start=${level}&seed=LAYOUT&section=${section}&layout=${code(section, v)}&kit=swordsman:greatsword`);
        await page.waitForFunction(() => (window as any).__game?.ready === true);
        const got = await page.evaluate((s) => { const g = (window as any).__game; g.setManual(true); g.step(2, {}); g.overview(s); return g.layoutCode(); }, section);
        expect(got).toBe(code(section, v));
        await frames(page);
        await page.screenshot({ path: level === 'plains' ? `test-results/layout-s${section}-v${v}.png` : `test-results/layout-${level}-s${section}-v${v}.png` });
        expect(errors).toEqual([]);
      });
    }
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

test('practice on a chosen layout: the best is saved under its layout code', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => { if (!localStorage.getItem('rushblade.save')) localStorage.setItem('rushblade.save', JSON.stringify({ v: 1, lastKit: { cls: 'swordsman', weapon: 'greatsword' } })); });
  await page.goto('/?debug=1'); await page.waitForFunction(() => (window as any).__game?.title);
  await page.evaluate(() => (window as any).__game.titleChoose(4));
  await expect.poll(() => page.evaluate(() => (window as any).__game.screenState().screen)).toBe('practice');
  const act = (...a: string[]) => page.evaluate((list) => { for (const x of list) (window as any).__game.screenAction(x); }, a);
  // Layout → Custom; Section 2 → v3; Section 7 → v2.
  await act('down', 'down', 'down', 'right', 'right', 'down', 'right', 'right', 'down', 'down', 'down', 'down', 'right');
  await frames(page); await page.screenshot({ path: 'test-results/layout-practice-setup.png' });
  await act('down', 'confirm');
  await page.waitForFunction(() => { const g = (window as any).__game; if (!g?.ready || g.levelId?.() !== 'plains') return false; g.setManual(true); return true; });
  await page.evaluate(() => { const g = (window as any).__game, t = g.runState().transition; if (t?.part === 'in') g.step(t.left, {}); });
  expect(await page.evaluate(() => (window as any).__game.layoutCode())).toBe('3-1-1-1-2');
  await page.evaluate(() => {
    const g = (window as any).__game, arena = g.arenas().find((a: any) => a.kind === 'boss');
    g.step(60, { moveX: 1 }); g.teleport(arena.rect.x + 32, arena.rect.y + arena.rect.h); g.step(2, {});
    const boss = g.world().enemies.filter((e: any) => !e.dead).sort((a: any, b: any) => b.maxHp - a.maxHp)[0];
    g.setEnemyHp(boss.id, 0); g.step(2, {});
  });
  const ticks = (await page.evaluate(() => (window as any).__game.practice())).clear.ticks;
  expect(await page.evaluate(() => (window as any).__game.save().practiceBests)).toEqual({ 'plains|swordsman|3-1-1-1-2': ticks });
  expect(errors).toEqual([]);
});
