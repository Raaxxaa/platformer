// Vampire (03 §12): passive; extra flask fill per player kill (tenths).
import { ABILITIES } from '../../../data/abilities.ts';
import type { GameWorld } from '../../sim/gameWorld.ts';

export function vampireTenths(w: GameWorld): number {
  const s = w.abilities.slots.find((x) => x?.id === 'vampire');
  return s ? (ABILITIES.vampire!.levels[s.level - 1].tenths as number) : 0;
}
