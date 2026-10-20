// Inn route choice and timed sleep (06 §3, §12.2).
import type { Road } from '../save/schema.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { beginTransition } from './phases.ts';
import { ROAD_LEVEL } from '../../data/run.ts';
export function openInn(w: GameWorld): boolean {
  if (w.run.phase !== 'village') return false;
  if (w.level?.id === 'border') {                       // 06 §1: the Border Village inn leads to Stage 3
    beginTransition(w.run, 'sleep', { phase: 'stage', levelId: 'kingdom', stage: 3 });
    return true;
  }
  if (w.level?.id === 'rebel_camp') {
    // SPEC-GAP: Stage 4 and the Enemy King come in the next M9 part; until then the Rebel Camp inn ends the run at "Run so far".
    beginTransition(w.run, 'sleep', { phase: 'runSoFar', levelId: 'rebel_camp', stage: 0 });
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
