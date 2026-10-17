// 08 §3.4: the player's trim A / trim B tints from the class state. Hybrids put the earlier class (swordsman, tank,
// archer, wizard order) on trim A.
import type { ClassState } from '../../core/abilities/types.ts';
import { TRIM_TINT } from '../../data/art.ts';
import { CLASS_IDS } from '../../data/classes.ts';

export function trimTints(c: ClassState): [number, number] {
  if (c.hybrid) {
    const [a, b] = [...c.carriedClasses].sort((x, y) => CLASS_IDS.indexOf(x) - CLASS_IDS.indexOf(y));
    return [TRIM_TINT[a], TRIM_TINT[b]];
  }
  if (!c.displayClass) return [TRIM_TINT.none, TRIM_TINT.none];
  return [TRIM_TINT[c.displayClass], c.connection ? TRIM_TINT[c.displayClass] : TRIM_TINT.none];
}
