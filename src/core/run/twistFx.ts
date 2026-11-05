// Daily twist effects (06 §14.1, M18) read by low-level systems. No imports of systems here (import cycles).
import type { GameWorld } from '../sim/gameWorld.ts';
import { TWIST_FX as F, type TwistId } from '../../data/twists.ts';

export const twistOf = (w: GameWorld): TwistId => w.run?.twist ?? 'classic';
export const hasTwist = (w: GameWorld, t: TwistId): boolean => twistOf(w) === t;

/** Enemy walking/chasing speed (not knockback). */
export const enemySpeedMult = (w: GameWorld): number => (hasTwist(w, 'swift') ? F.swiftEnemyMult : 1);
/** Enemy max HP. */
export const enemyHpMult = (w: GameWorld): number => (hasTwist(w, 'blood_moon') ? F.bloodMoonHp : 1);
export const flaskKillMult = (w: GameWorld): number => (hasTwist(w, 'blood_moon') ? F.bloodMoonFill : 1);
export const goldGainMult = (w: GameWorld): number => (hasTwist(w, 'heavy_pockets') ? F.goldMult : 1);
/** Shop, merchant and upgrade prices: ×1.5, still a multiple of 5. */
export const twistPrice = (w: GameWorld, price: number): number => (hasTwist(w, 'heavy_pockets') ? 5 * Math.round((price * F.priceMult) / 5) : price);
export const luckyAlwaysBuff = (w: GameWorld): boolean => hasTwist(w, 'golden_hour');

