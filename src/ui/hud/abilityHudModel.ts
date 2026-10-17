// What the weapon slots, ability slots and class name show (07 §4.8–4.10, HudModel §4.15). Pure: abilityHud.ts draws it.
import { cooldownTicks, maxCharges, rechargeRate } from '../../core/abilities/abilitySystem.ts';
import type { AbilityId, AbilityLevel, ClassId, HybridId } from '../../core/abilities/types.ts';
import { hammerOutIn, throwProgress } from '../../core/combat/stormHammer.ts';
import type { WeaponId } from '../../core/combat/types.ts';
import type { GameWorld } from '../../core/sim/gameWorld.ts';
import { ABILITY_INFO } from '../../data/abilities.ts';
import { BOND, HYBRIDS, WEAPON_CLASSES } from '../../data/classes.ts';

/** 07 §4.8/§4.9 bar and shade sizes (px). */
export const SLOT_HUD = { icon: 16, bar: 20, linkBar: 24 } as const;

export type ClassColorKey = ClassId | HybridId | 'neutral' | 'none';
export interface WeaponSlotView {
  weaponId: WeaponId; tags: ClassId[]; litTags: ClassId[];
  hammer: { out: boolean; ready: boolean; progress: number } | null;
}
export interface AbilitySlotView {
  id: AbilityId; level: AbilityLevel; cls: ClassId | null; passive: boolean;
  charges: number; maxCharges: number; rechargeLeft: number; cooldownTicks: number; rechargeRate: number;
  linkTicksLeft: number | null;                                        // set on the slot that glows
}
export interface ClassLineView { displayName: string; color: ClassColorKey; bondName: string | null; hybridParts: [ClassId, ClassId] | null }

export function weaponSlotViews(w: GameWorld): [WeaponSlotView | null, WeaponSlotView | null] {
  const carried = w.classState.carriedClasses;
  return [0, 1].map((i) => {
    const s = w.combat.slots[i];
    if (!s) return null;
    const tags = WEAPON_CLASSES[s.weaponId];
    const slot = i as 0 | 1;
    const out = hammerOutIn(w, slot);
    const progress = throwProgress(w, slot);
    return {
      weaponId: s.weaponId, tags, litTags: tags.filter((c) => carried.includes(c)),
      hammer: s.weaponId === 'storm_hammer' ? { out, ready: !out && progress >= 1, progress } : null,
    };
  }) as [WeaponSlotView | null, WeaponSlotView | null];
}

export function abilitySlotViews(w: GameWorld): [AbilitySlotView | null, AbilitySlotView | null] {
  const a = w.abilities, rate = rechargeRate(w);
  const link = a.link && w.classState.connection ? a.link : null;
  const left = link ? BOND.LINK_TICKS - (w.body.pt - link.openedTick) : 0;
  return [0, 1].map((i) => {
    const s = a.slots[i];
    if (!s) return null;
    const info = ABILITY_INFO[s.id];
    return {
      id: s.id, level: s.level, cls: info.cls, passive: info.kind === 'passive',
      charges: s.charges, maxCharges: maxCharges(s), rechargeLeft: s.rechargeLeft, cooldownTicks: cooldownTicks(s), rechargeRate: rate,
      linkTicksLeft: link && link.fromSlot !== i && left >= 0 ? left : null,
    };
  }) as [AbilitySlotView | null, AbilitySlotView | null];
}

/** §4.9: with 0 charges, the shade height over the icon and the whole seconds left; null when not shaded. */
export function cooldownShade(v: Pick<AbilitySlotView, 'charges' | 'maxCharges' | 'rechargeLeft' | 'cooldownTicks' | 'rechargeRate'>): { h: number; seconds: number } | null {
  if (v.charges > 0 || v.rechargeLeft <= 0) return null;
  return { h: Math.ceil((SLOT_HUD.icon * v.rechargeLeft) / v.cooldownTicks), seconds: Math.ceil(v.rechargeLeft / v.rechargeRate / 120) };
}
/** §4.9: 2-charge abilities, a charge recharging while ≥ 1 is left: the bar width; else null. */
export function chargeBarW(v: Pick<AbilitySlotView, 'charges' | 'maxCharges' | 'rechargeLeft' | 'cooldownTicks'>): number | null {
  if (v.maxCharges < 2 || v.charges < 1 || v.charges >= v.maxCharges) return null;
  return Math.floor(SLOT_HUD.bar * (1 - v.rechargeLeft / v.cooldownTicks));
}
export const linkBarW = (ticksLeft: number) => Math.round((SLOT_HUD.linkBar * ticksLeft) / BOND.LINK_TICKS);

/** §4.10: line 1 the class or hybrid name, line 2 the bond or the hybrid's two classes. */
export function classLine(w: GameWorld): ClassLineView {
  const c = w.classState;
  let hybridParts: [ClassId, ClassId] | null = null;
  if (c.hybrid) {
    const key = Object.keys(HYBRIDS).find((k) => HYBRIDS[k].id === c.hybrid)!;
    const [x, y] = key.split('+') as [ClassId, ClassId];
    hybridParts = [x, y];
  }
  const color: ClassColorKey = c.hybrid ?? c.displayClass ?? (c.carriedClasses.length || w.abilities.slots.some((s) => s) ? 'neutral' : 'none');
  return { displayName: c.displayName, color, bondName: c.bondName, hybridParts };
}
