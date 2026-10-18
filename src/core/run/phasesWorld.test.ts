import { describe, expect, it } from 'vitest';
import { GameWorld } from '../sim/gameWorld.ts';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';
import { bossLevel, feet, levelFrom, rect } from '../testkit/levelData.ts';
import { killEnemy } from '../combat/resolve.ts';
import { hurtPlayer } from '../combat/health.ts';
import { kitLoadout } from '../abilities/runtime.ts';
import { beginTransition } from './phases.ts';

const bossWorld = () => {
  const d = bossLevel(); d.objects.push({ ...rect('exit', 42, 14, 2, 3), id: 99 });
  const w = GameWorld.fromLevel(d, { seedText: 'BOSS' });
  for (let i = 0; i < 600 && !w.run.arenas.boss1?.locked; i++) stepSpec(w, { moveX: 1 });
  stepSpec(w, {}, 150);
  return w;
};
const defeat = (w: GameWorld) => { killEnemy(w, w.enemies.find((e) => e.boss)!); stepSpec(w, {}); };
const lethal = (w: GameWorld) => { w.health.hp = 1; hurtPlayer(w, { kind: 'hazard', cause: 'spikes', damageA: 20 }); };

describe('phase machine in the world (M7 Task 1)', () => {
  it('opens the stat pick exactly 120 ticks after a Guardian kill; its clock runs but everything else freezes', () => {
    const w = bossWorld(); defeat(w);
    const at = w.tick;
    stepSpec(w, {}, 119);
    expect(w.run.phase).toBe('stage');
    stepSpec(w, {});
    expect(w.tick - at).toBe(120);
    expect(w.run.phase).toBe('statPick');
    const state = structuredClone({ body: w.body, hp: w.health, enemies: w.enemies, tick: w.tick });
    const t = w.run.runTicks, stageT = w.run.stageTicks;
    stepSpec(w, { moveX: 1, attack1: true }, 75);
    expect({ body: w.body, hp: w.health, enemies: w.enemies, tick: w.tick }).toEqual(state);
    expect([w.run.runTicks, w.run.stageTicks]).toEqual([t + 75, stageT + 75]);
    expect(w.confirmStatPick()).toBe(true);
    expect(w.run.phase).toBe('stage');
    expect(w.confirmStatPick()).toBe(false);
  });
  it('death in the 1-second delay remains a normal death and never opens a stat pick', () => {
    const w = bossWorld(); defeat(w); stepSpec(w, {}, 60); lethal(w);
    const ticks = w.run.runTicks;
    stepSpec(w, {}, 180);
    expect(w.run.phase).toBe('dead');
    expect(w.phase).toBe('deathScreen');
    expect(w.run.runTicks).toBe(ticks);
    expect(w.confirmStatPick()).toBe(false);
  });
  it('exit stays blocked until the stat choice, then requests Crossroads at fade-out end', () => {
    const w = bossWorld(); defeat(w);
    w.teleportPlayer(42 * 16 + 8, 17 * 16);
    stepSpec(w, {});
    expect(w.run.phase).toBe('stage');
    stepSpec(w, {}, 119 + 36); w.confirmStatPick();
    stepSpec(w, {});
    expect(w.run.phase).toBe('transition');
    const ticks = w.run.runTicks, x = w.body.x;
    stepSpec(w, { restart: true, moveX: 1 }, 59);
    expect(w.run.phase).toBe('transition');
    const events = stepSpec(w, { restart: true });
    expect(w.body.x).toBe(x);
    expect(w.run.runTicks).toBe(ticks + 60);
    expect(w.run.phase).toBe('loading');
    expect(events).toContainEqual({ t: 'loadLevel', levelId: 'crossroads', stage: 0 });
    stepSpec(w, {}, 100);
    expect(w.run.runTicks).toBe(ticks + 60);
    w.completeLoading();
    expect(stepSpec(w, {})).toContainEqual({ t: 'enterVillage', villageId: 'crossroads' });
    expect(stepSpec(w, {}, 59)).not.toContainEqual({ t: 'enterVillage', villageId: 'crossroads' });
    expect(w.run.phase).toBe('village');
    expect(w.run.levelId).toBe('crossroads');
    expect(w.run.runTicks).toBe(ticks + 120);
  });
  it('inn counts exactly 120 ticks, heals at fade-out end, and never refills the flask', () => {
    const w = arenaWorld(); w.run.phase = 'village'; w.health.hp = 25;
    w.flask.charges = 0; w.flask.fillTenths = 321;
    beginTransition(w.run, 'sleep', { phase: 'stage', levelId: 'mountains', stage: 2 });
    stepSpec(w, {}, 59); expect(w.health.hp).toBe(25);
    stepSpec(w, {}); expect(w.health.hp).toBe(w.health.maxHp);
    w.completeLoading(); stepSpec(w, {}, 60);
    expect(w.run.runTicks).toBe(120);
    expect(w.flask).toMatchObject({ charges: 0, fillTenths: 321 });
    expect([w.run.phase, w.run.stageTicks]).toEqual(['stage', 0]);
  });
  it.each(['homeVillage', 'loading', 'paused', 'runComplete'] as const)('restart is ignored in %s', (phase) => {
    const w = arenaWorld(); w.run.phase = phase; w.health.hp = 42;
    stepSpec(w, { restart: true }, 100);
    expect(w.health.hp).toBe(42);
    expect(w.run.restartHoldTicks).toBe(0);
  });
  it.each(['statPick', 'village', 'routeChoice'] as const)('holding restart works in %s', (phase) => {
    const w = arenaWorld(); w.run.phase = phase; w.health.hp = 42;
    stepSpec(w, { restart: true }, 59); expect(w.health.hp).toBe(42);
    stepSpec(w, { restart: true }); expect(w.health.hp).toBe(w.health.maxHp);
    expect(w.run.phase).toBe('transition');
    stepSpec(w, { restart: true }, 300);
    expect(w.run.restartHoldTicks).toBe(0);
    stepSpec(w, {}); stepSpec(w, { restart: true }, 60);
    expect(w.run.phase).toBe('transition');
  });
  it('a restart keeps its initial kit, keeps typed seeds and gets a new injected random seed', () => {
    for (const seeded of [true, false]) {
      const d = levelFrom(['..........', '..........', '##########'], [feet('player_start', 2, 1)]);
      let draws = 0;
      const w = GameWorld.fromLevel(d, { seedText: 'ORIGINAL', seeded, nextRandomSeed: () => { draws++; return 'NEXTSEED'; } });
      w.setLoadout(kitLoadout('tank', 'war_maul'));
      w.combat.slots[0] = null;
      w.restart(); stepSpec(w, {}, 30);
      expect(w.combat.slots[0]).toMatchObject({ weaponId: 'war_maul' });
      expect(w.run.seedText).toBe(seeded ? 'ORIGINAL' : 'NEXTSEED');
      expect(draws).toBe(seeded ? 0 : 1);
      expect([w.run.runTicks, w.run.stageTicks, w.tick]).toEqual([0, 0, 0]);
    }
  });
  it('restart from another level requests real Plains loading and never relabels the old world', () => {
    const d = levelFrom(['..........', '..........', '##########'], [feet('player_start', 2, 1)], 'mountains');
    d.stage = 2;
    const w = GameWorld.fromLevel(d, { seedText: 'ROAD' });
    w.restart();
    expect(w.run.phase).toBe('loading');
    expect(w.run.levelId).toBe('mountains');
    expect(w.run.transition?.target).toEqual({ phase: 'stage', levelId: 'plains', stage: 1 });
    expect(stepSpec(w, {})).toContainEqual({ t: 'loadLevel', levelId: 'plains', stage: 1 });
    stepSpec(w, {}, 200);
    expect(w.run.phase).toBe('loading');
    expect(w.run.runTicks).toBe(0);
    expect(w.run.levelId).toBe('mountains');
  });
});
