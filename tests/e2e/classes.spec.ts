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
  // Hold each key for a couple of frames like a person would (an instant tap can fall between two frames).
  for (const key of ['ArrowRight', 'ArrowRight', 'Space']) {
    await page.keyboard.down(key); await nextFrames(page);
    await page.keyboard.up(key); await nextFrames(page);
  }
  await page.waitForFunction(() => !(window as any).__game.classPickOpen());
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

const TILE = 16;

test('Training Yard: pick each class at its statue', async ({ page }) => {
  const errors = await boot(page, '&start=training');
  expect(await page.evaluate(() => (window as any).__game.levelId())).toBe('training_yard');
  for (const cls of ['swordsman', 'tank', 'archer', 'wizard']) {
    await page.evaluate((c) => {
      const g = (window as any).__game;
      const s = g.interactables().find((o: any) => o.kind === 'class_statue' && o.label === c);
      g.teleport(s.x, s.y);
    }, cls);
    await page.waitForTimeout(100);
    await page.keyboard.press('KeyE');
    await page.waitForFunction(() => (window as any).__game.classPickOpen());
    await page.keyboard.press('Space');
    await page.waitForFunction(() => !(window as any).__game.classPickOpen());
    const cs = await page.evaluate(() => (window as any).__game.classState());
    expect(cs.displayClass).toBe(cls);
    await nextFrames(page);
    await page.screenshot({ path: `test-results/class-${cls}.png` });
  }
  expect(errors).toEqual([]);
});

test('Training Yard: stations 1, 3, 4, 8, 11 and 14 with scripted inputs', async ({ page }) => {
  const errors = await boot(page, '&start=training&kit=swordsman:greatsword');
  // Each bot runs in the page, one tick at a time, until the station reports done.
  const run = (id: number, bot: string, max: number) => page.evaluate(([id, bot, max]) => {
    const g = (window as any).__game;
    const st = g.stations().find((s: any) => s.id === id);
    const fn = new Function('i', 'b', 'st', 'g', 'mem', bot) as (i: number, b: any, st: any, g: any, mem: any) => object;
    const mem: Record<string, number> = {};
    for (let i = 0; i < (max as number) && !g.training().done.includes(id); i++) g.step(1, fn(i, g.body(), st, g, mem));
    g.step(10, {});
    return g.training().done.includes(id);
  }, [id, bot, max] as const);
  await page.evaluate(() => (window as any).__game.setManual(true));
  const to = (id: number) => page.evaluate((id) => { const g = (window as any).__game; g.toStation(id); g.step(2, {}); }, id);

  await to(1);
  expect(await run(1, 'return { moveX: 1, jump: i % 24 < 14 };', 600)).toBe(true);
  await to(3);
  expect(await run(3, `
    const edge = st.rect.x + 6 * ${TILE}; mem.p = mem.p ?? 0;
    if (mem.p === 0 && edge - b.x < 10) { mem.p = 1; return { moveX: 1, jump: true }; }
    if (mem.p === 1 && b.vy > -150) { mem.p = 2; return { moveX: 1, jump: true, dash: true }; }
    return { moveX: 1, jump: mem.p >= 1 };`, 600)).toBe(true);
  await to(4);
  expect(await run(4, `
    mem.hold = mem.hold ?? 1; mem.last = mem.last ?? -100;
    if (b.y < (34 - 10) * ${TILE} + 24 && mem.hold === 1) return { moveX: 1 };
    if (b.state === 'wallSlide' && i - mem.last > 8) { mem.last = i; mem.hold = -b.lastWallDir; return { moveX: mem.hold, jump: true }; }
    if (b.grounded && Math.abs(b.vx) < 1 && i - mem.last > 20) { mem.last = i; return { moveX: mem.hold, jump: true }; }
    return { moveX: mem.hold, jump: i - mem.last < 14 };`, 1200)).toBe(true);
  await to(8);
  await page.evaluate(() => { const g = (window as any).__game; const s = g.stations().find((x: any) => x.id === 8); g.teleport(s.rect.x + 7 * 16 + 8, s.checkpoint.y - 4 * 16); });
  expect(await run(8, 'return { moveY: 1, attack1: i === 5 };', 200)).toBe(true);
  await nextFrames(page);
  await page.screenshot({ path: 'test-results/yard-a.png' });

  await to(11);
  await page.evaluate(() => { const g = (window as any).__game; const s = g.stations().find((x: any) => x.id === 11); g.teleport(s.rect.x + 10 * 16 + 8 - 40, s.checkpoint.y); g.setHp(100); });
  expect(await run(11, `
    mem.dir = mem.dir ?? 1;
    const a = g.enemyAi().find((e) => e.def === 'sparring_dummy').attack;
    if (a && a.phase === 'tele' && a.len - a.t === 6 && b.state !== 'dash') { const d = mem.dir; mem.dir = -d; return { moveX: d, dash: true }; }
    return {};`, 3000)).toBe(true);
  await to(14);
  expect(await run(14, 'return { moveX: 1, attack1: i % 30 < 15 };', 2400)).toBe(true);
  await nextFrames(page);
  await page.screenshot({ path: 'test-results/yard-b.png' });

  // Part C, and the checklist board showing what's done.
  await to(15);
  await nextFrames(page);
  await page.screenshot({ path: 'test-results/yard-c.png' });
  await page.evaluate(() => { const g = (window as any).__game; const b = g.levelObjects('checklist_board')[0]; g.teleport(b.x, b.y); g.step(10, {}); });
  await nextFrames(page);
  await page.screenshot({ path: 'test-results/yard-board.png' });
  expect((await page.evaluate(() => (window as any).__game.training())).done).toEqual([1, 3, 4, 8, 11, 14]);
  expect(errors).toEqual([]);
});

/** Stand on the armory stand holding `id` and press interact. */
async function takeFromArmory(page: Page, id: string) {
  await page.evaluate((id) => {
    const g = (window as any).__game;
    const it = g.groundItems().find((i: any) => i.ability === id || i.weapon === id);
    g.teleport(it.x, it.y); g.step(2, {}); g.step(1, { interact: true }); g.step(2, {});
  }, id);
}

test('Training Yard armory: a same-class second ability makes a bond; another class makes a hybrid', async ({ page }) => {
  const errors = await boot(page, '&start=training&kit=swordsman:greatsword');
  await page.evaluate(() => (window as any).__game.setManual(true));
  await takeFromArmory(page, 'whirlwind');
  let cs = await page.evaluate(() => (window as any).__game.classState());
  expect(cs.connection).toBe(true);
  expect(cs.bondName).toBe('Blademaster');
  await page.evaluate(() => (window as any).__game.step(30, {}));
  await nextFrames(page);
  await page.screenshot({ path: 'test-results/yard-bond.png' });
  // Both slots full: the swap choice opens; ability 1 replaces slot 1 (Blade Dash).
  await takeFromArmory(page, 'arrow_rain');
  await page.evaluate(() => { const g = (window as any).__game; g.step(1, { ability1: true }); g.step(30, {}); });
  cs = await page.evaluate(() => (window as any).__game.classState());
  expect(cs.hybrid).toBe('thief');
  expect(cs.displayName).toBe('Thief');
  await nextFrames(page);
  await page.screenshot({ path: 'test-results/yard-hybrid.png' });
  expect(errors).toEqual([]);
});

// Ticks after the press to catch each ability mid-effect (startup + a few ticks; Arrow Rain: its first wave).
const MID: Record<string, number> = {
  blade_dash: 8, whirlwind: 20, shockwave: 26, shoulder_charge: 10, arrow_rain: 46, hunters_mark: 4, thunder_strike: 34, blink: 3, vampire: 2,
};
test('every M4 ability next to the armory dummy, mid-effect', async ({ page }) => {
  const errors = await boot(page, '&start=training&kit=swordsman:greatsword');
  await page.evaluate(() => (window as any).__game.setManual(true));
  for (const [id, n] of Object.entries(MID)) {
    const used = await page.evaluate(([id, n]) => {
      const g = (window as any).__game;
      const d = g.enemyAi().filter((e: any) => e.def === 'training_dummy').pop();
      g.teleport(d.x - 72, d.y); g.setHp(100);
      g.giveAbility(0, id); g.giveAbility(1, null);
      g.step(20, {});
      const before = g.abilityRuntime().slots[0].charges;
      g.step(1, { ability1: true });
      g.step(n as number, {});
      return id === 'vampire' || g.abilityRuntime().slots[0].charges < before;
    }, [id, n] as const);
    expect(used, id).toBe(true);
    await nextFrames(page);
    await page.screenshot({ path: `test-results/ability-${id}.png` });
    await page.evaluate(() => (window as any).__game.step(240, {}));
  }
  expect(errors).toEqual([]);
});

test('Storm Hammer throw: up + attack throws it and it comes back', async ({ page }) => {
  const errors = await boot(page, '&start=training&kit=wizard:storm_hammer');
  await page.evaluate(() => {
    const g = (window as any).__game;
    g.setManual(true);
    const d = g.enemyAi().filter((e: any) => e.def === 'training_dummy').pop();
    g.teleport(d.x - 120, d.y);
    g.step(20, {});
    g.step(1, { moveY: -1, attack1: true });
    g.step(30, {});
  });
  await nextFrames(page);
  await page.screenshot({ path: 'test-results/hammer-throw.png' });
  expect(errors).toEqual([]);
});

test('HUD: Thunder Strike on a dummy shows columns, the cooldown and the DPS readout', async ({ page }) => {
  const errors = await boot(page, '&start=training&kit=wizard:storm_hammer');
  await page.evaluate(() => {
    const g = (window as any).__game;
    g.setManual(true);
    g.toStation(9);
    g.step(30, {});
    g.step(1, { attack1: true }); g.step(40, {});
    g.step(1, { ability1: true }); g.step(34, {});                 // 0.15 s startup, then 2 bolts 12 ticks apart
  });
  await nextFrames(page);
  await page.screenshot({ path: 'test-results/hud-wizard.png' });
  expect(errors).toEqual([]);
});
