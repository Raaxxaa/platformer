import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../../data/enemies.ts';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';
import { eligibleAttacks, facePlayer } from './ai.ts';
import { grantStoneWard, stepMountainAi, stepMountainReaction, mountainAttackHooks } from './mountains.ts';
import { startEnemyAttack, stepEnemyAttack } from './attack.ts';
import { stepEnemyBody } from './body.ts';
import { enemyGuarded } from '../combat/enemyDamage.ts';
import { newStatus } from '../combat/status.ts';
import { resolvePlayerHits } from '../combat/resolve.ts';
import { firePlayerProjectile, stepPlayerProjectiles } from '../combat/playerProjectiles.ts';
function world(enemy: 'bat_swarm' | 'goblin_miner' | 'rock_golem' | 'ram' | 'goblin_shaman', x = 330, y = 320) {
  const w = arenaWorld({ stage: 2, enemies: [{ enemy, x, y, facing: -1 }] });
  w.health.iframeTicks = 99999;
  const e = w.enemies[0];
  e.dormant = false;
  e.aware = true;
  e.ai.state = 'engage';
  return { w, e };
}
describe('Caves and Mountains enemies (04 §4)', () => {
  it('Bat recovery flies back up through the shared recovery clock', () => {
    const { w, e } = world('bat_swarm', 200, 320);
    startEnemyAttack(w, e, e.def.attacks[0]);
    e.ai.attack!.phase = 'rec';
    e.ai.attack!.t = 0;
    e.ai.attack!.len = 72;
    stepEnemyAttack(w, e, mountainAttackHooks(e)!);
    expect(e.vy).toBeLessThan(0);
    const y = e.y;
    for (let n = 0; n < 10; n++) {
      stepEnemyBody(w, e);
      stepEnemyAttack(w, e, mountainAttackHooks(e)!);
    }
    expect(e.y).toBeLessThan(y);
  });
  it('front guard destroys an exploding orb before its enemy-contact blast', () => {
    const { w, e } = world('rock_golem', 230);
    e.facing = -1;
    firePlayerProjectile(w, 0, w.newId(), 'orb', 0);
    stepPlayerProjectiles(w);
    resolvePlayerHits(w);
    expect(w.playerProjectiles).toHaveLength(0);
    expect(w.blasts).toHaveLength(0);
    expect(e.hp).toBeLessThan(e.maxHp);
  });
  it('even a final control tick interrupts Blink without a late teleport', () => {
    const { w, e } = world('goblin_shaman', 230);
    stepSpec(w, {});
    expect(e.mountain?.blinkTicks).toBe(36);
    e.control = { type: 'stun', ticks: 1 };
    const x = e.x;
    stepSpec(w, {}, 40);
    expect(e.x).toBeLessThan(x + 20);
    expect(e.mountain?.blinkTicks).toBe(0);
  });
  it('Ward lasts world ticks through hit-stop, while invalid Blink spots still spend cooldown', () => {
    const { w, e } = world('goblin_shaman', 350);
    const ally = w.spawnExtra({ enemy: 'goblin_miner', x: 370, y: 320, facing: 1 });
    grantStoneWard(w, e);
    ally.ward!.ticks = 2;
    ally.hitStopTicks = 999;
    e.ai.gapTicks = 999;
    stepSpec(w, {}, 2);
    expect(ally.ward).toBe(null);
    e.x = 230;
    w.camera.x = 1000;
    const x = e.x;
    stepMountainReaction(w, e);
    for (let n = 0; n < 36; n++)
      stepMountainReaction(w, e);
    expect(e.x).toBe(x);
    expect(e.ai.cooldowns.get('blink_away')).toBe(600);
  });
  it('a diving Bat ends Act when its downward collision reaches a solid floor', () => {
    const { w, e } = world('bat_swarm', 200, 290);
    startEnemyAttack(w, e, e.def.attacks[0]);
    for (let n = 0; n < 48; n++)
      stepEnemyAttack(w, e, mountainAttackHooks(e)!);
    for (let n = 0; n < 30 && e.ai.attack?.phase === 'act'; n++) {
      stepEnemyBody(w, e);
      stepEnemyAttack(w, e, mountainAttackHooks(e)!);
    }
    expect(e.y).toBe(320);
    expect(e.ai.attack?.phase).toBe('rec');
    expect(e.vy).toBeLessThan(0);
  });
  it('Golem always guard remains active during control and freeze; bypass rules still apply', () => {
    const { w, e } = world('rock_golem', 230);
    const g = { id: 1, kind: 'melee', rect: { x: 0, y: 0, w: 1, h: 1 }, attackInstance: 1 } as Parameters<typeof enemyGuarded>[1];
    e.facing = -1;
    e.control = { type: 'stagger', ticks: 100 };
    expect(enemyGuarded(w, g, e)).toBe(true);
    e.status = { ...newStatus(), frozen: { left: 100, level: 1 } };
    expect(enemyGuarded(w, g, e)).toBe(true);
  });
  it('stores all five exact definitions and Stage2HP with telegraphs >=.35s', () => {
    const cases = [['bat_swarm', 25, 0, 3, 35], ['goblin_miner', 30, 10, 4, 42], ['rock_golem', 60, 40, 5, 84], ['ram', 40, 25, 4, 56], ['goblin_shaman', 120, 50, 20, 168]] as const;
    for (const [id, hp, poise, gold, scaled] of cases) {
      const { e } = world(id);
      expect(e.def).toMatchObject({ hp, poiseMax: poise, gold });
      expect(e.maxHp).toBe(scaled);
      expect(e.def.attacks.every((a) => a.telegraph >= .35)).toBe(true);
    }
    expect(ENEMIES.bat_swarm).toMatchObject({ flying: true, noFacing: true, fly: 110, preferred: [0, 0], notice: { range: 160, rangeY: 128, time: .30 } });
    expect(ENEMIES.rock_golem?.guard).toEqual({ guardMult: .25, when: 'always', bypassAbove: true });
  });
  it('bat waypoint picks deterministic player-relative x/y and flies without gravity', () => {
    const a = world('bat_swarm', 330, 160), b = world('bat_swarm', 330, 160);
    stepMountainAi(a.w, a.e);
    stepMountainAi(b.w, b.e);
    expect(a.e.mountain?.waypoint).toEqual(b.e.mountain?.waypoint);
    const p = a.e.mountain!.waypoint!;
    const center = { x: a.w.body.x, y: a.w.body.y - a.w.body.h / 2 };
    expect(p.x - center.x).toBeGreaterThanOrEqual(-48);
    expect(p.x - center.x).toBeLessThanOrEqual(48);
    expect(p.y - center.y).toBeGreaterThanOrEqual(-72);
    expect(p.y - center.y).toBeLessThanOrEqual(-32);
    expect(Math.hypot(a.e.vx, a.e.vy)).toBeCloseTo(110);
    const vy = a.e.vy;
    stepEnemyBody(a.w, a.e);
    expect(a.e.vy).toBe(vy);
    expect(a.e.grounded).toBe(false);
  });
  it('bat DiveBite uses full center distance, locks Act aim and ends at a wall', () => {
    const { w, e } = world('bat_swarm', 250, 170);
    expect(eligibleAttacks(w, e)).toEqual([]);
    e.y = 290;
    expect(eligibleAttacks(w, e).map((a) => a.id)).toContain('dive_bite');
    startEnemyAttack(w, e, e.def.attacks[0]);
    for (let n = 0; n < 48; n++)
      stepEnemyAttack(w, e, mountainAttackHooks(e)!);
    expect(Math.hypot(e.vx, e.vy)).toBeCloseTo(260);
    const velocity = [e.vx, e.vy];
    w.body.x = 500;
    stepEnemyAttack(w, e, mountainAttackHooks(e)!);
    expect([e.vx, e.vy]).toEqual(velocity);
    e.hitWall = true;
    stepEnemyAttack(w, e, mountainAttackHooks(e)!);
    expect(e.ai.attack?.phase).toBe('rec');
  });
  it('golem takes96ticks to turn and Ram leap keeps exact420,-220 knockback', () => {
    const { w, e } = world('rock_golem');
    e.facing = 1;
    for (let n = 0; n < 95; n++)
      facePlayer(w, e);
    expect(e.facing).toBe(1);
    facePlayer(w, e);
    expect(e.facing).toBe(-1);
    const ram = ENEMIES.ram!;
    expect(ram.attacks.find((a) => a.id === 'headbutt')).toMatchObject({ move: { dist: 72, time: .2 }, hit: { playerKb: [420, -220] } });
    expect(ram.attacks.find((a) => a.id === 'leap_butt')).toMatchObject({ leap: { vx: 160, vy: -420 }, use: { minDY: -64, maxDY: -24 } });
  });
  it('StoneWard picks miners first, then HP fraction/id, excludes caster and lasts960ticks', () => {
    const { w, e } = world('goblin_shaman');
    const allies = [w.spawnExtra({ enemy: 'ram', x: 350, y: 320, facing: 1 }), w.spawnExtra({ enemy: 'goblin_miner', x: 360, y: 320, facing: 1 }), w.spawnExtra({ enemy: 'rock_golem', x: 380, y: 320, facing: 1 }), w.spawnExtra({ enemy: 'goblin_miner', x: 400, y: 320, facing: 1 })];
    allies[0].hp = 1;
    allies[2].hp = 1;
    grantStoneWard(w, e);
    expect(e.ward).toBe(null);
    expect(allies.map((a) => a.ward?.hp ?? 0)).toEqual([0, 28, 28, 28]);
    expect(allies[1].ward).toMatchObject({ ticks: 960, sourceId: e.id });
  });
  it('BlinkAway reacts despite attack gap, fades36ticks and finds ground on its own side', () => {
    const { w, e } = world('goblin_shaman', 230);
    e.ai.gapTicks = 999;
    const x = e.x;
    expect(stepMountainReaction(w, e)).toBe(true);
    expect(e.x).toBe(x);
    expect(e.mountain?.blinkTicks).toBe(36);
    for (let n = 0; n < 35; n++)
      stepMountainReaction(w, e);
    expect(e.x).toBe(x);
    stepMountainReaction(w, e);
    expect(e.x).toBe(360);
    expect(e.y).toBe(320);
    expect(e.ai.cooldowns.get('blink_away')).toBe(600);
  });
  it('real Shaman AI casts Ward without a token and otherwise attacks with HexBolt', () => {
    const { w, e } = world('goblin_shaman', 350);
    const ally = w.spawnExtra({ enemy: 'goblin_miner', x: 370, y: 320, facing: -1 });
    ally.ai.gapTicks = 9999;
    e.ai.cooldowns.set('hex_bolt', 9999);
    e.ai.cooldowns.set('stone_spikes', 9999);
    stepSpec(w, {}, 75);
    expect(ally.ward?.hp).toBe(28);
    expect(e.token).toBe(null);
    const hex = world('goblin_shaman', 350);
    hex.e.ai.cooldowns.set('stone_ward', 9999);
    stepSpec(hex.w, {}, 70);
    expect(hex.w.projectiles.some((p) => p.def.id === 'hex_bolt')).toBe(true);
  });
});
