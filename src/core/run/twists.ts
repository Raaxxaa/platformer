// Daily twists (06 §14.1, M18): run modifiers. A run's twist is fixed at its start (`run.twist`); absent = classic.
import { addHitMod } from '../combat/hitMods.ts';
import { spawnEnemy } from '../enemies/enemy.ts';
import { sectionAt } from '../level/routeLint.ts';
import { addPlayerStatSource } from '../loot/perks.ts';
import { sourceRng } from '../loot/pick.ts';
import { rollWeapon } from '../loot/roll.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { RUSH } from '../tuning.ts';
import { FIXED_ODDS } from '../../data/loot.ts';
import { LEVEL_RULES, type StageLevelId } from '../../data/levelRules.ts';
import { TWIST_FX as F } from '../../data/twists.ts';
import { hasTwist } from './twistFx.ts';
export * from './twistFx.ts';

// Registered on the first stage load (not at import time: the hook lists import this file through the world).
let hooked = false;
function hook(): void {
  if (hooked) return; hooked = true;
  addPlayerStatSource({
    speed: (w) => (hasTwist(w, 'swift') ? F.swiftPercent : 0),
    incoming: (w) => (hasTwist(w, 'glass_cannon') ? F.glassCannonIn : 1),
  });
  addHitMod({ targetMult: (w) => (hasTwist(w, 'glass_cannon') ? F.glassCannonOut : 1) });
}

/** Run start (a fresh run, not a carried one): Dragon Day, Arsenal. */
export function applyTwistAtRunStart(w: GameWorld): void {
  if (hasTwist(w, 'dragon_day')) w.run.dragon = { ...w.run.dragon, present: true };
  if (hasTwist(w, 'arsenal') && w.combat.slots[0] && !w.combat.slots[1]) {
    const rng = sourceRng(w.runSeed, 'daily', 'arsenal');
    const weapon = rollWeapon(rng, FIXED_ODDS.jackpot, w.classState.carriedClasses, { unlocked: w.run.lootUnlocked, exclude: [w.combat.slots[0].weaponId] });
    w.setLoadout({ weapons: [w.combat.slots[0], { ...weapon, grade: F.arsenalGrade, element: weapon.element ?? 'fire' }], abilities: [...w.abilities.slots] as never });
  }
}
/** Every stage load: Rush Hour's floor, Elite Patrol's extra elite in section 2. */
export function applyTwistOnStage(w: GameWorld): void {
  hook();
  if (hasTwist(w, 'rush_hour')) { w.rush.floor = Math.max(w.rush.floor, RUSH.LEVEL_STEP); w.rush.value = Math.max(w.rush.value, RUSH.LEVEL_STEP); }
  if (hasTwist(w, 'elite_patrol') && w.level?.kind === 'stage') {
    const rule = LEVEL_RULES[w.level.id as StageLevelId]; if (!rule) return;
    const anchor = w.enemies.find((e) => e.def.id === rule.elite && sectionAt(w.level!, e.x, e.y - 8) === 2)
      ?? w.enemies.find((e) => sectionAt(w.level!, e.x, e.y - 8) === 2 && !e.def.flying);
    if (!anchor) return;
    const e = spawnEnemy(w, { enemy: rule.elite, x: anchor.x + F.elitePatrolOffset, y: anchor.y, facing: anchor.facing });
    w.enemies.push(e);
  }
}
