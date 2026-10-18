// Level hazards, 06 §10. Damage is fixed and never follows enemy stage scaling.
export const FALLING_ROCKS = {
  firstMarkTicks: 36,
  warningTicks: 72,
  intervalTicks: 240,
  speed: 360,
  size: 16,
  inset: 8,
  damage: 18,
} as const;
