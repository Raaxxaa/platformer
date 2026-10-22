import { test, expect, type Page } from '@playwright/test';

// M10: seeds, practice mode and ghosts. Photos land in test-results/m10-*.png.
const frames = (page: Page) => page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
const save = (extra: Record<string, unknown> = {}) => JSON.stringify({ v: 1, progress: { levelsReached: ['plains', 'mountains', 'swamps', 'kingdom'], stage1Cleared: true, classesDiscovered: [] }, ...extra });
const seedSave = (page: Page, data: string) => page.addInitScript((d) => { if (!localStorage.getItem('rushblade.save')) localStorage.setItem('rushblade.save', d); }, data);
async function title(page: Page) {
  await page.goto('/?debug=1'); await page.waitForFunction(() => (window as any).__game?.title);
}
async function openPractice(page: Page) {
  await page.evaluate(() => (window as any).__game.titleChoose(4));
  await expect.poll(() => page.evaluate(() => (window as any).__game.screenState().screen)).toBe('practice');
  await frames(page);
}
const act = (page: Page, ...actions: string[]) => page.evaluate((list) => { for (const a of list) (window as any).__game.screenAction(a); }, actions);
async function stageReady(page: Page, id: string) {
  await page.waitForFunction((level) => { const game = (window as any).__game; if (!game?.ready || game.levelId?.() !== level) return false; game.setManual(true); return true; }, id);
  await page.evaluate(() => { const game = (window as any).__game, t = game.runState().transition; if (t?.part === 'in') game.step(t.left, {}); });
}
/** Teleports into the boss arena and kills the boss on the spot. */
async function killBoss(page: Page) {
  await page.evaluate(() => {
    const game = (window as any).__game, arena = game.arenas().find((a: any) => a.kind === 'boss');
    game.teleport(arena.rect.x + 32, arena.rect.y + arena.rect.h); game.step(2, {});
    const boss = game.world().enemies.filter((e: any) => !e.dead).sort((a: any, b: any) => b.maxHp - a.maxHp)[0];
    game.setEnemyHp(boss.id, 0); game.step(2, {});
  });
}

test('a typed seed is saved from the Home Village board and shown in practice and on the HUD', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1&start=home');
  await page.waitForFunction(() => (window as any).__game?.ready && (window as any).__game.levelId?.() === 'home');
  await page.evaluate(() => (window as any).__game.setManual(true));
  await page.evaluate(() => (window as any).__game.openHomePanel('seed'));
  await page.keyboard.type('race7'); await frames(page);
  await page.screenshot({ path: 'test-results/m10-seed-board.png' });
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => (window as any).__game.save().typedSeed)).toBe('RACE7');
  // The same seed shows on the practice setup and the practice HUD, and the run is seeded (no records).
  await page.goto('/?debug=1'); await page.waitForFunction(() => (window as any).__game?.title);
  await openPractice(page);
  expect(await page.evaluate(() => (window as any).__game.screenState().model.seed)).toBe('RACE7');
  await act(page, 'down', 'down', 'down', 'confirm');
  await stageReady(page, 'plains');
  await frames(page);
  const run = await page.evaluate(() => (window as any).__game.runState());
  expect(run).toMatchObject({ seedText: 'RACE7', seeded: true });
  expect(await page.evaluate(() => (window as any).__game.timerBlock().info)).toBe('PRACTICE');
  expect(errors).toEqual([]);
});

test('practice setup is keyboard-usable and starts a stage with the preset loadout and a perched Dragon', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await seedSave(page, save({ lastKit: { cls: 'archer', weapon: 'bow' } }));
  await title(page);
  await page.keyboard.press('Enter');                                         // the boot gesture
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => (window as any).__game.screenState().screen)).toBe('practice');
  await frames(page); await page.screenshot({ path: 'test-results/m10-practice-setup.png' });
  expect(await page.evaluate(() => (window as any).__game.screenState().model)).toMatchObject({ setup: { levelId: 'plains', cls: 'archer', weapon: 'bow', dragon: 'off' } });
  await page.keyboard.press('ArrowRight');                                    // Stage 2 (Mountains)
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');   // class, weapon, dragon
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');   // Random color, Red
  await frames(page); await page.screenshot({ path: 'test-results/m10-practice-setup-dragon.png' });
  expect(await page.evaluate(() => (window as any).__game.screenState().model.setup)).toEqual({ levelId: 'mountains', cls: 'archer', weapon: 'bow', dragon: 'red' });
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');         // Start
  await stageReady(page, 'mountains');
  await frames(page);
  const info = await page.evaluate(() => { const game = (window as any).__game; return { loadout: game.loadout(), practice: game.practice(), world: game.world(), run: game.runState() }; });
  expect(info.loadout.weapons[0]).toMatchObject({ weaponId: 'bow', grade: 'B', element: 'wind' }); expect(info.loadout.weapons[1]).toBeNull();
  expect(info.loadout.abilities[0]).toMatchObject({ id: 'arrow_rain', level: 2 }); expect(info.loadout.abilities[1]).toBeNull();
  expect(info.world.flask).toMatchObject({ charges: 2, maxCharges: 2 }); expect(info.run.dragon).toMatchObject({ present: true, stage: 2, color: 'red' });
  expect(info.practice.setup.levelId).toBe('mountains');
  await page.screenshot({ path: 'test-results/m10-practice-stage2.png' });
  // The pause menu has the practice items.
  await page.evaluate(() => (window as any).__game.openPause()); await frames(page);
  await page.screenshot({ path: 'test-results/m10-practice-pause.png' });
  expect(errors).toEqual([]);
});

test('practice boss clear: result screen, best saved, and the ghost replays the best on the next try', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await seedSave(page, save({ lastKit: { cls: 'swordsman', weapon: 'greatsword' } }));
  await title(page); await openPractice(page);
  await act(page, 'down', 'down', 'down', 'confirm');                          // Start with the default setup
  await stageReady(page, 'plains');
  await page.evaluate(() => (window as any).__game.step(90, { moveX: 1 }));    // run a bit so the ghost has something to show
  await killBoss(page);
  await frames(page);
  const first = await page.evaluate(() => (window as any).__game.practice());
  expect(first.clear).toMatchObject({ isNew: true }); expect(first.ghost.recorded).toBeGreaterThan(10);
  const ticks = first.clear.ticks;
  expect(await page.evaluate(() => (window as any).__game.save().practiceBests['plains|swordsman'])).toBe(ticks);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('rushblade.ghosts')!).ghosts['plains|swordsman'].ticks)).toBe(ticks);
  expect(await page.evaluate(() => (window as any).__game.save().pbs)).toEqual({});     // practice writes no records
  await page.waitForFunction(() => (window as any).__game.practice().resultOpen);
  await frames(page); await page.screenshot({ path: 'test-results/m10-practice-result.png' });
  await page.waitForFunction(() => (window as any).__game.screenState().model.canConfirm);
  await act(page, 'confirm');                                                  // Retry
  await page.evaluate(() => { const game = (window as any).__game; for (let i = 0; i < 200 && game.runState().phase !== 'stage'; i++) game.step(1, {}); });
  await frames(page);
  const retry = await page.evaluate(() => (window as any).__game.practice());
  expect(retry.clear).toBeNull(); expect(retry.ghost.loaded).toBeGreaterThan(10);
  await page.evaluate(() => (window as any).__game.step(20, { moveX: 1 }));
  await frames(page); await frames(page);
  expect(await page.evaluate(() => (window as any).__game.practice().ghost.shown)).toBe(true);
  await page.screenshot({ path: 'test-results/m10-practice-ghost.png' });
  expect(errors).toEqual([]);
});
