// The Dragon (04 §13). Filled in by the Dragon task.
import type { GameWorld } from '../sim/gameWorld.ts';
import type { EnemyState } from './enemy.ts';
export interface DragonState { color: 'red' | 'white' | 'storm' | 'green' }
export function dragonTeleStart(_w: GameWorld, _e: EnemyState): void { /* later */ }
export function dragonTeleTick(_w: GameWorld, _e: EnemyState): void { /* later */ }
export function cancelDragonAttack(_w: GameWorld, _e: EnemyState): void { /* later */ }
