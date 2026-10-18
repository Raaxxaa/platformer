// A-grade perks (05 §4.4) and the player stat hooks they share with Lucky Block effects and curses (05 §7–8):
// attack speed, crit chance, move speed, incoming damage. Brutal, Finisher and Leeching are hit mods.
import type { EnemyState } from '../enemies/enemy.ts';
import { addHitMod } from '../combat/hitMods.ts';
import type { HitGroup } from '../combat/hitGroups.ts';
import type { WeaponInstance } from '../combat/types.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { FINISHER_HP, PERKS, type PerkId } from '../../data/loot.ts';
import { statValue, statProduct } from '../economy/stats.ts';

const PERK = Object.fromEntries(PERKS.map((p) => [p.id, p])) as Record<PerkId, (typeof PERKS)[number]>;
const hasPerk = (inst: WeaponInstance | null | undefined, id: PerkId) => inst?.perk === id;
const carriedCount = (w: GameWorld, id: PerkId) => w.combat.slots.filter((s) => hasPerk(s, id)).length;
const groupWeapon = (w: GameWorld, g: HitGroup) => (g.ability === undefined && g.slot !== undefined ? w.combat.slots[g.slot] : null);

/** Other player stat sources (Lucky Block, curses, M7 stat upgrades) register here. */
export interface PlayerStatSource {
  speed?(w: GameWorld): number;          // added to 01's speedPercents
  incoming?(w: GameWorld): number;       // incoming damage multiplier
  dashMult?(w: GameWorld): number;       // dashCooldownMult multiplier
}
const STAT_SOURCES: PlayerStatSource[] = [];
export function addPlayerStatSource(s: PlayerStatSource): void { STAT_SOURCES.push(s); }

/** 02 §9.9 attack-speed bonuses for a slot's attacks (Quick). */
export function attackSpeedBonus(w: GameWorld, slot: 0 | 1): number {
  return statValue(w, 'frenzy') + (hasPerk(w.combat.slots[slot], 'quick') ? PERK.quick.value : 0);
}
/** 02 §3.2 critChance for a slot's direct hits (Keen), capped at 1. */
export function critChance(w: GameWorld, slot?: 0 | 1): number {
  return Math.min(1, statValue(w, 'precision') + (slot !== undefined && hasPerk(w.combat.slots[slot], 'keen') ? PERK.keen.value : 0));
}
/** Extra speedPercents: Fleet per carried copy, plus registered sources (Swift, Heavy). */
export function extraSpeed(w: GameWorld): number {
  return statValue(w, 'quickstep') + carriedCount(w, 'fleet') * PERK.fleet.value + STAT_SOURCES.reduce((s, x) => s + (x.speed?.(w) ?? 0), 0);
}
/** 02 §3.3 incoming multiplier: Sturdy ×0.90 per carried copy, × registered sources (Glass Bones). */
export function incomingMult(w: GameWorld): number {
  return statProduct(w, 'iron_skin') * PERK.sturdy.value ** carriedCount(w, 'sturdy') * STAT_SOURCES.reduce((p, x) => p * (x.incoming?.(w) ?? 1), 1);
}
export function dashCooldownMult(w: GameWorld): number {
  return statProduct(w, 'light_feet') * STAT_SOURCES.reduce((p, x) => p * (x.dashMult?.(w) ?? 1), 1);
}

/** Leeching (§4.4): a weapon leaving the slots resets its bank. */
export function resetLeech(inst: WeaponInstance | null): void {
  if (inst) (inst as WeaponInstance & { leechBank?: number }).leechBank = 0;
}

addHitMod({
  bonus(w: GameWorld, g: HitGroup, e: EnemyState): number {
    const inst = groupWeapon(w, g);
    let b = 0;
    if (hasPerk(inst, 'brutal')) b += PERK.brutal.value;
    if (hasPerk(inst, 'finisher') && e.hp <= FINISHER_HP * e.maxHp) b += PERK.finisher.value;
    return b;
  },
  afterHit(w, g, _e, info) {
    const inst = groupWeapon(w, g) as (WeaponInstance & { leechBank?: number }) | null;
    if (!inst || !hasPerk(inst, 'leeching')) return;
    inst.leechBank = (inst.leechBank ?? 0) + info.damage;
    while (inst.leechBank >= PERK.leeching.value) {
      w.health.hp = Math.min(w.health.maxHp, w.health.hp + 1);
      inst.leechBank -= PERK.leeching.value;
    }
  },
});
