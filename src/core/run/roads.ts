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
  if (w.level?.id === 'rebel_camp') {                  // 06 §1: the Rebel Camp inn leads to Stage 4
    beginTransition(w.run, 'sleep', { phase: 'stage', levelId: 'castle', stage: 4 });
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
