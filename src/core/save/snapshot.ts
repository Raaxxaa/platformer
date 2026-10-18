// Store schema fields only; live loot weapons may also hold per-run Leeching state.
import type { KitSummary } from './schema.ts';
export function snapshotKit(kit: KitSummary): KitSummary {
  return { displayName: kit.displayName,
    weapons: kit.weapons.map((w) => w ? { weaponId: w.weaponId, grade: w.grade, element: w.element, perk: w.perk } : null),
    abilities: kit.abilities.map((a) => a ? { id: a.id, level: a.level } : null) };
}
