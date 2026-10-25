// Animation clocks and frame math (08 §5.1). Pure: no Phaser, never Phaser's anim clock.
import { ANIM } from '../../data/art.ts';
import { TICK_RATE } from '../../core/tuning.ts';

export type AnimMode = 'loop' | 'once' | 'phase' | 'speed';
export interface AnimSegment { phase: string; frames: number[]; loopFps?: number; byVy?: boolean }
export interface AnimDef { key: string; atlas: string; frames: string[]; mode: AnimMode; fps?: number; segments?: AnimSegment[]; weaponBehind?: number[];
  /** Player anims (ART10): attachment points per frame, in frame pixels. */
  points?: Partial<Record<'head' | 'back' | 'neck' | 'shoulder', [number, number]>>[] }

/** `loop` / `once`: frame index after `t` seconds in the anim. */
export function timeFrame(def: AnimDef, t: number): number {
  const n = def.frames.length;
  const i = Math.floor(t * (def.fps ?? 1));
  return def.mode === 'once' ? Math.min(i, n - 1) : ((i % n) + n) % n;
}

/** `phase`: frame index for `elapsed` of `total` ticks in `phase`; `vy` picks by-vy segments (rising f0, falling f1). */
export function phaseFrame(def: AnimDef, phase: string, elapsed: number, total: number, vy = 0): number {
  const seg = def.segments?.find((s) => s.phase === phase);
  if (!seg) return 0;
  const k = seg.frames.length;
  if (seg.byVy) return seg.frames[vy < 0 ? 0 : Math.min(1, k - 1)];
  if (seg.loopFps) return seg.frames[Math.floor((elapsed / TICK_RATE) * seg.loopFps) % k];
  const p = total > 0 ? elapsed / total : 1;
  return seg.frames[Math.min(k - 1, Math.floor(p * k))];
}

/** Player run anim fps for a horizontal speed (08 §5.1). */
export function runFps(vx: number): number {
  return Math.min(ANIM.RUN_FPS_MAX, Math.max(ANIM.RUN_FPS_MIN, (ANIM.RUN_FPS_AT * Math.abs(vx)) / ANIM.RUN_SPEED_REF));
}

/** Enemy walk anim fps (08 §7.1). */
export function walkFps(vx: number, walk: number): number {
  if (walk <= 0) return ANIM.WALK_FPS_MIN;
  return Math.min(ANIM.WALK_FPS_MAX, Math.max(ANIM.WALK_FPS_MIN, (ANIM.WALK_FPS_AT * Math.abs(vx)) / walk));
}

/**
 * A view's own anim time (08 §5.1): advances by the world ticks since the last render, stands still in hit-stop,
 * and resets when the anim key changes. `runPhase` is the speed-driven accumulator, in frames.
 */
export class AnimClock {
  key = '';
  t = 0;
  runPhase = 0;
  lastTick = -1;
  /** Returns the seconds this render advanced (0 when frozen or on a key change). */
  advance(key: string, worldTick: number, frozen: boolean, timeScale = 1): number {
    const dt = this.lastTick < 0 ? 0 : (Math.max(0, worldTick - this.lastTick) / TICK_RATE) * timeScale;
    this.lastTick = worldTick;
    if (key !== this.key) { this.key = key; this.t = 0; this.runPhase = 0; return 0; }
    if (frozen) return 0;
    this.t += dt;
    return dt;
  }
}
