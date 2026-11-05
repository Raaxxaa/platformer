import { describe, expect, it } from 'vitest';
import { newWeapon } from '../abilities/runtime.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import type { InputSpec } from '../sim/playerSim.ts';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';
import type { EnemyId } from '../enemies/types.ts';
import type { WeaponId } from './types.ts';

// M15 Task 1 (02 §9.6a): move selection for the Launcher, up air attack and Rushing Strike.
function setup(weapon: WeaponId, enemy?: { id: EnemyId; x: number }): GameWorld {
  const w = arenaWorld({ enemies: enemy ? [{ enemy: enemy.id, x: enemy.x, y: 320, facing: -1 }] : [] });
  w.setLoadout({ weapons: [newWeapon(weapon), null], abilities: [null, null] });
  for (const e of w.enemies) { e.hp = e.maxHp = 5000; e.dormant = false; }
  stepSpec(w, {}, 2);
  return w;
}
const run = (w: GameWorld, s: InputSpec, n = 1) => stepSpec(w, s, n);

describe('Smash-style moves (02 §9.6a)', () => {
  it('Up + button on the ground is the Launcher; it launches a Wolf and a Bandit, but only knocks back a Brute', () => {
    for (const [id, launched] of [['wolf', true], ['bandit', true], ['bandit_brute', false]] as const) {
      const w = setup('greatsword', { id, x: 225 });
      run(w, { moveY: -1, attack1: true }); expect(w.combat.current?.kind).toBe('launcher');
      run(w, {}, 40);
      expect(w.enemies[0].control?.type === 'launch', id).toBe(launched);
    }
  });
  it('Up + button in the air is the up air attack with a hop, once per airtime; Down + button is still a dive', () => {
    const w = setup('katana');
    run(w, { jump: true }); run(w, {}, 4);
    run(w, { moveY: -1, attack1: true }); expect(w.combat.current?.kind).toBe('upAir');
    while (w.combat.current?.phase === 'startup') run(w, {});
    expect(w.body.vy).toBeLessThanOrEqual(-120); expect(w.combat.uppercutUsed).toBe(true);   // −140 set on the active tick, then one tick of gravity
    const d = setup('katana'); run(d, { jump: true }); run(d, {}, 20);
    run(d, { moveY: 1, attack1: true }); expect(d.combat.current?.kind ?? null).not.toBe('upAir');
    expect(d.body.state.startsWith('dive')).toBe(true);
  });
  it('attack during a dash: Greatsword → Rushing Strike; Spear → lunge (unchanged); ranged → normal shot', () => {
    const g = setup('greatsword'); run(g, { dash: true }); run(g, {}, 4); run(g, { attack1: true });
    expect(g.combat.current?.kind).toBe('dashAtk');
    const s = setup('spear'); run(s, { dash: true }); run(s, {}, 4); run(s, { attack1: true });
    expect(s.combat.current?.kind).toBe('lunge');
    const b = setup('bow'); run(b, { dash: true }); run(b, {}, 30); run(b, { attack1: true });
    expect(b.combat.current?.kind).toBe('combo');
  });
  it('ranged weapons fire straight up with Up', () => {
    const w = setup('bow'); run(w, { moveY: -1, attack1: true });
    while (w.playerProjectiles.length === 0 && w.combat.current) run(w, {});
    const p = w.playerProjectiles[0]; expect(p.vx).toBeCloseTo(0); expect(p.vy).toBeLessThan(0);
    expect(p.y + p.traveled).toBeCloseTo(w.body.y - 30);
  });
  it('the Rushing Strike gives the Rush dash-attack bonus', () => {
    const w = setup('greatsword', { id: 'bandit', x: 260 }); w.rush.value = 0;
    run(w, { dash: true }); run(w, {}, 4); run(w, { attack1: true }); run(w, {}, 30);
    expect(w.rush.value).toBeGreaterThan(0);
  });
});
