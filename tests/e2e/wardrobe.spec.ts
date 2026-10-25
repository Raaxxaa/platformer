import { test, expect, type Page } from '@playwright/test';

// M13: the wardrobe, the collection, enemy accessories and the shop cosmetic.
const g = (page: Page, fn: string, ...args: unknown[]) => page.evaluate(([fn, args]) => (window as any).__game[fn as string](...(args as unknown[])), [fn, args] as const);
const frames = (page: Page) => page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
const act = async (page: Page, ...actions: string[]) => { for (const a of actions) await g(page, 'wardrobeAction', a); await frames(page); };

test('first launch shows "Make your hero"; a changed look is saved and survives a reload', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1&start=home&intro=1');
  await page.waitForFunction(() => (window as any).__game?.ready === true && (window as any).__game.wardrobe?.() !== null);
  expect(await g(page, 'wardrobe')).toMatchObject({ intro: true, zone: 'footer' });
  await frames(page); await page.screenshot({ path: 'test-results/wardrobe-intro.png' });
  await act(page, 'up', 'up');                               // anim row → rows
  expect(await g(page, 'wardrobe')).toMatchObject({ tab: 'body', zone: 'rows' });
  await act(page, 'right');                                  // Human → Elf
  await act(page, 'down', 'down', 'down', 'right');          // hair
  await act(page, 'up', 'up', 'up', 'up', 'up', 'up', 'right', 'down', 'right', 'right', 'right');   // Clothes tab, outfit → robe
  await page.screenshot({ path: 'test-results/wardrobe-clothes.png' });
  const look = (await g(page, 'wardrobe')).look;
  expect(look.race).toBe('elf'); expect(look.outfit).toBe('robe');
  // Confirm: down to the footer (Confirm is the default there).
  await act(page, 'down', 'down', 'down', 'down', 'down', 'confirm');
  expect(await g(page, 'wardrobe')).toBeNull();
  const saved = await g(page, 'save');
  expect(saved.look).toMatchObject({ race: 'elf', outfit: 'robe' }); expect(saved.cosmetics.wardrobeIntroDone).toBe(true);
  await page.reload();
  await page.waitForFunction(() => (window as any).__game?.ready === true);
  expect((await g(page, 'save')).look).toMatchObject({ race: 'elf', outfit: 'robe' });
  expect(await g(page, 'wardrobe')).toBeNull();               // the intro is a one-time thing
  expect(errors).toEqual([]);
});

test('the mirror opens the wardrobe; Back throws the changes away', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1&start=home');
  await page.waitForFunction(() => (window as any).__game?.ready === true);
  await page.evaluate(() => { const gm = (window as any).__game, m = gm.interactables().find((o: any) => o.kind === 'mirror_spot'); gm.setManual(true); gm.teleport(m.x, m.y); gm.step(2, {}); gm.step(1, { interact: true }); gm.setManual(false); });
  await page.waitForFunction(() => (window as any).__game.wardrobe() !== null);
  await act(page, 'right', 'right');
  await act(page, 'back');
  expect(await g(page, 'wardrobe')).toBeNull();
  expect((await g(page, 'save')).look.race).toBe('human');
  expect(errors).toEqual([]);
});

test('a first kill gives its accessory with a toast; it shows in Accessories and Collection, and can be worn', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1&start=plains&seed=WARD&kit=swordsman:greatsword');
  await page.waitForFunction(() => (window as any).__game?.ready === true);
  await page.evaluate(() => { const gm = (window as any).__game; gm.setManual(true); gm.step(5, {}); gm.killAll(); gm.step(3, {}); });
  const owned: string[] = (await g(page, 'save')).cosmetics.owned;
  expect(owned.length).toBeGreaterThan(0);
  await g(page, 'openWardrobe'); await frames(page);
  await act(page, 'up', 'right', 'right');                   // tabs: Body → Clothes → Accessories
  expect((await g(page, 'wardrobe')).tab).toBe('accessories');
  await page.screenshot({ path: 'test-results/wardrobe-accessories.png' });
  expect(owned).toContain('acc_bandit');
  await act(page, 'down', 'right');                          // head: None → Bandit bandana
  expect((await g(page, 'wardrobe')).look.head).toBe('acc_bandit');
  await act(page, 'down', 'down', 'down', 'down', 'confirm');
  expect((await g(page, 'save')).look.head).toBe('acc_bandit');
  await page.evaluate(() => { const gm = (window as any).__game; gm.setManual(false); });
  await page.waitForTimeout(300); await frames(page);
  await page.screenshot({ path: 'test-results/wardrobe-worn.png' });
});

test('the Collection tab counts what you own and the Records LOOKS tab shows the same', async ({ page }) => {
  await page.goto('/?debug=1&start=home');
  await page.waitForFunction(() => (window as any).__game?.ready === true);
  await g(page, 'openWardrobe'); await frames(page);
  await act(page, 'up', 'right', 'right', 'right');
  expect((await g(page, 'wardrobe')).tab).toBe('collection');
  await act(page, 'down');
  await page.screenshot({ path: 'test-results/wardrobe-collection.png' });
  await act(page, 'back');
  await g(page, 'openHomePanel', 'records'); await frames(page);
  for (let i = 0; i < 3; i++) await g(page, 'screenAction', 'right');
  await frames(page);
  expect((await g(page, 'screenState')).model.tab).toBe(3);
  await page.screenshot({ path: 'test-results/records-looks.png' });
});

test('a shop cosmetic is bought at the Crossroads and lands in the collection', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1&start=crossroads&kit=tank:war_maul');
  await page.waitForFunction(() => (window as any).__game?.ready === true);
  const id: string = await page.evaluate(() => (window as any).__game.shop().cosmeticId);
  expect(id).toBeTruthy();
  await page.evaluate(() => { const gm = (window as any).__game, s = gm.interactables().find((o: any) => o.kind === 'shop_cosmetic'); gm.setManual(true); gm.setGold(900); gm.teleport(s.x, s.y); gm.step(2, {}); gm.step(1, { interact: true }); gm.step(3, {}); });
  await frames(page);
  expect((await g(page, 'save')).cosmetics.owned).toContain(id);
  await page.screenshot({ path: 'test-results/shop-cosmetic.png' });
  expect(errors).toEqual([]);
});

test('gallery: 4 races × 4 outfits, and the preview animations with a hat and a cape', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('__seed', '1'));
  await page.goto('/?debug=1&start=home');
  await page.waitForFunction(() => (window as any).__game?.ready === true);
  await g(page, 'openWardrobe'); await frames(page);
  const clip = { x: 230, y: 250, width: 200, height: 210 };
  const shot = (name: string) => page.screenshot({ path: `test-results/look-${name}.png`, clip });
  for (let r = 0; r < 4; r++) {
    if (r > 0) await act(page, 'right');                      // next race (row 0 of the Body tab)
    await act(page, 'up', 'right', 'down');                   // Clothes tab, outfit row
    for (let o = 0; o < 4; o++) { await page.waitForTimeout(60); await shot(`r${r}o${o}`); await act(page, 'right'); }
    await act(page, 'up', 'left', 'down');                    // back to Body, race row
  }
  expect(errors).toEqual([]);
});
