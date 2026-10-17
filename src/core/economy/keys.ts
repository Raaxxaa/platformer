// Keys (05 §6): up to 3, collected by touch; at the cap a key stays on the ground ("Keys full").
import { dropItem, itemRect } from '../abilities/items.ts';
import { overlaps } from '../combat/hitGroups.ts';
import { playerRect } from '../combat/resolve.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { KEYS_MAX } from '../../data/economy.ts';

export function dropKey(w: GameWorld, x: number, y: number): void {
  dropItem(w, x, y, { key: true });
}

/** Each tick: keys under the player are taken while below the cap. `keysFull` fires once per touch. */
export function stepKeys(w: GameWorld): void {
  const pr = playerRect(w);
  for (const it of [...w.groundItems]) {
    if (!it.key) continue;
    const touching = overlaps(itemRect(it), pr);
    if (!touching) { it.fullShown = false; continue; }
    if (w.econ.keys >= KEYS_MAX) {
      if (!it.fullShown) { w.events.push({ t: 'keysFull' }); it.fullShown = true; }
      continue;
    }
    w.econ.keys += 1;
    w.groundItems = w.groundItems.filter((x) => x !== it);
    w.events.push({ t: 'keyTaken' });
  }
}
