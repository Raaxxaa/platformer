import { test, expect, type Page } from '@playwright/test';

// M4: classes, abilities, weapons, the Training Yard.
async function boot(page: Page, query: string) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`/?debug=1&seed=PLAINS${query}`);
  await page.waitForFunction(() => (window as any).__game?.ready === true);
  return errors;
}
async function nextFrames(page: Page) {
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
}

test('Stage 1 opens the class pick before the run; confirming equips the kit', async ({ page }) => {
  const errors = await boot(page, '&start=plains&picker=1');
  await nextFrames(page);
  await page.screenshot({ path: 'test-results/class-pick.png' });
  expect(await page.evaluate(() => (window as any).__game.classPickOpen())).toBe(true);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(100);
  await page.keyboard.press('Space');
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => (window as any).__game.classPickOpen())).toBe(false);
  const cs = await page.evaluate(() => (window as any).__game.classState());
  expect(cs.displayName).toBe('Archer');
  expect(errors).toEqual([]);
});

test('Stage 1 with ?kit=wizard:staff boots and Thunder Strike hits a wolf', async ({ page }) => {
  const errors = await boot(page, '&start=plains&kit=wizard:staff&section=2');
  const r = await page.evaluate(() => {
    const g = (window as any).__game;
    g.setManual(true);
    g.setHp(9999);
    const wolf = g.world().enemies.find((e: any) => e.def === 'wolf');
    g.teleport(wolf.x - 80, wolf.y);
    g.step(2, {});
    const hp0 = g.world().enemies.find((e: any) => e.id === wolf.id).hp;
    g.step(1, { ability1: true });
    g.step(40, {});
    return { cs: g.classState(), hp0, hp1: g.world().enemies.find((e: any) => e.id === wolf.id).hp };
  });
  expect(r.cs.displayName).toBe('Wizard');
  expect(r.hp1).toBeLessThan(r.hp0);
  await nextFrames(page);
  await page.screenshot({ path: 'test-results/ability-thunder_strike-stage.png' });
  expect(errors).toEqual([]);
});

test('the Training Yard loads with statues, signs, flags, stands and the checklist board', async ({ page }) => {
  const errors = await boot(page, '&start=training');
  expect(await page.evaluate(() => (window as any).__game.levelId())).toBe('training_yard');
  await page.evaluate(() => { const g = (window as any).__game; g.setManual(true); g.step(30, {}); });
  await nextFrames(page);
  await page.screenshot({ path: 'test-results/yard-start.png' });
  // Station 1: a sign; finish it and the flag turns green.
  await page.evaluate(() => { const g = (window as any).__game; g.toStation(1); g.step(10, {}); });
  expect((await page.evaluate(() => (window as any).__game.training())).sign).toContain('jump');
  await page.evaluate(() => { const g = (window as any).__game; for (let i = 0; i < 600 && !g.training().done.includes(1); i++) g.step(1, { moveX: 1, jump: i % 24 < 14 }); g.step(20, {}); });
  expect((await page.evaluate(() => (window as any).__game.training())).done).toContain(1);
  await nextFrames(page);
  await page.screenshot({ path: 'test-results/yard-station1.png' });
  // The armory and the board at the end.
  await page.evaluate(() => { const g = (window as any).__game; const b = g.levelObjects('checklist_board')[0]; g.teleport(b.x, b.y); g.step(20, {}); });
  await nextFrames(page);
  await page.screenshot({ path: 'test-results/yard-end.png' });
  expect(errors).toEqual([]);
});
