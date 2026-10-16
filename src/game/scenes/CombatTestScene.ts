// M2 combat test level (?scene=combat): the Stage 1 enemies on a flat field.
import { GameWorld } from '../../core/sim/gameWorld.ts';
import { COMBAT_TEST } from '../../data/levels/combatTest.ts';
import { WorldScene } from './WorldScene.ts';

export class CombatTestScene extends WorldScene {
  constructor() {
    super('CombatTest');
  }

  protected makeWorld(): GameWorld {
    return new GameWorld({ grid: COMBAT_TEST.grid, spawn: COMBAT_TEST.spawn, enemies: COMBAT_TEST.enemies });
  }
}
