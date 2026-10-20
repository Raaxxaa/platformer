// window.__game debug API and the ?debug=1 switch (00-README "Debug hook").
import type { CameraState } from '../core/camera.ts';
import type { Grade, WeaponId } from '../core/combat/types.ts';
import type { EnemyId } from '../core/enemies/types.ts';
import type { PlayerBody } from '../core/player/body.ts';
import type { GameWorld } from '../core/sim/gameWorld.ts';
import type { InputSpec, PlayerSim } from '../core/sim/playerSim.ts';

/** A read-only snapshot of the combat world (M2). */
export interface WorldSnapshot {
  tick: number; runTicks: number; phase: string;
  hp: number; maxHp: number; dead: boolean;
  flask: { charges: number; maxCharges: number; fillTenths: number };
  rush: number; gold: number;
  /** Weapon in slot 1 and what the player is doing with it (M9 part 2 tests): the running step kind, the raised shield, shots and platforms. */
  weapon: { id: string | null; grade: string | null; attack: string | null; shield: 'up' | 'lower' | null; shots: number; platforms: number; runes: number };
  enemies: { id: number; def: string; x: number; y: number; hp: number; maxHp: number; aware: boolean; state: string; attack: string | null; dead: boolean }[];
}

export interface GameDebugApi {
  ready: boolean;
  tick(): number;
  body(): PlayerBody;              // a copy
  camera(): CameraState;           // a copy
  setManual(on: boolean): void;    // manual: the scene stops stepping by itself and ignores devices
  step(n: number, spec?: InputSpec): void;  // run n ticks holding `spec` (pressed on the first tick only)
  teleport(x: number, y: number): void;     // fresh body with its feet at (x, y), camera snapped
  world?(): WorldSnapshot;                  // combat scene only
  spawn?(enemyId: EnemyId, x: number, y: number, facing?: 1 | -1): number;
  setHp?(hp: number): void;
  equip?(weaponId: string, grade?: string, slot?: 0 | 1): void;   // replaces a weapon slot (combat scene only)
}

declare global {
  interface Window { __game?: GameDebugApi }
}

/** Dev builds, or any build opened with ?debug=1. */
export function debugEnabled(): boolean {
  return import.meta.env.DEV || new URLSearchParams(window.location.search).get('debug') === '1';
}

export interface DebugHost {
  readonly sim: PlayerSim;
  setManual(on: boolean): void;
}

export function installDebugApi(host: DebugHost): void {
  window.__game = {
    ready: true,
    tick: () => host.sim.tick,
    body: () => structuredClone(host.sim.body),
    camera: () => structuredClone(host.sim.camera),
    setManual: (on) => host.setManual(on),
    step: (n, spec = {}) => { host.sim.stepSpec(spec, n); },
    teleport: (x, y) => host.sim.respawn({ x, y }),
  };
}

export interface CombatDebugHost {
  readonly world: GameWorld;
  setManual(on: boolean): void;
  stepSpec(spec: InputSpec, n: number): void;
}

export function snapshotWorld(w: GameWorld): WorldSnapshot {
  return {
    tick: w.tick, runTicks: w.runTicks, phase: w.phase,
    hp: w.health.hp, maxHp: w.health.maxHp, dead: w.health.dead,
    flask: { ...w.flask }, rush: w.rush.value, gold: w.gold,
    weapon: {
      id: w.combat.slots[0]?.weaponId ?? null, grade: w.combat.slots[0]?.grade ?? null, attack: w.combat.current ? `${w.combat.current.kind}:${w.combat.current.step}:${w.combat.current.phase}` : null,
      shield: w.combat.shield?.phase ?? null, shots: w.playerProjectiles.length, platforms: w.grid.pixelPlatforms.length,
      runes: w.abilityEntities.filter((e) => e.kind === 'rune_ring').length,
    },
    enemies: w.enemies.map((e) => ({
      id: e.id, def: e.def.id, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp, aware: e.aware,
      state: e.ai.state, attack: e.ai.attack ? `${e.ai.attack.def.id}:${e.ai.attack.phase}` : null, dead: e.dead,
    })),
  };
}

export function installCombatDebugApi(host: CombatDebugHost): void {
  window.__game = {
    ready: true,
    tick: () => host.world.tick,
    body: () => structuredClone(host.world.body),
    camera: () => structuredClone(host.world.camera),
    setManual: (on) => host.setManual(on),
    step: (n, spec = {}) => host.stepSpec(spec, n),
    teleport: (x, y) => host.world.teleportPlayer(x, y),
    world: () => snapshotWorld(host.world),
    spawn: (enemyId, x, y, facing = -1) => host.world.spawnExtra({ enemy: enemyId, x, y, facing }).id,
    setHp: (hp) => { host.world.health.hp = hp; },
    equip: (weaponId, grade = 'C', slot = 0) => {
      const w = host.world, weapons = [...w.combat.slots] as typeof w.combat.slots;
      weapons[slot] = { weaponId: weaponId as WeaponId, grade: grade as Grade, element: grade === 'S' ? 'fire' : null, perk: null };
      w.setLoadout({ weapons, abilities: w.abilities.slots });
    },
  };
}
