// Weapon attack data (02 §10). M2 has the Greatsword and War Maul; the other 17 come later.
import type { AttackStep, Box, HitSpec, WeaponDef, WeaponId } from '../core/combat/types.ts';
import { WEIGHT_MOVE_MULT } from '../core/tuning.ts';

const HEAVY = WEIGHT_MOVE_MULT.heavy;

function step(id: string, startup: number, active: number, recovery: number, box: Box, hit: Omit<HitSpec, 'kind'>): AttackStep {
  return { id, startup, active, recovery, moveMult: HEAVY, box, hit: { kind: 'melee', ...hit } };
}

export const WEAPONS: Partial<Record<WeaponId, WeaponDef>> = {
  greatsword: {
    id: 'greatsword', weight: 'heavy', hold: 'repeat', dive: 'standard', signature: 'Ground Wave',
    combo: [
      step('greatsword_1', 0.20, 0.10, 0.20, { dx: 22, dy: -16, w: 40, h: 28 }, { damage: 16, kb: [120, -40], poise: 15, hitStop: 0.05 }),
      step('greatsword_2', 0.20, 0.10, 0.20, { dx: 22, dy: -18, w: 40, h: 32 }, { damage: 16, kb: [120, -40], poise: 15, hitStop: 0.05 }),
      step('greatsword_cleave', 0.30, 0.15, 0.35, { dx: 24, dy: -18, w: 64, h: 40 }, { damage: 34, kb: [260, -120], poise: 40, hitStop: 0.10, heavy: true }),
    ],
  },
  war_maul: {
    id: 'war_maul', weight: 'heavy', hold: 'repeat', dive: 'war_maul', signature: 'Quake',
    combo: [
      step('war_maul_1', 0.35, 0.10, 0.30, { dx: 24, dy: -16, w: 40, h: 32 }, { damage: 25, kb: [200, -80], poise: 35, hitStop: 0.075, heavy: true }),
      step('war_maul_smash', 0.40, 0.125, 0.40, { dx: 28, dy: -10, w: 56, h: 20 }, { damage: 36, kb: [300, -200], poise: 50, hitStop: 0.10, heavy: true }),
    ],
  },
};

export interface DiveDef { descentBox: Box; impactBox: Box; impactTime: number; hit: HitSpec }

const DESCENT: Box = { dx: 0, dy: 2, w: 16, h: 12 };

/** Dive slam damage (02 §9.7) and the War Maul shockwave (02 §10.5). Impact boxes last 0.05 s. */
export const DIVE: { lightMedium: DiveDef; heavy: DiveDef; warMaul: DiveDef } = {
  lightMedium: {
    descentBox: DESCENT, impactBox: { dx: 0, dy: -8, w: 48, h: 16 }, impactTime: 0.05,
    hit: { damage: 18, kb: [150, -150], poise: 25, hitStop: 0.05, kind: 'melee' },
  },
  heavy: {
    descentBox: DESCENT, impactBox: { dx: 0, dy: -8, w: 64, h: 16 }, impactTime: 0.05,
    hit: { damage: 26, kb: [200, -180], poise: 40, hitStop: 0.075, kind: 'melee', heavy: true },
  },
  warMaul: {
    descentBox: DESCENT, impactBox: { dx: 0, dy: -12, w: 128, h: 24 }, impactTime: 0.05,
    hit: { damage: 30, kb: [200, -200], poise: 50, hitStop: 0.10, kind: 'melee', heavy: true, control: { type: 'knockdown', duration: 1.0 } },
  },
};
