import { describe, expect, it } from 'vitest';
import plainsJson from '../../../public/levels/plains.json';
import crossroadsJson from '../../../public/levels/village_crossroads.json';
import { killEnemy } from '../combat/resolve.ts';
import { loadLevel } from '../level/loadLevel.ts';
import { GameWorld } from '../sim/gameWorld.ts';
import { stepSpec } from '../testkit/combatWorld.ts';
import { RUN } from '../tuning.ts';
import { captureWorld } from './session.ts';

/** Exercise real level objects and the scene's fresh-world carry path, without rendering. */
function visitCrossroads(seedText: string) {
  const plains = loadLevel(plainsJson);
  const stage = GameWorld.fromLevel(plains, { seedText, startKit: { cls: 'tank', weapon: 'war_maul' } });
  stepSpec(stage, { moveX: 1 }, 12);
  stepSpec(stage, { jump: true }, 4);
  stepSpec(stage, {}, 12);

  // Skip travel, but use the real boss arena, death rewards, delayed offer and exit trigger.
  const arena = plains.objects.find((o) => o.type === 'arena' && o.props.kind === 'boss')!;
  stage.teleportPlayer(arena.x + 32, arena.y + arena.h);
  stepSpec(stage, {});
  expect(stage.run.arenas[String(arena.props.id)]?.locked).toBe(true);
  const boss = stage.enemies.find((e) => e.boss)!;
  expect(boss.dead).toBe(false);
  killEnemy(stage, boss);
  expect(stepSpec(stage, {})).toContainEqual({ t: 'split', index: 1, runTicks: stage.run.splits[0], segmentTicks: stage.run.splits[0], deltaTicks: null, bestSegment: true });
  stepSpec(stage, {}, RUN.STAT_PICK_DELAY_TICKS);
  expect(stage.run.phase).toBe('statPick');
  const offer = [...stage.statPick!.offer];
  expect(new Set(offer).size).toBe(3);
  stepSpec(stage, {}, RUN.STAT_PICK_CONFIRM_TICKS);
  const selected = offer[1];
  expect(stage.confirmStatPick(1)).toBe(true);
  expect(stage.econ.statStacks[selected]).toBe(1);

  const exit = plains.objects.find((o) => o.type === 'exit')!;
  stage.teleportPlayer(exit.x + exit.w / 2, exit.y + exit.h);
  stepSpec(stage, {});
  expect(stage.run.phase).toBe('transition');
  expect(stepSpec(stage, {}, RUN.FADE_TICKS)).toContainEqual({ t: 'loadLevel', levelId: 'crossroads', stage: 0 });
  expect(stage.run.phase).toBe('loading');

  const carry = captureWorld(stage);
  const village = GameWorld.fromLevel(loadLevel(crossroadsJson), { seedText, carry });
  expect(village.shop).toBeNull();
  village.completeLoading();
  expect(stepSpec(village, {}, RUN.FADE_TICKS)).toContainEqual({ t: 'enterVillage', villageId: 'crossroads' });
  expect(village.run.phase).toBe('village');
  expect(village.run.levelId).toBe('crossroads');
  expect(village.econ.statStacks[selected]).toBe(1);
  expect(village.run.startKit).toEqual({ cls: 'tank', weapon: 'war_maul' });
  expect(village.shop?.slots).toHaveLength(3);
  expect(village.groundItems.filter((item) => item.shopSlot !== undefined)).toHaveLength(3);

  return structuredClone({
    offer, selected, shop: village.shop,
    stock: village.groundItems.filter((item) => item.shopSlot !== undefined),
    economy: village.econ, run: village.run,
    weapons: village.combat.slots, abilities: village.abilities.slots,
    hp: village.health.hp, maxHp: village.health.maxHp, flask: village.flask,
  });
}

describe('M7 milestone determinism across the real Plains and Crossroads', () => {
  it('replays the same inputs and seed with identical stat offers, carry state and shop stock', () => {
    expect(visitCrossroads('M7SAME')).toEqual(visitCrossroads('M7SAME'));
  });

  it('varies stat offers and shop stock across fixed different seeds', () => {
    const visits = ['M7A', 'M7B', 'M7C', 'M7D', 'M7E', 'M7F', 'M7G', 'M7H'].map(visitCrossroads);
    expect(new Set(visits.map((visit) => JSON.stringify(visit.offer))).size).toBeGreaterThan(1);
    expect(new Set(visits.map((visit) => JSON.stringify(visit.shop))).size).toBeGreaterThan(1);
  });
});
