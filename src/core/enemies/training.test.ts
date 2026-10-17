import { describe, expect, it } from 'vitest';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';
import { kitLoadout } from '../abilities/runtime.ts';
import { dummyDps } from '../../ui/hud/dummyDps.ts';

describe('training enemies (04 §2.10–2.12)', () => {
  it('the dummy never dies; its HP returns 1.0 s after the last hit', () => {
    const w = arenaWorld({ enemies: [{ enemy: 'training_dummy', x: 230, y: 320, facing: -1 }] });
    const e = w.enemies[0]; e.dormant = false;
    stepSpec(w, { attack1: true }, 1); stepSpec(w, {}, 40);
    expect(e.hp).toBeLessThan(9999);
    e.hp = 1;
    stepSpec(w, { attack1: true }, 1); stepSpec(w, {}, 40);
    expect(e.dead).toBe(false);
    stepSpec(w, {}, 250);
    expect(e.hp).toBe(9999);
  });
  it('the sparring dummy swings every 2.0 s with a 0.6 s Tele and deals 0 damage', () => {
    const w = arenaWorld({ enemies: [{ enemy: 'sparring_dummy', x: 240, y: 320, facing: -1 }] });
    w.enemies[0].dormant = false;
    const teles: number[] = [];
    let hits = 0;
    for (let i = 0; i < 500; i++) {
      for (const ev of stepSpec(w, {}, 1)) {
        if (ev.t === 'enemyTelegraph') teles.push(w.tick);
        if (ev.t === 'sparringHit') hits += 1;
      }
    }
    expect(teles.length).toBeGreaterThanOrEqual(2);
    expect(teles[1] - teles[0]).toBe(240);
    expect(hits).toBeGreaterThan(0);
    expect(w.health.hp).toBe(100);
  });
  it('a straw target breaks in one hit, gives +15 Rush and no gold, and comes back after 3.0 s', () => {
    const w = arenaWorld({ enemies: [{ enemy: 'straw_target', x: 225, y: 320, facing: -1 }] });
    w.enemies[0].dormant = false;
    const r0 = w.rush.value;
    const ev = [...stepSpec(w, { attack1: true }, 1), ...stepSpec(w, {}, 40)];
    expect(w.enemies[0].dead).toBe(true);
    expect(w.gold).toBe(0);
    expect(w.rush.value - r0).toBeGreaterThanOrEqual(15);
    expect(ev.some((e) => e.t === 'kill')).toBe(false);
    stepSpec(w, {}, 360);
    expect(w.enemies.some((e) => e.def.id === 'straw_target' && !e.dead)).toBe(true);
  });
  it('the DPS readout (07 §5.8)', () => {
    expect(dummyDps([{ tick: 0, amount: 30 }], 60)).toBe(30);             // divides by at least 1.0 s
    expect(dummyDps([{ tick: 0, amount: 50 }, { tick: 240, amount: 50 }], 240)).toBe(50);
    expect(dummyDps([{ tick: 0, amount: 50 }], 400)).toBeNull();          // hidden 3.0 s after the last hit
  });
  it('a kit equips its items and survives a restart', () => {
    const w = arenaWorld();
    w.setLoadout(kitLoadout('tank', 'iron_fists'));
    w.restart();
    expect(w.combat.slots.map((s) => s?.weaponId ?? null)).toEqual(['iron_fists', null]);
    expect(w.abilities.slots.map((s) => s?.id ?? null)).toEqual(['shockwave', null]);
  });
});
