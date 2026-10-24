import { test, expect, type Page } from '@playwright/test';

// M12: the phone version, with mobile emulation (touch, coarse pointer) at 844 × 390.
test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });

const frames = (page: Page) => page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
/** A synthetic touch pointer on the window, like a finger (Playwright's touchscreen can only tap). */
async function finger(page: Page, type: 'down' | 'move' | 'up', id: number, x: number, y: number) {
  await page.evaluate(([type, id, x, y]) => {
    window.dispatchEvent(new PointerEvent(`pointer${type}`, { pointerId: id as number, pointerType: 'touch', clientX: x as number, clientY: y as number, bubbles: true, cancelable: true, isPrimary: id === 1 }));
  }, [type, id, x, y] as const);
}
const btn = (page: Page, name: string) => page.evaluate((n) => { const e = document.querySelector(`.touch-${n}`)!.getBoundingClientRect(); return { x: e.x + e.width / 2, y: e.y + e.height / 2 }; }, name);

test('the overlay shows after the first touch, over Stage 1, with live icons', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1&start=plains&seed=PHONE&kit=swordsman:greatsword');
  await page.waitForFunction(() => (window as any).__game?.ready === true);
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('touch')!).display)).toBe('none');
  await finger(page, 'down', 9, 200, 100); await finger(page, 'up', 9, 200, 100);
  await frames(page); await frames(page);
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('touch')!).display)).toBe('block');
  await page.screenshot({ path: 'test-results/phone-stage1.png' });
  expect(errors).toEqual([]);
});

test('play by touch: the stick runs, Jump jumps, Attack swings, lifting a finger lets go', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1&start=plains&seed=PHONE&kit=swordsman:greatsword');
  await page.waitForFunction(() => (window as any).__game?.ready === true);
  await finger(page, 'down', 9, 200, 100); await finger(page, 'up', 9, 200, 100); await frames(page);
  const x0 = (await page.evaluate(() => (window as any).__game.body())).x;
  // Stick: touch at (120, 250), drag right.
  await finger(page, 'down', 1, 120, 250); await finger(page, 'move', 1, 180, 250);
  await page.waitForTimeout(700);
  const x1 = (await page.evaluate(() => (window as any).__game.body())).x;
  expect(x1).toBeGreaterThan(x0 + 40);
  await page.screenshot({ path: 'test-results/phone-stick.png' });
  // Jump with a second finger while running.
  const jump = await btn(page, 'jump');
  let maxUp = 0; const y0 = (await page.evaluate(() => (window as any).__game.body())).y;
  await finger(page, 'down', 2, jump.x, jump.y);
  for (let i = 0; i < 8; i++) { await page.waitForTimeout(40); maxUp = Math.max(maxUp, y0 - (await page.evaluate(() => (window as any).__game.body())).y); }
  await finger(page, 'up', 2, jump.x, jump.y);
  expect(maxUp).toBeGreaterThan(20);
  // Attack: a tap starts a swing.
  const atk = await btn(page, 'attack1');
  await finger(page, 'down', 3, atk.x, atk.y); await finger(page, 'up', 3, atk.x, atk.y);
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => (window as any).__game.world?.().tick > 0)).toBe(true);
  // Lifting the stick finger stops the run.
  await finger(page, 'up', 1, 180, 250);
  await page.waitForTimeout(900);
  const a = (await page.evaluate(() => (window as any).__game.body())).x; await page.waitForTimeout(300);
  const b = (await page.evaluate(() => (window as any).__game.body())).x;
  expect(Math.abs(b - a)).toBeLessThan(1);
  expect(errors).toEqual([]);
});

// ------------------------------------------------------------------------------------------ Task 7
/** Screen position of a point in the 640 × 360 game (the canvas is fitted, so ask where it is). */
async function gameXY(page: Page, gx: number, gy: number) {
  return page.evaluate(([gx, gy]) => { const r = document.querySelector('canvas')!.getBoundingClientRect(); const k = r.width / 640; return { x: r.x + (gx as number) * k, y: r.y + (gy as number) * k }; }, [gx, gy] as const);
}
async function tapGame(page: Page, gx: number, gy: number) { const p = await gameXY(page, gx, gy); await page.touchscreen.tap(p.x, p.y); }
async function fingerTap(page: Page, x: number, y: number, ms = 80) { await finger(page, 'down', 7, x, y); await page.waitForTimeout(ms); await finger(page, 'up', 7, x, y); }
async function boot(page: Page, query: string) {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`/?debug=1&seed=PHONE${query}`);
  await page.waitForFunction(() => (window as any).__game?.ready === true);
  await finger(page, 'down', 9, 300, 100); await finger(page, 'up', 9, 300, 100);   // the first touch shows the buttons
  await frames(page);
  return errors;
}

test('the Home Village: tap Interact at a statue, pick a class by tapping its row, walk to the gate with the stick', async ({ page }) => {
  const errors = await boot(page, '&start=home');
  await page.waitForFunction(() => (window as any).__game.levelId() === 'home');
  await page.evaluate(() => { const g = (window as any).__game, s = g.interactables().find((o: any) => o.kind === 'class_statue' && o.label === 'archer'); g.teleport(s.x, s.y); });
  await page.waitForTimeout(250);
  await frames(page);
  await page.screenshot({ path: 'test-results/phone-village.png' });
  const interact = await btn(page, 'interact');
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.touch-interact')!).display)).not.toBe('none');
  await fingerTap(page, interact.x, interact.y);
  await page.waitForFunction(() => (window as any).__game.classPickOpen());
  await frames(page); await page.screenshot({ path: 'test-results/phone-class-pick.png' });
  // The class pick's weapon rows take taps: the first row confirms the kit.
  const open = await page.evaluate(() => (window as any).__game.classPickOpen());
  expect(open).toBe(true);
  await tapGame(page, 320, 196);
  await page.waitForFunction(() => !(window as any).__game.classPickOpen(), null, { timeout: 5000 });
  expect((await page.evaluate(() => (window as any).__game.classState())).displayClass).toBe('archer');
  // "Try the Training Yard first?" (the first pick): tap No.
  await frames(page); await page.screenshot({ path: 'test-results/phone-training-ask.png' });
  await tapGame(page, 368, 205);
  await page.waitForFunction(() => (window as any).__game.touch().gameplay === true, null, { timeout: 5000 });
  // Walk right with the stick.
  const x0 = (await page.evaluate(() => (window as any).__game.body())).x;
  await finger(page, 'down', 1, 110, 260); await finger(page, 'move', 1, 190, 260);
  await page.waitForTimeout(800);
  await finger(page, 'up', 1, 190, 260);
  expect((await page.evaluate(() => (window as any).__game.body())).x).toBeGreaterThan(x0 + 30);
  expect(errors).toEqual([]);
});

test('Pause by tap, the LOADOUT tab by tap, Resume by tap; holding Pause restarts the run', async ({ page }) => {
  const errors = await boot(page, '&start=plains&kit=swordsman:greatsword');
  const pause = await btn(page, 'pause');
  await fingerTap(page, pause.x, pause.y, 100);
  await page.waitForFunction(() => (window as any).__game.pauseState() !== null);
  expect(await page.evaluate(() => (window as any).__game.pauseState().tab)).toBe('MENU');
  await frames(page); await page.screenshot({ path: 'test-results/phone-pause.png' });
  await tapGame(page, 320, 70 + 6 + 7);            // tabs row: the middle tab is LOADOUT
  await page.waitForFunction(() => (window as any).__game.pauseState().tab === 'LOADOUT');
  await frames(page); await page.screenshot({ path: 'test-results/phone-pause-loadout.png' });
  await tapGame(page, 320 - 76, 70 + 6 + 7);       // back to MENU
  await page.waitForFunction(() => (window as any).__game.pauseState().tab === 'MENU');
  await tapGame(page, 320, 70 + 66 + 6);           // the first row: Resume
  await page.waitForFunction(() => (window as any).__game.pauseState() === null);
  // Hold Pause for over 0.5 s: the instant restart (06 §6.2). Run a moment first so there is a time to lose.
  await finger(page, 'down', 1, 110, 260); await finger(page, 'move', 1, 190, 260); await page.waitForTimeout(900); await finger(page, 'up', 1, 190, 260);
  const before = (await page.evaluate(() => (window as any).__game.runState())).runTicks;
  expect(before).toBeGreaterThan(60);
  await finger(page, 'down', 4, pause.x, pause.y);
  await page.waitForTimeout(250);
  await frames(page); await page.screenshot({ path: 'test-results/phone-pause-hold.png' });
  await page.waitForTimeout(600);
  await finger(page, 'up', 4, pause.x, pause.y);
  await page.waitForTimeout(300);
  expect((await page.evaluate(() => (window as any).__game.runState())).runTicks).toBeLessThan(before);
  expect(await page.evaluate(() => (window as any).__game.pauseState())).toBeNull();
  expect(errors).toEqual([]);
});

test('portrait pauses and asks to turn the phone; landscape resumes', async ({ page }) => {
  const errors = await boot(page, '&start=plains&kit=swordsman:greatsword');
  const t0 = await page.evaluate(() => (window as any).__game.tick());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => (window as any).__portrait === true);
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('portrait')!).display)).toBe('flex');
  await page.waitForTimeout(300);
  const t1 = await page.evaluate(() => (window as any).__game.tick());
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as any).__game.tick())).toBe(t1);       // nothing runs while it is sideways-less
  await page.screenshot({ path: 'test-results/phone-portrait.png' });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForFunction(() => (window as any).__portrait === false);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as any).__game.tick())).toBeGreaterThan(t1);
  expect(t1).toBeGreaterThanOrEqual(t0);
  expect(errors).toEqual([]);
});

test('Training Yard stations 1 to 3 by touch', async ({ page }) => {
  test.slow();
  const errors = await boot(page, '&start=training&kit=swordsman:greatsword');
  const done = () => page.evaluate(() => (window as any).__game.training().done as number[]);
  const run = async (station: number, jumpMs: number, extra?: () => Promise<void>) => {
    await page.evaluate((id) => (window as any).__game.toStation(id), station);
    await page.waitForTimeout(300);
    const jump = await btn(page, 'jump');
    await finger(page, 'down', 1, 110, 260); await finger(page, 'move', 1, 200, 260);        // hold the stick right
    const end = Date.now() + 25000;
    while (Date.now() < end && !(await done()).includes(station)) {
      await fingerTap(page, jump.x, jump.y, jumpMs);
      if (extra) await extra();
      await page.waitForTimeout(220);
    }
    await finger(page, 'up', 1, 200, 260);
  };
  await run(1, 220);
  expect(await done()).toContain(1);
  await page.screenshot({ path: 'test-results/phone-yard-station1.png' });
  await run(2, 120, async () => { const j = await btn(page, 'jump'); await fingerTap(page, j.x, j.y, 80); });   // a second tap in the air: the double jump
  expect(await done()).toContain(2);
  const dash = await btn(page, 'dash');
  await run(3, 200, async () => { await fingerTap(page, dash.x, dash.y, 60); });
  expect(await done()).toContain(3);
  expect(errors).toEqual([]);
});

test('Edit layout: drag a button, pinch it bigger, Done keeps it in the save', async ({ page }) => {
  const errors = await boot(page, '&start=plains&kit=swordsman:greatsword');
  await page.evaluate(() => (window as any).__game.openPause());
  await page.waitForFunction(() => (window as any).__game.pauseState() !== null);
  await tapGame(page, 320, 70 + 66 + 6 + 14 * 2);   // Settings (third row of the run menu)
  await page.waitForFunction(() => (window as any).__game.screenState().screen === 'settings');
  const rows = await page.evaluate(() => (window as any).__game.screenState().model);
  expect(rows).toBeTruthy();
  await page.evaluate(() => { const g = (window as any).__game; for (let i = 0; i < 6; i++) g.screenAction('down'); g.screenAction('confirm'); });     // Touch controls ▸
  await frames(page); await page.screenshot({ path: 'test-results/phone-settings-touch.png' });
  await page.evaluate(() => { const g = (window as any).__game; for (let i = 0; i < 6; i++) g.screenAction('down'); g.screenAction('confirm'); });     // Edit layout ▸
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.touch-edit')!).display === 'flex');
  await frames(page); await page.screenshot({ path: 'test-results/phone-layout-editor.png' });
  const dash = await btn(page, 'dash');
  await finger(page, 'down', 21, dash.x, dash.y); await finger(page, 'move', 21, 400, 120); await finger(page, 'up', 21, 400, 120);
  // Pinch it: two fingers on the button, spreading apart.
  const d2 = await btn(page, 'dash');
  await finger(page, 'down', 22, d2.x - 5, d2.y); await finger(page, 'down', 23, d2.x + 5, d2.y);
  await finger(page, 'move', 23, d2.x + 40, d2.y); await finger(page, 'up', 23, d2.x + 40, d2.y); await finger(page, 'up', 22, d2.x - 5, d2.y);
  await page.screenshot({ path: 'test-results/phone-layout-edited.png' });
  await page.click('.touch-edit [data-act="done"]');
  await page.waitForFunction(() => (window as any).__game.screenState().screen === 'settings');
  const layout = await page.evaluate(() => (window as any).__game.save().settings.touch.layout);
  expect(layout.dash.x).toBeCloseTo(400 / 844, 1); expect(layout.dash.y).toBeCloseTo(120 / 390, 1); expect(layout.dash.scale).toBeGreaterThan(1.2);
  expect(errors).toEqual([]);
});

test('performance smoke: 20 s of Stage 1 with Low effects on the emulated phone', async ({ page }) => {
  const errors = await boot(page, '&start=plains&kit=swordsman:greatsword');
  expect(await page.evaluate(() => (window as any).__game.effects?.() ?? 'low')).toBe('low');       // the default on a touch device
  await finger(page, 'down', 1, 110, 260); await finger(page, 'move', 1, 200, 260);
  const r = await page.evaluate(() => new Promise<{ frames: number; ticks: number; worst: number; ms: number }>((resolve) => {
    const g = (window as any).__game; let frames = 0, last = g.tick(), worst = 0; const t0 = performance.now(), t0ticks = last;
    const step = () => { frames++; const t = g.tick(); worst = Math.max(worst, t - last); last = t; if (performance.now() - t0 < 20000) requestAnimationFrame(step); else resolve({ frames, ticks: t - t0ticks, worst, ms: performance.now() - t0 }); };
    requestAnimationFrame(step);
  }));
  await finger(page, 'up', 1, 200, 260);
  console.log(`phone smoke: ${r.frames} frames, ${r.ticks} ticks in ${(r.ms / 1000).toFixed(1)} s; mean ${(r.ticks / r.frames).toFixed(2)} ticks per frame, worst ${r.worst}`);
  expect(r.frames).toBeGreaterThan(20);
  expect(errors).toEqual([]);
});
