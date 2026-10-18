import { describe, expect, it } from 'vitest';
import { GameWorld } from '../sim/gameWorld.ts';
import { feet, levelFrom } from '../testkit/levelData.ts';
import { stepSpec } from '../testkit/combatWorld.ts';
import { captureWorld } from './session.ts';
import { beginTransition } from './phases.ts';
import { newAbility, newWeapon } from '../abilities/runtime.ts';
import { deriveSeed, Rng } from '../rng.ts';
import { applyStatUpgrade } from '../economy/stats.ts';

const level = (id: 'plains' | 'crossroads' | 'home') => {
  const d = levelFrom(['#........#', '#........#', '##########'], [feet('player_start', 2, 1)], id);
  if (id !== 'plains') { d.kind = 'village'; d.stage = 0; }
  return d;
};
describe('fresh-world run transfer (06 §2.7, M7 Task3)', () => {
  it('preserves run counters and exact Iron Will removal after transfer', () => {
    const w = GameWorld.fromLevel(level('plains'), { seedText: 'IRON' });
    w.setStartingKit({ cls: 'tank', weapon: 'war_maul' }); w.abilities.slots[1] = newAbility('shoulder_charge'); w.refreshClassState();
    applyStatUpgrade(w, 'vitality'); w.health.hp = 90; w.run.stats.kills = 7;
    const next = GameWorld.fromLevel(level('crossroads'), { seedText: 'IRON', carry: captureWorld(w) });
    expect(next.health).toMatchObject({ hp: 90, maxHp: 156 });
    expect(next.run.stats.kills).toBe(7);
    next.abilities.slots[1] = null; next.refreshClassState();
    expect(next.health).toMatchObject({ hp: 54, maxHp: 120 });
  });
  it('village combat and cosmetic streams use the village id, not stage 1', () => {
    const w = GameWorld.fromLevel(level('home'), { seedText: 'SCOPES' });
    expect(w.rng.combat.next()).toBe(new Rng(deriveSeed(w.runSeed, 'combat', 'home')).next());
    expect(w.rng.cosmetic.next()).toBe(new Rng(deriveSeed(w.runSeed, 'cosmetic', 'home')).next());
  });
  it('first controlled Stage 1 tick emits runStarted once, after the untimed home fade', () => {
    const w = GameWorld.fromLevel(level('plains'), { seedText: 'START' });
    beginTransition(w.run, 'homeGate', { phase: 'stage', levelId: 'plains', stage: 1 });
    stepSpec(w, {}, 60); w.completeLoading(); stepSpec(w, {}, 60);
    expect(w.run.started).toBe(false); expect(w.run.runTicks).toBe(0);
    expect(stepSpec(w, {})).toContainEqual({ t: 'runStarted' });
    expect(stepSpec(w, {}, 100)).not.toContainEqual({ t: 'runStarted' });
  });
  it('carries live gear/HP/flask/economy/stats but preserves the original restart kit', () => {
    const w = GameWorld.fromLevel(level('plains'), { seedText: 'A', seeded: true });
    w.setStartingKit({ cls: 'tank', weapon: 'war_maul' });
    w.combat.slots[0] = newWeapon('katana');
    w.abilities.slots[1] = newAbility('shoulder_charge'); w.refreshClassState();
    w.health.hp = 49; w.flask.charges = 1; w.flask.fillTenths = 333;
    w.econ.goldTenths = 4450; w.econ.keys = 2; w.econ.statStacks.vitality = 1;
    w.econ.curse = { id: 'no_heal', killsLeft: 3 }; w.econ.buffs = ['swift']; w.econ.debuffs = [{ id: 'jammed', ticksLeft: 99 }];
    beginTransition(w.run, 'stageExit', { phase: 'village', levelId: 'crossroads', stage: 0 });
    stepSpec(w, {}, 60);
    const next = GameWorld.fromLevel(level('crossroads'), { seedText: 'A', carry: captureWorld(w) });
    next.completeLoading(); stepSpec(next, {}, 60);
    expect(next.combat.slots[0]?.weaponId).toBe('katana');
    expect(next.run.startKit).toEqual({ cls: 'tank', weapon: 'war_maul' });
    expect(next.health.hp).toBe(49);
    expect(next.econ).toMatchObject({ goldTenths: 4450, keys: 2, statStacks: { vitality: 1 }, curse: { killsLeft: 3 }, buffs: [], debuffs: [] });
    expect(next.flask).toMatchObject({ charges: 1, fillTenths: 333 });
    next.restart();
    expect(next.run.phase).toBe('loading');
    const fresh = GameWorld.fromLevel(level('plains'), { seedText: next.run.seedText, carry: captureWorld(next) });
    fresh.completeLoading(); stepSpec(fresh, {}, 30);
    expect(fresh.combat.slots[0]?.weaponId).toBe('war_maul');
    expect(fresh.gold).toBe(0); expect(fresh.econ.statStacks).toEqual({});
    expect(fresh.health.hp).toBe(fresh.health.maxHp);
    fresh.econ.goldTenths = 777; fresh.restart(); stepSpec(fresh, {}, 30);
    expect(fresh.gold).toBe(0);
  });
  it('Home starts empty, refuses its gate without a kit, and never counts time or Rush', () => {
    const d = level('home'); d.objects.push({ id: 9, type: 'exit', x: 32, y: 0, w: 16, h: 32, props: {} });
    const w = GameWorld.fromLevel(d, { seedText: 'HOME' });
    w.teleportPlayer(40, 32); stepSpec(w, {}, 120);
    expect(w.combat.slots).toEqual([null, null]);
    expect(w.run.phase).toBe('homeVillage'); expect(w.run.runTicks).toBe(0); expect(w.rush.value).toBe(0);
    expect(w.villageMessage).toBe('Choose a class at a statue first');
    w.setStartingKit({ cls: 'tank', weapon: 'war_maul' }); stepSpec(w, {});
    expect(w.run.phase).toBe('transition');
    expect(w.run.transition?.kind).toBe('homeGate');
  });
});
