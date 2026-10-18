// Run-long stat upgrades (05 §13). Pure core: no storage, clock or device reads.
import { PRICES, STAT_OFFER_COUNT, STAT_UPGRADES, type StatUpgradeId } from '../../data/economy.ts';
import { BOND } from '../../data/classes.ts';
import { COMBAT } from '../tuning.ts';
import { sourceRng } from '../loot/pick.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { priceOf } from '../loot/merchant.ts';

export const statCount = (w: GameWorld, id: StatUpgradeId): number => w.econ.statStacks[id] ?? 0;
export const statValue = (w: GameWorld, id: StatUpgradeId): number => statCount(w, id) * STAT_UPGRADES.find((s) => s.id === id)!.value;
export const statProduct = (w: GameWorld, id: StatUpgradeId): number => STAT_UPGRADES.find((s) => s.id === id)!.value ** statCount(w, id);

/** 02 §5.1: all flat HP comes before the percent term. */
export function maxPlayerHp(w: GameWorld, ironWill = w.classState.bond === 'iron_will'): number {
  return Math.round((COMBAT.MAX_HP + statValue(w, 'vitality')) * (1 + (ironWill ? BOND.IRON_WILL_HP : 0)));
}

export function offerStatUpgrades(w: GameWorld, stageIndex: number): StatUpgradeId[] {
  const rng = sourceRng(w.runSeed, 'statPick', stageIndex);
  const eligible = STAT_UPGRADES.filter((s) => statCount(w, s.id) < s.maxStacks).map((s) => s.id);
  const offer: StatUpgradeId[] = [];
  while (offer.length < STAT_OFFER_COUNT && eligible.length) offer.push(eligible.splice(Math.floor(rng() * eligible.length), 1)[0]);
  return offer;
}

/** Apply exactly one stack. The caller controls when a run offers a choice. */
export function applyStatUpgrade(w: GameWorld, id: StatUpgradeId): boolean {
  const def = STAT_UPGRADES.find((s) => s.id === id);
  if (!def || statCount(w, id) >= def.maxStacks || w.health.dead) return false;
  w.econ.statStacks[id] = statCount(w, id) + 1;
  if (id === 'vitality') {
    const max = maxPlayerHp(w);
    w.health.hp += max - w.health.maxHp;
    w.health.maxHp = max;
    // Keep the whole current percent bonus removable, including HP from new Vitality stacks.
    if (w.classState.bond === 'iron_will') w.ironWillAddedHP = max - maxPlayerHp(w, false);
  }
  if (id === 'haggler') {
    // Stock has already been rolled. Reprice that stock without consuming RNG or changing item IDs.
    for (const it of w.groundItems) if (it.price !== undefined) {
      const base = it.weapon ? PRICES.weapon[it.weapon.grade] : PRICES.abilityBuy;
      it.price = priceOf(base, it.merchantSlot !== undefined, true);
    }
  }
  return true;
}

