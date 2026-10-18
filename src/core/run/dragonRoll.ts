import { DRAGON_ROLL } from '../../data/run.ts';
export interface DragonRoll {
  present: boolean;
  stage: 2 | 3;
  color: typeof DRAGON_ROLL.colors[number];
  outcome: 'absent' | 'skipped' | 'escaped' | 'killed';
}
// SPEC-GAP: Dragon arrives in M9.
// Preserve its isolated three-draw roll now, without spawning a fight.
export function rollDragon(rng: () => number): DragonRoll {
  const present = rng() < DRAGON_ROLL.chance;
  const stage = rng() < DRAGON_ROLL.stage2Chance ? 2 : 3;
  const color = DRAGON_ROLL.colors[Math.floor(rng() * DRAGON_ROLL.colors.length)];
  return { present, stage, color, outcome: 'absent' };
}
