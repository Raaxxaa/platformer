import { describe, expect, it } from 'vitest';
import { STAT_UPGRADES, type StatUpgradeId } from '../../data/economy.ts';
import { newAbility, newWeapon } from '../abilities/runtime.ts';
import { rechargeRate } from '../abilities/abilitySystem.ts';
import { hurtPlayer } from '../combat/health.ts';
import { resolvePlayerHits, killEnemy, processDeaths } from '../combat/resolve.ts';
import { attackSpeed } from '../combat/playerCombat.ts';
import { incomingMult, critChance } from '../loot/perks.ts';
import { breakLucky, rollLucky } from '../loot/lucky.ts';
import { priceOf, upgradeAt } from '../loot/merchant.ts';
import { sourceRng } from '../loot/pick.ts';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';
import { applyStatUpgrade, offerStatUpgrades } from './stats.ts';
import { bossLevel } from '../testkit/levelData.ts';
import { GameWorld } from '../sim/gameWorld.ts';
import { dropItem } from '../abilities/items.ts';

function world() {
  const w = arenaWorld({ seed: 123, enemies: [{ enemy: 'training_dummy', x: 225, y: 320, facing: -1 }] });
  w.setLoadout({ weapons: [newWeapon('greatsword'), null], abilities: [null, null] });
  w.enemies[0].dormant = false;
  return w;
}
function take(w: ReturnType<typeof world>, id: StatUpgradeId, n = 1) {
  for (let i = 0; i < n; i++) expect(applyStatUpgrade(w, id)).toBe(true);
}
function hit(w: ReturnType<typeof world>, ability = false) {
  w.hitGroups = [{ id: w.newId(), owner: 'player', kind: 'melee', rect: { x: 210, y: 280, w: 40, h: 40 },
    spec: { damage: 20, kb: [0, 0], poise: 0, hitStop: 0, kind: 'melee' }, active: true,
    attackInstance: w.newId(), lastHitTick: new Map(), hitCount: new Map(), ...(ability ? { ability: 'shockwave' } : { slot: 0 as const }) }];
  resolvePlayerHits(w);
  return w.events.filter((e) => e.t === 'hit' && e.target !== 'player').at(-1);
}

describe('M7 stat upgrades (05 §13)', () => {
  it('has all twelve effects in spec order with exact values and caps', () => {
    expect(STAT_UPGRADES.map(({ id, value, maxStacks }) => [id, value, maxStacks])).toEqual([
      ['vitality', 20, 3], ['might', 0.10, 3], ['quickstep', 0.08, 3], ['focus', 0.15, 3],
      ['bloodthirst', 20, 3], ['precision', 0.08, 3], ['frenzy', 0.10, 3], ['iron_skin', 0.88, 3],
      ['prospector', 25, 3], ['light_feet', 0.80, 3], ['haggler', 0.85, 1], ['lucky_charm', 0.70, 1],
    ]);
  });
  it('draws three unique offers in draw order from the exact fresh stage stream', () => {
    const w = world(), rng = sourceRng(w.runSeed, 'statPick', 1), pool = STAT_UPGRADES.map((s) => s.id);
    const expected = Array.from({ length: 3 }, () => pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    expect(offerStatUpgrades(w, 1)).toEqual(expected);
    w.rng.combat.next(); w.rng.enemyAI.next();
    expect(offerStatUpgrades(w, 1)).toEqual(expected);
  });
  it('excludes maxed upgrades, allows repeat stacks, and refuses a fourth stack', () => {
    const w = world();
    take(w, 'haggler'); take(w, 'lucky_charm'); take(w, 'might', 3);
    expect(applyStatUpgrade(w, 'haggler')).toBe(false);
    expect(applyStatUpgrade(w, 'might')).toBe(false);
    for (let stage = 1; stage <= 3; stage++) expect(offerStatUpgrades(w, stage)).not.toEqual(expect.arrayContaining(['haggler']));
    expect(offerStatUpgrades(w, 1).every((id) => !['haggler', 'lucky_charm', 'might'].includes(id))).toBe(true);
    expect(w.econ.statStacks.might).toBe(3);
  });
  it.each(STAT_UPGRADES)('$id stops at its exact maximum stack count', ({ id, maxStacks }) => {
    const w = world(); take(w, id, maxStacks);
    expect(applyStatUpgrade(w, id)).toBe(false); expect(w.econ.statStacks[id]).toBe(maxStacks);
  });
  it('Vitality gives 70/100 → 90/120 and respects the flat-before-percent HP formula', () => {
    const w = world(); w.health.hp = 70;
    take(w, 'vitality');
    expect([w.health.hp, w.health.maxHp]).toEqual([90, 120]);
    w.abilities.slots = [newAbility('shockwave'), newAbility('shoulder_charge')]; w.refreshClassState();
    expect([w.health.hp, w.health.maxHp, w.ironWillAddedHP]).toEqual([126, 156, 36]);
    take(w, 'vitality');
    expect([w.health.hp, w.health.maxHp, w.ironWillAddedHP]).toEqual([152, 182, 42]);
    w.abilities.slots[1] = null; w.refreshClassState();
    expect([w.health.hp, w.health.maxHp]).toEqual([110, 140]);
    w.abilities.slots[1] = newAbility('shoulder_charge'); w.refreshClassState();
    w.abilities.slots[1] = null; w.refreshClassState();
    expect([w.health.hp, w.health.maxHp]).toEqual([110, 140]);
  });
  it('Might adds to the same bonus pool for weapon and ability direct hits', () => {
    for (const ability of [false, true]) {
      const w = world(); take(w, 'might', 2);
      expect(hit(w, ability)).toMatchObject({ amount: 24 });
    }
  });
  it('Quickstep changes actual run speed and stacks with movement sources', () => {
    const w = world(); take(w, 'quickstep', 3); stepSpec(w, { moveX: 1 }, 60);
    expect(w.body.vx).toBeCloseTo(170 * 1.24);
  });
  it('Focus adds recharge rate to Storm Caller and restores a charge at that rate', () => {
    const w = world(); take(w, 'focus', 2);
    w.abilities.slots = [newAbility('thunder_strike'), newAbility('blink')]; w.refreshClassState();
    expect(rechargeRate(w)).toBeCloseTo(1.55);
    w.abilities.slots[0]!.charges = 0; w.abilities.slots[0]!.rechargeLeft = 30;
    stepSpec(w, {}, 19); expect(w.abilities.slots[0]!.charges).toBe(0);
    stepSpec(w, {}, 1); expect(w.abilities.slots[0]!.charges).toBe(1);
  });
  it('Bloodthirst is included before Bloodrush doubles the full base/Vampire total', () => {
    const w = world(); take(w, 'bloodthirst', 2);
    w.abilities.slots[0] = newAbility('vampire'); w.refreshClassState();
    w.flask.charges = 0; w.econ.buffs.push('bloodrush');
    w.onPlayerKill(w.enemies[0], 'regular');
    expect(w.flask.fillTenths).toBe((50 + 40 + 20) * 2);
    w.onPlayerKill(w.enemies[0], 'elite');
    expect(w.flask.fillTenths).toBe((50 + 40 + 20 + 150 + 40 + 20) * 2);
  });
  it('Precision gives abilities random crits while Keen stays on its weapon only', () => {
    const w = world(); take(w, 'precision');
    w.combat.slots[0]!.perk = 'keen';
    expect(critChance(w, 0)).toBeCloseTo(0.20);
    expect(critChance(w)).toBeCloseTo(0.08);
    w.rng.combat.next = () => 0.079;
    expect(hit(w, true)).toMatchObject({ amount: 40, crit: true });
    w.rng.combat.next = () => 0.08;
    expect(hit(w, true)).toMatchObject({ amount: 20, crit: false });
  });
  it('Frenzy adds to Quick and shortens actual attack phases', () => {
    const w = world(); take(w, 'frenzy', 2); w.combat.slots[0]!.perk = 'quick';
    expect(attackSpeed(w, 'heavy', 0)).toBeCloseTo(1.35);
    stepSpec(w, { attack1: true });
    expect(w.combat.current!.lens.startup).toBe(Math.round(0.20 * 120 / 1.35));
  });
  it('Iron Skin stacks multiply with Sturdy and applies to hazard damage; curses still kill', () => {
    const w = world(); take(w, 'iron_skin', 3); w.combat.slots[0]!.perk = 'sturdy';
    expect(incomingMult(w)).toBeCloseTo(0.88 ** 3 * 0.9);
    expect(hurtPlayer(w, { kind: 'hazard', cause: 'spikes', damageA: 20 })).toBe(Math.round(20 * 0.88 ** 3 * 0.9));
    w.health.iframeTicks = 0; w.econ.curse = { id: 'one_hit', killsLeft: 10 };
    hurtPlayer(w, { kind: 'hazard', cause: 'spikes', damageA: 20 }); expect(w.health.dead).toBe(true);
  });
  it('Prospector changes real kill gold using the shared bonus pool and tenths rounding', () => {
    const w = world(); take(w, 'prospector', 2);
    const e = w.spawnExtra({ enemy: 'wolf', x: 500, y: 320, facing: -1 });
    killEnemy(w, e); processDeaths(w);
    expect(w.econ.goldTenths).toBe(45);
  });
  it.each([[1, false, 34], [1, true, 67], [2, false, 27], [3, false, 22]] as const)('Light Feet stacks %s, Jammed %s: %s ticks', (stacks, jammed, cooldown) => {
    const w = world(); take(w, 'light_feet', stacks);
    if (jammed) w.econ.debuffs.push({ id: 'jammed', ticksLeft: 5400 });
    stepSpec(w, { dash: true }, 18); stepSpec(w, {}, 1);
    expect(w.body.dashReadyPt - w.body.pt).toBe(cooldown);
  });
  it('Haggler discounts a real merchant upgrade, never sell prices', () => {
    const w = world(); take(w, 'haggler'); w.abilities.slots[0] = newAbility('shockwave', 2);
    w.econ.goldTenths = 10000; expect(upgradeAt(w, 0)).toBe(true); expect(w.gold).toBe(850);
    expect(priceOf(160, true, true)).toBe(170);
  });
  it('Haggler reprices existing stock without rerolling, changing IDs, or pricing free drops', () => {
    const w = world();
    const stock = dropItem(w, 200, 320, { weapon: { ...newWeapon('greatsword'), grade: 'B' }, price: 200, merchantSlot: 0 });
    const free = dropItem(w, 200, 320, { weapon: newWeapon('katana') });
    const before = { id: stock.id, weapon: { ...stock.weapon! }, rng: { ...w.rng } };
    take(w, 'haggler'); expect(stock.price).toBe(170); expect(free.price).toBeUndefined();
    expect({ id: stock.id, weapon: stock.weapon, rng: { ...w.rng } }).toEqual(before);
  });
  it('Guardian refill leaves banked flask fill unchanged even with Bloodthirst and Vampire', () => {
    const w = GameWorld.fromLevel(bossLevel(), { seedText: 'FLASK' }); take(w, 'bloodthirst');
    w.abilities.slots[0] = newAbility('vampire'); w.refreshClassState();
    w.flask.fillTenths = 321; w.flask.charges = 0;
    killEnemy(w, w.enemies.find((e) => e.boss)!); processDeaths(w);
    expect(w.flask.charges).toBe(w.flask.maxCharges); expect(w.flask.fillTenths).toBe(321);
  });
  it('Lucky Charm changes real block outcomes using 0.70 rather than 0.55', () => {
    const w = world(); take(w, 'lucky_charm');
    let id = 1;
    while (true) { const r = sourceRng(w.runSeed, 'lucky', 'test', id)(); if (r >= 0.55 && r < 0.70) break; id++; }
    const rng = sourceRng(w.runSeed, 'lucky', 'test', id), expected = rollLucky(rng, [], true).id;
    breakLucky(w, { objectId: id, x: 200, y: 260, broken: false });
    expect(w.events).toContainEqual({ t: 'luckyResult', id: expected });
  });
  it('run restart clears every stat stack and restores base HP', () => {
    const w = world(); take(w, 'vitality'); take(w, 'might'); w.restart();
    expect(w.econ.statStacks).toEqual({}); expect(w.health.maxHp).toBe(100);
  });
  it('core choice offers at the pick phase, guards the first 36 ticks and applies only the selected offer once', () => {
    const w = world(); w.onStageBossDefeated(); stepSpec(w, {}, 120);
    expect(w.run.phase).toBe('statPick'); expect(w.statPick!.offer).toHaveLength(3);
    const id = w.statPick!.offer[2];
    expect(w.confirmStatPick(2)).toBe(false); stepSpec(w, {}, 35);
    expect(w.confirmStatPick(2)).toBe(false); stepSpec(w, {}, 1);
    expect(w.confirmStatPick(9)).toBe(false); expect(w.confirmStatPick(2)).toBe(true);
    expect(w.econ.statStacks[id]).toBe(1); expect(w.run.phase).toBe('stage');
    expect(w.confirmStatPick(2)).toBe(false);
  });
});
