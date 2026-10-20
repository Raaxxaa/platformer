// Weapon attack data (02 §10). M2 has the Greatsword and War Maul; the other 17 come later.
import type { AttackStep, Box, HitSpec, ProjectileId, WeaponDef, WeaponId } from '../core/combat/types.ts';
import { WEIGHT_MOVE_MULT } from '../core/tuning.ts';

const HEAVY = WEIGHT_MOVE_MULT.heavy, MEDIUM = WEIGHT_MOVE_MULT.medium, LIGHT = WEIGHT_MOVE_MULT.light;

function step(id: string, startup: number, active: number, recovery: number, box: Box, hit: Omit<HitSpec, 'kind'>, moveMult: number = HEAVY): AttackStep {
  return { id, startup, active, recovery, moveMult, box, hit: { kind: 'melee', ...hit } };
}
/** A ranged step (02 §10.3): active 0, projectiles spawn when startup ends. */
function shot(id: string, startup: number, recovery: number, projectile: ProjectileId, moveMult: number): AttackStep {
  return { id, startup, active: 0, recovery, moveMult, projectiles: [{ id: projectile, angle: 0 }] };
}

/** A ranged step firing several projectiles at once (Throwing Knives, 02 §10.3). */
function volley(id: string, startup: number, recovery: number, projectile: ProjectileId, angles: number[], moveMult: number): AttackStep {
  return { id, startup, active: 0, recovery, moveMult, projectiles: angles.map((angle) => ({ id: projectile, angle })) };
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
  katana: {
    id: 'katana', weight: 'medium', hold: 'charge', dive: 'standard', signature: 'Phantom Edge', chargeTime: 0.40,
    combo: [
      step('katana_1', 0.10, 0.075, 0.15, { dx: 20, dy: -16, w: 32, h: 20 }, { damage: 12, kb: [80, -20], poise: 10, hitStop: 0.025 }, MEDIUM),
      step('katana_2', 0.10, 0.075, 0.15, { dx: 20, dy: -16, w: 32, h: 20 }, { damage: 12, kb: [80, -20], poise: 10, hitStop: 0.025 }, MEDIUM),
      step('katana_3', 0.125, 0.10, 0.25, { dx: 22, dy: -16, w: 40, h: 24 }, { damage: 17, kb: [160, -60], poise: 20, hitStop: 0.05 }, MEDIUM),
    ],
    // The dash-slash (02 §10.5): its box is the swept path, built by the special; active is the 0.15 s move.
    chargedStep: { id: 'katana_dash_slash', startup: 0.05, active: 0.15, recovery: 0.25, moveMult: 1,
      hit: { damage: 40, kb: [60, -100], poise: 40, hitStop: 0.075, kind: 'melee', charged: true } },
  },
  iron_fists: {
    id: 'iron_fists', weight: 'light', hold: 'repeat', dive: 'standard', signature: 'Thunderclap',
    combo: [
      step('iron_fists_1', 0.075, 0.05, 0.15, { dx: 14, dy: -16, w: 22, h: 16 }, { damage: 10, kb: [50, 0], poise: 6, hitStop: 0.025 }, LIGHT),
      step('iron_fists_2', 0.075, 0.05, 0.15, { dx: 14, dy: -16, w: 22, h: 16 }, { damage: 10, kb: [50, 0], poise: 6, hitStop: 0.025 }, LIGHT),
      step('iron_fists_3', 0.075, 0.05, 0.175, { dx: 14, dy: -16, w: 24, h: 18 }, { damage: 11, kb: [80, -20], poise: 10, hitStop: 0.025 }, LIGHT),
      step('iron_fists_uppercut', 0.125, 0.10, 0.30, { dx: 12, dy: -24, w: 20, h: 36 },
        { damage: 18, kb: [40, -380], poise: 30, hitStop: 0.075, heavy: true, control: { type: 'launch', duration: 0 } }, LIGHT),
    ],
  },
  bow: {
    id: 'bow', weight: 'medium', hold: 'charge', dive: 'standard', signature: 'Triple Shot', chargeTime: 0.45,
    combo: [shot('bow_shot', 0.10, 0.225, 'arrow', MEDIUM)],
    chargedStep: shot('bow_charged', 0.05, 0.25, 'arrow_charged', MEDIUM),
  },
  crossbow: {
    id: 'crossbow', weight: 'heavy', hold: 'repeat', dive: 'standard', signature: 'Impaler',
    combo: [shot('crossbow_shot', 0.15, 0.65, 'bolt', HEAVY)],
  },
  storm_hammer: {
    id: 'storm_hammer', weight: 'heavy', hold: 'repeat', dive: 'storm_hammer', signature: 'Tempest',
    combo: [
      step('storm_hammer_1', 0.25, 0.10, 0.25, { dx: 22, dy: -16, w: 40, h: 30 }, { damage: 22, kb: [180, -60], poise: 30, hitStop: 0.075, heavy: true }),
      step('storm_hammer_2', 0.30, 0.10, 0.30, { dx: 24, dy: -14, w: 48, h: 28 }, { damage: 25, kb: [240, -100], poise: 40, hitStop: 0.075, heavy: true }),
    ],
  },
  staff: {
    id: 'staff', weight: 'medium', hold: 'charge', dive: 'standard', signature: 'Singularity', chargeTime: 0.50,
    combo: [shot('staff_bolt', 0.10, 0.25, 'staff_bolt', MEDIUM)],
    chargedStep: shot('staff_orb', 0.05, 0.30, 'orb', MEDIUM),
  },
  twin_daggers: {
    id: 'twin_daggers', weight: 'light', hold: 'repeat', dive: 'standard', signature: 'Shadow Step',
    combo: [
      ...[1, 2, 3].map((n) => step(`twin_daggers_${n}`, 0.075, 0.05, 0.15, { dx: 14, dy: -14, w: 24, h: 20 }, { damage: 10, kb: [40, 0], poise: 6, hitStop: 0.025 }, LIGHT)),
      step('twin_daggers_4', 0.075, 0.05, 0.225, { dx: 16, dy: -14, w: 28, h: 20 }, { damage: 12, kb: [140, -40], poise: 15, hitStop: 0.05 }, LIGHT),
    ],
  },
  spear: {
    id: 'spear', weight: 'medium', hold: 'repeat', dive: 'standard', signature: 'Skewer Wave',
    combo: [
      step('spear_1', 0.125, 0.075, 0.20, { dx: 34, dy: -16, w: 52, h: 10 }, { damage: 14, kb: [100, -20], poise: 12, hitStop: 0.05 }, MEDIUM),
      step('spear_2', 0.125, 0.075, 0.20, { dx: 34, dy: -16, w: 52, h: 10 }, { damage: 14, kb: [100, -20], poise: 12, hitStop: 0.05 }, MEDIUM),
      step('spear_3', 0.15, 0.10, 0.25, { dx: 38, dy: -16, w: 60, h: 12 }, { damage: 18, kb: [180, -40], poise: 20, hitStop: 0.05 }, MEDIUM),
    ],
    // SPEC-GAP: 02 §10.5 gives the lunge no startup; it has none (the move starts on the press).
    // The lunge (02 §10.5): its active phase is the 0.16 s move; the hit box is the tip plus the swept body (built by the special).
    special: { id: 'spear_lunge', startup: 0, active: 0.16, recovery: 0.20, moveMult: 1,
      hit: { damage: 24, kb: [200, -60], poise: 30, hitStop: 0.05, kind: 'melee' } },
  },
  scythe: {
    id: 'scythe', weight: 'medium', hold: 'repeat', dive: 'standard', signature: 'Soul Reap',
    combo: [
      step('scythe_1', 0.15, 0.10, 0.20, { dx: 16, dy: -20, w: 52, h: 40 }, { damage: 15, kb: [120, -40], poise: 14, hitStop: 0.05 }, MEDIUM),
      step('scythe_2', 0.15, 0.10, 0.20, { dx: 16, dy: -20, w: 52, h: 40 }, { damage: 15, kb: [120, -40], poise: 14, hitStop: 0.05 }, MEDIUM),
      // Step 3 is centered on the player, so it hits both sides.
      step('scythe_3', 0.20, 0.125, 0.30, { dx: 0, dy: -20, w: 84, h: 40 }, { damage: 24, kb: [180, -80], poise: 25, hitStop: 0.075 }, MEDIUM),
    ],
  },
  giant_axe: {
    id: 'giant_axe', weight: 'heavy', hold: 'repeat', dive: 'standard', signature: 'Cyclone',
    combo: [
      step('giant_axe_1', 0.30, 0.125, 0.30, { dx: 22, dy: -16, w: 44, h: 32 }, { damage: 26, kb: [220, -60], poise: 35, hitStop: 0.075, heavy: true }),
      step('giant_axe_2', 0.35, 0.15, 0.375, { dx: 24, dy: -18, w: 52, h: 36 }, { damage: 32, kb: [280, -120], poise: 45, hitStop: 0.10, heavy: true }),
    ],
    // The spin (02 §10.5): startup 0.10, a 0.80 s spin (not scaled by attack speed), recovery 0.20.
    special: { id: 'giant_axe_spin', startup: 0.10, active: 0.80, recovery: 0.20, moveMult: 1, canTurn: true, box: { dx: 0, dy: -16, w: 64, h: 32 },
      hit: { damage: 10, kb: [120, -40], poise: 10, hitStop: 0.025, kind: 'melee', rehit: 0.20, maxHits: 4, multiHit: true } },
  },
  flail: {
    id: 'flail', weight: 'heavy', hold: 'charge', dive: 'standard', signature: 'Meteor', chargeTime: 0.60,
    combo: [
      step('flail_1', 0.20, 0.10, 0.25, { dx: 40, dy: -14, w: 32, h: 24 }, { damage: 20, kb: [140, -40], poise: 18, hitStop: 0.05 }),
      step('flail_2', 0.20, 0.10, 0.25, { dx: 40, dy: -14, w: 32, h: 24 }, { damage: 20, kb: [140, -40], poise: 18, hitStop: 0.05 }),
    ],
    // The release: small and medium targets are Pulled in (by the special); large ones and bosses take this knockback.
    chargedStep: { id: 'flail_release', startup: 0.05, active: 0.10, recovery: 0.35, moveMult: HEAVY, box: { dx: 48, dy: -16, w: 64, h: 32 },
      hit: { damage: 55, kb: [300, -80], poise: 60, hitStop: 0.10, kind: 'melee', heavy: true, charged: true } },
  },
  shield: {
    id: 'shield', weight: 'medium', hold: 'shield', dive: 'standard', signature: 'Aegis',
    // The bash (02 §10.2, §12): starts when the shield is let go inside the parry window.
    combo: [step('shield_bash', 0.05, 0.10, 0.25, { dx: 14, dy: -14, w: 20, h: 28 }, { damage: 12, kb: [220, -40], poise: 25, hitStop: 0.05 }, MEDIUM)],
  },
  hand_cannon: {
    id: 'hand_cannon', weight: 'heavy', hold: 'repeat', dive: 'standard', signature: 'Big Bore',
    combo: [{ ...shot('hand_cannon_shot', 0.15, 0.70, 'cannonball', HEAVY), recoveryMoveMult: 1 }],
  },
  javelin: {
    id: 'javelin', weight: 'heavy', hold: 'repeat', dive: 'standard', signature: 'Anchor',
    combo: [shot('javelin_throw', 0.20, 0.50, 'javelin', HEAVY)],
  },
  throwing_knives: {
    id: 'throwing_knives', weight: 'light', hold: 'repeat', dive: 'standard', signature: 'Fan of Blades',
    combo: [volley('throwing_knives_throw', 0.05, 0.35, 'knife', [-6, 0, 6], LIGHT)],
  },
  wand: {
    id: 'wand', weight: 'light', hold: 'repeat', dive: 'standard', signature: 'Seeker Swarm',
    combo: [shot('wand_shot', 0.05, 0.25, 'wand_shot', LIGHT)],
  },
  spell_tome: {
    id: 'spell_tome', weight: 'medium', hold: 'repeat', dive: 'standard', signature: 'Rune Storm',
    combo: [
      step('spell_tome_1', 0.10, 0.10, 0.20, { dx: 24, dy: -16, w: 36, h: 28 }, { damage: 12, kb: [90, -20], poise: 10, hitStop: 0.025 }, MEDIUM),
      step('spell_tome_2', 0.10, 0.10, 0.20, { dx: 24, dy: -16, w: 36, h: 28 }, { damage: 12, kb: [90, -20], poise: 10, hitStop: 0.025 }, MEDIUM),
      // Step 3 casts the Rune Ring (active 0): no direct hit.
      { id: 'spell_tome_ring', startup: 0.15, active: 0, recovery: 0.25, moveMult: MEDIUM },
    ],
  },
};

/** Weapon specials (02 §10.5, §11). */
export const WEAPON_SPECIAL = {
  katanaSlash: { speed: 600, moveS: 0.15, h: 32 },
  uppercutVy: -300,
  crossbowPin: { reach: 24, seconds: 1.5 },
  hammerDiveBolt: { delayS: 0.10, box: { dx: 0, dy: -80, w: 32, h: 160 } as Box,
    hit: { damage: 24, kb: [0, -100] as [number, number], poise: 30, hitStop: 0.05, kind: 'shot' as const, heavy: true } },
  /** Twin Daggers backstab needs nothing numeric. Spear lunge (02 §10.5): 95 px in 0.16 s, the tip box plus the swept body. */
  spearLunge: { speed: 600, moveS: 0.16, afterTriggerS: 0.10, tip: { dx: 34, dy: -16, w: 52, h: 10 } as Box, bodyH: 32 },
  scytheFlaskTenths: 30,
  axeSpin: { minVxFrac: 0.5, speedMult: 0.7, spinS: 0.80, cycloneS: 1.20 },
  flailPull: { dist: 24, speed: 480, staggerS: 0.6 },
  handCannonRecoil: { vx: 300, vy: -150 },
  /** Javelin wall platform (02 §10.5): 24 × 4, top edge at the javelin's center y − 2. */
  javelinPlatform: { w: 24, h: 4, topOffset: -2, lifeS: 6.0, blinkS: 1.0, max: 2 },
  runeRing: { runes: 4, size: 10, radius: 28, degPerS: 360, lifeS: 2.0, centerDy: -14 },
  wandSwarmEvery: 5,
  hammerThrow: {
    startup: 0.10, recovery: 0.20, outSpeed: 520, outTime: 0.30, backSpeed: 600, catchDist: 16, autoCatchS: 2.0, size: 16,
    rechargeS: 5.0, rechargeWizardS: 2.0,
    hit: { damage: 18, kb: [160, -40] as [number, number], poise: 20, hitStop: 0.05, kind: 'shot' as const, heavy: true },
  },
} as const;

/** 02 §13 S-grade signatures for the built weapons (damage is the base; the S grade ×2.0 and match apply). */
const sig = (damage: number, kb: [number, number], poise: number, extra: Partial<HitSpec> = {}): HitSpec =>
  ({ damage, kb, poise, hitStop: 0.05, kind: 'shot', ...extra });
export const SIGNATURE = {
  groundWave: { dx: 32, w: 16, h: 20, speed: 360, range: 192, hit: sig(16, [160, -80], 20) },
  phantomEdge: { chargeTime: 0.25, delayS: 0.30, hit: sig(24, [60, -100], 30) },        // kb as the dash-slash
  quake: { w: 16, h: 16, speed: 300, range: 128, hit: sig(16, [0, 0], 0, { control: { type: 'knockdown', duration: 0.6 } }) },
  thunderclap: { box: { dx: 0, dy: -16, w: 96, h: 48 } as Box, hit: sig(16, [0, -300], 0, { control: { type: 'launch', duration: 0 } }) },
  tripleShot: { angles: [-6, 6], sideDamage: 16 },
  // SPEC-GAP: 02 §13 gives the Impaler blast only its damage; kb and poise follow the bolt's.
  impaler: { pierce: 3, blast: { w: 64, h: 64 }, hit: sig(24, [280, -40], 30) },
  tempest: { everyS: 0.10, size: 24, lifeS: 1.0, hit: sig(5, [0, 0], 0, { hitStop: 0, rehit: 0.25, multiHit: true }) },
  singularity: { radius: 64, pull: 150, blast: 112 },
  shadowStep: { markS: 1.5 },
  skewerWave: { tip: { dx: 60, dy: -16 } },                                    // the shot starts at the spear tip
  soulReap: { radius: 160, lifeS: 2.0 },
  cyclone: { lifeS: 1.20, maxHits: 6, pullRadius: 64, pullSpeed: 120 },
  meteor: { box: { dx: 48, dy: -16 }, blast: { w: 80, h: 80 }, hit: sig(30, [0, 0], 30) },
  aegis: { windowS: 0.30, wave: { dx: 32, dy: -20, w: 64, h: 40 }, hit: sig(40, [0, 0], 60) },
  bigBore: { blast: { w: 96, h: 96 }, recoilVx: 450 },
  anchor: { blast: { w: 64, h: 64 }, hit: sig(20, [200, -40], 30), lifeS: 12, max: 3 },
  fanOfBlades: { angles: [-12, 12], extraPierce: 1 },
  seekerSwarm: { angles: [-15, 15], radius: 160, turnRate: 540 },
  runeStorm: { runes: 6, radius: 36, lifeS: 3.0 },
} as const;

/** 02 §12 shield numbers. */
export const SHIELD = {
  windowS: 0.20, lowerS: 0.10, moveMult: 0.50, blockMult: 0.25, blockKbVx: 90,
  parryStunS: 1.5, parryBossPoise: 50, parryIframesS: 0.30, parryRush: 10, parryStopS: 0.075, blockStopS: 0.05,
  reflect: { speedMult: 1.5, range: 320, hit: { damage: 24, kb: [120, -20] as [number, number], poise: 20, hitStop: 0.05, kind: 'shot' as const } },
} as const;

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
