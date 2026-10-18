import { test, expect, type Page } from '@playwright/test';

const frames = (page: Page) => page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
async function openWorld(page: Page, level: string) {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`/?debug=1&start=${level}&kit=tank:war_maul`);
  await page.waitForFunction(() => (window as any).__game?.ready);
  await page.evaluate(() => { const g = (window as any).__game; g.setManual(true); g.homeAction('back'); });
  return errors;
}

test('the first Title keyboard gesture unlocks actual audio without choosing Play', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?debug=1'); await page.waitForFunction(() => (window as any).__game?.ready);
  expect(await page.evaluate(() => (window as any).PHASER_GAME.sound.locked)).toBe(true);
  await page.keyboard.press('z');
  await expect.poll(() => page.evaluate(() => (window as any).__game.screenState())).toMatchObject({ screen: 'title', model: { step: 2 } });
  await expect.poll(() => page.evaluate(() => (window as any).PHASER_GAME.sound.locked), { timeout: 2000 }).toBe(false);
  expect(await page.evaluate(() => (window as any).PHASER_GAME.sound.context.state)).toBe('running');
  expect(errors).toEqual([]);
});

test('Home Records freezes a moving jump and returns to the same Home world', async ({ page }) => {
  const errors = await openWorld(page, 'home');
  const before = await page.evaluate(() => {
    const g = (window as any).__game; g.teleport(160, 320); g.step(3, { jump: true, moveX: 1 });
    g.openHomePanel('records'); const snapshot = { tick: g.tick(), body: g.body(), runTicks: g.runState().runTicks };
    g.setManual(false); return snapshot;
  });
  expect(before.body.grounded).toBe(false); expect(before.body.vy).toBeLessThan(0);
  await page.keyboard.press('p'); await frames(page);
  expect(await page.evaluate(() => (window as any).__game.pauseState())).toBeNull();
  expect(await page.evaluate(() => (window as any).__game.runState().phase)).toBe('homeVillage');
  for (let i = 0; i < 4; i++) await frames(page);
  expect(await page.evaluate(() => (window as any).__game.screenState().screen)).toBe('records');
  expect(await page.evaluate(() => (window as any).__game.tick())).toBe(before.tick);
  expect(await page.evaluate(() => (window as any).__game.body())).toEqual(before.body);
  expect(await page.evaluate(() => (window as any).__game.runState().runTicks)).toBe(before.runTicks);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => (window as any).__game.screenState().screen)).toBeNull();
  await expect.poll(() => page.evaluate(() => (window as any).__game.tick())).toBeGreaterThan(before.tick);
  expect(await page.evaluate(() => (window as any).__game.levelId())).toBe('home');
  expect(await page.evaluate(() => (window as any).__game.runState().phase)).toBe('homeVillage');
  expect(errors).toEqual([]);
});

test('Death to Home has both half-second fades with no timer or extra history entry', async ({ page }) => {
  const errors = await openWorld(page, 'plains');
  const death = await page.evaluate(() => {
    const g = (window as any).__game; g.setHp(1); const body = g.body(); g.spawn('bandit', body.x + 20, body.y, -1);
    for (let i = 0; i < 1200 && g.runState().phase !== 'dead'; i++) g.step(1, {});
    const result = g.runState(); g.step(120, {}); return result;
  });
  expect(death.phase).toBe('dead');
  await expect.poll(() => page.evaluate(() => (window as any).__game.screenState().model?.canConfirm)).toBe(true);
  const out = await page.evaluate(() => {
    const game = (window as any).PHASER_GAME, g = (window as any).__game;
    const home = game.scene.getScene('Village'); home.events.once('create', () => home.setManual(true));
    g.screenAction('down'); g.screenAction('confirm'); return { run: g.runState(), body: g.body() };
  });
  expect(out.run).toMatchObject({ phase: 'transition', runTicks: death.runTicks, transition: { kind: 'toHome', part: 'out', left: 60, timed: false } });
  await page.evaluate(() => (window as any).__game.step(30, { moveX: 1, jump: true, restart: true })); await frames(page);
  expect(await page.evaluate(() => { const s = (window as any).PHASER_GAME.scene.getScenes(true)[0]; return { visible: s.fade.visible, alpha: s.fade.alpha }; })).toEqual({ visible: true, alpha: 0.5 });
  expect(await page.evaluate(() => (window as any).__game.body())).toEqual(out.body);
  await page.evaluate(() => (window as any).__game.step(29, { restart: true }));
  expect(await page.evaluate(() => (window as any).__game.runState())).toMatchObject({ phase: 'transition', runTicks: death.runTicks, transition: { part: 'out', left: 1 } });
  await page.evaluate(() => (window as any).__game.step(1, {}));
  await page.waitForFunction(() => (window as any).__game?.ready && (window as any).__game.levelId?.() === 'home');
  const arrival = await page.evaluate(() => ({ run: (window as any).__game.runState(), body: (window as any).__game.body() }));
  expect(arrival.run).toMatchObject({ phase: 'transition', runTicks: 0, transition: { kind: 'toHome', part: 'in', left: 60, timed: false } });
  await page.evaluate(() => (window as any).__game.step(30, { moveX: 1, jump: true, restart: true })); await frames(page);
  expect(await page.evaluate(() => { const s = (window as any).PHASER_GAME.scene.getScenes(true)[0]; return { visible: s.fade.visible, alpha: s.fade.alpha }; })).toEqual({ visible: true, alpha: 0.5 });
  expect(await page.evaluate(() => (window as any).__game.body())).toEqual(arrival.body);
  await page.evaluate(() => (window as any).__game.step(29, { restart: true }));
  expect(await page.evaluate(() => (window as any).__game.runState())).toMatchObject({ phase: 'transition', runTicks: 0, transition: { part: 'in', left: 1 } });
  await page.evaluate(() => (window as any).__game.step(1, {})); await frames(page);
  expect(await page.evaluate(() => (window as any).__game.runState())).toMatchObject({ phase: 'homeVillage', runTicks: 0, transition: null });
  const saved = await page.evaluate(() => (window as any).__game.save());
  expect(saved.stats.deaths).toBe(1); expect(saved.history).toHaveLength(1);
  expect(saved.history[0]).toMatchObject({ result: 'death', runTicks: death.runTicks });
  expect(errors).toEqual([]);
});

test('releasing one of two real bound Jump keys keeps Jump held until the other is released', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('rushblade.save', JSON.stringify({ v: 1,
    lastKit: { cls: 'tank', weapon: 'war_maul' }, settings: { bindings: { keyboard: { jump: ['KeyZ', 'KeyX'] } } },
  })));
  const errors = await openWorld(page, 'home');
  await page.evaluate(() => { const g = (window as any).__game; g.teleport(160, 320); g.step(1, {}); g.setManual(false); });
  await frames(page);
  await page.evaluate(() => (window as any).PHASER_GAME.loop.sleep());
  try {
    await page.keyboard.down('z'); await page.keyboard.down('x');
    const first = await page.evaluate(() => {
      const scene = (window as any).PHASER_GAME.scene.getScenes(true)[0], input = scene.devices.builder.build();
      scene.stepWorld(input); return { jump: input.jump, body: scene.world.body };
    });
    expect(first.jump).toMatchObject({ held: true, pressed: true }); expect(first.body.jumpCuttable).toBe(true);
    await page.keyboard.up('z');
    const stillHeld = await page.evaluate(() => {
      const scene = (window as any).PHASER_GAME.scene.getScenes(true)[0], input = scene.devices.builder.build();
      scene.stepWorld(input); return { jump: input.jump, body: scene.world.body };
    });
    expect(stillHeld.jump).toMatchObject({ held: true, pressed: false, released: false });
    expect(stillHeld.body.jumpCuttable).toBe(true);
    await page.keyboard.up('x');
    const released = await page.evaluate(() => {
      const scene = (window as any).PHASER_GAME.scene.getScenes(true)[0], input = scene.devices.builder.build();
      scene.stepWorld(input); return { jump: input.jump, body: scene.world.body };
    });
    expect(released.jump).toMatchObject({ held: false, pressed: false, released: true }); expect(released.body.jumpCuttable).toBe(false);
  } finally { await page.evaluate(() => (window as any).PHASER_GAME.loop.wake()); }
  expect(errors).toEqual([]);
});

test('a zero-tick frame preserves fixed-menu priority for an imported Pause key', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('rushblade.save', JSON.stringify({ v: 1, lastRoad: 'forest',
    settings: { bindings: { keyboard: { left: ['KeyO', 'ArrowLeft'], pause: ['Escape', 'KeyA'] } } },
  })));
  const errors = await openWorld(page, 'crossroads');
  await page.evaluate(() => { const g = (window as any).__game; g.step(1, {}); g.teleport(680, 320); g.step(1, { interact: true }); });
  await page.waitForFunction(() => (window as any).__game.routeChoice?.() !== null);
  expect(await page.evaluate(() => (window as any).__game.routeChoice().road)).toBe('forest');
  await page.evaluate(() => { const g = (window as any).__game; g.setManual(false); (window as any).PHASER_GAME.loop.sleep(); });
  try {
    await page.keyboard.press('a');
    const zero = await page.evaluate(() => {
      const game = (window as any).PHASER_GAME, g = (window as any).__game, before = g.runState().runTicks;
      game.scene.getScenes(true)[0].update(0, 0);
      return { before, ticks: g.runState().runTicks, phase: g.runState().phase, pause: g.pauseState(), road: g.routeChoice().road };
    });
    expect(zero).toMatchObject({ ticks: zero.before, phase: 'routeChoice', pause: null, road: 'mountain' });
    const stepped = await page.evaluate(() => {
      const game = (window as any).PHASER_GAME, g = (window as any).__game;
      game.scene.getScenes(true)[0].update(10, 10);
      return { ticks: g.runState().runTicks, phase: g.runState().phase, pause: g.pauseState(), road: g.routeChoice().road };
    });
    expect(stepped).toMatchObject({ phase: 'routeChoice', pause: null, road: 'mountain' });
    expect(stepped.ticks).toBeGreaterThan(zero.ticks);
  } finally { await page.evaluate(() => (window as any).PHASER_GAME.loop.wake()); }
  expect(errors).toEqual([]);
});
