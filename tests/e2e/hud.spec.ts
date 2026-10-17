import { test, expect, type Page } from '@playwright/test';

// M4.1: the full HUD, the item card, the pause tabs and the start screen.
async function boot(page: Page, query: string) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`/?debug=1&seed=PLAINS${query}`);
  await page.waitForFunction(() => (window as any).__game?.ready === true);
  return errors;
}
const frames = (page: Page) => page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));

test('the HUD over the Plains: plates, heart, HP bar, Rush, flask, gold, slots, timer', async ({ page }) => {
  const errors = await boot(page, '&start=plains&kit=swordsman:greatsword');
  await page.evaluate(() => { const g = (window as any).__game; g.setManual(true); g.step(60, { moveX: 1 }); g.setHp(40); g.step(30, {}); });
  await frames(page);
  await page.screenshot({ path: 'test-results/hud-plains.png' });
  expect(errors).toEqual([]);
});

test('the item card: a weapon and an ability with both slots full', async ({ page }) => {
  const errors = await boot(page, '&start=training&kit=swordsman:greatsword');
  const standOn = (id: string) => page.evaluate((id) => {
    const g = (window as any).__game;
    const it = g.groundItems().find((i: any) => i.weapon === id || i.ability === id);
    g.teleport(it.x, it.y); g.step(20, {});
  }, id);
  await page.evaluate(() => { const g = (window as any).__game; g.setManual(true); g.giveWeapon(1, 'war_maul'); g.giveAbility(1, 'whirlwind'); });
  await standOn('katana');
  expect(await page.evaluate(() => (window as any).__game.cardOpen())).toBe(true);
  await frames(page);
  await page.screenshot({ path: 'test-results/card-weapon.png' });
  await standOn('arrow_rain');
  await frames(page);
  await page.screenshot({ path: 'test-results/card-ability.png' });
  // Interact opens the swap choice; ability 1 replaces slot 1 (Blade Dash) → Thief.
  await page.evaluate(() => { const g = (window as any).__game; g.step(1, { interact: true }); g.step(2, {}); });
  await frames(page);
  await page.screenshot({ path: 'test-results/card-swap-choice.png' });
  await page.evaluate(() => { const g = (window as any).__game; g.step(1, { ability1: true }); g.step(2, {}); });
  expect((await page.evaluate(() => (window as any).__game.classState())).displayName).toBe('Thief');
  expect(errors).toEqual([]);
});

test('pause: MENU, LOADOUT and CONTROLS tabs', async ({ page }) => {
  const errors = await boot(page, '&start=training&kit=wizard:storm_hammer');
  await page.evaluate(() => { const g = (window as any).__game; g.setManual(true); g.giveAbility(1, 'blink'); g.step(5, {}); g.openPause(); });
  for (const tab of ['MENU', 'LOADOUT', 'CONTROLS']) {
    await frames(page);
    expect((await page.evaluate(() => (window as any).__game.pauseState())).tab).toBe(tab);
    await page.screenshot({ path: `test-results/pause-${tab.toLowerCase()}.png` });
    await page.keyboard.press('ArrowRight');
  }
  await page.keyboard.press('Escape');
  await frames(page);
  expect(await page.evaluate(() => (window as any).__game.pauseState())).toBeNull();
  expect(errors).toEqual([]);
});

test('start screen: Training Yard, then leave it and come back', async ({ page }) => {
  const errors = await boot(page, '');
  expect(await page.evaluate(() => (window as any).__game.title)).toBe(true);
  await frames(page);
  await page.screenshot({ path: 'test-results/title.png' });
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game?.levelId?.() === 'training_yard');
  await frames(page);
  await page.screenshot({ path: 'test-results/title-yard.png' });
  // Pause → Leave Training Yard (confirm twice).
  await page.evaluate(() => { const g = (window as any).__game; g.openPause(); g.pauseAction('down'); g.pauseAction('confirm'); g.pauseAction('confirm'); });
  await page.waitForFunction(() => (window as any).__game?.title === true);
  // Play opens Stage 1 with the class pick.
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__game?.levelId?.() === 'plains');
  expect(await page.evaluate(() => (window as any).__game.classPickOpen())).toBe(true);
  await frames(page);
  await page.screenshot({ path: 'test-results/title-play.png' });
  expect(errors).toEqual([]);
});
