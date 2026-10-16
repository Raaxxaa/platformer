import { describe, it, expect } from 'vitest';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';
import { rushLevel, rushAttackSpeed, rushGoldMult, rushSpeedPercent } from './rush.ts';
import { hurtPlayer } from './health.ts';
import { resolvePlayerHits } from './resolve.ts';
import { enemyRect } from '../enemies/enemy.ts';
import { WEAPONS } from '../../data/weapons.ts';
import type { GameWorld } from '../sim/gameWorld.ts';

function playerGroupOn(w: GameWorld, enemyIdx: number, attackInstance: number): void {
  const e = w.enemies[enemyIdx];
  w.hitGroups.push({ id: w.newId(), owner: 'player', kind: 'melee', rect: enemyRect(e), spec: WEAPONS.greatsword!.combo[0].hit!, active: true,
    lastHitTick: new Map(), hitCount: new Map(), attackInstance });
}

describe('Rush meter (02 §8)', () => {
  it('levels: <100 → 0, 100–199 → 1, 200–299 → 2, exactly 300 → 3', () => {
    const w = arenaWorld();
    for (const [v, l] of [[0, 0], [99.9, 0], [100, 1], [299.9, 2], [300, 3]] as const) { w.rush.value = v; expect(rushLevel(w.rush)).toBe(l); }
  });
  it('7 regular kills (+105) reach level 1; a hit at 150 drops it to 75 (checklist 17)', () => {
    const w = arenaWorld({ enemies: Array.from({ length: 7 }, (_, i) => ({ enemy: 'bandit' as const, x: 300 + i * 20, y: 320, facing: -1 as const })) });
    for (const e of w.enemies) w.onPlayerKill(e, 'regular');
    expect(w.rush.value).toBe(105);
    expect(rushLevel(w.rush)).toBe(1);
    w.rush.value = 150;
    hurtPlayer(w, { kind: 'enemyHit', enemyId: 1, enemyDefId: 'bandit', damageA: 10, attackerCx: 300, melee: true });
    expect(w.rush.value).toBe(75);
  });
  it('an elite kill gives +40', () => {
    const w = arenaWorld({ enemies: [{ enemy: 'bandit_brute', x: 300, y: 320, facing: -1 }] });
    w.onPlayerKill(w.enemies[0], 'elite');
    expect(w.rush.value).toBe(40);
  });
  it('standing still drains 50/s, starting 0.5 s after stopping (checklist 19)', () => {
    const w = arenaWorld();
    w.rush.value = 200;
    stepSpec(w, {}, 60);
    expect(w.rush.value).toBe(200);
    stepSpec(w, {}, 60);
    expect(w.rush.value).toBeCloseTo(175, 0);             // 0.5 s of draining at 50/s
  });
  it('no gain for 4.0 s drains 15/s', () => {
    const w = arenaWorld();
    w.rush.value = 200;
    w.rush.noGainTime = 479;
    stepSpec(w, { jump: true });
    stepSpec(w, { jump: true }, 60);                      // airborne: not "standing still"
    expect(w.rush.value).toBeCloseTo(200 - 15 * 0.5, 0);
  });
  it('running at ≥ 102 px/s gains 6/s', () => {
    const w = arenaWorld();
    stepSpec(w, { moveX: 1 }, 120);
    expect(w.rush.value).toBeGreaterThan(5);
    expect(w.rush.value).toBeLessThanOrEqual(6);
  });
  it('the first hit of an attack instance gives +3, +5 more during or ≤ 0.20 s after a dash', () => {
    const w = arenaWorld({ enemies: [{ enemy: 'training_dummy', x: 260, y: 320, facing: 1 }, { enemy: 'training_dummy', x: 280, y: 320, facing: 1 }] });
    for (const e of w.enemies) e.dormant = false;
    playerGroupOn(w, 0, 501); playerGroupOn(w, 1, 501);
    resolvePlayerHits(w);
    expect(w.rush.value).toBe(3);                           // once per attack instance
    w.lastDashEndTick = w.tick;
    w.tick += 10;
    playerGroupOn(w, 0, 502);
    resolvePlayerHits(w);
    expect(w.rush.value).toBe(11);
  });
  it('dashing through an enemy gives +4 per enemy per dash', () => {
    const w = arenaWorld({ enemies: [{ enemy: 'training_dummy', x: 230, y: 320, facing: 1 }] });
    stepSpec(w, { moveX: 1, dash: true }, 20);
    expect(w.rush.value).toBeGreaterThanOrEqual(4);
    expect(w.rush.value).toBeLessThan(5);                    // + a little passive gain
  });
  it('level 3: speedPercents has 0.15, heavy attacks ×1.45, gold ×1.30', () => {
    const w = arenaWorld();
    w.rush.value = 300;
    stepSpec(w, {});
    expect(w.mods.speedPercents).toContain(0.15);
    expect(rushAttackSpeed(3, 'heavy')).toBe(1.45);
    expect(rushAttackSpeed(3, 'light')).toBe(1.15);
    expect(rushGoldMult(3)).toBe(1.3);
    expect(rushSpeedPercent(2)).toBe(0.10);
  });
  it('a level change applies from the next attack step', () => {
    const w = arenaWorld();
    stepSpec(w, { attack1: true });
    const lens = { ...w.combat.current!.lens };
    w.rush.value = 300;
    stepSpec(w, { attack1: true }, 30);
    expect(w.combat.current!.lens).toEqual(lens);
    stepSpec(w, { attack1: true }, 30);
    expect(w.combat.current!.step).toBe(1);
    expect(w.combat.current!.lens.startup).toBe(17);
  });
});
