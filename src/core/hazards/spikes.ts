// Spikes (01 §13.4): checked after the player moves (01 §3 step 9).
import { hurtPlayer } from '../combat/health.ts';
import { playerRect } from '../combat/resolve.ts';
import type { TileKind } from '../level/tiles.ts';
import { endDashOrSlide } from '../player/dash.ts';
import { setState } from '../player/body.ts';
import { runMaxEff } from '../player/modifiers.ts';
import { leaveWall } from '../player/wall.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { SPIKES, TILE_SIZE } from '../tuning.ts';

type SpikeKind = Extract<TileKind, 'spikeUp' | 'spikeDown' | 'spikeLeft' | 'spikeRight'>;
const TIE_ORDER: SpikeKind[] = ['spikeUp', 'spikeLeft', 'spikeRight', 'spikeDown'];

/** The hurt zone of a spike tile in px: [x0, y0, x1, y1). */
export function spikeZone(kind: SpikeKind, tx: number, ty: number): [number, number, number, number] {
  const x = tx * TILE_SIZE, y = ty * TILE_SIZE, s = SPIKES.INSET_SIDE, d = SPIKES.DEPTH, T = TILE_SIZE;
  switch (kind) {
    case 'spikeUp': return [x + s, y + T - d, x + T - s, y + T];
    case 'spikeDown': return [x + s, y, x + T - s, y + d];
    case 'spikeLeft': return [x, y + s, x + d, y + T - s];
    case 'spikeRight': return [x + T - d, y + s, x + T, y + T - s];
  }
}

/** Deals spike damage and the pop. Returns true when a spike hit landed this tick. */
export function checkSpikes(w: GameWorld): boolean {
  const b = w.body;
  if (b.state === 'dead' || w.health.dead || w.health.iframeTicks > 0) return false;
  const r = playerRect(w);
  const best = new Map<SpikeKind, number>();
  for (let ty = Math.floor(r.y / TILE_SIZE); ty <= Math.floor((r.y + r.h - 1) / TILE_SIZE); ty++) {
    for (let tx = Math.floor(r.x / TILE_SIZE); tx <= Math.floor((r.x + r.w - 1) / TILE_SIZE); tx++) {
      const k = w.grid.kindAt(tx, ty);
      if (k !== 'spikeUp' && k !== 'spikeDown' && k !== 'spikeLeft' && k !== 'spikeRight') continue;
      const [x0, y0, x1, y1] = spikeZone(k, tx, ty);
      const ox = Math.min(x1, r.x + r.w) - Math.max(x0, r.x), oy = Math.min(y1, r.y + r.h) - Math.max(y0, r.y);
      if (ox > 0 && oy > 0) best.set(k, Math.max(best.get(k) ?? 0, ox * oy));
    }
  }
  if (best.size === 0) return false;
  let kind: SpikeKind = TIE_ORDER.find((k) => best.has(k))!;
  for (const k of TIE_ORDER) if ((best.get(k) ?? 0) > (best.get(kind) ?? 0)) kind = k;
  hurtPlayer(w, { kind: 'hazard', cause: 'spikes', damageA: SPIKES.DAMAGE });
  if (w.health.dead || b.state === 'minecart') return true;
  // The pop: any state ends → air; the player keeps control (no knockback, no hitstun).
  if (b.state === 'dash' || b.state === 'slide') endDashOrSlide(b, w.mods);
  if (b.state === 'wallSlide') leaveWall(b);
  b.dashIframes = false;
  b.jumpCuttable = false;
  b.grounded = false;
  b.coyoteValid = false;
  if (kind === 'spikeUp') {
    const max = runMaxEff(b, w.mods);
    b.vy = SPIKES.UP_VY;
    b.vx = Math.max(-max, Math.min(max, b.vx));
  } else if (kind === 'spikeDown') {
    b.vy = SPIKES.DOWN_VY;
  } else {
    b.vx = kind === 'spikeLeft' ? -SPIKES.SIDE_VX : SPIKES.SIDE_VX;
    b.vy = SPIKES.SIDE_VY;
    b.steerLockTicks = SPIKES.SIDE_LOCK;
  }
  setState(b, 'air', 0);
  return true;
}
