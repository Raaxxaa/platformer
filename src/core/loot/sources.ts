// Loot sources (05 §5, 04 §2.9): free loot stands, key / cursed / timed chests, placed keys, elite drops, the boss drop.
// Every roll uses its own generator (05 §2.1), so the order things are opened in never changes their contents.
import { dropItem, type GroundItem, type Interactable } from '../abilities/items.ts';
import type { AbilityId } from '../abilities/types.ts';
import { tryLockpick } from '../classes/hybrids.ts';
import type { EnemyState } from '../enemies/enemy.ts';
import { addGoldTenths } from '../economy/gold.ts';
import { dropKey } from '../economy/keys.ts';
import { deriveSeed, Rng } from '../rng.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { CHEST_GOLD } from '../../data/economy.ts';
import { ANY_ABILITY_CHANCE, CURSE_KILLS, GRADE_ODDS, KEY_CHEST_ABILITY_CHANCE, KEY_CHEST_ITEM_DX, type StageIndex } from '../../data/loot.ts';
import { sourceRng, type Rng as RngFn } from './pick.ts';
import { rollAbility, rollWeapon } from './roll.ts';

export interface Chest { objectId: number; kind: 'key' | 'cursed' | 'timed'; x: number; y: number; opened: boolean }
/** 04 §2.9 elite item roll: key below 0.15, ability below 0.30. */
export const ELITE_DROP = { key: 0.15, ability: 0.30 } as const;
const CHEST_KIND: Record<string, Chest['kind']> = { key_chest: 'key', cursed_chest: 'cursed', timed_chest: 'timed' };
/** Items pop out 16 px above their source and fall. */
const POP_UP = 16;

const stageOf = (w: GameWorld) => Math.min(4, Math.max(1, w.stage)) as StageIndex;
const levelId = (w: GameWorld) => w.level?.id ?? 'test';
const carriedIds = (w: GameWorld) => w.abilities.slots.filter((s) => s).map((s) => s!.id) as AbilityId[];

/** A weapon (or, when asked, an ability) from one generator, using the carried classes now. */
function weaponItem(w: GameWorld, rng: RngFn, table: 'free' | 'key' | 'cursed', exclude: string[] = []): Pick<GroundItem, 'weapon'> {
  return { weapon: rollWeapon(rng, GRADE_ODDS[table][stageOf(w)], w.classState.carriedClasses, { exclude: exclude as never }) };
}
function abilityItem(w: GameWorld, rng: RngFn, table: 'free' | 'key'): Pick<GroundItem, 'weapon' | 'ability'> {
  const a = rollAbility(rng, carriedIds(w), w.classState.carriedClasses);
  return a ? { ability: a } : weaponItem(w, rng, table);
}

/** Stage load: stands roll their items, keys are placed, chests become interactables, elites get their drop. */
export function setupLoot(w: GameWorld): void {
  w.chests = [];
  w.luckyBlocks = [];
  const objs = w.level?.objects ?? [];
  for (const o of objs) {
    if (o.type === 'loot_stand') {
      const rng = sourceRng(w.runSeed, 'loot', levelId(w), o.id);
      const kind = String(o.props.kind ?? 'any');
      const ability = kind === 'ability' || (kind === 'any' && rng() < ANY_ABILITY_CHANCE);
      const item = ability ? abilityItem(w, rng, 'free') : weaponItem(w, rng, 'free');
      const it = dropItem(w, o.x, o.y, { ...item, stand: true });
      it.resting = true;
    }
    if (o.type === 'key') dropKey(w, o.x, o.y);
    if (o.type === 'lucky_block') w.luckyBlocks.push({ objectId: o.id, x: o.x, y: o.y, broken: false });
    const kind = CHEST_KIND[o.type];
    if (kind) {
      const c: Chest = { objectId: o.id, kind, x: o.x, y: o.y, opened: false };
      w.chests.push(c);
      const ia: Interactable = { id: w.newId(), x: o.x, y: o.y, kind: o.type, label: kind, use: (ww) => { openChest(ww, c); } };
      w.interactables.push(ia);
    }
  }
  // 04 §2.9: each elite rolls its drop at stage load, in ascending id order, on the `enemyDrops` stream.
  const drops = new Rng(deriveSeed(w.runSeed, 'enemyDrops', w.stage));
  for (const e of [...w.enemies].sort((a, b) => a.id - b.id)) {
    if (!e.def.elite) continue;
    const r = drops.next();
    e.drop = r < ELITE_DROP.key ? 'key' : r < ELITE_DROP.ability ? 'ability' : null;
  }
}

/** Interact on a chest (05 §5.2–5.4). Returns whether it opened. */
export function openChest(w: GameWorld, c: Chest): boolean {
  if (c.opened) return false;
  if (c.kind === 'key') {
    if (!tryLockpick(w)) {
      if (w.econ.keys < 1) { w.events.push({ t: 'chestLocked' }); return false; }
      w.econ.keys -= 1;
    }
  }
  c.opened = true;
  w.interactables = w.interactables.filter((i) => !(i.kind.endsWith('_chest') && i.x === c.x && i.y === c.y));
  const rng = sourceRng(w.runSeed, 'loot', levelId(w), c.objectId);
  const y = c.y - POP_UP;
  if (c.kind === 'key') {
    addGoldTenths(w, CHEST_GOLD.key * 10, 'chest');
    const a = weaponItem(w, rng, 'key');
    const b = rng() < KEY_CHEST_ABILITY_CHANCE ? abilityItem(w, rng, 'key') : weaponItem(w, rng, 'key', [a.weapon!.weaponId]);
    dropItem(w, c.x - KEY_CHEST_ITEM_DX, y, { ...a, chestGroup: c.objectId, fromChest: c.objectId });
    dropItem(w, c.x + KEY_CHEST_ITEM_DX, y, { ...b, chestGroup: c.objectId, fromChest: c.objectId });
  } else if (c.kind === 'cursed') {
    addGoldTenths(w, CHEST_GOLD.cursed * 10, 'chest');
    dropItem(w, c.x, y, { ...weaponItem(w, rng, 'cursed'), fromChest: c.objectId });
    w.econ.curse = { id: 'one_hit', killsLeft: CURSE_KILLS };          // 05 §8 (EXTRA_CURSES off: always one_hit)
    w.events.push({ t: 'curseApplied', id: 'one_hit' });
  } else {
    addGoldTenths(w, CHEST_GOLD.timed * 10, 'chest');
    dropItem(w, c.x, y, { ...weaponItem(w, rng, 'key'), fromChest: c.objectId });
  }
  w.run.stats.chestsOpened += 1;
  w.events.push({ t: 'chestOpened', kind: c.kind, objectId: c.objectId });
  return true;
}

/** On a player kill (02 §3.5 step 9): elite key or ability, the Guardian's weapon (05 §5.5). */
export function lootOnKill(w: GameWorld, e: EnemyState): void {
  const y = e.y - POP_UP;
  if (e.drop === 'key') dropKey(w, e.x, y);
  else if (e.drop === 'ability') {
    const rng = sourceRng(w.runSeed, 'loot', levelId(w), 'elite', e.id);
    dropItem(w, e.x, y, abilityItem(w, rng, 'key'));
  }
  if (e.boss) {
    const rng = sourceRng(w.runSeed, 'loot', levelId(w), e.def.id);
    dropItem(w, e.x, y, weaponItem(w, rng, 'key'));
  }
}

/** Key-chest pair (05 §5.2): taking one item makes the other vanish. */
export function onItemTaken(w: GameWorld, it: GroundItem): void {
  if (it.chestGroup === undefined) return;
  w.groundItems = w.groundItems.filter((x) => x.chestGroup !== it.chestGroup);
}
