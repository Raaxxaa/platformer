// The collection book (09 §6): all 59 cosmetics, with hints that only name an enemy the player has met.
import type { EnemyId } from '../../core/enemies/types.ts';
import { ACCESSORIES, ALL_COSMETIC_IDS, COSMETIC_TOTAL, SHOP_COSMETICS, cosmeticHex, cosmeticName, type CosmeticId } from '../../data/cosmetics.ts';

export interface CollectionEntry { id: CosmeticId; owned: boolean; name: string; hint: string; hex: number }

const ENEMY_LABEL: Partial<Record<string, string>> = { wisp: "Will-o'-Wisp" };
export const enemyLabel = (enemy: EnemyId): string => ENEMY_LABEL[enemy] ?? enemy.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

export const UNMET = "an enemy you haven't met";
export const SHOP_HINT = 'Sold in village shops';

/** One entry per cosmetic, in the data tables' order. */
export function collectionEntries(owned: readonly CosmeticId[], seen: readonly EnemyId[]): CollectionEntry[] {
  return ALL_COSMETIC_IDS.map((id) => {
    const have = owned.includes(id), a = ACCESSORIES.find((x) => x.id === id);
    const source = a ? `Dropped by: ${seen.includes(a.enemy) || have ? (a.dragon ? `${enemyLabel(a.enemy)} (${a.dragon})` : enemyLabel(a.enemy)) : UNMET}` : SHOP_HINT;
    return { id, owned: have, name: have ? cosmeticName(id) : '???', hint: have ? (a ? `Dropped by: ${a.dragon ? `${enemyLabel(a.enemy)} (${a.dragon})` : enemyLabel(a.enemy)}` : SHOP_HINT) : source, hex: cosmeticHex(id) };
  });
}
export const collectionCount = (owned: readonly CosmeticId[]): string => `${ALL_COSMETIC_IDS.filter((id) => owned.includes(id)).length} / ${COSMETIC_TOTAL}`;
export const SHOP_COUNT = SHOP_COSMETICS.length;
