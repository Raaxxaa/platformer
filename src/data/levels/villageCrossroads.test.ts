import { describe, expect, it } from 'vitest';
import json from '../../../public/levels/village_crossroads.json';
import { loadLevel } from '../../core/level/loadLevel.ts';
import { validateLevel } from '../../core/level/validateLevel.ts';
import { GameWorld } from '../../core/sim/gameWorld.ts';
import { stepSpec } from '../../core/testkit/combatWorld.ts';
describe('Crossroads layout (06 §12.2)', () => {
  const level = loadLevel(json);
  it('has every service at its exact tile', () => {
    expect(validateLevel(level)).toEqual([]);
    expect(level.objects.filter((o) => o.type === 'shop_item').map((o) => Math.floor(o.x / 16))).toEqual([9, 12, 15]);
    expect(level.objects.filter((o) => o.type === 'ability_altar').map((o) => Math.floor(o.x / 16))).toEqual([19, 22]);
    for (const [type, x] of [['shop_flask', 26], ['shop_refill', 29], ['shop_key', 32], ['shop_reroll', 35]] as const) expect(Math.floor(level.objects.find((o) => o.type === type)!.x / 16)).toBe(x);
    expect(level.objects.find((o) => o.type === 'inn')).toMatchObject({ x: 41 * 16, y: 16 * 16, w: 3 * 16, h: 4 * 16 });
  });
  it('walks from spawn to inn in less than four seconds and counts village time', () => {
    const w = GameWorld.fromLevel(level, { seedText: 'WALK' }); let ticks = 0;
    while (w.body.x < 42 * 16 && ticks < 480) { stepSpec(w, { moveX: 1 }); ticks++; }
    expect(ticks).toBeLessThan(480); expect(w.run.runTicks).toBe(ticks);
  });
});
