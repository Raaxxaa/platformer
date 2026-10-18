// Inn route choice and timed sleep (06 §3, §12.2).
import type { Road } from '../save/schema.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { beginTransition } from './phases.ts';
import { ROAD_LEVEL } from '../../data/run.ts';
export function openInn(w: GameWorld): boolean {
  if (w.run.phase !== 'village') return false;
  if (w.level?.id === 'border') {
    // Stage 3 arrives in M9; this milestone ends after the Border inn's timed sleep.
    beginTransition(w.run, 'sleep', { phase: 'runSoFar', levelId: 'border', stage: 0 });
    return true;
  }
  w.run.phase = 'routeChoice'; return true;
}
export function cancelRoad(w: GameWorld): boolean {
  if (w.run.phase !== 'routeChoice') return false;
  w.run.phase = 'village'; return true;
}
export function chooseRoad(w: GameWorld, road: Road): boolean {
  if (w.run.phase !== 'routeChoice' || (road !== 'mountain' && road !== 'forest')) return false;
  w.run.road = road;
  beginTransition(w.run, 'sleep', { phase: 'stage', levelId: ROAD_LEVEL[road], stage: 2 });
  return true;
}
