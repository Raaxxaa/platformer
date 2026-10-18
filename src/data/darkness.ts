// View-only darkness rules (08 §10.2). No gameplay or random stream uses these.
export const DARKNESS = {
  color: 0x06070a,
  alpha: 0.82,
  edge: 32,
  edgeAlphas: [0.2, 0.4, 0.6, 0.82],
  playerRadius: 112,
  wispRadius: 32,
  fireRadius: 24,
  lightBands: [{ fraction: 0.6, alpha: 0 }, { fraction: 0.85, alpha: 0.4 }, { fraction: 1, alpha: 0.65 }],
  fireflyDrift: 6,
  fireflyPeriod: 3,
  fireProjectileIds: ['fireball', 'fire_rain'],
} as const;
