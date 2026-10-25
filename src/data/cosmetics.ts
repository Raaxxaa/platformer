// Character customization data (spec 09, M13): the look, the options, the 35 enemy accessories and the 24 shop cosmetics.
// Looks only: nothing here changes any number in the game.
import type { EnemyId } from '../core/enemies/types.ts';

export type RaceId = 'human' | 'elf' | 'dwarf' | 'orc';
export type OutfitId = 'leather' | 'plate' | 'ranger' | 'robe';
export type DragonColorId = 'red' | 'white' | 'storm' | 'green';
export type AccessorySlot = 'head' | 'back' | 'extra';
export type CosmeticId = string;

export interface Look {
  race: RaceId; skin: number; face: number; hair: number; hairColor: string; beard: number;
  outfit: OutfitId; colorA: string; colorB: string;
  head: CosmeticId | null; back: CosmeticId | null; extra: CosmeticId | null;
}

export const RACES: readonly RaceId[] = ['human', 'elf', 'dwarf', 'orc'];
export const RACE_NAME: Record<RaceId, string> = { human: 'Human', elf: 'Elf', dwarf: 'Dwarf', orc: 'Orc' };
/** 09 §2: skin tones per race (index = `Look.skin`). */
export const SKINS: Record<RaceId, readonly { name: string; hex: number }[]> = {
  human: [{ name: 'Fair', hex: 0xf3d2b3 }, { name: 'Light', hex: 0xe8bb94 }, { name: 'Tan', hex: 0xd09b6e }, { name: 'Bronze', hex: 0xa9714a }, { name: 'Brown', hex: 0x7b4f33 }, { name: 'Dark', hex: 0x4e3224 }],
  elf: [{ name: 'Fair', hex: 0xf3d2b3 }, { name: 'Light', hex: 0xe8bb94 }, { name: 'Tan', hex: 0xd09b6e }, { name: 'Bronze', hex: 0xa9714a }, { name: 'Brown', hex: 0x7b4f33 }, { name: 'Dark', hex: 0x4e3224 }],
  dwarf: [{ name: 'Fair', hex: 0xf3d2b3 }, { name: 'Light', hex: 0xe8bb94 }, { name: 'Tan', hex: 0xd09b6e }, { name: 'Bronze', hex: 0xa9714a }, { name: 'Brown', hex: 0x7b4f33 }, { name: 'Dark', hex: 0x4e3224 }],
  orc: [{ name: 'Moss', hex: 0x6f9a4a }, { name: 'Green', hex: 0x4c7a3a }, { name: 'Deep green', hex: 0x35582e }, { name: 'Ash', hex: 0x8d949a }],
};
export const FACES: readonly string[] = ['Calm', 'Fierce', 'Cheerful', 'Tired'];
export const HAIR_STYLES: readonly string[] = ['Bald', 'Short', 'Spiky', 'Long tied', 'Braid', 'Mohawk', 'Curly', 'Top-knot'];
export const BEARDS: readonly string[] = ['None', 'Stubble', 'Short', 'Long', 'Braided'];
export const OUTFITS: readonly OutfitId[] = ['leather', 'plate', 'ranger', 'robe'];
export const OUTFIT_NAME: Record<OutfitId, string> = { leather: 'Leather', plate: 'Plate', ranger: 'Ranger', robe: 'Robe' };
/** The player art atlas each outfit uses (the old class outfits, 08 §4.2). */
export const OUTFIT_ATLAS: Record<OutfitId, string> = { leather: 'swordsman', plate: 'tank', ranger: 'archer', robe: 'wizard' };
/** Outfits with built-in headwear (a `head` accessory replaces it, 09 §2). */
export const OUTFIT_HEADWEAR: Record<OutfitId, boolean> = { leather: false, plate: true, ranger: false, robe: true };

export interface ColorOption { id: string; name: string; hex: number }
/** 09 §2: the colors everyone starts with; shop dyes add more (09 §5). */
export const BASE_CLOTH: readonly ColorOption[] = [
  { id: 'slate', name: 'Slate', hex: 0x4a5878 }, { id: 'brown', name: 'Brown', hex: 0x7a5035 }, { id: 'forest', name: 'Forest', hex: 0x2c6334 }, { id: 'navy', name: 'Navy', hex: 0x24366a },
  { id: 'maroon', name: 'Maroon', hex: 0x7e2a34 }, { id: 'sand', name: 'Sand', hex: 0xc99a63 }, { id: 'grey', name: 'Grey', hex: 0x8a8a96 }, { id: 'olive', name: 'Olive', hex: 0x6b6b2c },
];
export const BASE_HAIR: readonly ColorOption[] = [
  { id: 'black', name: 'Black', hex: 0x1d1a24 }, { id: 'brown', name: 'Brown', hex: 0x5a3a24 }, { id: 'auburn', name: 'Auburn', hex: 0x8a3a1e }, { id: 'blond', name: 'Blond', hex: 0xd8b25a }, { id: 'grey', name: 'Grey', hex: 0x8a8a96 }, { id: 'white', name: 'White', hex: 0xeeeae0 },
];

// ------------------------------------------------------------------------------------------ 09 §3 accessories
export interface Accessory { id: CosmeticId; name: string; slot: AccessorySlot; enemy: EnemyId; dragon?: DragonColorId; hex: number }
const acc = (enemy: EnemyId, name: string, slot: AccessorySlot, hex: number, dragon?: DragonColorId): Accessory =>
  ({ id: dragon ? `acc_dragon_${dragon}` : `acc_${enemy}`, name, slot, enemy, dragon, hex });
/** The 35 accessories, one per enemy type (09 §3), in the spec's order. `hex` is the placeholder square until ART10 icons. */
export const ACCESSORIES: readonly Accessory[] = [
  acc('wolf', 'Wolf-pelt hood', 'head', 0x737ca0), acc('bandit', 'Bandit bandana', 'head', 0xb8443f), acc('bandit_archer', 'Feathered cap', 'head', 0xe27b5b),
  acc('wild_boar', 'Tusk necklace', 'extra', 0xe8e0c8), acc('bandit_brute', 'Spiked shoulder pads', 'extra', 0x8a8a96), acc('great_boar', 'Boar-skull helmet', 'head', 0xd9d2b8),
  acc('bat_swarm', 'Bat-wing cape', 'back', 0x4a3a6a), acc('goblin_miner', "Miner's lamp helmet", 'head', 0xd8b25a), acc('rock_golem', 'Pebble pauldrons', 'extra', 0x8a8a7a),
  acc('ram', 'Curled horns', 'head', 0xc9b98a), acc('goblin_shaman', "Shaman's bead mask", 'extra', 0x6fa05a), acc('stone_colossus', 'Stone crown', 'head', 0x9a9a9a),
  acc('bog_zombie', 'Tattered shroud', 'back', 0x5a6a4a), acc('giant_spider', 'Silk scarf', 'extra', 0xe8e8f0), acc('spiderling', 'Tiny spider', 'extra', 0x2a2030),
  acc('wisp', 'Wisp lantern', 'extra', 0x7ae0c0), acc('swamp_witch', 'Crooked witch hat', 'head', 0x4a2a6a), acc('treant', 'Leafy mantle', 'back', 0x4c933a),
  acc('spider_queen', "Queen's eight-eye circlet", 'head', 0x8a2a6a), acc('soldier', 'Kingdom kettle helm', 'head', 0x9aa0b4), acc('crossbowman', 'Quiver of bolts', 'back', 0x7a5035),
  acc('war_hound', 'Spiked collar', 'extra', 0x6a6a7a), acc('battle_mage', 'Runed hood', 'head', 0x3a5ac0), acc('knight', "Knight's tabard cape", 'back', 0xc0c4d4),
  acc('black_knight', 'Black plume helm', 'head', 0x1d1a24), acc('royal_guard', "Halberdier's plumed hat", 'head', 0xc0392b), acc('gargoyle', 'Stone wings', 'back', 0x7a7a8a),
  acc('castle_mage', 'Star-scarf', 'extra', 0x5a7ae0), acc('living_armor', 'Haunted gauntlet pauldron', 'extra', 0x6a7a9a), acc('royal_executioner', "Executioner's hood", 'head', 0x2a2030),
  acc('enemy_king', 'The fallen crown', 'head', 0xffd34a),
  acc('dragon', 'Dragon-scale cape (red)', 'back', 0xe0463c, 'red'), acc('dragon', 'Dragon-scale cape (white)', 'back', 0xe8eef4, 'white'),
  acc('dragon', 'Dragon-scale cape (storm)', 'back', 0x5a7ae0, 'storm'), acc('dragon', 'Dragon-scale cape (green)', 'back', 0x4c933a, 'green'),
];

// ------------------------------------------------------------------------------------------ 09 §5 shop cosmetics
export type ShopKind = 'dye' | 'hair' | 'hat' | 'cape' | 'gold_cape';
export interface ShopCosmetic { id: CosmeticId; name: string; kind: ShopKind; price: number; hex: number; slot?: AccessorySlot }
const dyes = (kind: 'dye' | 'hair', list: readonly [string, number][]): ShopCosmetic[] =>
  list.map(([n, hex]) => ({ id: `${kind === 'dye' ? 'dye' : 'hair'}_${n}`, name: `${n[0].toUpperCase()}${n.slice(1).replace('-', ' ')} ${kind === 'dye' ? 'dye' : 'hair dye'}`, kind, price: 150, hex }));
/** The 24 shop cosmetics (09 §5), in the table's order (the shop draw indexes this list). */
export const SHOP_COSMETICS: readonly ShopCosmetic[] = [
  ...dyes('dye', [['crimson', 0xc0182a], ['gold', 0xd8a82a], ['teal', 0x1a8a8a], ['violet', 0x6a2ab0], ['black', 0x1d1a24], ['white', 0xeeeae0], ['rose', 0xe06a8a], ['sky', 0x5ab0e8]]),
  ...dyes('hair', [['silver', 0xc0c4d4], ['pink', 0xe06aa0], ['blue', 0x3a6ae0], ['green', 0x3aa04a], ['fire-red', 0xe03a1a], ['platinum', 0xf0f0e8]]),
  ...([['straw', 'Straw hat', 0xd8b25a], ['beret', 'Feathered beret', 0xa83a5a], ['flower', 'Flower crown', 0xe06a8a], ['tricorn', 'Pirate tricorn', 0x2a2030], ['tophat', 'Tall top hat', 0x1d1a24]] as const)
    .map(([n, name, hex]): ShopCosmetic => ({ id: `hat_${n}`, name, kind: 'hat', price: 250, hex, slot: 'head' })),
  ...([['purple', 'Royal purple cape', 0x6a2ab0], ['patched', 'Patched traveler cape', 0x7a5035], ['starry', 'Starry night cape', 0x24366a], ['checkered', 'Checkered speedrunner cape', 0xeeeae0]] as const)
    .map(([n, name, hex]): ShopCosmetic => ({ id: `cape_${n}`, name, kind: 'cape', price: 300, hex, slot: 'back' })),
  { id: 'cape_gold', name: 'Golden cape', kind: 'gold_cape', price: 400, hex: 0xffd34a, slot: 'back' },
];

export const ALL_COSMETIC_IDS: readonly CosmeticId[] = [...ACCESSORIES.map((a) => a.id), ...SHOP_COSMETICS.map((s) => s.id)];
export const COSMETIC_TOTAL = ALL_COSMETIC_IDS.length;       // 59
export const ACCESSORY_BY_ID: ReadonlyMap<CosmeticId, Accessory> = new Map(ACCESSORIES.map((a) => [a.id, a]));
export const SHOP_BY_ID: ReadonlyMap<CosmeticId, ShopCosmetic> = new Map(SHOP_COSMETICS.map((s) => [s.id, s]));

/** The accessory slot an id wears in, or null (dyes aren't worn, they unlock colors). */
export function slotOf(id: CosmeticId): AccessorySlot | null { return ACCESSORY_BY_ID.get(id)?.slot ?? SHOP_BY_ID.get(id)?.slot ?? null; }
export function cosmeticName(id: CosmeticId): string { return ACCESSORY_BY_ID.get(id)?.name ?? SHOP_BY_ID.get(id)?.name ?? id; }
/** The `ui` atlas icon of a cosmetic (ART10; hyphens are not allowed in frame names). */
export const cosmeticIcon = (id: CosmeticId): string => `icon_cos_${id.replace(/-/g, '_')}`;
export const cosmeticHex = (id: CosmeticId): number => ACCESSORY_BY_ID.get(id)?.hex ?? SHOP_BY_ID.get(id)?.hex ?? 0x8a8a96;

/** 09 §2 defaults (first launch, and the fallback for any bad saved option). */
export const DEFAULT_LOOK: Look = { race: 'human', skin: 1, face: 0, hair: 2, hairColor: 'brown', beard: 0, outfit: 'leather', colorA: 'slate', colorB: 'brown', head: null, back: null, extra: null };
/** The Dwarf's default beard is long, the Elf's none (09 §2): the wardrobe applies these when the race changes. */
export const RACE_DEFAULT_BEARD: Record<RaceId, number> = { human: 0, elf: 0, dwarf: 3, orc: 0 };
