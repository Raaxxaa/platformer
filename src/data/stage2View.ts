// View-only rules for Stage2 terrain and effects (08 §8–11).
export const STAGE2_VIEW = {
  rails: { up: 32, down: 48, height: 3, tieHeight: 2, color: 0x9a9da5, tieColor: 0x555860 },
  water: { alpha: 0.65, frames: 4, fps: 6, row: 7, bodyColumn: 4, fallback: 0x737b80 },
  bodies: { row: 3, crackedColumn: 12, blinkColumn: 13, solidColumn: 14, oneWayColumn: 15, fallback: 0x737780,
    shake: 1, shakeEvery: 2, collapseGravity: 1500, collapseLife: 1 },
  cart: { w: 32, h: 24, frames: 2, fps: 8, speed: 260, color: 0x85888f, wheelColor: 0x474a52, wheel: 6, wheelInset: 7 },
  grapple: { size: 16, width: 2, color: 0x9c9fa8 },
  marker: { height: 4, color: 0xff8a1f, go: 0xfff4c8, minAlpha: 0.4, maxAlpha: 0.8, hz: 4, solidLast: 0.15 },
  rockMarkerWidth: 16,
  firefly: { size: 2, color: 0xe6ffff },
  puddle: { color: 0x85888f, alpha: 0.7 },
  ward: { extra: 6, color: 0x9c9fa8, alpha: 0.6, lineWidth: 2 },
  splash: { w: 24, h: 16, frames: 5, fps: 20, speed: 100 },
  ripple: { w: 16, h: 4, frames: 2, fps: 8, every: 0.25 },
  frames: { rail: 'minecart_rail_00', cart: ['minecart_roll_00', 'minecart_roll_01'], grapple: 'grapple_point_00',
    rock: 'falling_rock_00', puddle: ['puddle_00', 'puddle_01'], splash: 'splash_', ripple: 'ripple_' },
} as const;
