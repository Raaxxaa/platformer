// Swinging blades (06 §10): a level hazard, not an enemy. θ(t) = amplitude × sin(2π (t / period + phase)); 0° = straight down.
import { SWINGING_BLADE as B } from '../../data/hazards.ts';
import { overlaps, type Rect } from '../combat/hitGroups.ts';
import type { LevelObject } from '../level/loadLevel.ts';
import { TICK, ticks } from '../tuning.ts';

export interface SwingingBlade {
  id: number; px: number; py: number; length: number; amplitude: number; period: number; phase: number;
  /** World ticks left before it may hit again. */
  rehit: number;
}
export interface BladesState { blades: SwingingBlade[]; /** World time in seconds (× worldTimeScale). */ t: number }

export function createBlades(objects: readonly LevelObject[]): BladesState {
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  return {
    t: 0,
    blades: objects.filter((o) => o.type === 'swinging_blade').map((o) => ({
      id: o.id, px: o.x, py: o.y, length: num(o.props.length, B.length), amplitude: num(o.props.amplitude, B.amplitude),
      period: num(o.props.period, B.period), phase: num(o.props.phase, B.phase), rehit: 0,
    })),
  };
}

/** Angle in radians, positive toward +x. */
export function bladeAngle(b: SwingingBlade, t: number): number {
  return (b.amplitude * Math.PI / 180) * Math.sin(2 * Math.PI * (t / b.period + b.phase));
}
export function bladeCenter(b: SwingingBlade, t: number): { x: number; y: number } {
  const a = bladeAngle(b, t);
  return { x: b.px + b.length * Math.sin(a), y: b.py + b.length * Math.cos(a) };
}

/** One world tick. Returns the blade that hit the player (rehit 0.5 s per blade), if any. */
export function stepBlades(s: BladesState, playerBox: Rect, worldTimeScale: number): SwingingBlade | null {
  if (!Number.isFinite(worldTimeScale) || worldTimeScale <= 0) return null;
  s.t += TICK * worldTimeScale;
  let hit: SwingingBlade | null = null;
  for (const b of s.blades) {
    if (b.rehit > 0) b.rehit -= worldTimeScale;
    const c = bladeCenter(b, s.t);
    if (b.rehit <= 0 && !hit && overlaps({ x: c.x - B.size / 2, y: c.y - B.size / 2, w: B.size, h: B.size }, playerBox)) hit = b;
  }
  return hit;
}
export const bladeRehitTicks = (): number => ticks(B.rehitS);
