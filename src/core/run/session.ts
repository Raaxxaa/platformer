// Scene-boundary snapshot. A constructor consumes it once; restart never reapplies collected equipment.
import type { Loadout } from '../abilities/runtime.ts';
import { cloneLoadout } from '../abilities/runtime.ts';
import type { FlaskState } from '../combat/types.ts';
import type { EconomyState } from '../economy/gold.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import type { RunState } from './runState.ts';
export interface WorldCarry { run: RunState; loadout: Loadout; hp: number; maxHp: number; flask: FlaskState; econ: EconomyState }
export function captureWorld(w: GameWorld): WorldCarry {
  return { run: structuredClone(w.run), loadout: cloneLoadout({ weapons: w.combat.slots, abilities: w.abilities.slots }), hp: w.health.hp,
    maxHp: w.health.maxHp, flask: { ...w.flask }, econ: structuredClone(w.econ) };
}
