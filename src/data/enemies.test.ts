import { describe, it, expect } from 'vitest';
import { ENEMIES } from './enemies.ts';
import { ENEMY_PROJECTILES } from './enemyProjectiles.ts';

const defs = Object.values(ENEMIES);
const regulars = defs.filter((d) => d.tier === 'regular');
const elites = defs.filter((d) => d.elite);

describe('Built enemy data (04 §3–5, checklist 1–3, 30)', () => {
  it('has Stage 1, both Stage 2 sets, Stage 3 with the Black Knight, three Guardians, Spiderlings and training enemies', () => {
    expect(Object.keys(ENEMIES).sort()).toEqual(['bandit', 'bandit_archer', 'bandit_brute', 'bat_swarm', 'battle_mage', 'black_knight', 'bog_zombie', 'crossbowman', 'giant_spider', 'goblin_miner', 'goblin_shaman', 'great_boar', 'knight', 'ram', 'rock_golem', 'soldier', 'sparring_dummy', 'spider_queen', 'spiderling', 'stone_colossus', 'straw_target', 'swamp_witch', 'training_dummy', 'treant', 'war_hound', 'wild_boar', 'wisp', 'wolf']);
  });
  it('regular HP is 25–60, elite HP 120–170', () => {
    for (const d of regulars) { expect(d.hp).toBeGreaterThanOrEqual(25); expect(d.hp).toBeLessThanOrEqual(60); }
    for (const d of elites) { expect(d.hp).toBeGreaterThanOrEqual(120); expect(d.hp).toBeLessThanOrEqual(170); }
    expect(elites.map((d) => d.id).sort()).toEqual(['bandit_brute', 'goblin_shaman', 'knight', 'treant']);
  });
  it('regular attacks deal 8–15; the elite strongest 18–22', () => {
    for (const d of regulars) for (const a of d.attacks) {
      const dmg = a.hit?.damage ?? ENEMY_PROJECTILES[a.shots![0].projectile]!.hit.damage;
      expect(dmg).toBeGreaterThanOrEqual(8); expect(dmg).toBeLessThanOrEqual(15);
    }
    for (const d of elites) {
      const top = Math.max(...d.attacks.map((a) => a.hit?.damage ?? 0));
      expect(top).toBeGreaterThanOrEqual(18); expect(top).toBeLessThanOrEqual(22);
    }
  });
  it('every first telegraph is ≥ 0.35 s and every chained one ≥ 0.25 s', () => {
    for (const d of defs) for (const a of d.attacks) {
      expect(a.telegraph).toBeGreaterThanOrEqual(0.35);
      for (const c of a.chain ?? []) expect(c.telegraph).toBeGreaterThanOrEqual(0.25);
    }
  });
  it('every projectile an attack fires exists, and every enemy but the dummy attacks', () => {
    for (const d of defs) {
      if (d.id !== 'training_dummy' && d.id !== 'straw_target') expect(d.attacks.length).toBeGreaterThan(0);
      for (const a of d.attacks) for (const s of a.shots ?? []) expect(ENEMY_PROJECTILES[s.projectile]).toBeDefined();
    }
  });
  it('spot-checks the table values', () => {
    expect(ENEMIES.wolf).toMatchObject({ size: 'small', hurtbox: { w: 28, h: 16 }, hp: 30, poiseMax: 10, walk: 60, chase: 150, notice: { range: 176, rangeY: 80, time: 0.35 }, preferred: [72, 112], gold: 3, dropsLedges: true, attackGap: 0.6 });
    expect(ENEMIES.bandit_brute).toMatchObject({ tier: 'elite', elite: true, size: 'large', hurtbox: { w: 24, h: 40 }, hp: 160, poiseMax: 70, kbResist: 0.7, gold: 20, attackGap: 0.8, hpBar: 'always' });
    const lunge = ENEMIES.wolf.attacks.find((a) => a.id === 'lunge_bite')!;
    expect(lunge).toMatchObject({ use: { minX: 48, maxX: 112, minDY: -24, maxDY: 16 }, telegraph: 0.40, recovery: 0.45, cooldown: 1.6, leap: { vx: 320, vy: -180 } });
    expect(ENEMIES.bandit.attacks.find((a) => a.id === 'slash')!.weight).toBe(2);
    expect(ENEMIES.bandit_archer.attacks.find((a) => a.id === 'arrow')!.token).toBe('ranged');
    expect(ENEMY_PROJECTILES.enemy_arrow).toMatchObject({ motion: 'straight', speed: 300, w: 12, h: 4, range: 320, hit: { damage: 9 } });
    expect(ENEMY_PROJECTILES.brute_wave).toMatchObject({ motion: 'floorWave', speed: 240, w: 16, h: 12, range: 160, hit: { damage: 14 } });
    expect(ENEMIES.training_dummy).toMatchObject({ tier: 'dummy', hurtbox: { w: 16, h: 32 }, hp: 9999, poiseMax: 50, kbResist: 1, attacks: [] });
  });
});
