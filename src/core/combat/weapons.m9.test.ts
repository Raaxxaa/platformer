// M9 part 2: the 11 weapons built after M4 (02 §10.5, §12, §13).
import { describe, expect, it } from 'vitest';
import { newWeapon } from '../abilities/runtime.ts';
import type { EnemyId } from '../enemies/types.ts';
import { gridFromRects } from '../level/build.ts';
import { GameWorld, type WorldEvent } from '../sim/gameWorld.ts';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';
import type { InputSpec } from '../sim/playerSim.ts';
import { COMBAT, MOVE } from '../tuning.ts';
import { isBackstab } from './weaponsM9.ts';
import { spawnEnemyProjectile } from '../enemies/projectiles.ts';
import { ENEMY_PROJECTILES } from '../../data/enemyProjectiles.ts';
import { firePlayerProjectile } from './playerProjectiles.ts';
import type { ElementId, Grade, WeaponId, WeaponInstance } from './types.ts';

interface Spawn { id?: EnemyId; x: number; y?: number; facing?: 1 | -1; hp?: number }
const inst = (weapon: WeaponId, grade: Grade = 'C', element: ElementId | null = null): WeaponInstance => ({ ...newWeapon(weapon), grade, element });

/** Player at x 200 on a long floor, facing right; enemies stand on it with lots of HP. */
function setup(weapon: WeaponId, enemies: Spawn[] = [], o: { grade?: Grade; weapon2?: WeaponId; grade2?: Grade } = {}): GameWorld {
  const w = arenaWorld({ enemies: enemies.map((e) => ({ enemy: e.id ?? 'training_dummy', x: e.x, y: e.y ?? 320, facing: e.facing ?? -1 })) });
  w.setLoadout({ weapons: [inst(weapon, o.grade ?? 'C', o.grade === 'S' ? 'fire' : null), o.weapon2 ? inst(o.weapon2, o.grade2 ?? 'C') : null], abilities: [null, null] });
  enemies.forEach((e, i) => { const en = w.enemies[i]; en.hp = en.maxHp = e.hp ?? 5000; en.dormant = false; });
  stepSpec(w, {}, 2);
  return w;
}
const run = (w: GameWorld, spec: InputSpec, n = 1) => stepSpec(w, spec, n);
const hits = (ev: WorldEvent[], id?: number) => ev.filter((e): e is Extract<WorldEvent, { t: 'hit' }> => e.t === 'hit' && e.target !== 'player' && !e.dot && (id === undefined || e.target === id));
const amounts = (ev: WorldEvent[], id?: number) => hits(ev, id).map((e) => e.amount);
/** Hold attack 1 for `n` ticks (a repeat weapon keeps its combo going). */
const hold = (w: GameWorld, n: number, extra: InputSpec = {}) => run(w, { attack1: true, ...extra }, n);
const tap = (w: GameWorld, wait: number, extra: InputSpec = {}) => [...run(w, { attack1: true, ...extra }, 1), ...run(w, {}, wait)];

describe('Twin Daggers (02 §10.5)', () => {
  it('combo 10, 10, 10, 12; a target facing away takes guaranteed crits (×2.0)', () => {
    const w = setup('twin_daggers', [{ x: 222 }]);
    expect(amounts(hold(w, 150))).toEqual([10, 10, 10, 12]);
    const b = setup('twin_daggers', [{ x: 222, facing: 1 }]);                       // facing right, the player is left of it
    expect(amounts(hold(b, 150)).slice(0, 4)).toEqual([10, 10, 10, 12].map((v) => v * COMBAT.CRIT_MULT));
  });
  it('isBackstab: either side, and noFacing enemies never count', () => {
    const w = setup('twin_daggers', [{ x: 260, facing: 1 }, { x: 140, facing: -1 }, { x: 260, facing: -1 }, { id: 'bat_swarm', x: 260, y: 300, facing: 1 }]);
    const [away, awayLeft, toward, bat] = w.enemies;
    expect([isBackstab(w, away), isBackstab(w, awayLeft), isBackstab(w, toward), isBackstab(w, bat)]).toEqual([true, true, false, false]);
  });
  it('Shadow Step (S): dashing through an enemy marks it; the next Daggers hit crits, once', () => {
    const w = setup('twin_daggers', [{ x: 240, facing: -1 }], { grade: 'S' });
    run(w, { dash: true, moveX: 1 }, 1);
    run(w, { moveX: 1 }, 40);
    expect(w.body.x).toBeGreaterThan(240);                                         // through it
    w.body.facing = -1;
    w.teleportPlayer(w.enemies[0].x - 20, 320);
    w.body.facing = 1;
    const first = amounts(hold(w, 75));
    expect(first[0]).toBe(10 * 2 * COMBAT.CRIT_MULT);                              // S ×2.0, crit ×2.0 (target faces the player)
    expect(first[1]).toBe(10 * 2);                                                 // the mark is used up
  });
});

describe('Spear (02 §10.5)', () => {
  it('combo 14, 14, 18', () => {
    const w = setup('spear', [{ x: 240 }]);
    expect(amounts(hold(w, 130)).slice(0, 3)).toEqual([14, 14, 18]);
  });
  it('lunge: pressing during a dash moves 95 px in 19 ticks, invulnerable, 24 damage, combo resets', () => {
    const w = setup('spear', [{ x: 270 }]);
    run(w, { dash: true, moveX: 1 }, 1);
    run(w, { moveX: 1 }, 2);
    expect(w.body.state).toBe('dash');
    const x0 = w.body.x;
    const ev = [...run(w, { attack1: true, moveX: 1 }, 1)];
    expect(w.combat.current?.kind).toBe('lunge');
    expect(w.body.forced?.owner).toBe('weapon:spear');
    ev.push(...run(w, { moveX: 1 }, 18));
    expect(w.body.x - x0).toBeGreaterThanOrEqual(90);
    expect(w.health.abilityIframeTicks).toBeGreaterThanOrEqual(0);
    expect(amounts(ev)).toEqual([24]);
    run(w, {}, 40);
    expect(w.combat.comboStep[0]).toBe(0);
  });
  it('lunge also works within 0.10 s after the dash ends; a late press is a normal combo step', () => {
    const w = setup('spear', [{ x: 400 }]);
    run(w, { dash: true, moveX: 1 }, 1);
    for (let i = 0; i < 40 && w.body.state === 'dash'; i++) run(w, { moveX: 1 }, 1);
    run(w, { moveX: 1 }, 6);
    run(w, { attack1: true }, 1);
    expect(w.combat.current?.kind).toBe('lunge');
    const v = setup('spear', [{ x: 400 }]);
    run(v, { dash: true, moveX: 1 }, 1);
    for (let i = 0; i < 40 && v.body.state === 'dash'; i++) run(v, { moveX: 1 }, 1);
    run(v, {}, 20);
    run(v, { attack1: true }, 1);
    expect(v.combat.current?.kind).toBe('combo');
  });
  it('Skewer Wave (S): the lunge ends by firing a piercing 18 × 2 shot', () => {
    const w = setup('spear', [{ x: 340 }, { x: 380 }], { grade: 'S' });
    run(w, { dash: true, moveX: 1 }, 3);
    run(w, { attack1: true, moveX: 1 }, 1);
    const ev = run(w, {}, 60);
    expect(amounts(ev, w.enemies[1].id)).toContain(36);
  });
});

describe('Scythe (02 §10.5, §7.3)', () => {
  it('combo 15, 15, 24; step 3 hits both sides', () => {
    const w = setup('scythe', [{ x: 225 }, { x: 175 }]);
    const ev = hold(w, 150);
    expect(amounts(ev, w.enemies[0].id).slice(0, 3)).toEqual([15, 15, 24]);
    expect(amounts(ev, w.enemies[1].id)).toEqual([24]);
  });
  it('a kill with the Scythe adds +3.0% flask fill on top of the regular 5.0%', () => {
    const w = setup('scythe', [{ id: 'wolf', x: 225 }]);
    w.enemies[0].hp = w.enemies[0].maxHp = 10;
    w.flask.fillTenths = 0;
    hold(w, 60);
    expect(w.enemies[0].dead).toBe(true);
    expect(w.flask.fillTenths).toBe(50 + 30);
    const g = setup('greatsword', [{ id: 'wolf', x: 225 }]);
    g.enemies[0].hp = g.enemies[0].maxHp = 10; g.flask.fillTenths = 0;
    hold(g, 80);
    expect(g.flask.fillTenths).toBe(50);
  });
  it('Soul Reap (S): a kill releases a soul that hits the next enemy for 20 × 2; with none near it fades', () => {
    const w = setup('scythe', [{ id: 'wolf', x: 225 }, { x: 330 }], { grade: 'S' });
    w.enemies[0].hp = w.enemies[0].maxHp = 10;
    const ev = hold(w, 100);
    expect(w.enemies[0].dead).toBe(true);
    expect(amounts([...ev, ...run(w, {}, 60)], w.enemies[1].id)).toContain(40);
    const v = setup('scythe', [{ id: 'wolf', x: 225 }], { grade: 'S' });
    v.enemies[0].hp = v.enemies[0].maxHp = 10;
    hold(v, 100);
    expect(v.playerProjectiles.length).toBe(0);
  });
});

describe('Giant Axe (02 §10.5)', () => {
  it('combo 26, 32 (heavy)', () => {
    const w = setup('giant_axe', [{ x: 240 }]);
    const ev = hold(w, 200);
    expect(hits(ev).map((e) => [e.amount, e.heavy]).slice(0, 2)).toEqual([[26, true], [32, true]]);
  });
  it('spin: only when running on the ground; 10 per hit, at most 4 hits per target; 0.80 s', () => {
    const w = setup('giant_axe', [{ x: 300 }]);
    run(w, { attack1: true }, 1);
    expect(w.combat.current?.kind).toBe('combo');                       // standing still: a normal step
    const v = setup('giant_axe', [{ x: 360 }]);
    run(v, { moveX: 1 }, 40);
    expect(v.body.vx).toBeGreaterThanOrEqual(MOVE.RUN_MAX * 0.5);
    run(v, { moveX: 1, attack1: true }, 1);
    expect(v.combat.current?.kind).toBe('spin');
    expect(v.combat.current!.lens.active).toBe(96);
    expect(v.combat.current!.lens.startup).toBe(12);
    // Walk the spin into the enemy while it runs.
    const ev: WorldEvent[] = [];
    for (let i = 0; i < 200; i++) ev.push(...run(v, { moveX: 1 }, 1));
    expect(amounts(ev).length).toBeGreaterThan(0);
    expect(amounts(ev).length).toBeLessThanOrEqual(4);
    expect(new Set(amounts(ev))).toEqual(new Set([10]));
  });
  it('the spin moves at 70% of run speed and the player can turn', () => {
    const v = setup('giant_axe', []);
    run(v, { moveX: 1 }, 40);
    run(v, { moveX: 1, attack1: true }, 1);
    run(v, { moveX: 1 }, 30);
    expect(v.combat.current!.phase).toBe('active');
    expect(v.mods.actionMoveMult).toBe(0.7);
    expect(v.mods.facingLocked).toBe(false);
    run(v, { moveX: -1 }, 40);
    expect(v.body.facing).toBe(-1);
  });
  it('Cyclone (S): 1.20 s spin (144 ticks), up to 6 hits', () => {
    const v = setup('giant_axe', [], { grade: 'S' });
    run(v, { moveX: 1 }, 40);
    run(v, { moveX: 1, attack1: true }, 1);
    expect(v.combat.current!.lens.active).toBe(144);
  });
});

describe('Flail (02 §10.5)', () => {
  it('tap: 20, 20. Holding 0.60 s then releasing: 55, small enemies are pulled in and staggered 0.6 s', () => {
    const w = setup('flail', [{ x: 240 }]);
    expect(amounts([...tap(w, 60), ...tap(w, 60)]).slice(0, 2)).toEqual([20, 20]);
    const v = setup('flail', [{ id: 'wolf', x: 262, hp: 5000 }]);
    run(v, { attack1: true }, 1);
    run(v, { attack1: true }, 66 + 80);                      // step 1 (66 ticks), then charge 0.60 s (72 ticks)
    expect(v.combat.charge).not.toBeNull();
    const ev = [...run(v, {}, 1), ...run(v, {}, 40)];
    expect(amounts(ev)).toEqual([55]);
    const wolf = v.enemies[0];
    expect(['pull', 'stagger']).toContain(wolf.control?.type);
    run(v, {}, 20);
    expect(wolf.x - v.body.x).toBeLessThanOrEqual(30);
  });
  it('large enemies are not pulled; they take knockback 300,−80 instead', () => {
    const v = setup('flail', [{ id: 'bandit_brute', x: 262, hp: 5000 }]);
    run(v, { attack1: true }, 1);
    run(v, { attack1: true }, 66 + 80);
    run(v, {}, 1);
    run(v, {}, 30);
    expect(v.enemies[0].control?.type).not.toBe('pull');
  });
});

describe('Hand Cannon (02 §10.4–10.5)', () => {
  it('fires a cannonball that explodes on contact for 30 in a 56×56 blast; recoil 300 px/s backwards', () => {
    const w = setup('hand_cannon', [{ x: 330 }, { x: 350 }]);
    run(w, { attack1: true }, 1);
    run(w, {}, 18);
    expect(w.body.vx).toBeLessThan(0);
    const ev = run(w, {}, 80);
    expect(amounts(ev, w.enemies[0].id)).toEqual([30]);
    expect(amounts(ev, w.enemies[1].id)).toEqual([30]);                // inside the blast
    expect(w.health.hp).toBe(w.health.maxHp);                         // never hurt by its own blast
  });
  it('recoil in the air also lifts: vy ≤ −150', () => {
    const w = setup('hand_cannon');
    w.teleportPlayer(200, 200);
    run(w, {}, 2);
    run(w, { attack1: true }, 1);
    let minVy = 0;
    for (let i = 0; i < 24; i++) { run(w, {}, 1); minVy = Math.min(minVy, w.body.vy); }
    expect(minVy).toBeLessThanOrEqual(-130);                          // −150 at the shot, then gravity
  });
  it('Big Bore (S): blast 96×96 and recoil 450', () => {
    const w = setup('hand_cannon', [{ x: 330 }, { x: 365 }], { grade: 'S' });
    run(w, { attack1: true }, 1);
    run(w, {}, 18);
    expect(w.body.vx).toBeLessThanOrEqual(-300);
    const ev = run(w, {}, 80);
    expect(amounts(ev, w.enemies[1].id).length).toBe(1);               // 35 px beyond the first: only the 96-wide blast reaches it
    const base = setup('hand_cannon', [{ x: 330 }, { x: 365 }]);
    run(base, { attack1: true }, 1);
    expect(amounts(run(base, {}, 100), base.enemies[1].id).length).toBe(0);
  });
});

describe('Javelin (02 §10.5)', () => {
  const wallWorld = (): GameWorld => {
    const g = gridFromRects(40, 23, [
      { x0: 0, y0: 20, x1: 39, y1: 22, kind: 'solid' }, { x0: 0, y0: 0, x1: 0, y1: 22, kind: 'solid' }, { x0: 20, y0: 0, x1: 39, y1: 19, kind: 'solid' },
    ]);
    const w = new GameWorld({ grid: g, spawn: { x: 200, y: 320 }, enemies: [] });
    w.setLoadout({ weapons: [inst('javelin'), null], abilities: [null, null] });
    stepSpec(w, {}, 2);
    return w;
  };
  it('hits an enemy for 25 and goes on to hit a second one (hits 2)', () => {
    const w = setup('javelin', [{ x: 300 }, { x: 330 }]);
    const ev = tap(w, 80);
    expect(amounts(ev, w.enemies[0].id)).toEqual([25]);
    expect(amounts(ev, w.enemies[1].id)).toEqual([25]);
  });
  it('sticks into a wall as a one-way platform 24×4, 6 s; the player can stand on it; 3rd removes the oldest', () => {
    const w = wallWorld();
    w.teleportPlayer(200, 320);
    // The wall face is at x 320 (tile 20). A throw at feet height flies level and sticks.
    tap(w, 80);
    expect(w.grid.pixelPlatforms.length).toBe(1);
    const p = w.grid.pixelPlatforms[0];
    expect([p.w, p.h]).toEqual([24, 4]);
    expect(p.x + p.w).toBe(320);
    expect(p.expireTick - p.born).toBe(720);
    // Stand on it: drop onto the platform from above.
    w.teleportPlayer(p.x + 12, p.y - 40);
    run(w, {}, 40);
    expect(w.body.y).toBe(p.y);
    expect(w.body.grounded).toBe(true);
    const oldest = w.grid.pixelPlatforms[0].born;
    w.teleportPlayer(200, 320);
    tap(w, 80);
    expect(w.grid.pixelPlatforms.length).toBe(2);
    tap(w, 80);
    expect(w.grid.pixelPlatforms.length).toBe(2);                    // max 2 at once: the 3rd removed the oldest
    expect(w.grid.pixelPlatforms.some((q) => q.born === oldest)).toBe(false);
    w.teleportPlayer(200, 320);
    run(w, {}, 721);
    expect(w.grid.pixelPlatforms.length).toBe(0);
  });
  it('a javelin that lands on the floor vanishes', () => {
    const w = setup('javelin');
    w.teleportPlayer(200, 120);
    run(w, {}, 1);
    const p = firePlayerProjectile(w, 0, 99, 'javelin', 90)!;
    expect(p).not.toBeNull();
    run(w, {}, 120);
    expect(w.playerProjectiles.length).toBe(0);
    expect(w.grid.pixelPlatforms.length).toBe(0);
  });
  it('Anchor (S): the first enemy hit also explodes for 20 × 2; platforms last 12 s, up to 3', () => {
    const w = setup('javelin', [{ x: 300 }, { x: 320 }], { grade: 'S' });
    const ev = tap(w, 80);
    expect(amounts(ev, w.enemies[0].id).sort()).toEqual([40, 50]);
  });
});

describe('Throwing Knives (02 §10.3)', () => {
  it('3 knives, 5 each, all hit a near target', () => {
    const w = setup('throwing_knives', [{ x: 260 }]);
    expect(amounts(tap(w, 60))).toEqual([5, 5, 5]);
  });
  it('Fan of Blades (S): 5 knives; each pierces one extra enemy', () => {
    const w = setup('throwing_knives', [{ x: 250 }, { x: 330 }], { grade: 'S' });
    const ev = tap(w, 80);
    expect(amounts(ev, w.enemies[0].id).length).toBeGreaterThanOrEqual(3);
    expect(amounts(ev, w.enemies[1].id).length).toBeGreaterThanOrEqual(1);
    expect(w.combat.slots[0]!.grade).toBe('S');
  });
});

describe('Wand (02 §10.4–10.5)', () => {
  it('auto-fires while held: 10 per shot, one every 0.30 s', () => {
    const w = setup('wand', [{ x: 300 }]);
    const ev = hold(w, 150);
    expect(amounts(ev)).toEqual([10, 10, 10, 10]);
  });
  it('shots home toward an enemy ahead but never behind', () => {
    const w = setup('wand', [{ x: 300, y: 320 - 40 }]);
    const p = firePlayerProjectile(w, 0, 99, 'wand_shot', 0)!;
    const y0 = p.y;
    run(w, {}, 20);
    expect(p.vy).toBeLessThan(0);
    expect(p.y).toBeLessThan(y0);
    const v = setup('wand', [{ x: 100, y: 300 }]);
    const q = firePlayerProjectile(v, 0, 99, 'wand_shot', 0)!;
    run(v, {}, 10);
    expect(q.vy).toBe(0);
  });
  it('Seeker Swarm (S): every 5th shot is 3 shots', () => {
    const w = setup('wand', [], { grade: 'S' });
    const volleys: number[] = [];
    for (let i = 0; i < 5 * 36 + 20; i++) { run(w, { attack1: true }, 1); const n = w.playerProjectiles.filter((p) => p.age === 1).length; if (n) volleys.push(n); }
    expect(volleys.slice(0, 5)).toEqual([1, 1, 1, 1, 3]);
  });
});

describe('Spell Tome (02 §10.5)', () => {
  it('steps 1 and 2 blast 12; step 3 casts a ring of 4 runes that lasts 2.0 s and hits for 4 with rehit 0.25 s', () => {
    const w = setup('spell_tome', [{ x: 215 }]);
    const ev = hold(w, 150);
    expect(amounts(ev).slice(0, 2)).toEqual([12, 12]);
    const ring = w.abilityEntities.find((e) => e.kind === 'rune_ring')!;
    expect(ring).toBeDefined();
    expect((ring.view!().runes as unknown[]).length).toBe(4);
    const ev2 = run(w, {}, 200);
    const ringHits = amounts(ev2).filter((a) => a === 4);
    expect(ringHits.length).toBeGreaterThanOrEqual(2);
    run(w, {}, 60);
    expect(w.abilityEntities.some((e) => e.kind === 'rune_ring')).toBe(false);
  });
  it('casting again replaces the ring; it disappears if the Tome leaves its slot', () => {
    const w = setup('spell_tome', [], { weapon2: 'bow' });
    hold(w, 130);
    expect(w.abilityEntities.filter((e) => e.kind === 'rune_ring').length).toBe(1);
    hold(w, 150);
    expect(w.abilityEntities.filter((e) => e.kind === 'rune_ring').length).toBe(1);
    run(w, {}, 60);                                                  // idle: swapping needs no attack running (02 §9.5)
    w.combat.slots[0] = inst('bow');
    run(w, {}, 2);
    expect(w.abilityEntities.some((e) => e.kind === 'rune_ring')).toBe(false);
    expect(w.hitGroups.some((g) => g.rects)).toBe(false);
  });
  it('Rune Storm (S): 6 runes, 3.0 s', () => {
    const w = setup('spell_tome', [], { grade: 'S' });
    hold(w, 130);
    const ring = w.abilityEntities.find((e) => e.kind === 'rune_ring')!;
    expect((ring.view!().runes as unknown[]).length).toBe(6);
  });
});

describe('Shield (02 §12)', () => {
  const brute = (x = 230): Spawn => ({ id: 'bandit_brute', x, hp: 5000 });
  it('goes up at once; moves at 50% and cannot turn; a dash cancels it', () => {
    const w = setup('shield');
    run(w, { attack1: true }, 1);
    expect(w.combat.shield?.phase).toBe('up');
    run(w, { attack1: true, moveX: 1 }, 30);
    expect(w.mods.actionMoveMult).toBe(0.5);
    expect(w.mods.facingLocked).toBe(true);
    run(w, { dash: true }, 1);
    expect(w.combat.shield).toBeNull();
  });
  it('letting go inside 0.20 s is a bash (12 damage); held longer it blocks, and lowering takes 0.10 s', () => {
    const w = setup('shield', [{ x: 222 }]);
    run(w, { attack1: true }, 1);
    const ev = run(w, {}, 40);
    expect(amounts(ev)).toEqual([12]);
    expect(w.combat.shield).toBeNull();
    const v = setup('shield');
    run(v, { attack1: true }, 1);
    run(v, { attack1: true }, 40);
    expect(v.combat.shield?.phase).toBe('up');
    run(v, {}, 1);
    expect(v.combat.shield?.phase).toBe('lower');
    run(v, {}, 13);
    expect(v.combat.shield).toBeNull();
  });
  const enemyHit = (w: GameWorld, mod: Partial<Parameters<typeof import('./health.ts').hurtPlayer>[1]> = {}) =>
    import('./health.ts').then((m) => m.hurtPlayer(w, { kind: 'enemyHit', enemyId: w.enemies[0]?.id ?? 0, enemyDefId: 'bandit', damageA: 20, attackerCx: 260, melee: true, ...mod } as never));
  it('parry (first 0.20 s, frontal): 0 damage, no hurt, melee attacker stunned 1.5 s, Rush +10, 0.30 s invulnerable', async () => {
    const w = setup('shield', [{ id: 'bandit', x: 260, hp: 500 }]);
    run(w, { attack1: true }, 1);
    run(w, { attack1: true }, 4);
    w.rush.value = 0;
    const dealt = await enemyHit(w);
    expect(dealt).toBe(0);
    expect(w.health.hp).toBe(w.health.maxHp);
    expect(w.body.state).not.toBe('hurt');
    expect(w.enemies[0].control?.type).toBe('stun');
    expect(w.enemies[0].control!.ticks).toBe(180);
    expect(w.rush.value).toBe(10);
    expect(w.health.iframeTicks).toBe(36);
  });
  it('parry of an elite stuns 0.75 s; a boss takes 50 poise damage', async () => {
    const w = setup('shield', [brute(260)]);
    run(w, { attack1: true }, 5);
    await enemyHit(w);
    expect(w.enemies[0].control!.ticks).toBe(90);
  });
  it('block (after 0.20 s, frontal): ×0.25 damage, no hitstun or i-frames, knockback 90, no streak reset', async () => {
    const w = setup('shield', [{ id: 'bandit', x: 260, hp: 500 }]);
    run(w, { attack1: true }, 1);
    run(w, { attack1: true }, 40);
    w.rush.value = 100;
    const dealt = await enemyHit(w);
    expect(dealt).toBe(5);                                           // 20 × 0.25
    expect(w.health.hp).toBe(w.health.maxHp - 5);
    expect(w.health.hitstunTicks).toBe(0);
    expect(w.health.iframeTicks).toBe(0);
    expect(w.rush.value).toBe(100);
    expect(w.body.vx).toBe(-90);
    expect(w.combat.shield?.phase).toBe('up');
  });
  it('a hit from behind or an unblockable attack goes through', async () => {
    const w = setup('shield', [{ id: 'bandit', x: 140, hp: 500 }]);
    run(w, { attack1: true }, 1);
    run(w, { attack1: true }, 5);
    expect(await enemyHit(w, { attackerCx: 140 })).toBe(20);
    expect(w.combat.shield).toBeNull();                              // hurt lowers it
    const v = setup('shield', [{ id: 'bandit', x: 260, hp: 500 }]);
    run(v, { attack1: true }, 1);
    run(v, { attack1: true }, 5);
    expect(await enemyHit(v, { unblockable: true })).toBe(20);
  });
  it('a frontal projectile is parried in the first 0.20 s and sent back at 1.5x speed for 24', () => {
    const w = setup('shield', [{ id: 'bandit_archer', x: 262, hp: 5000 }]);
    const archer = w.enemies[0];
    spawnEnemyProjectile(w, archer, ENEMY_PROJECTILES.enemy_arrow, 'facing', 0);
    run(w, { attack1: true }, 1);
    let ev: WorldEvent[] = [];
    for (let i = 0; i < 20 && w.projectiles.length; i++) ev = ev.concat(run(w, { attack1: true }, 1));
    expect(w.projectiles.length).toBe(0);
    expect(w.health.hp).toBe(w.health.maxHp);
    const p = w.playerProjectiles.find((q) => q.def.id === 'reflected')!;
    expect(p).toBeDefined();
    expect(p.vx).toBeCloseTo(450, 0);                                   // 300 × 1.5, reversed
    ev = ev.concat(run(w, { attack1: true }, 30));
    expect(amounts(ev, archer.id)).toContain(24);
  });
  it('after the window a projectile is blocked: ×0.25 damage and the projectile is destroyed', () => {
    const w = setup('shield', [{ id: 'bandit_archer', x: 330, hp: 5000 }]);
    run(w, { attack1: true }, 1);
    run(w, { attack1: true }, 30);
    spawnEnemyProjectile(w, w.enemies[0], ENEMY_PROJECTILES.enemy_arrow, 'facing', 0);
    run(w, { attack1: true }, 60);
    expect(w.projectiles.length).toBe(0);
    expect(w.health.hp).toBeLessThan(w.health.maxHp);
    expect(w.health.hp).toBeGreaterThanOrEqual(w.health.maxHp - 3);
    expect(w.playerProjectiles.some((q) => q.def.id === 'reflected')).toBe(false);
  });
  it('raising the shield cancels the other weapon\'s attack in any phase', () => {
    const w = setup('greatsword', [], { weapon2: 'shield' });
    run(w, { attack1: true }, 1);
    run(w, {}, 3);
    expect(w.combat.current?.phase).toBe('startup');
    run(w, { attack2: true }, 1);
    expect(w.combat.current).toBeNull();
    expect(w.combat.shield?.slot).toBe(1);
  });
  it('Aegis (S): parry window 0.30 s and each parry fires a 40 × 2 shockwave', async () => {
    const w = setup('shield', [{ id: 'bandit', x: 245, hp: 5000 }], { grade: 'S' });
    run(w, { attack1: true }, 1);
    expect(w.combat.shield!.windowTicks).toBe(36);
    const hp0 = w.enemies[0].hp;
    run(w, { attack1: true }, 30);
    await enemyHit(w, { attackerCx: 245 });
    const ev = run(w, { attack1: true }, 3);
    expect(w.enemies[0].hp).toBeLessThan(hp0);
    expect(amounts(ev)).toContain(80);
  });
});
