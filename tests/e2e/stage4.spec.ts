import { test, expect, type Page } from '@playwright/test';

// Stage 4 King's Castle, the Enemy King and the Dragon (M9 part 4). Photos land in test-results/m94-*.png.
const frames = (page: Page) => page.evaluate(() => new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
async function shot(page: Page, name: string) {
  await frames(page);
  await page.screenshot({ path: `test-results/m94-${name}.png` });
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
const open = async (page: Page, query = '') => { await page.goto(`/?debug=1&start=castle&seed=M94&kit=swordsman:greatsword${query}`); await arrive(page, 'castle'); };
const openDragon = async (page: Page, level: string, color: string) => {
  await page.goto(`/?debug=1&start=${level}&seed=M94D&kit=swordsman:greatsword&dragon=${color}`);
  await arrive(page, level);
};

test('castle: boots and shows all eight authored sections', async ({ page }) => {
  test.slow();   // 16 software-rendered screenshots
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  for (let index = 1; index <= 8; index++) {
    await page.goto(`/?debug=1&start=castle&section=${index}&seed=M94VIEW&kit=swordsman:greatsword`);
    await arrive(page, 'castle');
    expect(await page.evaluate(() => (window as any).__game.levelId())).toBe('castle');
    expect(await page.evaluate(() => (window as any).__game.runState().stage)).toBe(4);
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

for (const enemy of ['royal_guard', 'gargoyle', 'castle_mage', 'living_armor', 'royal_executioner'] as const) {
  test(`castle: ${enemy} spawns, stands in the level and is drawn (art or grey body)`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await open(page);
    const target = await page.evaluate(id => {
      const g = (window as any).__game, en = g.world().enemies.find((x: any) => x.def === id);
      if (!en) return null;
      g.setHp(9999); g.teleport(en.x - 70, en.y); g.step(3, {});
      return { id: en.id, x: en.x, y: en.y, maxHp: en.maxHp };
    }, enemy);
    expect(target, `${enemy} exists in the castle level`).not.toBeNull();
    const expectedHp = { royal_guard: 120, gargoyle: 96, castle_mage: 84, living_armor: 108, royal_executioner: 408 }[enemy];   // base HP x 2.4 (Stage 4)
    expect(target!.maxHp).toBe(expectedHp);
    await page.evaluate(() => { const g = (window as any).__game; g.setHp(9999); g.step(40, {}); });
    const state = await page.evaluate(({ id }) => {
      const g = (window as any).__game, en = g.world().enemies.find((x: any) => x.id === id), c = g.camera();
      return { draw: g.enemyDraw(id), onScreen: en.x >= c.x - 20 && en.x <= c.x + 660 && en.y >= c.y && en.y <= c.y + 360, dead: en.dead };
    }, target!);
    expect(['sprite', 'box']).toContain(state.draw);
    expect(state.onScreen).toBe(true);
    expect(state.dead).toBe(false);
    await shot(page, `enemy-${enemy}`);
    expect(errors).toEqual([]);
  });
}

test('castle: a Gargoyle sleeps in stone, wakes when approached and a Living Armor collapses and rises', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await open(page);
  const id = await page.evaluate(() => {
    const g = (window as any).__game, en = g.world().enemies.find((x: any) => x.def === 'gargoyle');
    g.setHp(9999); g.teleport(en.x - 300, en.y); g.step(10, {});
    return en.id;
  });
  const asleep = await page.evaluate(i => (window as any).__game.world().enemies.find((e: any) => e.id === i).aware, id);
  expect(asleep).toBe(false);
  await page.evaluate(i => { const g = (window as any).__game, en = g.world().enemies.find((e: any) => e.id === i); g.teleport(en.x - 60, en.y); g.step(5, {}); }, id);
  expect(await page.evaluate(i => (window as any).__game.world().enemies.find((e: any) => e.id === i).aware, id)).toBe(true);
  await shot(page, 'gargoyle-awake');
  const armor = await page.evaluate(() => {
    const g = (window as any).__game, en = g.world().enemies.find((x: any) => x.def === 'living_armor');
    g.setHp(9999); g.teleport(en.x - 70, en.y); g.step(3, {}); g.setEnemyHp(en.id, 0);
    return en.id;
  });
  await page.evaluate(() => (window as any).__game.step(30, {}));
  const pile = await page.evaluate(i => { const e = (window as any).__game.world().enemies.find((x: any) => x.id === i); return { dead: e.dead, hp: e.hp }; }, armor);
  expect(pile).toEqual({ dead: false, hp: 0 });
  await shot(page, 'living-armor-pile');
  await page.evaluate(() => (window as any).__game.step(260, {}));
  const risen = await page.evaluate(i => { const e = (window as any).__game.world().enemies.find((x: any) => x.id === i); return { dead: e.dead, hp: e.hp, max: e.maxHp }; }, armor);
  expect(risen.dead).toBe(false); expect(risen.hp).toBeGreaterThan(risen.max * 0.4);
  expect(errors).toEqual([]);
});

test('castle: the Enemy King fight starts when the throne room locks, and killing the King shows the victory screen', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await open(page);
  const arena = await page.evaluate(() => (window as any).__game.arenas().find((a: any) => a.kind === 'boss').rect);
  expect(arena.w).toBe(640); expect(arena.h).toBe(304);
  const before = await page.evaluate(() => (window as any).__game.world().enemies.find((e: any) => e.def === 'enemy_king'));
  expect(before.maxHp).toBe(3960);
  await page.evaluate(a => { const g = (window as any).__game; g.setHp(9999); g.teleport(a.x + 120, a.y + a.h); g.step(30, {}); }, arena);
  await shot(page, 'king-intro');
  let attack: string | null = null;
  for (let n = 0; n < 120 && !attack; n++) {
    attack = await page.evaluate(() => {
      const g = (window as any).__game; g.setHp(9999); g.step(10, {});
      return g.world().enemies.find((e: any) => e.def === 'enemy_king').attack;
    });
  }
  expect(attack, 'the King starts an attack after his intro').not.toBeNull();
  await shot(page, 'king-attack');
  // Phase 2: the Royal Decree brings two Royal Guards.
  await page.evaluate(() => { const g = (window as any).__game; g.setBossHp(Math.floor(3960 * 0.6)); g.step(1, {}); });
  await page.evaluate(() => { const g = (window as any).__game; for (let n = 0; n < 40; n++) { g.setHp(9999); g.step(10, {}); } });
  const guards = await page.evaluate(() => (window as any).__game.world().enemies.filter((e: any) => e.def === 'royal_guard' && !e.dead).length);
  expect(guards).toBeGreaterThanOrEqual(2);
  await shot(page, 'king-decree');
  // Phase 3: Blade Rain and the Throne Beam show their marks.
  await page.evaluate(() => { const g = (window as any).__game; g.setBossHp(Math.floor(3960 * 0.3)); g.step(1, {}); });
  const seen = new Set<string>();
  for (let n = 0; n < 400 && !(seen.has('blade_rain') && seen.has('throne_beam')); n++) {
    const a = await page.evaluate(() => { const g = (window as any).__game; g.setHp(9999); g.step(6, {}); return g.world().enemies.find((e: any) => e.def === 'enemy_king').attack; });
    if (a) { const id = String(a).split(':')[0]; if ((id === 'blade_rain' || id === 'throne_beam') && !seen.has(id)) { seen.add(id); await shot(page, `king-${id}`); } }
  }
  expect([...seen].sort()).toEqual(['blade_rain', 'throne_beam']);
  await page.evaluate(() => { const g = (window as any).__game; g.killAll(); g.step(5, {}); });
  expect(await page.evaluate(() => (window as any).__game.runState().phase)).toBe('runComplete');
  expect(await page.evaluate(() => (window as any).__game.world().enemies.find((e: any) => e.def === 'enemy_king').dead)).toBe(true);
  await page.waitForFunction(() => (window as any).__game.victory?.() !== null, undefined, { timeout: 10000 });
  const victory = await page.evaluate(() => (window as any).__game.victory());
  expect(victory.lines[0]).toMatch(/^Time /);
  await shot(page, 'victory');
  expect(errors).toEqual([]);
});

test('castle: spikes, bridges, blades, towers, the cannon gallery and the throne room are photographed', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await open(page);
  const spots: [string, number, number][] = [['bridges', 150, 109], ['blades', 178, 109], ['tower-shaft', 190, 109], ['rampart', 200, 95], ['spike-field', 280, 109], ['cannon-gallery', 440, 109],
    ['tower-two', 480, 109], ['guard-hall', 356, 109], ['throne-room', 600, 109]];
  for (const [name, tx, ty] of spots) {
    await page.evaluate(({ tx, ty }) => { const g = (window as any).__game; g.setHp(9999); g.teleport(tx * 16 + 8, (ty + 1) * 16); g.step(40, {}); }, { tx, ty });
    await shot(page, `place-${name}`);
  }
  expect(errors).toEqual([]);
});

for (const color of ['red', 'white', 'storm', 'green'] as const) {
  test(`dragon: the ${color} Dragon is perched in the Kingdom side room, wakes and fights`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await openDragon(page, 'kingdom', color);
    expect(await page.evaluate(() => (window as any).__game.runState().dragon)).toMatchObject({ present: true, stage: 3, color });
    const side = await page.evaluate(() => (window as any).__game.arenas().find((a: any) => a.kind === 'side').rect);
    const perched = await page.evaluate(() => (window as any).__game.world().enemies.find((e: any) => e.def === 'dragon'));
    expect(perched.maxHp).toBe(2600);
    expect(perched.x).toBe(side.x + side.w / 2);
    await page.evaluate(a => { const g = (window as any).__game; g.setHp(9999); g.teleport(a.x + 120, a.y + a.h); g.step(2, {}); }, side);
    await shot(page, `dragon-${color}-wakes`);
    expect(await page.evaluate(() => (window as any).__game.bossBar()?.name)).toBe(`${color[0].toUpperCase()}${color.slice(1)} Dragon`);
    let attack: string | null = null;
    for (let n = 0; n < 200 && !attack; n++) {
      attack = await page.evaluate(a => { const g = (window as any).__game; g.setHp(9999); g.teleport(a.x + 120, a.y + a.h); g.step(8, {}); return g.world().enemies.find((e: any) => e.def === 'dragon').attack; }, side);
    }
    expect(attack, `the ${color} Dragon starts an attack`).not.toBeNull();
    const d = await page.evaluate(() => { const g = (window as any).__game, e = g.world().enemies.find((x: any) => x.def === 'dragon'); return { draw: g.enemyDraw(e.id), aware: e.aware, dead: e.dead }; });
    expect(['sprite', 'box']).toContain(d.draw);
    expect(d.aware).toBe(true);
    await shot(page, `dragon-${color}-attack`);
    await page.evaluate(() => { const g = (window as any).__game; g.killAll(); g.step(5, {}); });
    expect(await page.evaluate(() => (window as any).__game.runState().dragon.outcome)).toBe('killed');
    expect(await page.evaluate(() => (window as any).__game.runState().splits)).toEqual([null, null, null, null]);
    expect(errors).toEqual([]);
  });
}

test('dragon: Stage 2 roads hold the Dragon too (1,700 HP) and the phase 2 air loop is drawn', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await openDragon(page, 'mountains', 'white');
  const side = await page.evaluate(() => (window as any).__game.arenas().find((a: any) => a.kind === 'side').rect);
  expect(await page.evaluate(() => (window as any).__game.world().enemies.find((e: any) => e.def === 'dragon').maxHp)).toBe(1700);
  await page.evaluate(a => { const g = (window as any).__game; g.setHp(9999); g.teleport(a.x + 120, a.y + a.h); g.step(130, {}); g.setEnemyHp(g.world().enemies.find((e: any) => e.def === 'dragon').id, 800); g.step(200, {}); }, side);
  await shot(page, 'dragon-white-air');
  expect(errors).toEqual([]);
});
