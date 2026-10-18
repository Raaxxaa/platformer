// Blueprint ground pickups and run-owned unlock events (05 §14).
import type { GameWorld } from '../sim/gameWorld.ts';
import type { EnemyState } from '../enemies/enemy.ts';
import { BLUEPRINT_IDS } from '../../data/save.ts';
import { dropItem, itemRect } from '../abilities/items.ts';
import { playerRect } from '../combat/resolve.ts';
import { overlaps } from '../combat/hitGroups.ts';
import { kingUnlocks, rollBlueprint, type BlueprintId } from './blueprints.ts';

export function dropBlueprint(w: GameWorld, id: BlueprintId, x: number, y: number): number | false {
  if (w.run.seeded || w.opts.practice || !BLUEPRINT_IDS.includes(id) || w.run.lootUnlocked.includes(id) || w.run.blueprintsDropped.includes(id)) return false;
  w.run.blueprintsDropped.push(id); return dropItem(w, x, y, { blueprint: id }).id;
}
export function blueprintOnKill(w: GameWorld, enemy: EnemyState): void {
  if (w.run.seeded || w.opts.practice || w.level?.kind !== 'stage') return;
  const kind = enemy.def.tier === 'boss' && enemy.def.id !== 'enemy_king' ? 'boss' : enemy.def.elite ? 'elite' : null;
  if (!kind) return;
  const id = rollBlueprint(w.runSeed, w.level.id, kind === 'boss' ? enemy.def.id : enemy.spawn.objectId ?? enemy.id, kind, w.run.lootUnlocked, w.run.blueprintsDropped);
  if (id) dropBlueprint(w, id, enemy.x, enemy.y);
}
export function stepBlueprints(w: GameWorld): void {
  if (w.health.dead) return;
  for (const item of [...w.groundItems]) {
    if (!item.blueprint || !overlaps(itemRect(item), playerRect(w))) continue;
    w.groundItems = w.groundItems.filter((i) => i !== item); w.events.push({ t: 'blueprintFound', id: item.blueprint });
  }
}
/** Directly testable until the King and full victory flow arrive in M9. */
export function grantKingUnlocks(w: GameWorld): void {
  if (!w.run.startKit) return;
  const intent = kingUnlocks(w.runSeed, w.run.startKit.cls, w.run.lootUnlocked, w.run.blueprintsDropped, w.run.seeded, w.opts.practice);
  if (intent.blueprint) { w.run.blueprintsDropped.push(intent.blueprint); w.events.push({ t: 'blueprintFound', id: intent.blueprint }); }
  if (intent.startWeapon) w.events.push({ t: 'startingWeaponUnlocked', cls: w.run.startKit.cls, weapon: intent.startWeapon });
}
