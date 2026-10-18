// Player status rules, 02 §5.4. Durations count player ticks, pausing in player hit-stop.
export const PLAYER_STATUS = {
  intervalTicks: 60,
  poisoned: { damage: 1, maxStacks: 3, durationTicks: 480 },
  burning: { damage: 3, durationTicks: 240 },
  rootedTicks: 120,
  chilledTicks: 240,
  chilledMult: 0.70,
} as const;
