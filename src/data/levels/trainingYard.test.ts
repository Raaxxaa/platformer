import { describe, expect, it } from 'vitest';
import yardJson from '../../../public/levels/training_yard.json';
import { loadLevel } from '../../core/level/loadLevel.ts';
import { validateLevel } from '../../core/level/validateLevel.ts';
import { GameWorld } from '../../core/sim/gameWorld.ts';
import { kitLoadout } from '../../core/abilities/runtime.ts';
import type { InputSpec } from '../../core/sim/playerSim.ts';
import { stepSpec } from '../../core/testkit/combatWorld.ts';

const yard = loadLevel(yardJson);

export function yardWorld(): GameWorld {
  const w = GameWorld.fromLevel(yard, { seedText: 'YARD' });
  w.setLoadout(kitLoadout('swordsman', 'greatsword'));
  return w;
}
/** Puts the player at station `id`'s checkpoint. */
export function toStation(w: GameWorld, id: number): void {
  const s = w.training!.stations.find((x) => x.id === id)!;
  w.teleportPlayer(s.checkpoint.x, s.checkpoint.y);
  stepSpec(w, {}, 2);
}
const doneIn = (w: GameWorld, spec: (i: number, w: GameWorld) => InputSpec, n: number, id: number,
  after?: (ev: GameWorld['events']) => void) => {
  for (let i = 0; i < n && !w.trainingDone.has(id); i++) { const ev = stepSpec(w, spec(i, w), 1); after?.(ev); }
  return w.trainingDone.has(id);
};
const TILE = 16;
/** Station x0 (tiles) = its checkpoint tile − 1. */
const x0px = (w: GameWorld, id: number) => w.training!.stations.find((s) => s.id === id)!.rect.x;

describe('Training Yard level (06 §12.4)', () => {
  it('is valid: stations 1–17, each with a checkpoint and a sign', () => {
    expect(yard.kind).toBe('training');
    expect(validateLevel(yard)).toEqual([]);
  });
  it('has 4 class statues, the kit stands and the armory', () => {
    const w = yardWorld();
    expect(w.interactables.filter((o) => o.kind === 'class_statue').length).toBe(4);
    expect(w.groundItems.some((i) => i.weapon?.weaponId === 'katana')).toBe(true);        // station 10: the other Swordsman weapon
    expect(w.groundItems.some((i) => i.ability?.id === 'whirlwind')).toBe(true);           // station 13
    expect(w.groundItems.filter((i) => i.endless).length).toBeGreaterThanOrEqual(17);
  });
  it('no run timer; HP never goes below 1', () => {
    const w = yardWorld();
    stepSpec(w, {}, 120);
    expect(w.run.runTicks).toBe(0);
  });
  it('station 1: run and jump to the far side', () => {
    const w = yardWorld();
    toStation(w, 1);
    expect(doneIn(w, (i) => ({ moveX: 1, jump: i % 24 < 14 }), 600, 1)).toBe(true);
  });
  it('station 2: double jump onto the 6-tile ledge', () => {
    const w = yardWorld(); toStation(w, 2);
    const wall = x0px(w, 2) + 9 * TILE;
    let jumped = 0;
    expect(doneIn(w, (_i, ww) => {
      const b = ww.body;
      if (b.grounded && wall - b.x < 90 && jumped === 0) { jumped = 1; return { moveX: 1, jump: true }; }
      if (jumped === 1 && b.vy > -50 && !b.grounded) { jumped = 2; return { moveX: 1 }; }
      if (jumped === 2) { jumped = 3; return { moveX: 1, jump: true }; }
      return { moveX: 1, jump: jumped >= 1 && jumped !== 2 };
    }, 600, 2)).toBe(true);
  });
  it('station 3: cross the gap with an air dash', () => {
    const w = yardWorld(); toStation(w, 3);
    const edge = x0px(w, 3) + 6 * TILE;
    let phase = 0;
    expect(doneIn(w, (_i, ww) => {
      const b = ww.body;
      if (phase === 0 && edge - b.x < 10) { phase = 1; return { moveX: 1, jump: true }; }
      if (phase === 1 && b.vy > -150) { phase = 2; return { moveX: 1, jump: true, dash: true }; }
      return { moveX: 1, jump: phase >= 1 };
    }, 600, 3)).toBe(true);
  });
  it('station 8: a dive slam on the dummy', () => {
    const w = yardWorld(); toStation(w, 8);
    const s = w.training!.stations.find((x) => x.id === 8)!;
    w.teleportPlayer(s.rect.x + 7 * TILE + 8, s.checkpoint.y - 4 * TILE);
    expect(doneIn(w, (i) => ({ moveY: 1, attack1: i === 5 }), 200, 8)).toBe(true);
  });
  it('station 9: a whole Greatsword combo on the dummy', () => {
    const w = yardWorld(); toStation(w, 9);
    const s = w.training!.stations.find((x) => x.id === 9)!;
    w.teleportPlayer(s.rect.x + 8 * TILE + 8 - 26, s.checkpoint.y);
    expect(doneIn(w, () => ({ attack1: true }), 400, 9)).toBe(true);
  });
  it('station 10: take the other weapon, hit with weapon 2', () => {
    const w = yardWorld(); toStation(w, 10);
    const s = w.training!.stations.find((x) => x.id === 10)!;
    w.teleportPlayer(s.rect.x + 5 * TILE + 8, s.checkpoint.y);
    stepSpec(w, {}, 2); stepSpec(w, { interact: true }, 1);
    expect(w.combat.slots[1]?.weaponId).toBe('katana');
    w.teleportPlayer(s.rect.x + 12 * TILE + 8 - 22, s.checkpoint.y);
    expect(doneIn(w, (i) => ({ attack2: i % 40 === 0 }), 300, 10)).toBe(true);
  });
  it('station 11: dash through 3 swings in a row', () => {
    const w = yardWorld(); toStation(w, 11);
    const s = w.training!.stations.find((x) => x.id === 11)!;
    const dx = s.rect.x + 10 * TILE + 8;
    w.teleportPlayer(dx - 40, s.checkpoint.y);
    w.health.hp = 100;
    let dir: 1 | -1 = 1;
    expect(doneIn(w, (_i, ww) => {
      const a = ww.enemies.find((e) => e.def.id === 'sparring_dummy')!.ai.attack;
      if (a && a.phase === 'tele' && a.len - a.t === 6 && ww.body.state !== 'dash') { const d = dir; dir = -dir as 1 | -1; return { moveX: d, dash: true }; }
      return {};
    }, 3000, 11)).toBe(true);
  });
  it('station 12: drink the flask', () => {
    const w = yardWorld(); toStation(w, 12);
    expect(w.health.hp).toBe(40);
    expect(doneIn(w, (i) => ({ heal: i === 2 }), 120, 12)).toBe(true);
  });
  it('station 13: use both abilities within 3 s for a link', () => {
    const w = yardWorld(); toStation(w, 13);
    const s = w.training!.stations.find((x) => x.id === 13)!;
    w.teleportPlayer(s.rect.x + 12 * TILE + 8, s.checkpoint.y);
    stepSpec(w, {}, 2); stepSpec(w, { interact: true }, 1);
    expect(w.classState.connection).toBe(true);
    stepSpec(w, {}, 5);
    expect(doneIn(w, (i) => ({ ability1: i === 0, ability2: i === 60 }), 300, 13)).toBe(true);
  });
  it('station 14: reach Rush level 1 on the straw targets', () => {
    const w = yardWorld(); toStation(w, 14);
    expect(doneIn(w, (i) => ({ moveX: 1, attack1: i % 30 < 15 }), 2400, 14)).toBe(true);
  });
  it('station 15: cross with a dash-jump', () => {
    const w = yardWorld(); toStation(w, 15);
    const edge = x0px(w, 15) + 10 * TILE;
    let phase = 0;
    expect(doneIn(w, (_i, ww) => {
      const b = ww.body;
      if (phase === 0 && edge - b.x < 8) { phase = 1; return { moveX: 1, dash: true }; }
      if (phase === 1) { phase = 2; return { moveX: 1, dash: true, jump: true }; }
      return { moveX: 1, jump: phase === 2, dash: phase === 1 };
    }, 600, 15)).toBe(true);
  });
  it('stations 4 and 5: wall-jump up the shaft, then grab the ledge', () => {
    const w = yardWorld(); toStation(w, 4);
    let hold: 1 | -1 = 1, lastJump = -100;
    const topPx = (34 - 10) * TILE;                               // the shaft's right wall ends here
    expect(doneIn(w, (i, ww) => {
      const b = ww.body;
      if (b.y < topPx + 24 && hold === 1) return { moveX: 1 };       // near the top: hold toward the ledge to grab it
      if (b.state === 'wallSlide' && i - lastJump > 8) { lastJump = i; hold = (-b.lastWallDir) as 1 | -1; return { moveX: hold, jump: true }; }
      if (b.grounded && Math.abs(b.vx) < 1 && i - lastJump > 20) { lastJump = i; return { moveX: hold, jump: true }; }
      return { moveX: hold, jump: i - lastJump < 14 };
    }, 1200, 4)).toBe(true);
    expect(doneIn(w, (i, ww) => ({ moveX: 1, jump: ww.body.grounded ? i % 30 === 0 : true }), 900, 5)).toBe(true);
  });
  it('station 6: slide, then crawl through', () => {
    const w = yardWorld(); toStation(w, 6);
    expect(doneIn(w, (i) => ({ moveX: 1, moveY: i > 30 ? 1 : 0, dash: i === 40 }), 900, 6)).toBe(true);
  });
  it('station 7: drop through a thin platform', () => {
    const w = yardWorld(); toStation(w, 7);
    expect(doneIn(w, (i) => (i < 50 ? { moveX: 1 } : { moveY: 1, jump: i % 20 === 0 }), 300, 7)).toBe(true);
  });
  it('station 16: cross with a slide-jump', () => {
    const w = yardWorld(); toStation(w, 16);
    let phase = 0;
    const x0 = x0px(w, 16);
    expect(doneIn(w, (_i, ww) => {
      const b = ww.body;
      if (phase === 0 && b.x > x0 + 3.5 * TILE) { phase = 1; return { moveX: 1, moveY: 1, dash: true }; }   // slide under the low wall
      if (phase === 1 && b.state === 'slide' && b.x > x0 + 9.5 * TILE) { phase = 2; return { moveX: 1, jump: true }; }  // out: jump at the pit edge
      return { moveX: 1, moveY: phase === 1 ? 1 : 0, jump: phase === 2 };
    }, 600, 16)).toBe(true);
  });
  it('station 17: dive-bounce across the three targets', () => {
    const w = yardWorld(); toStation(w, 17);
    const x0 = x0px(w, 17);
    const targets = [8, 14, 20].map((d) => x0 + d * TILE + 8);
    let k = 0, dj = false, started = -1;
    expect(doneIn(w, (i, ww) => {
      const b = ww.body;
      if (k < 3 && b.state === 'air' && Math.abs(targets[k] - b.x) < 10) return { moveY: 1, attack1: true };   // dive onto the next target
      if (b.state.startsWith('dive')) return {};
      if (started < 0 && b.x > x0 + 5 * TILE) { started = i; return { moveX: 1, jump: true }; }
      if (k === 0 && started >= 0 && i - started < 14) return { moveX: 1, jump: true };
      if (b.state === 'air' && b.vy > 0 && !dj && k > 0 && (k === 3 || b.x > targets[k] - 64)) { dj = true; return { moveX: 1, jump: true }; }
      return { moveX: 1 };
    }, 900, 17, (ev) => { if (ev.some((e) => e.t === 'move' && e.e === 'diveBounce')) { k += 1; dj = false; } })).toBe(true);
  });
  it('a pit puts you back at the station checkpoint', () => {
    const w = yardWorld();
    toStation(w, 3);
    const cp = w.training!.checkpoint;
    let fell = false;
    for (let i = 0; i < 300 && !(fell && w.training!.fade === null); i++) { stepSpec(w, { moveX: 1 }, 1); if (w.training!.fade !== null) fell = true; }
    expect(fell).toBe(true);
    expect(Math.abs(w.body.x - cp.x)).toBeLessThan(4);
  });
});
