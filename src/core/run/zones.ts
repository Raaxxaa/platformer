// Hint zones, sections reached and the stage exit (06 §13.4, §2.5). 06 §2.8 step 11.
import type { GameWorld } from '../sim/gameWorld.ts';
import { beginTransition } from './phases.ts';
import { NEXT_VILLAGE } from '../../data/run.ts';

export type HintAction = 'move' | 'jump' | 'double_jump' | 'dash' | 'wall_jump' | 'slide' | 'dive_slam' | 'attack'
  | 'lucky_block' | 'ability' | 'heal' | 'interact' | 'drop_through';

export function stepZones(w: GameWorld): void {
  const b = w.body;
  const cx = b.x, cy = b.y - b.h / 2;
  let hint: HintAction | null = null;
  for (const o of w.level?.objects ?? []) {
    const inRect = cx >= o.x && cx < o.x + o.w && cy >= o.y && cy < o.y + o.h;
    if (o.type === 'hint' && inRect && hint === null) hint = String(o.props.action) as HintAction;
    else if (o.type === 'section' && inRect) w.run.sectionReached = Math.max(w.run.sectionReached, Number(o.props.index));
    else if (o.type === 'exit' && w.run.phase === 'stage' && w.run.statPickDone && w.run.splits[w.stage - 1] !== null && !w.health.dead && w.stage < 4) {
      const touch = b.x + b.w / 2 > o.x && b.x - b.w / 2 < o.x + o.w && b.y > o.y && b.y - b.h < o.y + o.h;
      if (touch) beginTransition(w.run, 'stageExit', { phase: 'village', levelId: NEXT_VILLAGE[w.stage as 1 | 2 | 3], stage: 0 });
    }
  }
  w.activeHint = hint;
}
