// The saved look and its checks (09 §2, §8). Pure.
import {
  ALL_COSMETIC_IDS, BASE_CLOTH, BASE_HAIR, BEARDS, DEFAULT_LOOK, FACES, HAIR_STYLES, OUTFITS, RACES, SHOP_COSMETICS, SKINS, slotOf,
  type AccessorySlot, type ColorOption, type CosmeticId, type Look,
} from '../../data/cosmetics.ts';
import type { EnemyId } from '../enemies/types.ts';

export interface CosmeticsSave { owned: CosmeticId[]; seenEnemies: EnemyId[]; wardrobeIntroDone: boolean }
export const defaultCosmetics = (): CosmeticsSave => ({ owned: [], seenEnemies: [], wardrobeIntroDone: false });

const obj = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null && !Array.isArray(v) ? v as Record<string, unknown> : {});
const idx = (v: unknown, n: number, d: number): number => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < n ? v : d);

/** Cloth dye options (09 §2, §5): the 8 base colors, plus each owned `dye_*`. */
export function clothColors(owned: readonly CosmeticId[]): ColorOption[] {
  const extra = SHOP_COSMETICS.filter((s) => s.kind === 'dye' && owned.includes(s.id)).map((s) => ({ id: s.id.slice(4), name: s.name.replace(/ dye$/, ''), hex: s.hex }));
  return [...BASE_CLOTH, ...extra];
}
/** Hair color options: the 6 base colors, plus each owned `hair_*`. */
export function hairColors(owned: readonly CosmeticId[]): ColorOption[] {
  const extra = SHOP_COSMETICS.filter((s) => s.kind === 'hair' && owned.includes(s.id)).map((s) => ({ id: s.id.slice(5), name: s.name.replace(/ hair dye$/, ''), hex: s.hex }));
  return [...BASE_HAIR, ...extra];
}
/** Owned items that fit a slot, in the data tables' order (accessories first, then shop hats and capes). */
export function ownedFor(slot: AccessorySlot, owned: readonly CosmeticId[]): CosmeticId[] {
  return ALL_COSMETIC_IDS.filter((id) => owned.includes(id) && slotOf(id) === slot);
}

/** A look from a save: anything unknown, out of range or not owned falls back to its default. */
export function validateLook(raw: unknown, owned: readonly CosmeticId[]): Look {
  const s = obj(raw), d = DEFAULT_LOOK;
  const race = RACES.includes(s.race as never) ? (s.race as Look['race']) : d.race;
  const cloth = clothColors(owned).map((c) => c.id), hair = hairColors(owned).map((c) => c.id);
  const worn = (slot: AccessorySlot): CosmeticId | null => { const v = s[slot]; return typeof v === 'string' && owned.includes(v) && slotOf(v) === slot ? v : null; };
  return {
    race, skin: idx(s.skin, SKINS[race].length, d.skin), face: idx(s.face, FACES.length, d.face), hair: idx(s.hair, HAIR_STYLES.length, d.hair),
    hairColor: typeof s.hairColor === 'string' && hair.includes(s.hairColor) ? s.hairColor : d.hairColor, beard: idx(s.beard, BEARDS.length, d.beard),
    outfit: OUTFITS.includes(s.outfit as never) ? (s.outfit as Look['outfit']) : d.outfit,
    colorA: typeof s.colorA === 'string' && cloth.includes(s.colorA) ? s.colorA : d.colorA, colorB: typeof s.colorB === 'string' && cloth.includes(s.colorB) ? s.colorB : d.colorB,
    head: worn('head'), back: worn('back'), extra: worn('extra'),
  };
}

const ENEMY_IDS = new Set<string>(['wolf', 'bandit', 'bandit_archer', 'wild_boar', 'bandit_brute', 'bat_swarm', 'goblin_miner', 'rock_golem', 'ram', 'goblin_shaman', 'bog_zombie', 'giant_spider', 'wisp', 'swamp_witch', 'treant',
  'soldier', 'crossbowman', 'war_hound', 'battle_mage', 'knight', 'royal_guard', 'gargoyle', 'castle_mage', 'living_armor', 'royal_executioner', 'spiderling', 'great_boar', 'stone_colossus', 'spider_queen', 'black_knight', 'enemy_king', 'dragon']);
export function validateCosmetics(raw: unknown): CosmeticsSave {
  const s = obj(raw), known = new Set<string>(ALL_COSMETIC_IDS);
  const owned = [...new Set(Array.isArray(s.owned) ? s.owned.filter((v): v is string => typeof v === 'string' && known.has(v)) : [])];
  const seen = [...new Set(Array.isArray(s.seenEnemies) ? s.seenEnemies.filter((v): v is EnemyId => typeof v === 'string' && ENEMY_IDS.has(v)) : [])];
  return { owned, seenEnemies: seen, wardrobeIntroDone: s.wardrobeIntroDone === true };
}
