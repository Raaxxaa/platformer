import { describe, it, expect } from 'vitest';
import { GameWorld } from '../sim/gameWorld.ts';
import { feet, levelFrom, rect } from '../testkit/levelData.ts';
import { stepSpec } from '../testkit/combatWorld.ts';
import { killEnemy } from '../combat/resolve.ts';
import { VIEW_W } from '../tuning.ts';

/** 50 × 24 tiles. Arena a1 inner x 6–39, y 2–19 (34 × 18 tiles); doors at x 5 and x 40, rows 17–19; floor row 20. */
function arenaLevel(waves: [number, string][] = [[1, 'wolf'], [1, 'wolf'], [2, 'bandit']], parTime?: number) {
  const rows: string[] = [];
  for (let y = 0; y < 24; y++) {
    let r = '';
    for (let x = 0; x < 50; x++) {
      const wall = (x === 5 || x === 40) && y <= 16;
      const ceil = y === 1 && x >= 5 && x <= 40;
      r += y >= 20 || wall || ceil || x === 0 || x === 49 ? '#' : '.';
    }
    rows.push(r);
  }
  const props: Record<string, string | number | boolean> = { id: 'a1', kind: 'combat' };
  if (parTime !== undefined) props.parTime = parTime;
  return levelFrom(rows, [
    feet('player_start', 2, 19),
    rect('arena', 6, 2, 34, 18, props),
    rect('arena_door', 5, 17, 1, 3, { arena: 'a1', role: 'entry' }),
    rect('arena_door', 40, 17, 1, 3, { arena: 'a1', role: 'entry' }),
    ...waves.map(([wave, enemy], i) => feet('enemy', 12 + i * 6, 19, { enemy, wave, arena: 'a1', facing: -1 })),
  ]);
}

const world = (...a: Parameters<typeof arenaLevel>) => GameWorld.fromLevel(arenaLevel(...a), { seedText: 'A' });
const walkIn = (w: GameWorld) => { for (let i = 0; i < 600 && !w.run.arenas.a1?.locked; i++) stepSpec(w, { moveX: 1 }); };
const killWave = (w: GameWorld) => { for (const e of w.enemies) if (!e.dead) killEnemy(w, e); };

describe('combat arena (06 §9.1–9.2, tests 15 and 16)', () => {
  it('locks on the first tick the hurtbox is fully inside', () => {
    const w = world();
    let lockedAt = -1, prevLeft = 0;
    for (let i = 0; i < 600 && lockedAt < 0; i++) {
      prevLeft = w.body.x - w.body.w / 2;
      const ev = stepSpec(w, { moveX: 1 });
      if (ev.some((e) => e.t === 'arenaLocked')) lockedAt = w.body.x - w.body.w / 2;
    }
    expect(lockedAt).toBeGreaterThanOrEqual(96);   // fully inside: left edge ≥ arena x 96
    expect(prevLeft).toBeLessThan(96);             // and not on the tick before
    expect(w.bodies.list.every((b) => b.active)).toBe(true);
    expect(w.enemies.length).toBe(2);
    expect(w.enemies.every((e) => e.aware && !e.dormant && e.spawnInTicks > 0)).toBe(true);
  });
  it('spawn-in: 0.5 s invulnerable and unable to act, then aware', () => {
    const w = world();
    walkIn(w);
    const e = w.enemies[0];
    expect(e.spawnInTicks).toBe(60);
    stepSpec(w, {}, 59);
    expect(e.spawnInTicks).toBe(1);
    expect(e.ai.attack).toBeNull();
    stepSpec(w, {});
    expect(e.spawnInTicks).toBe(0);
  });
  it('wave 2 spawns 90 ticks after wave 1’s last kill', () => {
    const w = world();
    walkIn(w);
    stepSpec(w, {}, 70);
    killWave(w);
    stepSpec(w, {});                        // the kill tick (step 9 processes it)
    stepSpec(w, {}, 89);
    expect(w.enemies.filter((e) => !e.dead).length).toBe(0);
    const ev = stepSpec(w, {});
    expect(ev.some((e) => e.t === 'arenaWave')).toBe(true);
    expect(w.enemies.filter((e) => !e.dead).map((e) => e.def.id)).toEqual(['bandit']);
  });
  it('a clear in 19.9 s adds 400 tenths, in 20.1 s 250; the doors open 60 ticks after the clear', () => {
    for (const [ticks, fill] of [[2388, 400], [2412, 250]] as const) {
      const w = world([[1, 'wolf']]);
      walkIn(w);
      stepSpec(w, {}, ticks - 1);
      w.health.iframeTicks = 0;
      w.flask.fillTenths = 0;
      killWave(w);
      const ev = stepSpec(w, {});
      const cleared = ev.find((e) => e.t === 'arenaCleared');
      expect(cleared).toMatchObject({ t: 'arenaCleared', arenaId: 'a1', clearTicks: ticks });
      expect(w.flask.fillTenths + w.flask.charges * 1000 - 2000).toBe(fill + 50);   // +50: the kill's own fill
      stepSpec(w, {}, 59);
      expect(w.bodies.list.every((b) => b.active)).toBe(true);
      stepSpec(w, {});
      expect(w.bodies.list.every((b) => !b.active)).toBe(true);
      expect(w.run.arenas.a1).toMatchObject({ locked: false, cleared: true });
    }
  });
  it('while locked the camera bounds are the arena; an arena smaller than the view is centered (after the 0.4 s blend)', () => {
    const w = world();
    walkIn(w);
    stepSpec(w, {}, 48);
    expect(w.camera.bounds).toEqual({ x: 96, y: 32, w: 544, h: 288 });
    for (let i = 0; i < 240; i++) {
      stepSpec(w, { moveX: i % 120 < 60 ? 1 : -1 });
      expect(w.camera.x).toBe(96 + 272 - VIEW_W / 2);
    }
  });
  it('a wave enemy outside the arena for 3.0 s goes back to its spawn', () => {
    const w = world();
    walkIn(w);
    stepSpec(w, {}, 60);
    const e = w.enemies[0];
    e.x = 45 * 16; e.y = 320;              // outside the arena (beyond the right door)
    e.ai.state = 'idle'; e.aware = false;
    stepSpec(w, {}, 359);
    expect(e.x).not.toBe(e.spawn.x);
    stepSpec(w, {});
    expect([e.x, e.y]).toEqual([e.spawn.x, e.spawn.y]);
  });
});
