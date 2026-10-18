import { describe, expect, it } from 'vitest';
import { GameWorld } from './sim/gameWorld.ts';
import type { LevelObject } from './level/loadLevel.ts';
import { levelFrom, rect } from './testkit/levelData.ts';
import { stepSpec } from './testkit/combatWorld.ts';
import { dropItem } from './abilities/items.ts';
import { newAbility, newWeapon } from './abilities/runtime.ts';
import { hurtPlayer } from './combat/health.ts';
import { emptyInput } from './input.ts';

type ObjectDef = Omit<LevelObject, 'id'>;
const point = (type: string, x: number, y: number, props: LevelObject['props'] = {}): ObjectDef => ({ type, x, y, w: 0, h: 0, props });
function world(objects: ObjectDef[], spawn = { x: 200, y: 320 }) {
  const rows = Array.from({ length: 23 }, (_, y) => y >= 20 ? '#'.repeat(60) : `#${'.'.repeat(58)}#`);
  const level = levelFrom(rows, [point('player_start', spawn.x, spawn.y), ...objects], 'mountains');
  level.stage = 2;
  const w = GameWorld.fromLevel(level, { seedText: 'M71INTEGRATION', startKit: { cls: 'swordsman', weapon: 'greatsword' } });
  stepSpec(w, {});
  return w;
}
function board(w: GameWorld) {
  stepSpec(w, { interact: true });
  expect(w.body.state).toBe('minecart');
  stepSpec(w, {});
}

describe('Stage 2 mechanics through the real GameWorld', () => {
  it('a seated player has the specified 12 by 20 hurtbox above the cart', () => {
    const w = world([point('minecart', 200, 320, { dir: 1 })]);
    board(w);
    expect(w.body.w).toBe(12); expect(w.body.h).toBe(20);
    expect(w.body.y).toBe(w.minecarts[0].y - 8);
  });

  it('a press released between ticks starts a full cart jump before the later jump cut', () => {
    const w = world([point('minecart', 200, 320, { dir: 1 })]);
    board(w);
    const tap = emptyInput(); tap.jump = { held: false, pressed: true, released: true };
    w.step(tap);
    expect(w.body.state).toBe('minecart');
    expect(w.minecarts[0].vy).toBeCloseTo(-407.5, 8); // -420 plus one tick of gravity.
    w.step(emptyInput());
    expect(w.minecarts[0].vy).toBeCloseTo(-170.875, 8); // The release cuts on the following tick.
  });

  it('a fresh held airborne jump leaves the cart with a full double jump', () => {
    const w = world([point('minecart', 200, 320, { dir: 1 })]);
    board(w); stepSpec(w, { jump: true }); stepSpec(w, {});
    stepSpec(w, { jump: true });
    expect(w.body.cartId).toBeNull(); expect(w.body.state).toBe('air');
    expect(w.body.doubleJumpAvailable).toBe(false);
    expect(w.body.vy).toBeCloseTo(-333.5, 8); // -346 plus one normal gravity tick, without a cut.
  });

  it('a seated cart jump cancels weapon, cast startup, and drinking before their costs', () => {
    for (const action of ['attack1', 'ability1', 'heal'] as const) {
      const w = world([point('minecart', 200, 320, { dir: 1 })]);
      w.setLoadout({ weapons: [newWeapon('greatsword'), null], abilities: [newAbility('shockwave'), null] });
      w.health.hp = 50;
      board(w);
      const flask = w.flask.charges;
      stepSpec(w, { attack1: action === 'attack1', ability1: action === 'ability1', heal: action === 'heal' });
      if (action === 'attack1') expect(w.combat.current).not.toBeNull();
      if (action === 'ability1') expect(w.abilities.cast).not.toBeNull();
      if (action === 'heal') expect(w.drinking).not.toBeNull();
      stepSpec(w, { jump: true });
      expect(w.body.state).toBe('minecart'); expect(w.minecarts[0].vy).toBeLessThan(-400);
      expect(w.combat.current).toBeNull(); expect(w.abilities.cast).toBeNull(); expect(w.drinking).toBeNull();
      expect(w.abilities.slots[0]?.charges).toBe(1); expect(w.flask.charges).toBe(flask);
    }
  });

  it('takes nearer ground loot before the waiting cart, then boards on a fresh press', () => {
    const w = world([point('minecart', 204, 320, { dir: 1 })]);
    const item = dropItem(w, 200, 320, { weapon: newWeapon('katana') });
    stepSpec(w, {}, 2); stepSpec(w, { interact: true });
    expect(w.combat.slots[1]?.weaponId).toBe('katana');
    expect(w.groundItems).not.toContain(item);
    expect(w.body.state).not.toBe('minecart');
    stepSpec(w, {}); board(w);
  });

  it('boards the nearer waiting cart without also taking overlapping loot', () => {
    const w = world([point('minecart', 200, 320, { dir: 1 })]);
    const item = dropItem(w, 205, 320, { weapon: newWeapon('katana') });
    stepSpec(w, {}, 2); board(w);
    expect(w.combat.slots[1]).toBeNull();
    expect(w.groundItems).toContain(item);
  });

  it('uses the lower object id when loot and the waiting cart have the same center', () => {
    const w = world([point('minecart', 200, 320, { dir: 1 })]);
    const item = dropItem(w, 200, 320, { weapon: newWeapon('katana') });
    item.id = 500; // Deliberately higher than the cart's level object id 2.
    stepSpec(w, {}, 2); board(w);
    expect(w.groundItems).toContain(item);
  });

  it('a press that closes a weapon swap cannot also board an overlapping cart', () => {
    const w = world([point('minecart', 208, 320, { dir: 1 })]);
    w.setLoadout({ weapons: [newWeapon('greatsword'), newWeapon('war_maul')], abilities: [null, null] });
    dropItem(w, 200, 320, { weapon: newWeapon('katana') });
    stepSpec(w, {}, 2); stepSpec(w, { interact: true });
    expect(w.weaponSwapChoice).not.toBeNull();
    w.body.x = 208; stepSpec(w, {}); stepSpec(w, { interact: true });
    expect(w.weaponSwapChoice).toBeNull();
    expect(w.body.state).not.toBe('minecart');
    expect(w.minecarts[0].started).toBe(false);
  });

  it('death detaches the passenger and the empty cart keeps moving during the death second', () => {
    const w = world([point('minecart', 200, 320, { dir: 1 })]);
    board(w); stepSpec(w, {}, 30);
    const before = w.minecarts[0].x;
    hurtPlayer(w, { kind: 'hazard', cause: 'hazard', damageA: 1000 });
    stepSpec(w, {}, 30);
    expect(w.health.dead).toBe(true);
    expect(w.body.state).toBe('dead'); expect(w.body.cartId).toBeNull();
    expect(w.minecarts[0].rider).toBe(false);
    expect(w.minecarts[0].x).toBeGreaterThan(before);
  });

  it('Blade Dash and Blink each leave the cart before their own movement starts', () => {
    for (const id of ['blade_dash', 'blink'] as const) {
      const w = world([point('minecart', 200, 320, { dir: 1 })]);
      w.setLoadout({ weapons: [newWeapon('greatsword'), null], abilities: [newAbility(id), null] });
      board(w); stepSpec(w, {}, 20); const x = w.body.x;
      stepSpec(w, { ability1: true });
      expect(w.body.state).not.toBe('minecart'); expect(w.body.cartId).toBeNull();
      expect(w.minecarts[0].rider).toBe(false);
      if (id === 'blade_dash') { expect(w.body.state).toBe('forced'); expect(w.body.forced?.owner).toBe('ability:blade_dash'); }
      else expect(w.body.x).toBeGreaterThan(x + 60);
    }
  });

  it('a Shoulder Charge breaks a cracked wall reached later, in either direction', () => {
    for (const dir of [1, -1] as const) {
      const x = dir === 1 ? 200 : 312;
      const w = world([rect('cracked_wall', 16, 18, 1, 2, { id: 'skipWall' })], { x, y: 320 });
      w.setLoadout({ weapons: [newWeapon('greatsword'), null], abilities: [newAbility('shoulder_charge'), null] });
      stepSpec(w, { moveX: dir, ability1: true });
      expect(w.bodies.get('skipWall')?.active).toBe(true);
      stepSpec(w, { moveX: dir }, 31);
      expect(w.bodies.get('skipWall')?.active).toBe(false);
      expect(w.body.x).toBe(x + dir * 96);
    }
  });

  it('an ordinary weapon hit does not break a cracked wall', () => {
    const w = world([rect('cracked_wall', 16, 18, 1, 2, { id: 'skipWall' })], { x: 248, y: 320 });
    stepSpec(w, { attack1: true }, 80);
    expect(w.bodies.get('skipWall')?.active).toBe(true);
  });

  it('ice on a level SolidBody keeps the ice rates through loader and world construction', () => {
    const w = world([rect('collapsing_platform', 10, 19, 8, 1, { id: 'iceBridge', surface: 'ice', collapseDelay: 5 })], { x: 200, y: 304 });
    expect(w.body.onIce).toBe(true);
    stepSpec(w, { moveX: 1 }, 12);
    expect(w.body.vx).toBeCloseTo(45, 8); // 450 px/s² acceleration over 0.1 s.
    expect(w.body.onIce).toBe(true);
  });

  it('level rocks deal 18 unscaled through hurt rules, ignore ability protection, and never hurt enemies', () => {
    const objects = [rect('falling_rocks', 10, 10, 6, 10, { interval: 2 })];
    const w = world(objects);
    const dummy = w.spawnExtra({ enemy: 'training_dummy', x: 200, y: 320, facing: -1 });
    const enemyHp = dummy.hp;
    w.health.abilityIframeTicks = 9999;
    for (let i = 0; i < 240 && w.health.hp === 100; i++) stepSpec(w, {});
    expect(w.health.hp).toBe(82);
    expect(w.health.abilityIframeTicks).toBeGreaterThan(0);
    expect(w.health.iframeTicks).toBeGreaterThan(0);
    expect(w.run.stats.damageTaken).toBe(18);
    expect(dummy.hp).toBe(enemyHp); expect(w.run.stats.kills).toBe(0);

    const protectedWorld = world(objects);
    protectedWorld.health.iframeTicks = 9999;
    stepSpec(protectedWorld, {}, 240);
    expect(protectedWorld.health.hp).toBe(100);
  });
});
