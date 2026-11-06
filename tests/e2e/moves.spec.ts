import { test, expect, type Page } from '@playwright/test';

// M15 (02 §9.6a): Launcher, juggles and the Rushing Strike, in the Training Yard (stations 18 and 19).
const frames = (page: Page) => page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));

test('Training Yard: launch and juggle (18), Rushing Strike (19)', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1&start=training&kit=swordsman:katana');
  await page.waitForFunction(() => (window as any).__game?.ready === true && (window as any).__game.stations);
  await page.evaluate(() => (window as any).__game.setManual(true));
  const run = (id: number, bot: string, max: number) => page.evaluate(([id, bot, max]) => {
    const g = (window as any).__game;
    const fn = new Function('i', 'b', 'g', 'mem', bot) as (i: number, b: any, g: any, mem: any) => object;
    const mem: Record<string, number> = {};
    for (let i = 0; i < (max as number) && !g.training().done.includes(id); i++) g.step(1, fn(i, g.body(), g, mem));
    return g.training().done.includes(id);
  }, [id, bot, max] as const);
  await page.evaluate(() => { const g = (window as any).__game; g.toStation(18); g.step(2, {}); });
  // Walk to the target, launch it (↑ + Attack), then jump after it and keep hitting with ↑ + Attack in the air.
  const ok18 = await run(18, `
    const t = g.enemyAi().filter((e) => e.def === 'juggle_target').sort((a, c) => Math.abs(a.x - b.x) - Math.abs(c.x - b.x))[0];
    if (!t) return {};
    const dx = t.x - b.x; mem.p = mem.p ?? 0; mem.t = mem.t ?? 0;
    if (mem.p === 0) { if (Math.abs(dx) > 18) return { moveX: Math.sign(dx) }; mem.p = 1; mem.t = i; return { moveY: -1, attack1: true }; }
    if (i - mem.t < 20) return {};
    const press = (i - mem.t) % 16 === 0;
    return { moveX: Math.abs(dx) > 10 ? Math.sign(dx) : 0, jump: b.grounded && press, moveY: -1, attack1: press };`, 1500);
  await frames(page); await page.screenshot({ path: 'test-results/m15-juggle.png' });
  expect(ok18).toBe(true);
  await page.evaluate(() => { const g = (window as any).__game; g.toStation(19); g.step(2, {}); });
  expect(await run(19, 'return i % 40 === 0 ? { dash: true, moveX: 1 } : i % 40 === 4 ? { attack1: true, moveX: 1 } : { moveX: 1 };', 600)).toBe(true);
  await frames(page); await page.screenshot({ path: 'test-results/m15-rushing-strike.png' });
  expect(errors).toEqual([]);
});
