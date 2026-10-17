// The four Connection bonds (03 §5). Each registers what it changes; GameWorld calls stepBonds and the class hooks.
import { castRt, abilityMoveRunning } from '../abilities/abilitySystem.ts';
import { addElementHook } from '../combat/elements.ts';
import { addSuperArmor } from '../combat/health.ts';
import { addHitMod } from '../combat/hitMods.ts';
import type { ClassState } from '../abilities/types.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { roundHalfUp } from '../math.ts';
import { COMBAT } from '../tuning.ts';
import { BOND } from '../../data/classes.ts';
import { WEAPONS } from '../../data/weapons.ts';

/** Blademaster: the landing that makes the streak a multiple of 3 crits every hit of its instance. */
addHitMod({ crit: (w, g) => w.classState.bond === 'blademaster' && w.streakCrit.has(g.attackInstance) });

/** Eagle Eye: a weapon shot (projectile, its blast, the thrown hammer) that has flown ≥ 128 px crits. */
addHitMod({ crit: (w, g) => w.classState.bond === 'eagle_eye' && g.ability === undefined && g.kind === 'shot' && (g.traveled ?? -1) >= BOND.EAGLE_EYE_RANGE });

/** Storm Caller: a C-grade weapon with no element gets Lightning 1. */
addElementHook((w, g) => {
  const inst = g.slot !== undefined ? w.combat.slots[g.slot] : null;
  return w.classState.bond === 'storm_caller' && inst?.grade === 'C' && !inst.element ? { id: 'lightning', level: 1 } : null;
});

/** Iron Will: super armor while attacking or casting (weapon phases, charging, a cast, an ability move). */
export function attacking(w: GameWorld): boolean {
  return w.combat.current !== null || w.combat.charge !== null || castRt(w) !== null || abilityMoveRunning(w);
}
addSuperArmor((w) => w.classState.bond === 'iron_will' && attacking(w));

/** Iron Will HP (03 §5.3): on +30% max HP and current HP; off removes what was added (min 1), then clamps. */
export function onBondChange(w: GameWorld, prev: ClassState, next: ClassState): void {
  const h = w.health;
  const wasIW = prev.bond === 'iron_will', isIW = next.bond === 'iron_will';
  if (!wasIW && isIW) {
    const max = roundHalfUp(COMBAT.MAX_HP * (1 + BOND.IRON_WILL_HP));
    w.ironWillAddedHP = max - h.maxHp;
    h.maxHp = max;
    if (!h.dead) h.hp += w.ironWillAddedHP;
  } else if (wasIW && !isIW) {
    h.maxHp = COMBAT.MAX_HP;
    if (!h.dead) h.hp = Math.min(h.maxHp, Math.max(1, h.hp - w.ironWillAddedHP));
    w.ironWillAddedHP = 0;
  }
  if (!next.connection) w.abilities.link = null;               // the link clears when the Connection is lost
}

/** Eagle Eye "aiming" (03 §5.4): a projectile step in startup, a Bow/Staff charging, or the throw in startup. */
function aiming(w: GameWorld): boolean {
  const c = w.combat, cur = c.current;
  if (cur && cur.phase === 'startup') {
    const weapon = WEAPONS[c.slots[cur.slot]!.weaponId]!;
    const st = cur.kind === 'charged' ? weapon.chargedStep : cur.kind === 'throw' ? null : weapon.combo[cur.step];
    if (cur.kind === 'throw' || st?.projectiles) return true;
  }
  if (c.charge) return !!WEAPONS[c.slots[c.charge.slot]!.weaponId]?.chargedStep?.projectiles;
  return false;
}

/** Per tick, before movement: Eagle Eye's slow fall while aiming in the air (budget 120 ticks per airtime). */
export function stepBonds(w: GameWorld): void {
  const b = w.body;
  w.mods.maxFallOverride = null;
  if (w.classState.bond !== 'eagle_eye') return;
  if (b.grounded) { w.abilities.eagleEyeBudget = BOND.EAGLE_EYE_BUDGET_TICKS; return; }
  if (b.state !== 'air' || !aiming(w) || w.abilities.eagleEyeBudget <= 0) return;
  w.mods.maxFallOverride = BOND.EAGLE_EYE_FALL;
  if (b.vy >= 0 && b.hitStopTicks === 0) w.abilities.eagleEyeBudget -= 1;
}
