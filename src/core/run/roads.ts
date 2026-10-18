// Inn route choice and timed sleep (06 §3, §12.2).
import type { Road } from '../save/schema.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { beginTransition } from './phases.ts';
export function openInn(w: GameWorld): boolean {
  if (w.run.phase !== 'village') return false;
  w.run.phase = 'routeChoice'; return true;
}
export function cancelRoad(w: GameWorld): boolean {
  if (w.run.phase !== 'routeChoice') return false;
  w.run.phase = 'village'; return true;
}
export function chooseRoad(w: GameWorld, road: Road): boolean {
  if (w.run.phase !== 'routeChoice' || (road !== 'mountain' && road !== 'forest')) return false;
  w.run.road = road;
  // SPEC-GAP: placeholder end until Stage 2 (M7.1)
  beginTransition(w.run, 'sleep', { phase: 'runSoFar', levelId: w.level?.id ?? 'crossroads', stage: 0 });
  return true;
}
