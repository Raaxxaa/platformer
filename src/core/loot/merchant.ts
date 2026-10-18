// The wandering merchant (05 §12, 06 §11.3): present 40% of stages; 2 cursed-table weapons + 1 ability at ×1.25,
// and two altars that upgrade the carried abilities at normal prices.
import { dropItem, type GroundItem, type Interactable } from '../abilities/items.ts';
import { maxCharges } from '../abilities/abilitySystem.ts';
import type { AbilityId } from '../abilities/types.ts';
import { addGoldTenths } from '../economy/gold.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { MERCHANT_CHANCE, PRICES } from '../../data/economy.ts';
import { GRADE_ODDS, type StageIndex } from '../../data/loot.ts';
import { sourceRng } from './pick.ts';
import { rollAbility, rollWeapon } from './roll.ts';
import { statCount } from '../economy/stats.ts';

export interface MerchantState { present: boolean; x: number; y: number; sold: boolean[] }
/** 06 §11.3 entity x offsets from the spot. */
export const MERCHANT_LAYOUT = { items: [-96, -64, -32], altars: [32, 64], maxLevel: 5 } as const;

/** 05 §11: 5 × floor((base × markupPct × hagglerPct + 25000) / 50000). */
export function priceOf(base: number, merchant: boolean, haggler = false): number {
  const markup = merchant ? PRICES.merchantMarkupPct : 100, hag = haggler ? PRICES.hagglerPct : 100;
  return 5 * Math.floor((base * markup * hag + 25000) / 50000);
}
export const upgradePrice = (w: GameWorld, nextLevel: number): number => priceOf(PRICES.upgradeTo[nextLevel], false, statCount(w, 'haggler') > 0);

/** Stage load: the presence draw, then the stock (with the abilities carried now). `force` (debug) skips the 40% draw. */
export function setupMerchant(w: GameWorld, force = false): void {
  const spot = w.level?.objects.find((o) => o.type === 'merchant_spot');
  w.merchant = null;
  if (!spot) return;
  const rng = sourceRng(w.runSeed, 'shop', 'merchant', w.level!.id);
  const present = rng() < MERCHANT_CHANCE;
  if (!present && !force) return;
  const m: MerchantState = { present: true, x: spot.x, y: spot.y, sold: [false, false, false] };
  w.merchant = m;
  const stage = Math.min(4, Math.max(1, w.stage)) as StageIndex;
  const carried = w.classState.carriedClasses;
  const a = rollWeapon(rng, GRADE_ODDS.cursed[stage], carried);
  const b = rollWeapon(rng, GRADE_ODDS.cursed[stage], carried, { exclude: [a.weaponId] });
  const ab = rollAbility(rng, w.abilities.slots.filter((s) => s).map((s) => s!.id) as AbilityId[], carried);
  const stock: Pick<GroundItem, 'weapon' | 'ability'>[] = [{ weapon: a }, { weapon: b }, ab ? { ability: ab } : { weapon: rollWeapon(rng, GRADE_ODDS.cursed[stage], carried) }];
  stock.forEach((s, i) => {
    const price = priceOf(s.weapon ? PRICES.weapon[s.weapon.grade] : PRICES.abilityBuy, true, statCount(w, 'haggler') > 0);
    const it = dropItem(w, spot.x + MERCHANT_LAYOUT.items[i], spot.y, { ...s, price, merchantSlot: i });
    it.resting = true;
  });
  MERCHANT_LAYOUT.altars.forEach((dx, slot) => {
    const ia: Interactable = { id: w.newId(), x: spot.x + dx, y: spot.y, kind: 'merchant_altar', label: String(slot), use: (ww) => { upgradeAt(ww, slot as 0 | 1); } };
    w.interactables.push(ia);
  });
}

/** Can the player take this priced item now? (05 §10.2: affordable; an ability already carried is `Owned`.) */
export function canBuy(w: GameWorld, it: GroundItem): boolean {
  if (it.price === undefined) return true;
  if (it.ability && w.abilities.slots.some((s) => s?.id === it.ability!.id)) return false;
  return w.gold >= it.price;
}

/** Paid on the tick the item is actually taken. */
export function onBought(w: GameWorld, it: GroundItem): void {
  if (it.price === undefined) return;
  addGoldTenths(w, -it.price * 10, 'purchase');
  if (w.merchant && it.merchantSlot !== undefined) w.merchant.sold[it.merchantSlot] = true;
  if (w.shop && it.shopSlot !== undefined) w.shop.slots[it.shopSlot] = 'sold';
  w.events.push({ t: 'purchase', what: it.weapon?.weaponId ?? it.ability?.id ?? '', price: it.price });
}

/** Merchant altar: +1 level at the normal upgrade price; charge state kept; a new max charge comes ready. */
export function upgradeAt(w: GameWorld, slot: 0 | 1): boolean {
  const s = w.abilities.slots[slot];
  if (!s || s.level >= MERCHANT_LAYOUT.maxLevel) return false;
  const price = upgradePrice(w, s.level + 1);
  if (w.gold < price) { w.events.push({ t: 'cantAfford' }); return false; }
  const oldMax = maxCharges(s);
  s.level = (s.level + 1) as typeof s.level;
  const add = maxCharges(s) - oldMax;
  if (add > 0) s.charges += add;
  addGoldTenths(w, -price * 10, 'upgrade');
  w.events.push({ t: 'purchase', what: `upgrade:${s.id}`, price });
  return true;
}
