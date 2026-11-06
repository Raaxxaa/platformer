// 06 §14.1 (M18): each daily twist's exact effect.
import { describe, expect, it } from 'vitest';
import plainsJson from '../../../public/levels/plains.json';
import { loadLevel } from '../level/loadLevel.ts';
import { GameWorld } from '../sim/gameWorld.ts';
import { defaultSave } from '../save/schema.ts';
import type { TwistId } from '../../data/twists.ts';
import { TWISTS } from '../../data/twists.ts';
import { rollLucky } from '../loot/lucky.ts';
import { mulberry32 } from '../rng.ts';
import { extraSpeed, incomingMult } from '../loot/perks.ts';
import { enemySpeedMult, twistPrice } from './twistFx.ts';
import { addGoldTenths } from '../economy/gold.ts';
import { spawnEnemy } from '../enemies/enemy.ts';
import { RUSH } from '../tuning.ts';
import { dailyTwist } from './daily.ts';

const world = (twist?: TwistId, seedText = 'TWIST') => GameWorld.fromLevel(loadLevel(plainsJson as never), { seedText, seeded: true, startKit: { cls: 'tank', weapon: 'war_maul' }, records: defaultSave(), twist });

describe('daily twists (06 §14.1)', () => {
  it('the twist is the third draw of the daily stream, the same everywhere, all ten reachable', () => {
    expect(dailyTwist('DAILY-20261105')).toBe(dailyTwist('DAILY-20261105'));
    const seen = new Set<string>(); for (let d = 1; d <= 400; d++) seen.add(dailyTwist(`DAILY-2026${String(d).padStart(4, '0')}`));
    expect([...seen].sort()).toEqual([...TWISTS].sort());
  });
  it('golden_hour: 1000 Lucky Block rolls give only buffs', () => {
    const rng = mulberry32(7); for (let i = 0; i < 1000; i++) expect(rollLucky(rng, [], false, true).kind).toBe('buff');
  });
  it('glass_cannon: +50% taken (and dealt)', () => {
    expect(incomingMult(world('glass_cannon')) / incomingMult(world())).toBeCloseTo(1.5);
  });
  it('heavy_pockets: double gold; a 120-gold ability costs 180', () => {
    const w = world('heavy_pockets'); expect(twistPrice(w, 120)).toBe(180); expect(twistPrice(world(), 120)).toBe(120);
    const g0 = w.econ.goldTenths; addGoldTenths(w, 100, 'test'); expect(w.econ.goldTenths - g0).toBe(200);
  });
  it('swift: +20% move speed for the player and ×1.2 for enemies', () => {
    expect(extraSpeed(world('swift')) - extraSpeed(world())).toBe(20);
    expect(enemySpeedMult(world('swift'))).toBe(1.2); expect(enemySpeedMult(world())).toBe(1);
  });
  it('blood_moon: enemies +25% HP', () => {
    const a = spawnEnemy(world('blood_moon'), { enemy: 'bandit', x: 100, y: 100, facing: 1 }), b = spawnEnemy(world(), { enemy: 'bandit', x: 100, y: 100, facing: 1 });
    expect(a.maxHp).toBe(Math.round(b.maxHp * 1.25));
  });
  it('rush_hour: Rush never drops below level 1', () => {
    const w = world('rush_hour'); expect(w.rush.floor).toBe(RUSH.LEVEL_STEP); expect(w.rush.value).toBeGreaterThanOrEqual(RUSH.LEVEL_STEP);
  });
  it('arsenal: a B-grade second weapon from the seed', () => {
    const a = world('arsenal'), b = world('arsenal');
    expect(a.combat.slots[1]?.grade).toBe('B'); expect(a.combat.slots[1]?.weaponId).toBe(b.combat.slots[1]?.weaponId);
    expect(world().combat.slots[1]).toBeNull();
  });
  it('dragon_day: the Dragon is present in every seed', () => {
    for (let s = 0; s < 30; s++) expect(world('dragon_day', `S${s}`).run.dragon.present).toBe(true);
  });
  it('elite_patrol: one extra elite of the stage type in section 2', () => {
    const n = (w: GameWorld) => w.enemies.filter((e) => e.def.id === 'bandit_brute').length;
    expect(n(world('elite_patrol'))).toBe(n(world()) + 1);
  });
});
