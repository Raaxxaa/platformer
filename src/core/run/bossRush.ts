// Boss rush (06 §14.2, M15): every boss back to back, against the clock. Pure rules; the scene loads each arena.
import type { AbilityId, ClassId } from '../abilities/types.ts';
import { newAbility, type Loadout } from '../abilities/runtime.ts';
import type { WeaponId } from '../combat/types.ts';
import { ABILITY_INFO } from '../../data/abilities.ts';
import { STARTING_KITS } from '../../data/classes.ts';
import { BLUEPRINT_IDS } from '../../data/save.ts';
import { PRACTICE_PRESET } from '../../data/practice.ts';
import type { DragonRoll } from './dragonRoll.ts';
import { BOSS_RUSH } from '../../data/bossRush.ts';

export { BOSS_RUSH };
export type DragonColor = DragonRoll['color'];
import { practiceLoadout } from './practice.ts';


export type BossRushDragon = 'off' | 'random' | DragonColor;
export interface BossRushFight { boss: string; levelId: 'plains' | 'mountains' | 'swamps' | 'kingdom' | 'castle'; arena: 'boss' | 'side' }
const BOAR: BossRushFight = { boss: 'great_boar', levelId: 'plains', arena: 'boss' };
const COLOSSUS: BossRushFight = { boss: 'stone_colossus', levelId: 'mountains', arena: 'boss' };
const QUEEN: BossRushFight = { boss: 'spider_queen', levelId: 'swamps', arena: 'boss' };
const DRAGON: BossRushFight = { boss: 'dragon', levelId: 'mountains', arena: 'side' };
const KNIGHT: BossRushFight = { boss: 'black_knight', levelId: 'kingdom', arena: 'boss' };
const KING: BossRushFight = { boss: 'enemy_king', levelId: 'castle', arena: 'boss' };

/** Great Boar → Stone Colossus → Spider Queen → (the Dragon) → Black Knight → Enemy King. */
export const bossRushOrder = (dragon: boolean): BossRushFight[] => dragon ? [BOAR, COLOSSUS, QUEEN, DRAGON, KNIGHT, KING] : [BOAR, COLOSSUS, QUEEN, KNIGHT, KING];

/** Unlocked once the Enemy King was beaten in a normal or daily run (old saves: any finished run). */
export const bossRushUnlocked = (s: { progress: { kingBeaten?: boolean }; stats: { runsCompleted: number } }): boolean =>
  s.progress.kingBeaten === true || s.stats.runsCompleted > 0;

/** The class's second M4 ability (03 §5; not the starting one, not a blueprint).
 * SPEC-GAP: "second M4 ability" read as the first non-starting, non-blueprint ability in the class's list. */
export function secondAbility(cls: ClassId): AbilityId {
  const ids = Object.keys(ABILITY_INFO) as AbilityId[];
  return ids.find((id) => ABILITY_INFO[id].cls === cls && id !== STARTING_KITS[cls].ability && !(BLUEPRINT_IDS as readonly string[]).includes(id))!;
}

/** The practice Stage 4 preset for the kit, plus the second ability at Lv3 in slot 2. */
export function bossRushLoadout(cls: ClassId, weapon: WeaponId): Loadout {
  const l = practiceLoadout({ levelId: 'castle', cls, weapon, dragon: 'off' });
  return { weapons: l.weapons, abilities: [l.abilities[0], newAbility(secondAbility(cls), BOSS_RUSH.secondAbilityLevel)] };
}
export const bossRushFlasks = (): number => PRACTICE_PRESET[BOSS_RUSH.preset].flask;
export const bossRushHp = (): number => PRACTICE_PRESET[BOSS_RUSH.preset].hp;
/** Between fights: HP +50% of max, capped. */
export const healBetween = (hp: number, maxHp: number): number => Math.min(maxHp, hp + Math.floor(maxHp * BOSS_RUSH.healFraction));

export interface BossRushAttempt { cls: ClassId; weapon: WeaponId; dragon: BossRushDragon; dragonColor: DragonColor | null; fights: BossRushFight[];
  index: number; splits: number[]; hp: number; assist: boolean }
export function newBossRush(cls: ClassId, weapon: WeaponId, dragon: BossRushDragon, pick: number, colors: readonly DragonColor[]): BossRushAttempt {
  const dragonColor = dragon === 'off' ? null : dragon === 'random' ? colors[Math.min(colors.length - 1, Math.floor(pick * colors.length))] : dragon;
  return { cls, weapon, dragon, dragonColor, fights: bossRushOrder(dragon !== 'off'), index: 0, splits: [], hp: bossRushHp(), assist: false };
}
/** A boss died after `fightTicks` of control in its arena (fades are not timed). Returns true when it was the last. */
export function bossDown(a: BossRushAttempt, fightTicks: number, hp: number, maxHp: number): boolean {
  a.splits.push((a.splits.at(-1) ?? 0) + fightTicks);
  a.index += 1; a.hp = healBetween(hp, maxHp);
  return a.index >= a.fights.length;
}
export const bossRushTicks = (a: BossRushAttempt): number => a.splits.at(-1) ?? 0;

export interface BossRushBest { ticks: number; splits: number[] }
export type BossRushKey = `${ClassId}|${'dragon' | 'no_dragon'}`;
export const bossRushKey = (cls: ClassId, dragon: boolean): BossRushKey => `${cls}|${dragon ? 'dragon' : 'no_dragon'}`;
/** A finished, non-assisted attempt replaces a slower best. Returns whether it was saved. */
export function applyBossRushBest(bests: Partial<Record<BossRushKey, BossRushBest>>, a: BossRushAttempt): boolean {
  if (a.assist || a.index < a.fights.length) return false;
  const key = bossRushKey(a.cls, a.dragon !== 'off'), old = bests[key], ticks = bossRushTicks(a);
  if (old && old.ticks <= ticks) return false;
  bests[key] = { ticks, splits: [...a.splits] }; return true;
}
