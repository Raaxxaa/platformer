// Player statuses, 02 §5.4. Damage uses the separate DOT-only hurt path.
import { PLAYER_STATUS as S } from '../../data/playerStatus.ts';
import type { PlayerStatusId } from '../enemies/types.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { STAGE_SCALING, ticks } from '../tuning.ts';

export interface PlayerDotStatus { stacks: number; left: number; next: number; damageA: number }
export interface PlayerStatuses {
  poisoned: PlayerDotStatus | null;
  burning: PlayerDotStatus | null;
  rooted: number;
  chilled: number;
}

export const createPlayerStatus = (): PlayerStatuses => ({ poisoned: null, burning: null, rooted: 0, chilled: 0 });

function duration(defaultTicks: number, durationS?: number): number {
  return durationS === undefined || !Number.isFinite(durationS) ? defaultTicks : Math.max(0, ticks(durationS));
}

/** Applications from clouds/puddles call this directly; direct hits call it only after damage lands. */
export function applyPlayerStatus(w: GameWorld, id: PlayerStatusId, stacks = 1, durationS?: number): void {
  if (w.health.dead) return;
  const s = w.playerStatus;
  if (id === 'rooted') {
    if (s.rooted <= 0) s.rooted = duration(S.rootedTicks, durationS);
  } else if (id === 'chilled') s.chilled = duration(S.chilledTicks, durationS);
  else {
    if (!Number.isFinite(stacks) || stacks <= 0) return;
    const old = s[id], rule = S[id];
    s[id] = {
      stacks: id === 'poisoned' ? Math.min(S.poisoned.maxStacks, (old?.stacks ?? 0) + Math.floor(stacks)) : 1,
      left: duration(rule.durationTicks, durationS), next: old?.next ?? S.intervalTicks,
      // Keep fractional A until the hurt pipeline rounds the whole damage tick, after stack multiplication.
      damageA: rule.damage * STAGE_SCALING[w.stage].dmg,
    };
  }
}

export function clearPlayerDamageStatus(w: GameWorld): void {
  w.playerStatus.poisoned = null;
  w.playerStatus.burning = null;
}

/** One player tick. Global Time Slow does not slow the player or these timers. */
export function stepPlayerStatus(w: GameWorld): void {
  const s = w.playerStatus;
  if (w.health.dead) { Object.assign(s, createPlayerStatus()); return; }
  if (w.body.hitStopTicks > 0) return;
  s.rooted = Math.max(0, s.rooted - 1);
  s.chilled = Math.max(0, s.chilled - 1);
  for (const id of ['burning', 'poisoned'] as const) {
    const dot = s[id]; if (!dot) continue;
    dot.left -= 1;
    dot.next -= 1;
    if (dot.next <= 0 && dot.left >= 0) {
      dot.next = S.intervalTicks;
      w.onPlayerStatusDot(dot.damageA * dot.stacks, id);
      if (w.health.dead) { Object.assign(s, createPlayerStatus()); return; }
    }
    if (dot.left <= 0) s[id] = null;
  }
}
