// Village shops (05 §10–11) and altar tap/hold (06 §12.2). No devices, clock, storage or Phaser.
import type { AbilityId, AbilitySlot } from '../abilities/types.ts';
import type { WeaponId, WeaponInstance } from '../combat/types.ts';
import { dropItem, interactTarget, ITEM, type Interactable } from '../abilities/items.ts';
import { playerRect } from '../combat/resolve.ts';
import { overlaps } from '../combat/hitGroups.ts';
import { emptyButton, type InputState } from '../input.ts';
import { rollAbility, rollWeapon } from '../loot/roll.ts';
import { sourceRng } from '../loot/pick.ts';
import { priceOf, upgradeAt } from '../loot/merchant.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { GRADE_ODDS, type StageIndex } from '../../data/loot.ts';
import { KEYS_MAX, PRICES } from '../../data/economy.ts';
import { SHOP_RULES as S } from '../../data/shop.ts';
import { SHOP_BY_ID, SHOP_COSMETICS, type CosmeticId } from '../../data/cosmetics.ts';
import { FLASK } from '../tuning.ts';
import { statCount } from './stats.ts';
import { addGoldTenths } from './gold.ts';

export type VillageIndex = 1 | 2 | 3;
export type ShopItem = { kind: 'weapon'; weapon: WeaponInstance } | { kind: 'ability'; ability: AbilitySlot };
export interface ShopState {
  villageIndex: VillageIndex; rerollCount: number; slots: (ShopItem | 'sold')[]; keyInStock: boolean;
  /** M13 (09 §5): this visit's shop cosmetic (null = Collection complete), and whether it was bought. Rerolls don't change it. */
  cosmeticId: CosmeticId | null; cosmeticSold: boolean;
}
export interface AltarHold { slot: 0 | 1; ticks: number; id: number; cancelled: boolean; sold: boolean }
export const shopPrice = (w: GameWorld, base: number): number => priceOf(base, false, statCount(w, 'haggler') > 0);
export const rerollPrice = (w: GameWorld): number => shopPrice(w, PRICES.rerollBase + PRICES.rerollStep * (w.shop?.rerollCount ?? 0));

/** Exactly one fresh stream per offer. The optional key is the draw after the initial stock. */
function rollStock(w: GameWorld, villageIndex: VillageIndex, rerollCount: number): { slots: ShopItem[]; keyInStock?: boolean; cosmeticId?: CosmeticId | null } {
  const rng = sourceRng(w.runSeed, 'shop', villageIndex, rerollCount);
  const table = GRADE_ODDS.free[(villageIndex + 1) as StageIndex], carried = w.classState.carriedClasses;
  const carriedIds = w.abilities.slots.filter((a): a is AbilitySlot => a !== null).map((a) => a.id);
  const weapons: WeaponId[] = [], abilities: AbilityId[] = [], slots: ShopItem[] = [];
  const first = rollWeapon(rng, { ...table, F: 0, C: 0 }, carried, { unlocked: w.run.lootUnlocked });
  slots.push({ kind: 'weapon', weapon: first }); weapons.push(first.weaponId);
  for (let i = 1; i < S.slots; i++) {
    const ability = rng() < S.abilityChance ? rollAbility(rng, carriedIds, carried, abilities, w.run.lootUnlocked) : null;
    if (ability) { slots.push({ kind: 'ability', ability }); abilities.push(ability.id); }
    else {
      const weapon = rollWeapon(rng, table, carried, { exclude: weapons, unlocked: w.run.lootUnlocked });
      slots.push({ kind: 'weapon', weapon }); weapons.push(weapon.weaponId);
    }
  }
  if (rerollCount !== 0) return { slots };
  const keyInStock = rng() < S.keyChance;
  // 09 §5: one more draw, AFTER the stock and the key (so seeds keep their stock): an unowned shop cosmetic, in the table's order.
  const unowned = SHOP_COSMETICS.filter((c) => !w.cosmetics.owned.has(c.id)), pick = rng();
  return { slots, keyInStock, cosmeticId: unowned.length ? unowned[Math.floor(pick * unowned.length)].id : null };
}

/** Place priced items at the level's stand anchors. Purchase remains the existing deferred pickup flow. */
function placeStock(w: GameWorld): void {
  w.groundItems = w.groundItems.filter((i) => i.shopSlot === undefined);
  const shop = w.shop!;
  const stands = w.level?.objects.filter((o) => o.type === 'shop_item') ?? [];
  shop.slots.forEach((slot, i) => {
    if (slot === 'sold') return;
    const stand = stands.find((o) => Number(o.props.slot) === i); if (!stand) return;
    const item = slot.kind === 'weapon' ? { weapon: { ...slot.weapon } } : { ability: { ...slot.ability } };
    const base = slot.kind === 'weapon' ? PRICES.weapon[slot.weapon.grade] : PRICES.abilityBuy;
    const ground = dropItem(w, stand.x, stand.y, { ...item, price: shopPrice(w, base), shopSlot: i });
    ground.resting = true;
  });
}

/** Called on enterVillage, after carry state is installed, once per visit. Repeated calls preserve stock. */
export function setupShop(w: GameWorld, villageIndex: VillageIndex = S.defaultVillageIndex): ShopState {
  const old = w.shop; if (old?.villageIndex === villageIndex) return old;
  const roll = rollStock(w, villageIndex, 0);
  const shop: ShopState = { villageIndex, rerollCount: 0, slots: roll.slots, keyInStock: roll.keyInStock!, cosmeticId: roll.cosmeticId ?? null, cosmeticSold: false };
  w.shop = shop; w.altarHold = null; placeStock(w); return shop;
}

function pay(w: GameWorld, price: number, what: string): boolean {
  if (w.gold < price) { w.events.push({ t: 'cantAfford' }); return false; }
  addGoldTenths(w, -price * 10, 'purchase'); w.events.push({ t: 'purchase', what, price }); return true;
}

export function rerollShop(w: GameWorld): boolean {
  const shop = w.shop; if (!shop) return false;
  const price = rerollPrice(w); if (w.gold < price) { w.events.push({ t: 'cantAfford' }); return false; }
  const roll = rollStock(w, shop.villageIndex, shop.rerollCount + 1);
  if (!pay(w, price, 'reroll')) return false;
  shop.rerollCount += 1; shop.slots = roll.slots; placeStock(w);
  // A swap choice pointing at removed stock can no longer be confirmed.
  w.weaponSwapChoice = null; w.abilities.swapChoice = null;
  return true;
}
export function buyFlaskUpgrade(w: GameWorld): boolean {
  if (w.flask.maxCharges >= FLASK.MAX_CHARGES || !pay(w, shopPrice(w, PRICES.flaskUpgrade), 'flask_upgrade')) return false;
  w.flask.maxCharges += 1; w.flask.charges += 1; return true;
}
export function refill(w: GameWorld): boolean {
  if (w.flask.charges >= w.flask.maxCharges || !pay(w, shopPrice(w, PRICES.flaskRefill), 'flask_refill')) return false;
  w.flask.charges = w.flask.maxCharges; return true;
}
export function buyKey(w: GameWorld): boolean {
  const shop = w.shop; if (!shop?.keyInStock) return false;
  if (w.econ.keys >= KEYS_MAX) { w.events.push({ t: 'keysFull' }); return false; }
  if (!pay(w, shopPrice(w, PRICES.key), 'key')) return false;
  w.econ.keys += 1; shop.keyInStock = false; return true;
}
/** The cosmetic stand's state for the view (09 §5): the item, its price, or a word (`SOLD`, `Collection complete`). */
export function cosmeticStand(w: GameWorld): { id: CosmeticId | null; price: number | null; word: string | null } {
  const shop = w.shop;
  if (!shop) return { id: null, price: null, word: null };
  if (shop.cosmeticSold) return { id: shop.cosmeticId, price: null, word: 'SOLD' };
  const c = shop.cosmeticId ? SHOP_BY_ID.get(shop.cosmeticId) : null;
  if (!c) return { id: null, price: null, word: 'Collection complete' };
  return { id: c.id, price: shopPrice(w, c.price), word: null };
}
/** Press at the cosmetic stand: pay, own it at once, no item dropped. An empty or sold stand does nothing (returns true, takes nothing). */
export function buyCosmetic(w: GameWorld): boolean {
  const shop = w.shop;
  if (!shop) return false;
  const c = shop.cosmeticId && !shop.cosmeticSold ? SHOP_BY_ID.get(shop.cosmeticId) : null;
  if (!c) return true;
  if (!pay(w, shopPrice(w, c.price), `cosmetic:${c.id}`)) return false;
  w.cosmetics.owned.add(c.id); shop.cosmeticSold = true;
  w.events.push({ t: 'cosmeticUnlocked', id: c.id, source: 'shop' });
  return true;
}
export function sellAbility(w: GameWorld, slot: 0 | 1): boolean {
  const ability = w.abilities.slots[slot]; if (!ability) return false;
  w.abilities.slots[slot] = null;
  addGoldTenths(w, PRICES.sell[ability.level] * 10, 'sell');
  // 03 §7.9: already-started effects continue; passive/class/link effects update immediately.
  w.refreshClassState(); return true;
}

function overlapping(w: GameWorld, target: Interactable): boolean {
  const width = target.w ?? ITEM.interactW, height = target.h ?? ITEM.interactH;
  return overlaps(playerRect(w), { x: target.x - width / 2, y: target.y - height, w: width, h: height });
}

/** Intercept before generic stepInteract. Press starts a hold; release under90 ticks upgrades. */
export function stepAltarInteraction(w: GameWorld, input: InputState): InputState {
  if (w.health.dead) { w.altarHold = null; return input; }
  let hold = w.altarHold;
  if (w.weaponSwapChoice || w.abilities.swapChoice) { if (hold) hold.cancelled = true; return input; }
  const target = interactTarget(w);
  const altar = target && 'use' in target && target.kind === 'ability_altar' ? target : null;
  const allowed = S.altarStates.some((state) => state === w.body.state);
  if (!hold && altar && allowed && input.interact.pressed) {
    const slot = Number(altar.label);
    if ((slot === 0 || slot === 1) && w.abilities.slots[slot]) {
      hold = { slot, id: altar.id, ticks: 0, cancelled: false, sold: false }; w.altarHold = hold;
    }
  }
  if (!hold) return altar ? { ...input, interact: emptyButton() } : input;
  const original = w.interactables.find((o) => o.id === hold.id && o.kind === 'ability_altar');
  if (!allowed || !original || !overlapping(w, original)) hold.cancelled = true;
  if (input.interact.held) {
    if (!hold.cancelled && !hold.sold) {
      hold.ticks += 1;
      if (hold.ticks >= S.altarHoldTicks) { sellAbility(w, hold.slot); hold.sold = true; }
    }
  } else {
    if (input.interact.released && !hold.cancelled && !hold.sold && hold.ticks < S.altarHoldTicks) {
      const before = w.events.length;
      if (!upgradeAt(w, hold.slot) && !w.events.slice(before).some((event) => event.t === 'cantAfford')) {
        w.events.push({ t: 'cantAfford' });
      }
    }
    w.altarHold = null;
  }
  return { ...input, interact: emptyButton() };
}
