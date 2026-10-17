// The six hybrids (03 §6). Primes and timers clear at stage start, death and when the hybrid ends.
import { abilityDef, cooldownTicks, maxCharges } from '../abilities/abilitySystem.ts';
import { addElementHook } from '../combat/elements.ts';
import { addHitMod } from '../combat/hitMods.ts';
import { spawnBlast } from '../combat/playerProjectiles.ts';
import { addFireHook } from '../combat/weaponSpecials.ts';
import { enemyCenter, enemyRect } from '../enemies/enemy.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { COMBAT } from '../tuning.ts';
import { HYBRID, WEAPON_CLASSES } from '../../data/classes.ts';
import { PLAYER_PROJECTILES } from '../../data/playerProjectiles.ts';
import { WEAPONS } from '../../data/weapons.ts';
import type { WeaponId } from '../combat/types.ts';

const H = HYBRID;
const isWeaponMelee = (g: { ability?: string; kind: string }) => g.ability === undefined && g.kind === 'melee';
const isWeaponShot = (g: { ability?: string; kind: string; slot?: number }) => g.ability === undefined && g.kind === 'shot' && g.slot !== undefined;

export function clearHybridState(w: GameWorld): void {
  const a = w.abilities;
  a.shotPrimed = false;
  a.meleePrimed = false;
  a.gladiatorReadyTick = -100000;
  w.instanceBonus.clear();
  w.thunderBolts.clear();
}

// Thief (03 §6.1): +20% speed, enemies notice half as fast, hits on unaware enemies crit, one Lockpick per stage.
export function hybridSpeed(w: GameWorld): number[] {
  return w.classState.hybrid === 'thief' ? [H.THIEF_SPEED] : [];
}
export function hybridNoticeMult(w: GameWorld): number {
  return w.classState.hybrid === 'thief' ? H.THIEF_NOTICE_TIME_MULT : 1;
}
addHitMod({ crit: (w, _g, e) => w.classState.hybrid === 'thief' && !e.aware && !e.def.boss });

/** M5's key chests call this: opens a locked chest without a key once per stage while Thief. */
export function tryLockpick(w: GameWorld): boolean {
  if (w.classState.hybrid !== 'thief' || w.abilities.lockpickUsedThisStage) return false;
  w.abilities.lockpickUsedThisStage = true;
  w.events.push({ t: 'lockpickUsed' });
  return true;
}

// Gladiator (03 §6.2): switching weapons carries the combo over; the first step of B gets +0.50 (180-tick cooldown).
export function keepComboOnSwap(w: GameWorld, toSlot: 0 | 1, step: number, instance: number): number {
  if (w.classState.hybrid !== 'gladiator') return step;
  const c = w.combat, from = (toSlot === 0 ? 1 : 0) as 0 | 1;
  const last = c.lastCounted[from];
  const lenB = WEAPONS[c.slots[toSlot]!.weaponId]!.combo.length;
  const mine = c.lastCounted[toSlot];
  // Only a real switch: A's counted step is the latest one, inside the 0.35 s combo window.
  if (!last || (mine && mine.tick > last.tick) || w.tick - last.tick > COMBAT.COMBO_WINDOW_TICKS || c.slots[toSlot]?.weaponId === 'shield') return step;
  c.lastCounted[from] = null;
  const pt = w.body.pt;
  if (pt >= w.abilities.gladiatorReadyTick) {
    w.instanceBonus.set(instance, H.GLADIATOR_BONUS);
    w.abilities.gladiatorReadyTick = pt + H.GLADIATOR_COOLDOWN_TICKS;
  }
  return last.step % lenB;
}

// Spellblade (03 §6.3): a weapon melee instance that lands takes 60 ticks off both abilities' recharge (once).
addHitMod({
  landing: (w, g) => {
    if (w.classState.hybrid !== 'spellblade' || !isWeaponMelee(g)) return;
    for (const s of w.abilities.slots) {
      if (!s || !abilityDef(s.id) || s.charges >= maxCharges(s)) continue;
      s.rechargeLeft -= H.SPELLBLADE_TICKS;
      if (s.rechargeLeft <= 0) { s.charges += 1; s.rechargeLeft = s.charges < maxCharges(s) ? cooldownTicks(s) : 0; }
    }
  },
});

// Warden (03 §6.4): melee lands → the next shot +0.50; a shot lands → the next landing melee instance +0.50.
addHitMod({
  landing: (w, g) => {
    if (w.classState.hybrid !== 'warden') return;
    const a = w.abilities;
    if (isWeaponMelee(g)) {
      if (a.meleePrimed) { w.instanceBonus.set(g.attackInstance, (w.instanceBonus.get(g.attackInstance) ?? 0) + H.WARDEN_BONUS); a.meleePrimed = false; }
      a.shotPrimed = true;
    } else if (isWeaponShot(g)) a.meleePrimed = true;
  },
});
let wardenStepInstance = -1;
addFireHook((w, cur, _id, opts) => {
  if (w.classState.hybrid !== 'warden') return opts;
  // Every projectile of the step that consumed the prime gets the bonus.
  if (w.abilities.shotPrimed) { w.abilities.shotPrimed = false; wardenStepInstance = cur.attackInstance; }
  return wardenStepInstance === cur.attackInstance ? { ...opts, bonus: (opts.bonus ?? 0) + H.WARDEN_BONUS } : opts;
});

// Thunderlord (03 §6.5): each heavy direct hit calls a bolt on that enemy 12 ticks later, 3 per attack instance.
addHitMod({
  afterHit: (w, g, e) => {
    if (w.classState.hybrid !== 'thunderlord' || !g.spec.heavy || g.ability !== undefined) return;
    const n = w.thunderBolts.get(g.attackInstance) ?? 0;
    if (n >= H.THUNDERLORD_MAX_BOLTS) return;
    w.thunderBolts.set(g.attackInstance, n + 1);
    const at = w.tick + H.THUNDERLORD_DELAY_TICKS;
    let lastX = enemyCenter(e).x, lastFeet = e.y;
    const spec = { damage: g.spec.damage * H.THUNDERLORD_DAMAGE, kb: H.THUNDERLORD_HIT.kb, poise: H.THUNDERLORD_HIT.poise, hitStop: H.THUNDERLORD_HIT.hitStop, kind: 'shot' as const };
    w.abilityEntities.push({
      id: w.newId(), kind: 'thunderlord_bolt',
      step: (ww) => {
        if (!e.dead) { lastX = enemyCenter(e).x; lastFeet = enemyRect(e).y + enemyRect(e).h; }
        if (ww.tick < at) return true;
        const B = H.THUNDERLORD_BOX;
        spawnBlast(ww, lastX, lastFeet - B.h / 2, { w: B.w, h: B.h }, spec, g.slot, g.attackInstance, { kbFromX: lastX });
        return false;
      },
    });
  },
});

// Arcane Archer (03 §6.6): Archer-weapon projectiles get Lightning 1; a charged arrow explodes once; the orb blast ×1.5.
addElementHook((w, g) => {
  if (w.classState.hybrid !== 'arcane_archer' || g.projectile === undefined || g.slot === undefined) return null;
  const id = w.combat.slots[g.slot]?.weaponId as WeaponId | undefined;
  return id && WEAPON_CLASSES[id].includes('archer') ? { id: 'lightning', level: 1 } : null;
});
addFireHook((w, cur, _id, opts, projectile) => {
  if (w.classState.hybrid !== 'arcane_archer') return opts;
  if (projectile === 'orb') return { ...opts, blastMult: H.ARCANE_ORB_BLAST_MULT };
  if (projectile !== 'arrow_charged') return opts;
  const base = PLAYER_PROJECTILES.arrow_charged!.hit.damage;
  const spec = { damage: base * H.ARCANE_BLAST_DAMAGE, kb: H.ARCANE_BLAST_HIT.kb, poise: H.ARCANE_BLAST_HIT.poise, hitStop: H.ARCANE_BLAST_HIT.hitStop, kind: 'shot' as const };
  let exploded = false;
  const blast = (ww: GameWorld, x: number, y: number, skip: number | null) => {
    if (exploded) return;
    exploded = true;
    const g = spawnBlast(ww, x, y, H.ARCANE_BLAST, spec, cur.slot, cur.attackInstance, { bonus: opts.bonus });
    if (skip !== null) g.lastHitTick.set(skip, ww.tick);       // the directly hit enemy is not hit by the blast
  };
  return {
    ...opts,
    onHit: (ww, g, e, info) => { opts.onHit?.(ww, g, e, info); const c = enemyCenter(e); blast(ww, c.x, c.y, e.id); },
    onEnd: (ww, p, x, y) => { opts.onEnd?.(ww, p, x, y); blast(ww, x, y, null); },
  };
});
