import { describe, expect, it } from 'vitest';
import { GameWorld } from '../sim/gameWorld.ts';
import { bossLevel } from '../testkit/levelData.ts';
import { killEnemy, processDeaths } from '../combat/resolve.ts';
import { defaultSave } from '../save/schema.ts';
import { hurtPlayer } from '../combat/health.ts';
import { newWeapon } from '../abilities/runtime.ts';

describe('real Guardian split records (06 §5.3)', () => {
  const world = (seeded = false) => GameWorld.fromLevel(bossLevel(), { seedText: 'BOSS', seeded, startKit: { cls: 'tank', weapon: 'war_maul' }, records: defaultSave() });
  const kill = (w: GameWorld) => { killEnemy(w, w.enemies.find((e) => e.def.id === 'great_boar')!); processDeaths(w); };
  it('uses the original kit and writes both first segments, even on the death tick', () => {
    const w = world(); w.combat.slots[0] = newWeapon('katana'); w.run.runTicks = 111;
    w.health.hp = 1; hurtPlayer(w, { kind: 'enemyHit', enemyId: 1, enemyDefId: 'great_boar', damageA: 20, attackerCx: 999, melee: true }); kill(w);
    expect(w.run.phase).toBe('dead'); expect(w.events).toContainEqual({ t: 'split', index: 1, runTicks: 111, segmentTicks: 111, deltaTicks: null, bestSegment: true });
    expect(w.records.bestSegments).toEqual({ 'tank|mountain': [111, null, null, null], 'tank|forest': [111, null, null, null] });
  });
  it('typed runs compare but leave the injected record snapshot unchanged', () => {
    const w = world(true); w.run.runTicks = 123;
    const before = structuredClone(w.records); kill(w); expect(w.records).toEqual(before);
    expect(w.events.find((e) => e.t === 'split')).toMatchObject({ runTicks: 123, bestSegment: true });
  });
});
