import { describe, expect, it } from 'vitest';
import { newWeapon } from '../abilities/runtime.ts';
import type { WorldEvent } from '../sim/gameWorld.ts';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';
import type { WeaponId, WeaponInstance } from './types.ts';
import { chargeTimeOf } from './signatures.ts';
import { WEAPONS } from '../../data/weapons.ts';

const S = (id: WeaponId): WeaponInstance => ({ ...newWeapon(id), grade: 'S', element: 'fire', perk: 'keen' });
function world(id: WeaponId, enemies: { x: number; enemy?: 'wolf' | 'bandit_brute' | 'training_dummy' }[]) {
  const w = arenaWorld({ enemies: enemies.map((e) => ({ enemy: e.enemy ?? 'training_dummy', x: e.x, y: 320, facing: -1 as const })) });
  w.setLoadout({ weapons: [S(id), null], abilities: [null, null] });
  stepSpec(w, {}, 2);
  for (const e of w.enemies) e.dormant = false;
  return w;
}
const hitsOn = (ev: WorldEvent[], id: number) => ev.filter((e) => e.t === 'hit' && e.target === id && !e.dot && !e.chainFrom).map((e) => (e as { amount: number }).amount);
/** Presses attack whenever the previous step is in recovery (or idle) until `n` steps have started. */
function combo(w: ReturnType<typeof world>, n: number): WorldEvent[] {
  const ev: WorldEvent[] = [];
  let started = 0, lastKey = '';
  for (let i = 0; i < 400 && started < n; i++) {
    const c = w.combat.current;
    const press = (!c || c.phase === 'recovery') && i % 2 === 0;
    ev.push(...stepSpec(w, press ? { attack1: true } : {}, 1));
    const k = w.combat.current ? `${w.combat.current.attackInstance}` : '';
    if (k && k !== lastKey) { started++; lastKey = k; }
  }
  ev.push(...stepSpec(w, {}, 150));
  return ev;
}
/** Holds attack long enough to charge, then releases. */
const charged = (w: ReturnType<typeof world>) => [...stepSpec(w, { attack1: true }, 140), ...stepSpec(w, {}, 1)];

describe('S-grade signatures (02 §13)', () => {
  it('Greatsword Ground Wave: the cleave sends a floor wave that hits a far enemy for 16 × S 2.0', () => {
    const w = world('greatsword', [{ x: 360 }]);
    const ev = combo(w, 3);
    expect(hitsOn(ev, w.enemies[0].id)).toContain(16 * 2 * 1);
  });
  it('Katana Phantom Edge: charge time 0.25 s; the dash path detonates for 24 × 2', () => {
    const w = world('katana', [{ x: 260 }]);
    expect(chargeTimeOf(w, 0, WEAPONS.katana!)).toBe(0.25);
    const ev = [...charged(w), ...stepSpec(w, {}, 120)];
    expect(hitsOn(ev, w.enemies[0].id)).toContain(48);
  });
  it('War Maul Quake: step 2 sends floor waves left and right (16 × 2, knockdown)', () => {
    const w = world('war_maul', [{ x: 80 }, { x: 330 }]);
    const ev = combo(w, 2);
    expect(hitsOn(ev, w.enemies[0].id)).toContain(32);
    expect(hitsOn(ev, w.enemies[1].id)).toContain(32);
  });
  it('Iron Fists Thunderclap: the uppercut blasts 0,−16,96,48 for 16 × 2', () => {
    const w = world('iron_fists', [{ x: 222 }]);
    const ev = combo(w, 4);
    expect(hitsOn(ev, w.enemies[0].id)).toContain(32);
  });
  it('Bow Triple Shot: the charged shot fires 3 arrows; the sides deal 16 × 2', () => {
    const w = world('bow', [{ x: 400 }]);
    charged(w);
    stepSpec(w, {}, 8);
    expect(w.playerProjectiles.length).toBe(3);
    expect(w.playerProjectiles.map((p) => w.hitGroups.find((g) => g.id === p.groupId)!.spec.damage).sort()).toEqual([16, 16, 32]);
  });
  it('Crossbow Impaler: bolts pierce up to 3 enemies', () => {
    const w = world('crossbow', [{ x: 260 }, { x: 290 }, { x: 320 }, { x: 350 }]);
    const ev = [...stepSpec(w, { attack1: true }, 1), ...stepSpec(w, {}, 60)];
    expect(w.enemies.filter((e) => hitsOn(ev, e.id).length > 0).length).toBe(3);
  });
  it('Storm Hammer Tempest: the thrown hammer drops clouds every 0.10 s that hit for 5 × 2', () => {
    const w = world('storm_hammer', [{ x: 300 }]);
    const ev = [...stepSpec(w, { moveY: -1, attack1: true }, 1), ...stepSpec(w, {}, 150)];
    expect(hitsOn(ev, w.enemies[0].id)).toContain(10);
  });
  it('Staff Singularity: the charged orb pulls small enemies within 64 px; its blast is 112 × 112', async () => {
    const { firePlayerProjectile } = await import('./playerProjectiles.ts');
    const { signatureFire, stepSignatures } = await import('./signatures.ts');
    const w = world('staff', [{ x: 300, enemy: 'wolf' }]);
    const sg = signatureFire(w, { slot: 0, step: 0, phase: 'active', phaseTicks: 1, attackInstance: 1, lens: { startup: 1, active: 0, recovery: 1 }, faceAway: false, kind: 'charged' }, {});
    expect(sg.opts.singularity).toBe(true);
    expect(sg.opts.blastMult).toBeCloseTo(112 / 80);
    const orb = firePlayerProjectile(w, 0, 1, 'orb', 0, sg.opts)!;
    orb.vx = 0; orb.x = w.enemies[0].x - 50;
    const x0 = w.enemies[0].x;
    stepSignatures(w);
    expect(w.enemies[0].x).toBeLessThan(x0);
  });
});
