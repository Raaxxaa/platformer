import { test, expect, type Page } from '@playwright/test';

const frames = (page: Page) => page.evaluate(() => new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
async function shot(page: Page, name: string) {
  await frames(page);
  await page.screenshot({ path: `test-results/m71-${name}.png` });
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

for (const road of ['mountains', 'swamps'] as const) {
  test(`${road}: boot and all eight authored sections`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    for (let index = 1; index <= 8; index++) {
      // A fresh scene keeps an earlier arena's real camera lock out of later section photos.
      await page.goto(`/?debug=1&start=${road}&section=${index}&seed=M71VIEW&kit=tank:war_maul`);
      await arrive(page, road);
      expect(await page.evaluate(() => (window as any).__game.levelId())).toBe(road);
      await page.evaluate(() => (window as any).__game.step(1, {}));
      const playerOnScreen = await page.evaluate(() => {
        const g = (window as any).__game, b = g.body(), c = g.camera(), y = b.y - b.h / 2;
        return b.x >= c.x && b.x <= c.x + 640 && y >= c.y && y <= c.y + 360;
      });
      expect(playerOnScreen, `${road} section ${index} must show its own player position`).toBe(true);
      await shot(page, `${road}-play-section-${index}`);
      await page.evaluate(n => (window as any).__game.overview(n), index);
      await shot(page, `${road}-section-${index}`);
    }
    expect(errors).toEqual([]);
  });
}

for (const route of [{ road: 'mountain', level: 'mountains', boss: 'stone_colossus' }, { road: 'forest', level: 'swamps', boss: 'spider_queen' }] as const) {
  test(`${route.road}: real Plains carry, inn, Guardian split 2, stat choice, Border and continuation`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    const typed = route.road === 'forest';
    await page.goto(`/?debug=1&start=plains&kit=tank:war_maul${typed ? '&seed=M71RUN' : ''}`);
    await arrive(page, 'plains');
    const split1 = await page.evaluate(() => {
      const g = (window as any).__game, boss = g.arenas().find((a: any) => a.kind === 'boss').rect;
      g.teleport(boss.x + boss.w / 2, boss.y + boss.h); g.step(1, {}); g.killAll(); g.step(1, {});
      g.step(120, {}); return g.runState().splits[0];
    });
    expect(split1).toBeGreaterThan(0);
    await page.evaluate(() => {
      const g = (window as any).__game; g.step(36, {}); g.confirmStatPick();
      const exit = g.levelObjects('exit')[0]; g.teleport(exit.x + exit.w / 2, exit.y + exit.h); g.step(61, {});
    });
    await arrive(page, 'crossroads');
    expect(await page.evaluate(() => (window as any).__game.runState().splits[0])).toBe(split1);
    const carried = await page.evaluate(() => {
      const g = (window as any).__game;
      g.setHp(21); g.teleport(680, 320); g.step(1, { interact: true });
      return { kit: g.runState().startKit, stacks: g.loot().econ.statStacks, gear: g.loadout() };
    });
    await page.waitForFunction(() => (window as any).__game.routeChoice?.() !== null);
    await page.evaluate(road => {
      const g = (window as any).__game;
      g.routeAction(road === 'mountain' ? 'left' : 'right');
    }, route.road);
    await shot(page, `${route.level}-inn-choice`);
    const beforeSleep = await page.evaluate(() => {
      const g = (window as any).__game, ticks = g.runState().runTicks;
      g.routeAction('confirm'); g.step(60, {}); return ticks;
    });
    await arrive(page, route.level);
    const arrived = await page.evaluate(() => {
      const g = (window as any).__game; return { run: g.runState(), hp: g.world().hp, maxHp: g.world().maxHp, gear: g.loadout(), stacks: g.loot().econ.statStacks };
    });
    expect(arrived.run.phase).toBe('stage'); expect(arrived.run.road).toBe(route.road);
    expect(arrived.run.seeded).toBe(typed);
    expect(arrived.run.runTicks).toBe(beforeSleep + 120); expect(arrived.run.stageTicks).toBe(0);
    expect(arrived.run.splits[0]).toBe(split1); expect(arrived.run.startKit).toEqual(carried.kit);
    expect(arrived.gear).toEqual(carried.gear); expect(arrived.stacks).toEqual(carried.stacks);
    expect(arrived.hp).toBe(arrived.maxHp);
    await shot(page, `${route.level}-real-arrival`);
    await page.evaluate(() => {
      const g = (window as any).__game, boss = g.arenas().find((a: any) => a.kind === 'boss').rect;
      g.teleport(boss.x + boss.w / 2, boss.y + boss.h); g.step(121, {});
    });
    expect(await page.evaluate(id => (window as any).__game.world().enemies.some((e: any) => e.def === id && !e.dead), route.boss)).toBe(true);
    await shot(page, `${route.level}-guardian`);
    const kill = await page.evaluate(() => {
      const g = (window as any).__game; g.killAll(); g.step(1, {});
      const run = g.runState(); return { now: run.runTicks, split: run.splits[1], phase: run.phase };
    });
    expect(kill.split).toBe(kill.now); expect(kill.split).toBeGreaterThan(split1);
    await page.evaluate(() => (window as any).__game.step(119, {}));
    expect(await page.evaluate(() => (window as any).__game.runState().phase)).toBe('stage');
    await page.evaluate(() => (window as any).__game.step(1, {}));
    expect(await page.evaluate(() => (window as any).__game.runState().phase)).toBe('statPick');
    await shot(page, `${route.level}-split2-stat-pick`);
    await page.evaluate(() => {
      const g = (window as any).__game; g.step(36, {}); g.confirmStatPick();
      const exit = g.levelObjects('exit')[0]; g.teleport(exit.x + exit.w / 2, exit.y + exit.h); g.step(61, {});
    });
    await arrive(page, 'border');
    expect(await page.evaluate(() => (window as any).__game.runState().splits)).toEqual([split1, kill.split, null, null]);
    expect(await page.evaluate(() => (window as any).__game.shop().villageIndex)).toBe(2);
    await shot(page, `${route.level}-border`);
    const borderSleep = await page.evaluate(() => {
      const g = (window as any).__game; g.teleport(680, 320); g.step(1, { interact: true });
      const before = g.runState().runTicks; g.step(60, {}); return before;
    });
    // The renderer acknowledges the unchanged Border scene between the two real fade halves.
    await page.waitForFunction(() => (window as any).__game.runState().transition?.part === 'in');
    await page.evaluate(() => { const g = (window as any).__game; g.step(g.runState().transition.left, {}); });
    expect(await page.evaluate(() => (window as any).__game.runState().phase)).toBe('runSoFar');
    expect(await page.evaluate(() => (window as any).__game.runState().runTicks)).toBe(borderSleep + 120);
    expect(await page.evaluate(() => (window as any).__game.runState().splits)).toEqual([split1, kill.split, null, null]);
    const save = await page.evaluate(() => (window as any).__game.save());
    expect(save.stats.runsCompleted).toBe(0); expect(save.pbs).toEqual({});
    if (typed) expect(save.bestSegments).toEqual({}); // Typed browser run compares without changing records.
    else {
      expect(save.bestSegments['tank|mountain'][0]).toBe(split1);
      expect(save.bestSegments['tank|forest'][0]).toBe(split1);
      expect(save.bestSegments['tank|mountain'][1]).toBe(kill.split - split1);
      expect(save.bestSegments['tank|forest'][1]).toBeNull();
    }
    await shot(page, `${route.level}-continued`);
    if (!typed) {
      await page.reload(); await arrive(page, 'plains');
      const reloaded = await page.evaluate(() => (window as any).__game.save());
      expect(reloaded.bestSegments).toEqual(save.bestSegments);
      expect(reloaded.lastRoad).toBe('mountain');
    }
    expect(errors).toEqual([]);
  });
}
