// The Training Yard (06 §12.4, docs/levels/training-yard.md): stations and their checks, checkpoints, pits that
// return you to the station start, the armory and the class statues. Pure core.
import { classStatue, type GroundItem } from '../abilities/items.ts';
import { newAbility, newWeapon } from '../abilities/runtime.ts';
import type { AbilityId, ClassId } from '../abilities/types.ts';
import { rushLevel } from '../combat/rush.ts';
import type { WeaponId } from '../combat/types.ts';
import type { LevelObject } from '../level/loadLevel.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { ticks } from '../tuning.ts';
import { ABILITY_INFO } from '../../data/abilities.ts';
import { SECOND_ABILITY, STARTING_KITS } from '../../data/classes.ts';
import { WEAPONS } from '../../data/weapons.ts';

export const TRAINING_RULES = { fadeS: 0.3, heal: { hp: 40, charges: 1 }, dodges: 3, bounces: 3 } as const;

interface Rect { x: number; y: number; w: number; h: number }
interface Station { id: number; check: string; rect: Rect; goal: Rect | null; checkpoint: { x: number; y: number } }

export interface TrainingState {
  stations: Station[];
  current: number;                      // the station the player is in (0 = none yet)
  checkpoint: { x: number; y: number };
  /** Ticks left of the 0.3 s fade before a pit respawn, or null. */
  fade: number | null;
  airDash: boolean; dashJump: boolean; slideJump: boolean; bounces: number;
  comboSeq: number[];
  dodge: { count: number; swingDodged: boolean; swingHit: boolean; inSwing: boolean };
  /** Signs: the text of the hint zone the player is in. */
  sign: string | null;
}

const inside = (x: number, y: number, r: Rect) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
const rectOf = (o: LevelObject): Rect => ({ x: o.x, y: o.y, w: o.w, h: o.h });

/** The class of the picked kit (its starting ability), or null with no kit. */
export function kitClass(w: GameWorld): ClassId | null {
  const a = w.opts.loadout?.abilities[0]?.id;
  return a ? ABILITY_INFO[a].cls : null;
}

/** Ground items for the yard's stands: fixed armory stands, and stations 10 and 13 (the picked class's 2nd weapon and ability). */
export function trainingItems(w: GameWorld): GroundItem[] {
  const cls = kitClass(w);
  const out: GroundItem[] = [];
  for (const o of w.level?.objects ?? []) {
    if (o.type !== 'item_stand') continue;
    let weapon = o.props.weapon as WeaponId | undefined, ability = o.props.ability as AbilityId | undefined;
    if (o.props.dynamic === 'kit_weapon2') weapon = cls ? STARTING_KITS[cls].weapons.find((x) => x !== w.opts.loadout?.weapons[0]?.weaponId) : undefined;
    if (o.props.dynamic === 'kit_ability2') ability = cls ? SECOND_ABILITY[cls] : undefined;
    if (!weapon && !ability) continue;
    // SPEC-GAP: M4 armory stands never run out (test only)
    out.push({ id: -o.id, x: o.x, y: o.y, vy: 0, resting: true, endless: true, label: String(o.props.cls ?? ''),
      weapon: weapon && WEAPONS[weapon] ? newWeapon(weapon) : undefined, ability: ability ? newAbility(ability) : undefined });
  }
  return out;
}

/** Stage start for a training level: stations, statues and stands. */
export function setupTraining(w: GameWorld): void {
  const objs = w.level?.objects ?? [];
  const stations: Station[] = objs.filter((o) => o.type === 'station').map((o) => {
    const id = Number(o.props.id);
    const goal = objs.find((g) => g.type === 'station_goal' && Number(g.props.station) === id);
    const cp = objs.find((c) => c.type === 'checkpoint' && Number(c.props.station) === id)!;
    return { id, check: String(o.props.check), rect: rectOf(o), goal: goal ? rectOf(goal) : null, checkpoint: { x: cp.x, y: cp.y } };
  }).sort((a, b) => a.id - b.id);
  w.training = {
    stations, current: 0, checkpoint: { x: w.opts.spawn.x, y: w.opts.spawn.y }, fade: null,
    airDash: false, dashJump: false, slideJump: false, bounces: 0, comboSeq: [],
    dodge: { count: 0, swingDodged: false, swingHit: false, inSwing: false }, sign: null,
  };
  w.interactables = objs.filter((o) => o.type === 'class_statue').map((o) => classStatue(w, o.props.cls as ClassId, o.x, o.y));
  w.groundItems = trainingItems(w);
}

/** After a kit change: the kit-dependent stands follow the new class. */
export function refreshTrainingStands(w: GameWorld): void {
  if (!w.training) return;
  w.groundItems = [...w.groundItems.filter((i) => !i.endless), ...trainingItems(w)];
}

function resetFlags(t: TrainingState): void {
  t.airDash = t.dashJump = t.slideJump = false;
  t.bounces = 0;
  t.comboSeq = [];
}

/** Back to the station's checkpoint: full flask, Rush 0, no damage (06 §12.4). */
function respawn(w: GameWorld): void {
  const t = w.training!;
  w.teleportPlayer(t.checkpoint.x, t.checkpoint.y);
  w.flask.charges = w.flask.maxCharges;
  w.rush.value = 0;
  resetFlags(t);
}

function done(w: GameWorld, id: number): void {
  if (w.trainingDone.has(id)) return;
  w.trainingDone.add(id);
  w.events.push({ t: 'stationDone', id });
}

/** Step 11 for a training level. */
export function stepTraining(w: GameWorld): void {
  const t = w.training;
  if (!t) return;
  const b = w.body, cx = b.x, cy = b.y - b.h / 2;
  // Pits: a 0.3 s fade, then back to the checkpoint.
  if (t.fade !== null) {
    if (--t.fade <= 0) { t.fade = null; respawn(w); }
    return;
  }
  for (const o of w.level?.objects ?? []) {
    if (o.type === 'respawn' && inside(cx, cy, rectOf(o))) { t.fade = ticks(TRAINING_RULES.fadeS); return; }
  }
  // Leaving through an exit: back to the picked kit, back to the start.
  for (const o of w.level?.objects ?? []) {
    if (o.type === 'exit' && inside(cx, cy, rectOf(o))) {
      if (w.opts.loadout) w.setLoadout(w.opts.loadout);
      w.groundItems = trainingItems(w);
      t.checkpoint = { x: w.opts.spawn.x, y: w.opts.spawn.y };
      respawn(w);
      w.events.push({ t: 'leftTraining' });
      return;
    }
  }
  // Which station, and its sign.
  const st = t.stations.find((s) => inside(cx, cy, s.rect));
  if (st && st.id !== t.current) {
    t.current = st.id;
    t.checkpoint = st.checkpoint;
    resetFlags(t);
    t.dodge = { count: 0, swingDodged: false, swingHit: false, inSwing: false };
    if (st.check === 'heal') { w.health.hp = Math.min(w.health.hp, TRAINING_RULES.heal.hp); w.flask.charges = Math.max(w.flask.charges, TRAINING_RULES.heal.charges); }
  }
  t.sign = null;
  for (const o of w.level?.objects ?? []) if (o.type === 'hint' && o.props.text && inside(cx, cy, rectOf(o))) t.sign = String(o.props.text);
  if (!st) return;
  const ev = w.events;
  const has = (pred: (e: (typeof ev)[number]) => boolean) => ev.some(pred);
  const move = (m: string) => has((e) => e.t === 'move' && e.e === m);
  if (move('dashStart') && !b.grounded) t.airDash = true;
  if (move('jump') && move('dashEnd')) t.dashJump = true;
  if (move('jump') && move('slideEnd')) t.slideJump = true;
  if (move('diveBounce')) t.bounces += 1;
  const inGoal = st.goal !== null && inside(cx, cy, st.goal);
  const enemyHits = ev.filter((e): e is Extract<(typeof ev)[number], { t: 'hit' }> => e.t === 'hit' && e.target !== 'player');
  let ok = false;
  switch (st.check) {
    case 'reach': ok = inGoal; break;
    case 'stand': ok = inGoal && b.grounded; break;
    case 'airDash': ok = inGoal && t.airDash; break;
    case 'ledgeGrab': ok = move('ledgeGrab'); break;
    case 'dropThrough': ok = move('dropThrough'); break;
    case 'diveHit': ok = enemyHits.length > 0 && (move('diveBounce') || move('diveLand') || b.state === 'diveLand'); break;
    case 'combo': {
      for (const h of enemyHits) {
        if (h.slot === undefined || h.step === undefined) continue;
        const s = t.comboSeq;
        if (h.step === 0) t.comboSeq = [0];
        else if (s.length && h.step === s[s.length - 1] + 1) s.push(h.step);
        else if (!s.length || h.step !== s[s.length - 1]) t.comboSeq = [];
        const len = WEAPONS[w.combat.slots[h.slot]?.weaponId ?? 'greatsword']?.combo.length ?? 99;
        if (t.comboSeq.length >= len) ok = true;
      }
      break;
    }
    case 'weapon2': ok = enemyHits.some((h) => h.slot === 1); break;
    case 'dodge': ok = stepDodge(w) >= TRAINING_RULES.dodges; break;
    case 'heal': ok = has((e) => e.t === 'drink'); break;
    case 'link': ok = has((e) => e.t === 'abilityLinked'); break;
    case 'rush': ok = rushLevel(w.rush) >= 1; break;
    case 'dashJump': ok = inGoal && t.dashJump; break;
    case 'slideJump': ok = inGoal && t.slideJump; break;
    case 'diveBounce': ok = inGoal && t.bounces >= TRAINING_RULES.bounces; break;
    default: break;
  }
  if (ok) done(w, st.id);
}

/** Station 11: a swing whose Act passes while the player has dash i-frames, and that never hit, counts; a hit resets.
 *  Each swing is judged when its Act ends (the dummy swings again right after its recovery). */
function stepDodge(w: GameWorld): number {
  const d = w.training!.dodge;
  if (w.events.some((e) => e.t === 'sparringHit')) { d.count = 0; d.swingHit = true; }
  const dummy = w.enemies.find((e) => e.def.id === 'sparring_dummy' && !e.dead);
  const a = dummy?.ai.attack ?? null;
  const inAct = a?.phase === 'act';
  if (inAct) {
    d.inSwing = true;
    if (w.body.dashIframes) d.swingDodged = true;
  } else if (d.inSwing) {
    if (d.swingDodged && !d.swingHit) d.count += 1;
    d.inSwing = false; d.swingDodged = false; d.swingHit = false;
  }
  return d.count;
}
