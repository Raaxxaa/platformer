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

/** 06 §10 cannon: a 12 x 12 ball at 300 px/s every 3.0 s, only while the muzzle is inside the view grown by 160 px. */
export const CANNON = {
  intervalS: 3.0, offsetS: 1.0, range: 960, telegraphTicks: 72, activeMargin: 160,
  speed: 300, size: 12, damage: 20, kb: [240, -180] as [number, number], muzzleDx: 8,
} as const;

/** 06 §10 swinging blade: a pendulum, 20 x 20 box at the blade, rehit 0.5 s, 20 damage, not stage scaled. */
export const SWINGING_BLADE = { size: 20, damage: 20, kb: [260, -200] as [number, number], rehitS: 0.5, length: 64, amplitude: 60, period: 2.0, phase: 0 } as const;
