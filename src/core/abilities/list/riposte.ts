// Riposte (03 §8.4): a 1.0 s stance. The first enemy direct hit is blocked (0 damage, no hitstun) and answered with a big counter slash.
import { boxToWorld, markHit } from '../../combat/hitGroups.ts';
import { maxStop } from '../../combat/hitStop.ts';
import { setRiposteHook } from '../../combat/health.ts';
import { refundDash } from '../../player/dash.ts';
import type { GameWorld } from '../../sim/gameWorld.ts';
import { ticks } from '../../tuning.ts';
import { ABILITY } from '../../../data/abilities.ts';
import { castRt, registerAbility, type ActivationCtx } from '../abilitySystem.ts';
import type { AbilityEntity } from '../entities.ts';
import { abilityHit, addAbilityGroup, newInstance } from '../helpers.ts';

const A = ABILITY.riposte;
const STANCE_TICKS = 120;                                       // 1.0 s of player ticks (= the cast's recovery, 03 §7.6)

export interface RiposteEntity extends AbilityEntity { kind: 'riposte'; ctx: ActivationCtx }

export function stance(w: GameWorld): RiposteEntity | undefined {
  return w.abilityEntities.find((e): e is RiposteEntity => e.kind === 'riposte');
}

setRiposteHook((w, src) => {
  const st = stance(w);
  if (!st || src.kind !== 'enemyHit' || src.unblockable) return false;     // hazards, DOT and unblockables go through
  const c = st.ctx, b = w.body, T = w.tick;
  w.abilityEntities = w.abilityEntities.filter((e) => e !== st);           // the first block ends the stance
  // The blocked hit is used up; a blocked projectile is destroyed.
  if (src.group) { markHit(src.group, 0, T); if (!src.melee) { src.group.active = false; w.onEnemyShotLanded(src.group); } }
  if (src.attackerCx !== b.x) b.facing = src.attackerCx > b.x ? 1 : -1;
  const cast = castRt(w);
  if (cast && cast.id === 'riposte') { cast.facing = b.facing; cast.t = cast.S + cast.R - A.recoveryAfterBlock; }   // free again at T+30
  w.health.abilityIframeTicks = A.iframeTicks;
  const stop = ticks(A.stopS);
  b.hitStopTicks = maxStop(b.hitStopTicks, stop);
  if (src.melee) { const owner = w.enemies.find((e) => e.id === src.enemyId); if (owner) owner.hitStopTicks = maxStop(owner.hitStopTicks, stop); }
  // Counter: box (w/2, -14, w, h) from the feet, active ticks T+1 ... T+12, each enemy once.
  const box = { dx: (c.row.w as number) / 2, dy: A.dy, w: c.row.w as number, h: c.row.h as number };
  addAbilityGroup(w, c, abilityHit(c, 'counter', c.row.damage as number), boxToWorld(box, b.x, b.y, b.facing), newInstance(w), {
    follow: (ww, g) => { if (ww.tick > T + A.counterTicks) g.active = false; else g.rect = boxToWorld(box, ww.body.x, ww.body.y, ww.body.facing); },
  });
  if (c.row.refundDash === true) refundDash(b);
  return true;
});

registerAbility('riposte', {
  effect(w, c) {
    w.abilityEntities = w.abilityEntities.filter((e) => e.kind !== 'riposte');
    let left = STANCE_TICKS;
    const st: RiposteEntity = {
      id: w.newId(), kind: 'riposte', ctx: c,
      // Jump, dash or another ability end the cast, and the stance with it (still spent).
      step: (ww) => {
        const cast = castRt(ww);
        if (!cast || cast.id !== 'riposte') return false;
        if (ww.body.hitStopTicks <= 0) left -= 1;
        return left > 0;
      },
      view: () => ({ left }),
    };
    w.abilityEntities.push(st);
  },
});
