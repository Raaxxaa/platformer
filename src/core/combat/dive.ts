// Dive slam damage and the War Maul shockwave (02 §9.7, §10.5). Movement and the bounce are in 01.
import type { InputState } from '../input.ts';
import type { MoveEvent } from '../player/body.ts';
import { onDiveHit } from '../player/dive.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { ticks } from '../tuning.ts';
import { DIVE, type DiveDef } from '../../data/weapons.ts';
import { boxToWorld, type HitGroup } from './hitGroups.ts';
import { weaponIn } from './playerCombat.ts';
import { scheduleHammerDiveBolt } from './weaponSpecials.ts';

export interface DiveState {
  slot: 0 | 1;
  def: DiveDef;
  descentId: number | null;
  impactId: number | null;
  impactTicks: number;
  hitEnemies: Set<number>;
}

function diveDefFor(w: GameWorld, slot: 0 | 1): { descent: DiveDef; impact: DiveDef } {
  const weapon = weaponIn(w, slot);
  const heavy = weapon?.weight === 'heavy';
  const base = heavy ? DIVE.heavy : DIVE.lightMedium;
  return { descent: base, impact: weapon?.dive === 'war_maul' ? DIVE.warMaul : base };
}

function addGroup(w: GameWorld, def: DiveDef, box: DiveDef['descentBox'], slot: 0 | 1, hitEnemies: Set<number>): number {
  const b = w.body;
  const id = w.newId();
  const g: HitGroup = {
    id, owner: 'player', kind: 'melee', rect: boxToWorld(box, b.x, b.y, b.facing), spec: def.hit, active: true,
    lastHitTick: new Map(), hitCount: new Map(), attackInstance: -id, slot, box,
  };
  for (const e of hitEnemies) g.lastHitTick.set(e, -1);       // at most once per dive
  w.hitGroups.push(g);
  return id;
}

function removeGroup(w: GameWorld, id: number | null): void {
  if (id !== null) w.hitGroups = w.hitGroups.filter((g) => g.id !== id);
}

/** After player movement: start, land and end dives from the tick's movement events. */
export function onDiveEvents(w: GameWorld, events: MoveEvent[], input: InputState): void {
  if (events.includes('diveStart')) {
    const slot: 0 | 1 = input.attack1.pressed && w.ctx.slotUsable[0] ? 0 : 1;
    if (w.dive) endDive(w);
    w.dive = { slot, def: diveDefFor(w, slot).descent, descentId: null, impactId: null, impactTicks: 0, hitEnemies: new Set() };
  }
  const d = w.dive;
  if (!d) return;
  if (w.body.state === 'diveFall' && d.descentId === null) d.descentId = addGroup(w, d.def, d.def.descentBox, d.slot, d.hitEnemies);
  if (events.includes('diveLand')) {
    removeGroup(w, d.descentId);
    d.descentId = null;
    const impact = diveDefFor(w, d.slot).impact;
    d.impactId = addGroup(w, impact, impact.impactBox, d.slot, d.hitEnemies);
    d.impactTicks = ticks(impact.impactTime);
    if (impact.hit.heavy) w.shakeLevel('medium');
    if (weaponIn(w, d.slot)?.dive === 'storm_hammer') scheduleHammerDiveBolt(w, d.slot, -d.impactId);
    return;
  }
  // A jump or dash out of the dive ends its descent box.
  const s = w.body.state;
  if (d.impactId === null && s !== 'diveWindup' && s !== 'diveFall') endDive(w);
}

/** Each tick after hit resolution: the impact box lasts 0.05 s. */
export function stepDiveImpact(w: GameWorld): void {
  const d = w.dive;
  if (!d || d.impactId === null) return;
  if (w.body.hitStopTicks > 0) return;
  d.impactTicks -= 1;
  if (d.impactTicks <= 0) endDive(w);
}

export function endDive(w: GameWorld): void {
  const d = w.dive;
  if (!d) return;
  removeGroup(w, d.descentId);
  removeGroup(w, d.impactId);
  w.dive = null;
}

/** A dive group landed a hit: remember the enemy; the first descent hit bounces (01 §11.2), no impact. */
export function onDiveGroupHit(w: GameWorld, g: HitGroup, enemyId: number): void {
  const d = w.dive;
  if (!d) return;
  d.hitEnemies.add(enemyId);
  if (g.id === d.descentId && onDiveHit(w.body)) {
    w.events.push({ t: 'move', e: 'diveBounce' });
    endDive(w);
  }
}
