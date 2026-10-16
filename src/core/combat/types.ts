// Combat data shapes (02 §14). Names copied exactly from the spec.

export type WeaponId = 'greatsword' | 'katana' | 'twin_daggers' | 'spear' | 'scythe' | 'war_maul'
  | 'iron_fists' | 'giant_axe' | 'flail' | 'shield' | 'bow' | 'crossbow' | 'hand_cannon' | 'javelin'
  | 'throwing_knives' | 'storm_hammer' | 'staff' | 'wand' | 'spell_tome';
export type ProjectileId = 'arrow' | 'arrow_charged' | 'bolt' | 'cannonball' | 'javelin' | 'knife'
  | 'staff_bolt' | 'orb' | 'wand_shot';
export type Grade = 'F' | 'C' | 'B' | 'A' | 'S';
export type ElementId = 'fire' | 'ice' | 'lightning' | 'poison' | 'wind';
export type Weight = 'light' | 'medium' | 'heavy';
export type ControlType = 'stun' | 'knockdown' | 'pin' | 'launch' | 'pull';
export interface Box { dx: number; dy: number; w: number; h: number }      // center offset from feet, facing right
export interface HitSpec {
  damage: number; kb: [number, number]; poise: number; hitStop: number;    // base values; seconds
  kind: 'melee' | 'shot'; heavy?: boolean; charged?: boolean;
  rehit?: number; maxHits?: number; multiHit?: boolean; control?: { type: ControlType; duration: number };
}
export interface AttackStep {
  id: string; startup: number; active: number; recovery: number;
  moveMult: number;           // 01 §5.2 actionMoveMult on the ground (§9.3)
  recoveryMoveMult?: number;  // replaces moveMult during recovery (Hand Cannon: 1)
  gravityMult?: number;       // 01 §5.4; default 1
  canTurn?: boolean;          // 01 §12.2; default false
  box?: Box; hit?: HitSpec; projectiles?: { id: ProjectileId; angle: number }[];
}
export interface WeaponDef {
  id: WeaponId; weight: Weight; hold: 'repeat' | 'charge' | 'shield';
  combo: AttackStep[]; chargeTime?: number; chargedStep?: AttackStep;
  dive: 'standard' | 'war_maul' | 'storm_hammer'; signature: string;
}
export interface ProjectileDef {
  id: ProjectileId; speed: number; range: number; lifetime?: number; w: number; h: number;
  gravity: number; pierce: number; onWall: 'vanish' | 'explode' | 'stick' | 'return';
  explodeOnEnemy?: boolean; blast?: { w: number; h: number }; hit: HitSpec;
  homing?: { radius: number; turnRate: number };
}
export interface WeaponInstance { weaponId: WeaponId; grade: Grade; element: ElementId | null; perk: string | null }
export interface FlaskState { charges: number; maxCharges: number; fillTenths: number }
export type HealRefusedReason = 'noCharge' | 'fullHp' | 'blocked' | 'hitstun';
export interface RushState { value: number; stillTime: number; noGainTime: number; floor: number }
