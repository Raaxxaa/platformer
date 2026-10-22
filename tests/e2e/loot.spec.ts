import { test, expect, type Page } from '@playwright/test';

// M5: chests, Lucky Blocks, graded weapons and their cards, the merchant, the cursed one-hit rule, the boss drop.
async function boot(page: Page, query = '&start=plains&layout=classic&kit=swordsman:greatsword') {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`/?debug=1&seed=LOOT${query}`);
  await page.waitForFunction(() => (window as any).__game?.ready === true);
  await page.evaluate(() => { const g = (window as any).__game; g.setManual(true); g.step(2, {}); });
  return errors;
}
const frames = (page: Page) => page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
const shot = async (page: Page, name: string) => { await frames(page); await page.screenshot({ path: `test-results/${name}.png` }); };

/** Stand at an object's spot, press interact. */
async function openAt(page: Page, type: string, index = 0) {
  return page.evaluate(([type, index]) => {
    const g = (window as any).__game;
    const o = g.levelObjects(type)[index];
    g.teleport(o.x - 4, o.y - 2);
    g.step(20, {});
    g.step(1, { interact: true });
    g.step(30, {});
    return g.loot();
  }, [type, index] as const);
}

test('a key chest: locked without a key, opens with one into 1 of 2 weapons', async ({ page }) => {
  const errors = await boot(page);
  let l = await openAt(page, 'key_chest', 0);
  expect(l.chests.filter((c: any) => c.opened).length).toBe(0);
  await shot(page, 'loot-chest-locked');
  await page.evaluate(() => (window as any).__game.setKeys(1));
  l = await openAt(page, 'key_chest', 0);
  expect(l.chests.filter((c: any) => c.opened).length).toBe(1);
  expect(l.econ.keys).toBe(0);
  expect(l.gold).toBe(40);
  await shot(page, 'loot-key-chest');
  expect(errors).toEqual([]);
});

test('the cursed chest: 100 gold, a weapon, and one hit kills you', async ({ page }) => {
  const errors = await boot(page);
  const l = await openAt(page, 'cursed_chest');
  expect(l.gold).toBe(100);
  expect(l.econ.curse).toEqual({ id: 'one_hit', killsLeft: 10 });
  await page.evaluate(() => (window as any).__game.step(20, {}));
  await shot(page, 'loot-cursed-chest');
  const dead = await page.evaluate(() => {
    const g = (window as any).__game, b = g.body();
    g.setHp(9999);
    g.spawn('bandit', b.x + 30, b.y);
    for (let i = 0; i < 900 && !g.world().dead; i++) g.step(1, {});
    return g.world().dead;
  });
  expect(dead).toBe(true);
  expect(errors).toEqual([]);
});

test('the timed chest gives 80 gold', async ({ page }) => {
  const errors = await boot(page);
  const l = await openAt(page, 'timed_chest');
  expect(l.gold).toBe(80);
  await shot(page, 'loot-timed-chest');
  expect(errors).toEqual([]);
});

test('a Lucky Block breaks on a weapon hit; forced buff and debuff show banners and the effects row', async ({ page }) => {
  const errors = await boot(page);
  const broke = await page.evaluate(() => {
    const g = (window as any).__game;
    const o = g.levelObjects('lucky_block')[0];
    g.teleport(o.x - 20, o.y + 16);
    g.step(10, {});
    for (let i = 0; i < 120 && !g.loot().lucky.find((x: any) => x.broken); i++) g.step(1, { attack1: i % 30 === 0 });
    return !!g.loot().lucky.find((x: any) => x.broken);
  });
  expect(broke).toBe(true);
  await page.evaluate(() => { const g = (window as any).__game; g.forceLucky('swift'); g.step(12, {}); });
  await shot(page, 'loot-lucky-buff');
  await page.evaluate(() => { const g = (window as any).__game; g.forceLucky('jammed'); g.forceLucky('heavy'); g.step(12, {}); });
  const l = await page.evaluate(() => (window as any).__game.loot());
  expect(l.econ.buffs).toContain('swift');
  expect(l.econ.debuffs.map((d: any) => d.id)).toEqual(['jammed', 'heavy']);
  await shot(page, 'loot-lucky-debuff');
  expect(errors).toEqual([]);
});

test('the item card for each grade', async ({ page }) => {
  const errors = await boot(page, '&start=plains&kit=swordsman:greatsword');
  const sets: [string, string, string | null, string | null][] = [
    ['katana', 'F', null, null], ['bow', 'C', null, null], ['war_maul', 'B', 'ice', null], ['crossbow', 'A', 'poison', 'keen'], ['greatsword', 'S', 'fire', 'brutal'],
  ];
  for (const [i, [id, grade, el, perk]] of sets.entries()) {
    await page.evaluate(([id, grade, el, perk, i]) => {
      const g = (window as any).__game;
      g.teleport(600 + 160 * (i as number), g.body().y);
      g.step(5, {});
      const iid = g.dropWeapon(id, grade, el, perk);
      g.step(40, {});
      const it = g.loot().items.find((i: any) => i.id === iid);
      g.teleport(it.x, it.y);
      g.step(10, {});
    }, [id, grade, el, perk, i] as const);
    expect(await page.evaluate(() => (window as any).__game.cardOpen())).toBe(true);
    await shot(page, `loot-card-${grade}`);
    // Take it, so the next one is alone on the ground.
    await page.evaluate(() => { const g = (window as any).__game; g.step(1, { interact: true }); g.step(1, { attack2: true }); g.step(5, {}); });
  }
  expect(errors).toEqual([]);
});

test('the merchant: forced, priced stock, a purchase takes the gold', async ({ page }) => {
  const errors = await boot(page);
  const m = await page.evaluate(() => {
    const g = (window as any).__game;
    g.forceMerchant();
    g.setGold(500);
    const l = g.loot();
    const it = l.items.filter((i: any) => i.price !== undefined).sort((a: any, b: any) => a.x - b.x)[0];
    g.teleport(it.x, it.y - 2);
    g.step(20, {});
    return { present: l.merchant.present, price: it.price, count: l.items.filter((i: any) => i.price !== undefined).length };
  });
  expect(m.present).toBe(true);
  expect(m.count).toBe(3);
  await shot(page, 'loot-merchant');
  const after = await page.evaluate(() => {
    const g = (window as any).__game;
    g.step(1, { interact: true }); g.step(2, {});
    if (g.loot().gold === 500) { g.step(1, { attack2: true }); g.step(2, {}); }
    g.step(20, {});
    return g.loot();
  });
  expect(after.gold).toBe(500 - m.price);
  expect(after.merchant.sold.filter(Boolean).length).toBe(1);
  await shot(page, 'loot-merchant-sold');
  expect(errors).toEqual([]);
});

test('the Great Boar drops a weapon where it dies', async ({ page }) => {
  const errors = await boot(page, '&start=plains&section=8&kit=swordsman:greatsword');
  const res = await page.evaluate(() => {
    const g = (window as any).__game;
    for (let i = 0; i < 1200 && !g.runState().arenas.boss1.locked; i++) g.step(1, { moveX: 1 });
    g.setHp(9999);
    g.step(130, {});
    g.setBossHp(1);
    const boss = g.world().enemies.find((e: any) => e.def === 'great_boar');
    g.teleport(boss.x - 44, boss.y);
    for (let i = 0; i < 300 && g.runState().splits[0] === null; i++) g.step(1, { attack1: i % 20 === 0 });
    g.step(60, {});
    return g.loot().items.filter((i: any) => i.weapon && !i.price).length;
  });
  expect(res).toBeGreaterThanOrEqual(1);
  await shot(page, 'loot-boss-drop');
  expect(errors).toEqual([]);
});

test('element effects: an S ice weapon freezes and burns show on enemies', async ({ page }) => {
  const errors = await boot(page);
  const r = await page.evaluate(() => {
    const g = (window as any).__game;
    g.teleport(600, g.body().y); g.step(5, {});
    const iid = g.dropWeapon('greatsword', 'S', 'ice');
    g.step(30, {});
    const it = g.loot().items.find((i: any) => i.id === iid);
    g.teleport(it.x, it.y); g.step(5, {});
    g.step(1, { interact: true }); g.step(5, {});
    const b = g.body();
    g.spawn('bandit_brute', b.x + 36, b.y, -1);
    g.setHp(9999);
    let frozen = false;
    for (let i = 0; i < 400 && !frozen; i++) { g.step(1, { attack2: i % 30 === 0 }); frozen = g.enemyStatus().some((s: any) => s.frozen); }
    return frozen;
  });
  expect(r).toBe(true);
  await shot(page, 'loot-freeze');
  expect(errors).toEqual([]);
});

test('the Training Yard loot corner: a Lucky Block, a key and a key chest with signs', async ({ page }) => {
  const errors = await boot(page, '&start=training&kit=swordsman:greatsword');
  const r = await page.evaluate(() => {
    const g = (window as any).__game;
    const key = g.levelObjects('key')[0], chest = g.levelObjects('key_chest')[0];
    g.teleport(key.x - 40, key.y - 2); g.step(10, {});
    const before = g.loot();
    g.teleport(key.x, key.y - 2); g.step(10, {});
    const keys = g.loot().econ.keys;
    g.teleport(chest.x - 4, chest.y - 2); g.step(10, {});
    g.step(1, { interact: true }); g.step(40, {});
    return { lucky: before.lucky.length, keys, opened: g.loot().chests.filter((c: any) => c.opened).length };
  });
  expect(r).toEqual({ lucky: 1, keys: 1, opened: 1 });
  await page.evaluate(() => { const g = (window as any).__game; g.teleport(g.body().x - 120, g.body().y); g.step(10, {}); });
  await shot(page, 'loot-yard-corner');
  expect(errors).toEqual([]);
});
