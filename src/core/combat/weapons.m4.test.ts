import { describe, expect, it } from 'vitest';
import { newAbility, newWeapon } from '../abilities/runtime.ts';
import type { AbilityId } from '../abilities/types.ts';
import type { GameWorld, WorldEvent } from '../sim/gameWorld.ts';
import type { InputSpec } from '../sim/playerSim.ts';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';
import type { WeaponId } from './types.ts';
import { firePlayerProjectile } from './playerProjectiles.ts';
import type { EnemyId } from '../enemies/types.ts';
import { gridFromRects } from '../level/build.ts';
import { GameWorld as World } from '../sim/gameWorld.ts';

/** Player at x 200 on a long floor; enemies standing on it with lots of HP so nothing dies. */
function setup(weapon: WeaponId, enemies: { id: EnemyId; x: number; hp?: number }[] = [], ability: AbilityId | null = null, weapon2: WeaponId | null = null): GameWorld {
  const w = arenaWorld({ enemies: enemies.map((e) => ({ enemy: e.id, x: e.x, y: 320, facing: -1 })) });
  w.setLoadout({ weapons: [newWeapon(weapon), weapon2 ? newWeapon(weapon2) : null], abilities: [ability ? newAbility(ability) : null, null] });
  enemies.forEach((e, i) => { const en = w.enemies[i]; en.hp = en.maxHp = e.hp ?? 5000; en.dormant = false; });
  stepSpec(w, {}, 2);
  return w;
}
const run = (w: GameWorld, spec: InputSpec, n = 1) => stepSpec(w, spec, n);
const hits = (ev: WorldEvent[], id?: number) => ev.filter((e): e is Extract<WorldEvent, { t: 'hit' }> => e.t === 'hit' && e.target !== 'player' && (id === undefined || e.target === id)).map((e) => e.amount);
/** Tap the button once, then wait. */
function tap(w: GameWorld, spec: InputSpec, wait: number): WorldEvent[] {
  return [...run(w, spec, 1), ...run(w, {}, wait)];
}

describe('player projectiles (02 §9.8, §10.4)', () => {
  it('spawn at +12, −18 from the feet; fly at their speed; vanish at their range; track distance', () => {
    const w = setup('bow');
    const p = firePlayerProjectile(w, 0, 99, 'arrow', 0)!;
    expect([p.x, p.y]).toEqual([w.body.x + 12, w.body.y - 18]);
    run(w, {}, 10);
    expect(p.traveled).toBeCloseTo(50);
    run(w, {}, 53);
    expect(w.playerProjectiles.length).toBe(1);
    run(w, {}, 1);
    expect(w.playerProjectiles.length).toBe(0);           // 320 px at 5 px/tick
  });
  it('inside a wall it runs onWall at once; the player\'s hit-stop does not slow it', () => {
    const w = setup('bow');
    w.teleportPlayer(24, 320);                              // facing left into the arena wall
    w.body.facing = -1;
    expect(firePlayerProjectile(w, 0, 99, 'arrow', 0)).not.toBeNull();
    expect(w.playerProjectiles.length).toBe(0);
    const v = setup('bow');
    const p = firePlayerProjectile(v, 0, 99, 'arrow', 0)!;
    v.body.hitStopTicks = 20;
    run(v, {}, 10);
    expect(p.traveled).toBeCloseTo(50);
  });
  it('the orb explodes on contact: the touched enemy takes only the blast; neighbours in the 80×80 blast too', () => {
    const w = setup('staff', [{ id: 'bandit_brute', x: 300 }, { id: 'bandit_brute', x: 330 }]);
    firePlayerProjectile(w, 0, 99, 'orb', 0);
    const ev = run(w, {}, 40);
    expect(hits(ev, w.enemies[0].id)).toEqual([40]);
    expect(hits(ev, w.enemies[1].id)).toEqual([40]);
  });
});

describe('charge weapons (02 §9.4)', () => {
  it('Bow: a tap shoots a 12 arrow; holding 0.45 s past recovery fires a piercing 32', () => {
    const w = setup('bow', [{ id: 'bandit_brute', x: 300 }, { id: 'bandit_brute', x: 340 }]);
    expect(hits(tap(w, { attack1: true }, 60))).toEqual([12]);
    const v = setup('bow', [{ id: 'bandit_brute', x: 300 }, { id: 'bandit_brute', x: 340 }]);
    run(v, { attack1: true }, 1);
    run(v, { attack1: true }, 39);                          // step: 12 + 27 ticks, then Charge
    expect(v.combat.charge).not.toBeNull();
    run(v, { attack1: true }, 54);
    const ev = [...run(v, {}, 1), ...run(v, {}, 60)];
    expect(hits(ev).sort()).toEqual([32, 32]);              // pierces both
  });
  it('releasing early does the next step; a dash loses the charge', () => {
    const w = setup('bow', [{ id: 'bandit_brute', x: 300 }]);
    run(w, { attack1: true }, 1);
    run(w, { attack1: true }, 45);
    expect(w.combat.charge).not.toBeNull();
    const ev = [...run(w, {}, 1), ...run(w, {}, 60)];
    expect(hits(ev)).toEqual([12]);
    run(w, { attack1: true }, 1);
    run(w, { attack1: true }, 45);
    run(w, { attack1: true, dash: true }, 1);
    expect(w.combat.charge).toBeNull();
  });
});

describe('the six new weapons (02 §10)', () => {
  it('Katana combo 12, 12, 17', () => {
    const w = setup('katana', [{ id: 'training_dummy', x: 230 }]);
    const ev = [...tap(w, { attack1: true }, 45), ...tap(w, { attack1: true }, 45), ...tap(w, { attack1: true }, 60)];
    expect(hits(ev)).toEqual([12, 12, 17]);
  });
  it('Katana dash-slash: 90 px in 18 ticks, gravity off, invulnerable, 40 to each enemy in the path once (checklist 31)', () => {
    const w = setup('katana', [{ id: 'bandit_brute', x: 260 }, { id: 'bandit_brute', x: 280 }]);
    run(w, { attack1: true }, 1);
    run(w, { attack1: true }, 40);                          // step 1 (39 ticks) → charge
    run(w, { attack1: true }, 48);                          // 0.40 s
    expect(w.combat.charge!.ticks).toBeGreaterThanOrEqual(48);
    const ev = run(w, {}, 6);                               // release + 0.05 s startup
    const x0 = w.body.x;
    const ev2 = run(w, {}, 18);
    expect(w.body.x - x0).toBe(90);
    expect(hits([...ev, ...ev2]).sort()).toEqual([40, 40]);
  });
  it('Iron Fists 10, 10, 11, 18; the uppercut launches a small enemy and lifts the player once per airtime', () => {
    const w = setup('iron_fists', [{ id: 'training_dummy', x: 222 }]);
    const ev = [...tap(w, { attack1: true }, 30), ...tap(w, { attack1: true }, 30), ...tap(w, { attack1: true }, 30), ...run(w, { attack1: true }, 1)];
    let minVy = 0;
    for (let i = 0; i < 40; i++) { ev.push(...run(w, {}, 1)); minVy = Math.min(minVy, w.body.vy); }
    expect(minVy).toBeLessThanOrEqual(-280);                  // −300, then one tick of gravity
    expect(hits(ev)).toEqual([10, 10, 11, 18]);
    const v = setup('iron_fists');
    for (let i = 0; i < 3; i++) tap(v, { attack1: true }, 30);
    const wolf = v.spawnExtra({ enemy: 'wolf', x: v.body.x + 18, y: 320, facing: -1 });
    wolf.hp = wolf.maxHp = 500;
    run(v, { attack1: true }, 1); run(v, {}, 30);         // queued behind step 3's recovery
    expect(wolf.control?.type).toBe('launch');
  });
  it('Crossbow bolt 29; a wall within 24 px behind pins 1.5 s', () => {
    const g = gridFromRects(40, 23, [
      { x0: 0, y0: 20, x1: 39, y1: 22, kind: 'solid' }, { x0: 0, y0: 0, x1: 0, y1: 22, kind: 'solid' }, { x0: 22, y0: 0, x1: 39, y1: 22, kind: 'solid' },
    ]);
    const w = new World({ grid: g, spawn: { x: 200, y: 320 }, enemies: [{ enemy: 'bandit', x: 330, y: 320, facing: -1 }] });
    w.setLoadout({ weapons: [newWeapon('crossbow'), null], abilities: [null, null] });
    const e = w.enemies[0]; e.dormant = false; e.hp = e.maxHp = 500;
    const ev = tap(w, { attack1: true }, 60);
    expect(hits(ev)).toEqual([29]);
    expect(e.control?.type).toBe('pin');
    expect(e.x + e.def.hurtbox.w / 2).toBe(352);              // flush with the wall at x 352
  });
  it('Staff bolt 13; the charged orb blasts for 40', () => {
    const w = setup('staff', [{ id: 'training_dummy', x: 300 }]);
    expect(hits(tap(w, { attack1: true }, 60))).toEqual([13]);
    run(w, { attack1: true }, 1); run(w, { attack1: true }, 42 + 62);
    expect(hits([...run(w, {}, 1), ...run(w, {}, 80)])).toEqual([40]);
  });
  it('Storm Hammer combo 22, 25 (heavy); its dive adds a 24 bolt 0.10 s after landing', () => {
    const w = setup('storm_hammer', [{ id: 'training_dummy', x: 230 }]);
    const ev = [...tap(w, { attack1: true }, 70), ...tap(w, { attack1: true }, 80)];
    const amounts = ev.filter((e) => e.t === 'hit' && e.target !== 'player');
    expect(amounts.map((e) => e.t === 'hit' && [e.amount, e.heavy])).toEqual([[22, true], [25, true]]);
    const v = setup('storm_hammer', [{ id: 'training_dummy', x: 218 }]);
    v.teleportPlayer(200, 200);
    run(v, {}, 2);
    run(v, { moveY: 1, attack1: true }, 1);
    const evd = run(v, { moveY: 1 }, 60);
    const landed = evd.findIndex((e) => e.t === 'move' && e.e === 'diveLand');
    expect(landed).toBeGreaterThanOrEqual(0);
    expect(hits(evd)).toContain(24);
  });
});

describe('Storm Hammer throw (02 §11, checklist 25–26)', () => {
  it('Up + button throws; it hits a stationary enemy once out and once back; it is caught', () => {
    const w = setup('storm_hammer', [{ id: 'bandit_brute', x: 300 }]);
    run(w, { moveY: -1, attack1: true }, 1);
    const ev = run(w, {}, 150);
    expect(hits(ev)).toEqual([18, 18]);
    expect(w.hammer).toBeNull();
  });
  it('a press while outbound starts the return at once; while out it cannot swing', () => {
    const w = setup('storm_hammer');
    run(w, { moveY: -1, attack1: true }, 1);
    run(w, {}, 16);
    expect(w.hammer?.phase).toBe('out');
    run(w, { attack1: true }, 1);
    expect(w.hammer?.phase).toBe('back');
    expect(w.combat.current?.kind ?? 'none').not.toBe('combo');
  });
  it('recharge: 5.0 s without a Wizard ability, 2.0 s with one', () => {
    const w = setup('storm_hammer');
    run(w, { moveY: -1, attack1: true }, 1);
    run(w, {}, 120);                                        // caught well before 1.0 s
    expect(w.hammer).toBeNull();
    run(w, { moveY: -1, attack1: true }, 1);
    expect(w.hammer).toBeNull();                            // swing instead
    expect(w.combat.current?.kind).toBe('combo');
    const v = setup('storm_hammer', [], 'thunder_strike');
    run(v, { moveY: -1, attack1: true }, 1);
    run(v, {}, 252);                                        // launch at +12 ticks; 2.0 s later the throw is ready
    run(v, { moveY: -1, attack1: true }, 1);
    run(v, {}, 13);
    expect(v.hammer).not.toBeNull();
  });
  it('dying removes the hammer and makes the throw ready', () => {
    const w = setup('storm_hammer');
    run(w, { moveY: -1, attack1: true }, 1);
    run(w, {}, 15);
    w.onPlayerDied('test');
    expect(w.hammer).toBeNull();
  });
});
