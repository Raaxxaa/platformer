// Timed doors (06 §9.5): decided the first tick the player's center enters the 48 px strip in front of the door.
import type { GameWorld } from '../sim/gameWorld.ts';
import { TICK_RATE } from '../tuning.ts';
import { LEVEL_RULES, type StageLevelId } from '../../data/levelRules.ts';
import { TIMED_DOOR } from '../tuning.ts';

export interface TimedDoorRt { id: string; x: number; y: number; w: number; h: number; side: 'left' | 'right'; limitTicks: number }

export function buildTimedDoors(w: GameWorld): TimedDoorRt[] {
  const out: TimedDoorRt[] = [];
  for (const o of w.level?.objects ?? []) {
    if (o.type !== 'timed_door') continue;
    const id = String(o.props.id);
    const limit = o.props.timeLimit !== undefined ? Number(o.props.timeLimit) : LEVEL_RULES[w.level!.id as StageLevelId]?.timeLimit ?? 120;
    out.push({ id, x: o.x, y: o.y, w: o.w, h: o.h, side: o.props.side === 'right' ? 'right' : 'left', limitTicks: Math.round(limit * TICK_RATE) });
    w.run.timedDoors[id] = 'pending';
  }
  return out;
}

/** Seconds left on a pending door (never below 0). */
export function timedDoorTimeLeft(w: GameWorld, id: string): number {
  const d = w.timedDoors.find((t) => t.id === id);
  if (!d) return 0;
  return Math.max(0, (d.limitTicks - w.run.stageTicks) / TICK_RATE);
}

export function stepTimedDoors(w: GameWorld): void {
  if (w.health.dead) return;
  const cx = w.body.x, cy = w.body.y - w.body.h / 2;
  for (const d of w.timedDoors) {
    if (w.run.timedDoors[d.id] !== 'pending') continue;
    const tx = d.side === 'left' ? d.x - TIMED_DOOR.TRIGGER_W : d.x + d.w;
    if (cx < tx || cx >= tx + TIMED_DOOR.TRIGGER_W || cy < d.y || cy >= d.y + d.h) continue;
    if (w.run.stageTicks <= d.limitTicks) {
      w.run.timedDoors[d.id] = 'open';
      w.setBodyActive(d.id, false);
      w.events.push({ t: 'timedDoorOpened', doorId: d.id });
    } else {
      w.run.timedDoors[d.id] = 'missed';
      w.events.push({ t: 'timedDoorMissed', doorId: d.id });
    }
  }
}
