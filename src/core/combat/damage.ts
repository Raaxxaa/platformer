// Damage formulas (02 §3.1, §3.3).
import { roundHalfUp } from '../math.ts';
import { COMBAT } from '../tuning.ts';
import type { Grade } from './types.ts';

export const GRADE_MULT: Record<Grade, number> = COMBAT.GRADE_MULT;

/** Player → enemy, 02 §3.1 steps 1–7. Ability hits (`isWeapon: false`) skip grade and match. */
export function playerHitDamage(o: {
  base: number; grade?: Grade; matched?: boolean; bonus?: number; crit?: boolean; targetMult?: number; isWeapon: boolean;
}): { procBase: number; damage: number } {
  let v = o.base;
  if (o.isWeapon) {
    v *= GRADE_MULT[o.grade ?? 'C'];
    if (o.matched) v *= COMBAT.MATCH_MULT;
  }
  const procBase = v * (1 + (o.bonus ?? 0));
  const raw = procBase * (o.crit ? COMBAT.CRIT_MULT : 1) * (o.targetMult ?? 1);
  return { procBase, damage: Math.max(1, roundHalfUp(raw)) };
}

/** Enemy → player, 02 §3.3. `A` is the attack's stage-scaled damage; a one-hit curse deals current HP. */
export function enemyHitDamage(A: number, incomingMult: number, oneHitCurseHp: number | null): number {
  if (oneHitCurseHp !== null) return oneHitCurseHp;
  return Math.max(1, roundHalfUp(A * incomingMult));
}
