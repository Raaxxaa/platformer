// M9 part 2: each of the 11 new weapons is equipped in ?debug=1 combat mode, used on the training dummy, and photographed.
// The weapons have no art yet: the game draws the player pose plus grey-box placeholders (shots, runes, shield, platforms).
import { test, expect, type Page } from '@playwright/test';

async function boot(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1&scene=combat');
  await page.waitForFunction(() => (window as any).__game?.ready === true);
  await page.evaluate(() => (window as any).__game.setManual(true));
  return errors;
}

async function nextFrames(page: Page) {
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
}

/**
 * Equips the weapon, puts a fresh training dummy at x 230 (clear of the weapon HUD in the photo) and stands the player `gap` px
 * left of it (negative: right of it). Returns the dummy's id.
 */
async function prepare(page: Page, weapon: string, gap: number, grade = 'C') {
  return page.evaluate(({ weapon, gap, grade }) => {
    const g = (window as any).__game;
    g.equip(weapon, grade);
    const id = g.spawn('training_dummy', 230, 320, -1);
    g.teleport(230 - gap, 320);
    g.step(2, {});
    return id as number;
  }, { weapon, gap, grade });
}

const dummyDamage = (page: Page, id: number) => page.evaluate((id) => {
  const e = (window as any).__game.world().enemies.find((x: any) => x.id === id);
  return e.maxHp - e.hp;
}, id);

interface Case { weapon: string; gap: number; hold: number; shotAt: number }
// `hold`: ticks the attack button is held; `shotAt`: the tick the photo is taken (while the attack is visible).
const CASES: Case[] = [
  { weapon: 'twin_daggers', gap: 22, hold: 70, shotAt: 8 },
  { weapon: 'spear', gap: 30, hold: 70, shotAt: 12 },
  { weapon: 'scythe', gap: 26, hold: 70, shotAt: 14 },
  { weapon: 'flail', gap: 40, hold: 40, shotAt: 14 },
  { weapon: 'hand_cannon', gap: 70, hold: 60, shotAt: 24 },
  { weapon: 'throwing_knives', gap: 70, hold: 40, shotAt: 8 },
  { weapon: 'wand', gap: 70, hold: 60, shotAt: 10 },
  { weapon: 'javelin', gap: 70, hold: 60, shotAt: 24 },
];

for (const c of CASES) {
  test(`${c.weapon}: equip, attack the dummy, photo`, async ({ page }) => {
    const errors = await boot(page);
    const id = await prepare(page, c.weapon, c.gap);
    let shot = false;
    for (let t = 0; t < c.hold; t++) {
      await page.evaluate((spec) => (window as any).__game.step(1, spec), { attack1: true });
      if (t === c.shotAt && !shot) {
        await nextFrames(page);
        await page.screenshot({ path: `test-results/m9-weapon-${c.weapon}.png` });
        shot = true;
      }
    }
    await page.evaluate(() => (window as any).__game.step(30, {}));
    const w = await page.evaluate(() => (window as any).__game.world());
    expect(w.weapon.id).toBe(c.weapon);
    expect(await dummyDamage(page, id)).toBeGreaterThan(0);
    expect(shot).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('giant_axe: running into a press starts the spin and it hits the dummy', async ({ page }) => {
  const errors = await boot(page);
  const id = await prepare(page, 'giant_axe', -100);                 // 100 px to the right of the dummy, then run left at it
  await page.evaluate(() => (window as any).__game.step(40, { moveX: -1 }));
  await page.evaluate(() => (window as any).__game.step(1, { moveX: -1, attack1: true }));
  expect((await page.evaluate(() => (window as any).__game.world())).weapon.attack).toMatch(/^spin/);
  let shot = false;
  for (let t = 0; t < 130; t++) {
    await page.evaluate(() => (window as any).__game.step(1, { moveX: -1 }));
    if (t === 40) { await nextFrames(page); await page.screenshot({ path: 'test-results/m9-weapon-giant_axe.png' }); shot = true; }
  }
  expect(shot).toBe(true);
  expect(await dummyDamage(page, id)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('spell_tome: the third step casts the rune ring, which hits the dummy', async ({ page }) => {
  const errors = await boot(page);
  const id = await prepare(page, 'spell_tome', 24);
  await page.evaluate(() => (window as any).__game.step(140, { attack1: true }));
  expect((await page.evaluate(() => (window as any).__game.world())).weapon.runes).toBe(1);
  await page.evaluate(() => (window as any).__game.step(20, {}));
  await nextFrames(page);
  await page.screenshot({ path: 'test-results/m9-weapon-spell_tome.png' });
  const before = await dummyDamage(page, id);
  await page.evaluate(() => (window as any).__game.step(100, {}));
  expect(await dummyDamage(page, id)).toBeGreaterThanOrEqual(before);
  expect(before).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('shield: goes up at once, blocks while held, a quick tap bashes the dummy', async ({ page }) => {
  const errors = await boot(page);
  const id = await prepare(page, 'shield', 22);
  await page.evaluate(() => (window as any).__game.step(1, { attack1: true }));
  expect((await page.evaluate(() => (window as any).__game.world())).weapon.shield).toBe('up');
  await page.evaluate(() => (window as any).__game.step(40, { attack1: true }));
  await nextFrames(page);
  await page.screenshot({ path: 'test-results/m9-weapon-shield.png' });
  await page.evaluate(() => (window as any).__game.step(1, {}));
  expect((await page.evaluate(() => (window as any).__game.world())).weapon.shield).toBe('lower');
  await page.evaluate(() => (window as any).__game.step(30, {}));
  expect((await page.evaluate(() => (window as any).__game.world())).weapon.shield).toBeNull();
  expect(await dummyDamage(page, id)).toBe(0);
  await page.evaluate(() => (window as any).__game.step(1, { attack1: true }));
  await page.evaluate(() => (window as any).__game.step(30, {}));
  expect(await dummyDamage(page, id)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('javelin: sticks into a wall as a platform you can see', async ({ page }) => {
  const errors = await boot(page);
  await prepare(page, 'javelin', 90);
  // Throw it left along the floor into the arena's boundary wall.
  const platforms = await page.evaluate(() => {
    const g = (window as any).__game;
    g.teleport(70, 250);                                             // in the air, so the platform is above the HUD in the photo
    g.step(1, {});
    g.step(1, { moveX: -1, attack1: true });
    g.step(60, {});
    return g.world().weapon.platforms;
  });
  expect(platforms).toBe(1);
  await nextFrames(page);
  await page.screenshot({ path: 'test-results/m9-weapon-javelin-platform.png' });
  expect(errors).toEqual([]);
});

test('all 11 new weapons can be equipped in any order without errors', async ({ page }) => {
  const errors = await boot(page);
  const ids = ['twin_daggers', 'spear', 'scythe', 'giant_axe', 'flail', 'shield', 'hand_cannon', 'javelin', 'throwing_knives', 'wand', 'spell_tome'];
  for (const grade of ['C', 'S']) {
    for (const id of ids) {
      await page.evaluate(({ id, grade }) => {
        const g = (window as any).__game;
        g.equip(id, grade);
        g.step(1, { attack1: true });
        g.step(60, { attack1: true, moveX: 1 });
        g.step(20, {});
      }, { id, grade });
    }
  }
  await nextFrames(page);
  expect((await page.evaluate(() => (window as any).__game.world())).weapon.id).toBe('spell_tome');
  expect(errors).toEqual([]);
});
