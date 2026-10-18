import { describe, expect, it } from 'vitest';
import { GameWorld } from '../sim/gameWorld.ts';
import { bossLevel } from '../testkit/levelData.ts';
import { captureRunEnd, appendHistory } from './history.ts';
import { defaultSave } from '../save/schema.ts';
import { newWeapon } from '../abilities/runtime.ts';
import { addGoldTenths } from '../economy/gold.ts';
import { hurtPlayer } from '../combat/health.ts';
import { openChest, type Chest } from '../loot/sources.ts';
import { breakLucky } from '../loot/lucky.ts';
import { stepSpec } from '../testkit/combatWorld.ts';
import { savePersonalBest } from './splits.ts';
import { decodeSave, encodeSave } from '../save/codec.ts';
const date = '2026-10-18T03:00:00.000Z';
const world = () => GameWorld.fromLevel(bossLevel(), { seedText: 'OLD', startKit: { cls: 'tank', weapon: 'war_maul' } });
describe('run-end history (06 §15.2)', () => {
  it('round-trips real Leeching history and PB snapshots without transient weapon state', () => {
    const w = world(), save = defaultSave(); w.combat.slots[0] = Object.assign(newWeapon('war_maul'), { perk: 'leeching', leechBank: 23 }); w.run.runTicks = 4000;
    appendHistory(save, captureRunEnd(w, 'restart'), date);
    w.run.phase = 'runComplete'; w.run.road = 'forest'; w.run.splits = [1000, 2000, 3000, 4000];
    savePersonalBest(w.run, save, date, { weapons: w.combat.slots, abilities: [{ id: 'shockwave', level: 1 }, null], displayName: 'Tank' });
    expect(decodeSave(encodeSave(save))).toEqual(save);
    expect(save.history[0].kit.weapons[0]).not.toHaveProperty('leechBank'); expect(save.pbs['tank|forest']?.kit.weapons[0]).not.toHaveProperty('leechBank');
  });
  it('counts a real flask sip, opened chest and broken Lucky Block once', () => {
    const w = world(); w.health.hp = 50; stepSpec(w, { heal: true }, 30); expect(w.run.stats.flasksDrunk).toBe(1);
    const chest: Chest = { objectId: 10, kind: 'timed', x: w.body.x, y: w.body.y, opened: false }; openChest(w, chest); openChest(w, chest);
    const lucky = { objectId: 11, x: w.body.x, y: w.body.y, broken: false }; breakLucky(w, lucky); breakLucky(w, lucky);
    expect(w.run.stats).toMatchObject({ flasksDrunk: 1, chestsOpened: 1, luckyBlocksBroken: 1 });
  });
  it('snapshots old live equipment, original start kit, clocks and counters before restart clears them', () => {
    const w = world(); w.run.runTicks = 4000; w.run.splits[0] = 3000; w.run.stage = 0; w.run.sectionReached = 8; w.combat.slots[0] = newWeapon('bow');
    addGoldTenths(w, 15, 'kill'); addGoldTenths(w, 15, 'kill'); hurtPlayer(w, { kind: 'hazard', cause: 'hazard', damageA: 10 });
    const snapshot = captureRunEnd(w, 'restart'); w.restart();
    expect(snapshot).toMatchObject({ seedText: 'OLD', runTicks: 4000, startClass: 'tank', startWeapon: 'war_maul', stageReached: 1, sectionReached: 8,
      kit: { weapons: [{ weaponId: 'bow' }, null] }, stats: { goldEarned: 3, damageTaken: 10 } });
    expect(w.run.stats.goldEarned).toBe(0); expect(snapshot?.kit.weapons[0]?.weaponId).toBe('bow');
  });
  it('records every death and completion, skips short restarts/quits, and keeps newest20', () => {
    const w = world(), save = defaultSave(); w.run.runTicks = 1;
    expect(appendHistory(save, captureRunEnd(w, 'restart'), date)).toBe(false); expect(appendHistory(save, captureRunEnd(w, 'quit'), date)).toBe(false);
    expect(appendHistory(save, captureRunEnd(w, 'death', 'spikes'), date)).toBe(true);
    for (let n = 0; n < 25; n++) { w.run.runTicks = n; appendHistory(save, captureRunEnd(w, 'complete'), date); }
    expect(save.history).toHaveLength(20); expect(save.history[0].runTicks).toBe(24); expect(save.history.at(-1)?.runTicks).toBe(5);
  });
  it('uses the last real stage in villages and excludes practice and Home', () => {
    const w = world(); w.run.stage = 0; w.run.splits = [100, 500, null, null]; expect(captureRunEnd(w, 'quit')?.stageReached).toBe(2);
    w.opts.practice = true; expect(captureRunEnd(w, 'death')).toBeNull(); w.opts.practice = false; w.run.phase = 'homeVillage'; expect(captureRunEnd(w, 'quit')).toBeNull();
  });
});
