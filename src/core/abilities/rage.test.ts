import { describe, expect, it } from 'vitest';
import { newAbility, newWeapon } from './runtime.ts';
import type { AbilityId, AbilityLevel } from './types.ts';
import type { GameWorld, WorldEvent } from '../sim/gameWorld.ts';
import type { InputSpec } from '../sim/playerSim.ts';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';
import type { EnemyId } from '../enemies/types.ts';
import { hurtPlayer } from '../combat/health.ts';
import { rage } from './list/rage.ts';

interface Foe { id: EnemyId; x: number; y?: number; hp?: number }
function setup(ability: AbilityId, level: AbilityLevel = 1, foes: Foe[] = []): GameWorld {
  const w = arenaWorld({ enemies: foes.map((f) => ({ enemy: f.id, x: f.x, y: f.y ?? 320, facing: -1 })) });
  w.setLoadout({ weapons: [newWeapon('greatsword'), null], abilities: [newAbility(ability, level), null] });
  foes.forEach((f, i) => { const e = w.enemies[i]; e.hp = e.maxHp = f.hp ?? 5000; e.dormant = false; });
  stepSpec(w, {}, 2);
  return w;
}
const run = (w: GameWorld, spec: InputSpec, n = 1) => stepSpec(w, spec, n);
const hitsOn = (ev: WorldEvent[], id: number) => ev.filter((e): e is Extract<WorldEvent, { t: 'hit' }> => e.t === 'hit' && e.target === id).map((e) => e.amount);
/** One Greatsword swing at the dummy, from the same spot. */
function swing(w: GameWorld): number {
  w.teleportPlayer(200, 320);
  const ev = run(w, { attack1: true }, 1).concat(run(w, {}, 40));
  return hitsOn(ev, w.enemies[0].id)[0];
}

describe('Rage (03 §9.3)', () => {
  it('Lv1 makes a hit x1.30 for 720 ticks, then it ends', () => {
    const w = setup('rage', 1, [{ id: 'training_dummy', x: 230 }]);
    expect(swing(w)).toBe(16);
    run(w, { ability1: true }, 1);
    expect(rage(w)?.bonus).toBeCloseTo(0.30);
    expect(swing(w)).toBe(21);                                 // 16 x 1.30 = 20.8
    run(w, {}, 720);
    expect(rage(w)).toBeUndefined();
    expect(swing(w)).toBe(16);
  });
  it('recasting restarts the timer and does not stack', () => {
    const w = setup('rage', 1, [{ id: 'training_dummy', x: 230 }]);
    run(w, { ability1: true }, 1);
    run(w, {}, 300);
    w.abilities.slots[0]!.charges = 1;
    run(w, { ability1: true }, 1);
    expect(w.abilityEntities.filter((e) => e.kind === 'rage').length).toBe(1);
    expect(rage(w)!.left).toBeGreaterThan(700);
    expect(swing(w)).toBe(21);
  });
  it('Lv5 gives +0.60', () => {
    const w = setup('rage', 5);
    run(w, { ability1: true }, 1);
    expect(rage(w)!.bonus).toBeCloseTo(0.60);
  });
  it('super armor: an enemy hit does not cause hitstun while active', () => {
    const hurt = (active: boolean) => {
      const w = setup('rage');
      if (active) run(w, { ability1: true }, 1);
      const hp = w.health.hp;
      hurtPlayer(w, { kind: 'enemyHit', enemyId: 1, enemyDefId: 'bandit', damageA: 10, attackerCx: w.body.x - 20, melee: true });
      return { hp: w.health.hp < hp, stun: w.health.hitstunTicks > 0 };
    };
    expect(hurt(false)).toEqual({ hp: true, stun: true });
    expect(hurt(true)).toEqual({ hp: true, stun: false });
  });
});
