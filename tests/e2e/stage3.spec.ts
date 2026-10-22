import { test, expect, type Page } from '@playwright/test';

// Stage 3, the Enemy Kingdom (M9 part 3). Photos land in test-results/m93-*.png.
const frames = (page: Page) => page.evaluate(() => new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
async function shot(page: Page, name: string) {
  await frames(page);
  await page.screenshot({ path: `test-results/m93-${name}.png` });
}

/** Stop the new scene as soon as it exists, then finish its real fade with the remaining ticks. */
async function arrive(page: Page, id: string) {
  await page.waitForFunction(target => {
    const g = (window as any).__game;
    if (!g?.ready || g.levelId?.() !== target) return false;
    g.setManual(true); return true;
  }, id);
  await page.evaluate(() => {
    const g = (window as any).__game, t = g.runState().transition;
    if (t?.part === 'in') g.step(t.left, {});
  });
}
const open = async (page: Page, query = '') => { await page.goto(`/?debug=1&start=kingdom&seed=M93&kit=swordsman:greatsword${query}`); await arrive(page, 'kingdom'); };

test('kingdom: boots and shows all eight authored sections', async ({ page }) => {
  test.slow();   // 16 software-rendered screenshots
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  for (let index = 1; index <= 8; index++) {
    await page.goto(`/?debug=1&start=kingdom&section=${index}&seed=M93VIEW&kit=swordsman:greatsword`);
    await arrive(page, 'kingdom');
    expect(await page.evaluate(() => (window as any).__game.levelId())).toBe('kingdom');
    expect(await page.evaluate(() => (window as any).__game.runState().stage)).toBe(3);
    await page.evaluate(() => (window as any).__game.step(1, {}));
    const onScreen = await page.evaluate(() => {
      const g = (window as any).__game, b = g.body(), c = g.camera(), y = b.y - b.h / 2;
      return b.x >= c.x && b.x <= c.x + 640 && y >= c.y && y <= c.y + 360;
    });
    expect(onScreen, `section ${index} shows its own player position`).toBe(true);
    await shot(page, `section-${index}-play`);
    await page.evaluate(n => (window as any).__game.overview(n), index);
    await shot(page, `section-${index}-overview`);
  }
  expect(errors).toEqual([]);
});

for (const enemy of ['soldier', 'crossbowman', 'war_hound', 'battle_mage', 'knight'] as const) {
  test(`kingdom: ${enemy} spawns, is awake near the player and is drawn (art or grey body)`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await open(page);
    const target = await page.evaluate(id => {
      const g = (window as any).__game, en = g.world().enemies.find((x: any) => x.def === id);
      if (!en) return null;
      g.teleport(en.x - 70, en.y); g.step(3, {});
      return { id: en.id, x: en.x, y: en.y, maxHp: en.maxHp };
    }, enemy);
    expect(target, `${enemy} exists in the kingdom level`).not.toBeNull();
    const expectedHp = { soldier: 86, crossbowman: 57, war_hound: 53, battle_mage: 67, knight: 304 }[enemy];   // base HP x 1.9 (Stage 3)
    expect(target!.maxHp).toBe(expectedHp);
    await page.evaluate(() => (window as any).__game.step(60, {}));
    const state = await page.evaluate(({ id }) => {
      const g = (window as any).__game, en = g.world().enemies.find((x: any) => x.id === id), c = g.camera();
      return { draw: g.enemyDraw(id), onScreen: en.x >= c.x && en.x <= c.x + 640 && en.y >= c.y && en.y <= c.y + 360, dead: en.dead };
    }, target!);
    expect(['sprite', 'box']).toContain(state.draw);
    expect(state.onScreen).toBe(true);
    expect(state.dead).toBe(false);
    await shot(page, `enemy-${enemy}`);
    expect(errors).toEqual([]);
  });
}

test('kingdom: cannons telegraph, fire along the street and are drawn', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await open(page);
  await page.evaluate(() => { const g = (window as any).__game; g.teleport(158 * 16, 71 * 16); g.step(60, {}); });
  await shot(page, 'cannon-waiting');
  let balls = 0;
  for (let n = 0; n < 60 && balls === 0; n++) {
    await page.evaluate(() => { const g = (window as any).__game; g.setHp(9999); g.step(5, {}); });
    balls = await page.evaluate(() => (window as any).__game.world().cannonBalls);
  }
  expect(balls).toBeGreaterThan(0);
  await shot(page, 'cannon-ball');
  expect(errors).toEqual([]);
});

test('kingdom: the Black Knight fight starts when the gate courtyard locks', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await open(page);
  const arena = await page.evaluate(() => (window as any).__game.arenas().find((a: any) => a.kind === 'boss').rect);
  expect(arena.w).toBe(640); expect(arena.h).toBe(256);
  const before = await page.evaluate(() => (window as any).__game.world().enemies.find((e: any) => e.def === 'black_knight'));
  expect(before.maxHp).toBe(3120);
  await page.evaluate(a => { const g = (window as any).__game; g.setHp(9999); g.teleport(a.x + 120, a.y + a.h); g.step(30, {}); }, arena);
  await shot(page, 'black-knight-intro');
  let attack: string | null = null;
  for (let n = 0; n < 120 && !attack; n++) {
    attack = await page.evaluate(() => {
      const g = (window as any).__game; g.setHp(9999); g.step(10, {});
      return g.world().enemies.find((e: any) => e.def === 'black_knight').attack;
    });
  }
  expect(attack, 'the Black Knight starts an attack after its intro').not.toBeNull();
  await shot(page, 'black-knight-attack');
  const knight = await page.evaluate(() => (window as any).__game.world().enemies.find((e: any) => e.def === 'black_knight'));
  expect(knight.dead).toBe(false);
  expect(await page.evaluate(() => (window as any).__game.enemyDraw((window as any).__game.world().enemies.find((e: any) => e.def === 'black_knight').id))).not.toBeNull();
  // killing it ends the fight (split 3 and the stat pick are checked in the full-run test, which has the earlier splits)
  await page.evaluate(() => { const g = (window as any).__game; g.killAll(); g.step(10, {}); });
  expect(await page.evaluate(() => (window as any).__game.world().enemies.find((e: any) => e.def === 'black_knight').dead)).toBe(true);
  await shot(page, 'black-knight-defeated');
  expect(errors).toEqual([]);
});

test('kingdom: the combat arena, rooftops, Dragon room and timed door are photographed', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await open(page);
  // Real camera views (feet row of each spot): the rooftop, the empty Dragon room, the sealed timed-door cellar, the combat arena.
  const spots: [string, number, number][] = [['rooftops', 300, 47], ['balconies', 280, 59], ['dragon-room', 490, 62], ['barbican-tunnel', 497, 71], ['timed-door', 598, 80], ['palace-yard', 388, 71], ['side-cellar', 352, 80]];
  for (const [name, tx, ty] of spots) {
    await page.evaluate(({ tx, ty }) => { const g = (window as any).__game; g.setHp(9999); g.teleport(tx * 16 + 8, (ty + 1) * 16); g.step(40, {}); }, { tx, ty });
    await shot(page, `place-${name}`);
  }
  const standing = await page.evaluate(() => (window as any).__game.body());
  expect(standing.state).toBe('ground');
  expect(errors).toEqual([]);
});
