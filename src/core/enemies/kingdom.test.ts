import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../../data/enemies.ts';
import { ENEMY_PROJECTILES } from '../../data/enemyProjectiles.ts';
import { STAGE_SCALING } from '../tuning.ts';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';
import { attackHooks } from './special.ts';
import { startEnemyAttack, stepEnemyAttack } from './attack.ts';
import { eligibleAttacks } from './ai.ts';
import { enemyGuarded } from '../combat/enemyDamage.ts';
import { resolvePlayerHits } from '../combat/resolve.ts';
import { enemyRect, type EnemyState } from './enemy.ts';
import { WEAPONS } from '../../data/weapons.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import type { EnemyId } from './types.ts';
import { packIndex, preferredBand } from './kingdom.ts';

function world(enemy: EnemyId, x = 330, y = 320, facing: 1 | -1 = -1) {
  const w = arenaWorld({ stage: 3, enemies: [{ enemy, x, y, facing }] });
  w.health.iframeTicks = 99999;
  const e = w.enemies[0];
  e.dormant = false; e.aware = true; e.ai.state = 'engage';
  return { w, e };
}
const run = (w: GameWorld, e: EnemyState, n: number) => { for (let i = 0; i < n; i++) { stepEnemyAttack(w, e, attackHooks(e)); w.projectiles.length; } };
function strike(w: GameWorld, e: EnemyState, spec = WEAPONS.greatsword!.combo[0].hit!) {
  w.hitGroups.push({ id: w.newId(), owner: 'player', kind: 'melee', rect: enemyRect(e), spec,
    active: true, lastHitTick: new Map(), hitCount: new Map(), attackInstance: w.newId(), slot: 0 });
  const before = e.hp;
  resolvePlayerHits(w);
  return before - e.hp;
}

describe('Stage 3 data (04 §6)', () => {
  it('has the listed stats, scaled at spawn by the Stage 3 multipliers', () => {
    const d = (id: EnemyId) => ENEMIES[id]!;
    expect([d('soldier').hp, d('crossbowman').hp, d('war_hound').hp, d('battle_mage').hp, d('knight').hp]).toEqual([45, 30, 28, 35, 160]);
    expect(d('soldier').hurtbox).toEqual({ w: 14, h: 28 });
    expect(d('knight').elite).toBe(true);
    expect(d('knight').armor).toEqual({ mult: 0.75, heavyIgnores: true });
    for (const id of ['soldier', 'crossbowman', 'war_hound', 'battle_mage', 'knight'] as const) {
      const { e } = world(id);
      expect(e.maxHp).toBe(Math.round(d(id).hp * STAGE_SCALING[3].mobHp));
    }
    expect(world('black_knight').e.maxHp).toBe(3120);
  });
  it('has the projectiles of 04 §8', () => {
    expect(ENEMY_PROJECTILES.enemy_bolt).toMatchObject({ speed: 420, range: 400, w: 12, h: 4 });
    expect(ENEMY_PROJECTILES.fireball).toMatchObject({ speed: 260, range: 360 });
    expect(ENEMY_PROJECTILES.fireball!.hit.status?.id).toBe('burning');
    expect(ENEMY_PROJECTILES.dark_wave).toMatchObject({ motion: 'floorWave', speed: 300, range: 480, w: 20, h: 32 });
  });
});

describe('Chain attacks (04 §2.6)', () => {
  it('runs the Knight combo as two hits, each with its own Tele', () => {
    const { w, e } = world('knight', 330);
    const a = e.ai.attack;
    expect(a).toBeNull();
    startEnemyAttack(w, e, e.def.attacks.find((x) => x.id === 'sword_combo')!);
    const phases: string[] = [];
    const hits: number[] = [];
    for (let i = 0; i < 200 && e.ai.attack; i++) {
      stepEnemyAttack(w, e, attackHooks(e));
      const cur = e.ai.attack;
      if (!cur) break;
      phases.push(`${cur.link}:${cur.phase}`);
      for (const g of w.hitGroups) if (g.owner === e.id && g.kind === 'melee' && !hits.includes(g.id)) hits.push(g.id);
    }
    expect(hits).toHaveLength(2);
    expect([...new Set(phases)]).toEqual(['0:tele', '0:act', '1:tele', '1:act', '1:rec']);
    // hit 2: 0.30 s Tele
    expect(phases.filter((p) => p === '1:tele')).toHaveLength(36);
  });
  it('emits a telegraph event for the chained hit and then rests for 0.70 s', () => {
    const { w, e } = world('knight', 330);
    startEnemyAttack(w, e, e.def.attacks[0]);
    run(w, e, 66 + 12 + 36);                  // Tele 0.55, Act 0.10 (12 ticks incl.), chain Tele 0.30
    expect(e.ai.attack?.link).toBe(1);
    expect(w.events.some((ev) => ev.t === 'enemyTelegraph' && ev.duration === 0.30)).toBe(true);
  });
});

describe('Soldier shield (04 §6)', () => {
  it('blocks frontal hits (x0.2), not hits from behind, and drops during its own Sword Thrust only', () => {
    const { w, e } = world('soldier', 230);
    w.body.x = 200;
    e.facing = -1;
    const open = (() => { const { w: w2, e: e2 } = world('soldier', 230); w2.body.x = 200; e2.facing = 1; return strike(w2, e2); })();
    const guarded = strike(w, e);
    expect(guarded).toBeLessThan(open);
    expect(guarded / open).toBeLessThanOrEqual(0.3);
    const g = { kind: 'melee', rect: enemyRect(e) } as never;
    startEnemyAttack(w, e, e.def.attacks.find((a) => a.id === 'sword_thrust')!);
    expect(enemyGuarded(w, g, e)).toBe(false);
    e.ai.attack = null;
    startEnemyAttack(w, e, e.def.attacks.find((a) => a.id === 'shield_bash')!);
    expect(enemyGuarded(w, g, e)).toBe(true);
    e.ai.attack = null;
    e.control = { type: 'stagger', ticks: 30 };
    expect(enemyGuarded(w, g, e)).toBe(false);
  });
  it('turns only after the player has been behind it for 0.5 s', () => {
    expect(ENEMIES.soldier!.turnDelay).toBe(0.5);
  });
});

describe('Knight armor (04 §6)', () => {
  it('takes x0.75 from any hit unless it is heavy', () => {
    const a = world('knight', 230), b = world('knight', 230);
    a.w.body.x = 200; b.w.body.x = 200; a.e.facing = b.e.facing = 1;
    const normal = strike(a.w, a.e);
    const heavy = strike(b.w, b.e, { ...WEAPONS.greatsword!.combo[0].hit!, heavy: true });
    expect(normal).toBeLessThan(heavy);
    expect(normal / heavy).toBeCloseTo(0.75, 1);
  });
});

describe('Crossbowman (04 §6)', () => {
  it('never walks and locks its aim for the last 0.2 s of Tele', () => {
    const { w, e } = world('crossbowman', 330);
    w.body.x = 100;
    const x0 = e.x;
    startEnemyAttack(w, e, e.def.attacks[0]);
    run(w, e, 40);
    const tracked = { ...e.kingdom!.aim! };
    expect(tracked.x).toBe(100);
    w.body.x = 120; run(w, e, 1);
    expect(e.kingdom!.aim!.x).toBe(120);                 // still tracking at 0.35 s
    run(w, e, 40);                                       // past 0.5 s of the 0.7 s Tele
    const locked = { ...e.kingdom!.aim! };
    w.body.x = 60; run(w, e, 4);
    expect(e.kingdom!.aim).toEqual(locked);
    expect(e.x).toBe(x0);
  });
  it('fires along the locked aim, clamped to 45 degrees', () => {
    const { w, e } = world('crossbowman', 330, 320, -1);
    w.body.x = 300; w.body.y = 20;                       // steeply above
    startEnemyAttack(w, e, e.def.attacks[0]);
    run(w, e, 84 + 1);
    const p = w.projectiles.find((q) => q.def.id === 'enemy_bolt')!;
    expect(p).toBeDefined();
    expect(Math.abs(Math.atan2(p.vy, Math.abs(p.vx)) * 180 / Math.PI)).toBeCloseTo(45, 0);
  });
  it('the Bolt needs the player within |dY| 160 and x 48-320', () => {
    const { w, e } = world('crossbowman', 330);
    w.camera.x = 100;
    w.body.x = 250;
    expect(eligibleAttacks(w, e).map((a) => a.id)).toContain('bolt');
    w.body.x = 320;
    expect(eligibleAttacks(w, e).map((a) => a.id)).not.toContain('bolt');
  });
});

describe('War Hound pack (04 §6)', () => {
  it('shifts the preferred band by 24 px per pack index', () => {
    const w = arenaWorld({ stage: 3, enemies: [0, 1, 2].map((i) => ({ enemy: 'war_hound' as const, x: 300 + i * 20, y: 320, facing: -1 as const, group: 'h' })) });
    expect(w.enemies.map((e) => packIndex(w, e))).toEqual([0, 1, 2]);
    expect(w.enemies.map((e) => preferredBand(w, e))).toEqual([[40, 64], [64, 88], [88, 112]]);
  });
  it('leaps with 340,-200 and wakes its whole group at once', () => {
    const w = arenaWorld({ stage: 3, enemies: [0, 1].map((i) => ({ enemy: 'war_hound' as const, x: 300 + i * 20, y: 320, facing: -1 as const, group: 'h' })) });
    for (const e of w.enemies) e.dormant = false;
    w.onEnemyHitByPlayer(w.enemies[0]);
    expect(w.enemies[1].aware || w.enemies[1].noticeT >= 0).toBe(true);
    const e = w.enemies[0];
    e.aware = true; e.ai.state = 'engage';
    startEnemyAttack(w, e, e.def.attacks[0]);
    run(w, e, 49);
    expect(e.vx).toBe(-340);
    expect(e.vy).toBeLessThan(0);
  });
});

describe('Battle Mage (04 §6)', () => {
  it('Teleports 176 px away when the player is within 64 px, fade out then fade in, CD 5 s', () => {
    const { w, e } = world('battle_mage', 330);
    w.camera.x = 100;
    w.body.x = 300;
    w.health.iframeTicks = 99999;
    stepSpec(w, {}, 1);
    expect(e.kingdom?.fade).toBe('out');
    expect(e.ai.attack).toBeNull();
    stepSpec(w, {}, 34);
    expect(e.kingdom?.fade).toBe('out');
    stepSpec(w, {}, 3);
    expect(e.kingdom?.fade).toBe('in');
    expect(Math.abs(e.x - w.body.x)).toBeGreaterThan(170);
    expect(Math.abs(e.x - w.body.x)).toBeLessThan(180);
    stepSpec(w, {}, 40);
    expect(e.kingdom?.fade).toBeNull();
    expect(e.ai.cooldowns.get('teleport')!).toBeGreaterThan(400);
  });
  it('is hittable while fading out and an interrupt cancels it', () => {
    const { w, e } = world('battle_mage', 330);
    w.body.x = 300;
    stepSpec(w, {}, 5);
    expect(e.kingdom?.fade).toBe('out');
    e.control = { type: 'stagger', ticks: 30 };
    stepSpec(w, {}, 2);
    expect(e.kingdom?.fade).toBeNull();
  });
  it('Fireball sets Burning and aims at the player', () => {
    const { w, e } = world('battle_mage', 330);
    w.body.x = 160;
    startEnemyAttack(w, e, e.def.attacks[0]);
    run(w, e, 73);
    const p = w.projectiles.find((q) => q.def.id === 'fireball');
    expect(p).toBeDefined();
    expect(p!.def.hit.status?.id).toBe('burning');
  });
});
