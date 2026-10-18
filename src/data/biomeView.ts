// View fallback boxes while ART7 is absent. These never affect collision.
export const BIOME_VIEW = {
  terrain: { solid: 0x65656d, ice: 0xb9c2c9, oneway: 0x96969c, spike: 0xd0d0d4, empty: 0 },
  onewayHeight: 6,
  background: 0x45454c, cave: 0x1c1c22,
  caveStartFraction: 0.6, caveFadeSeconds: 0.5,
  frameClamp: 0.1,
  enemy: 0xaaaab2, eye: 0xe6ffff, eyeW: 2, eyeH: 1, eyeInset: 1, eyeTop: 2,
  bubbleRadius: 2, bubblePeriod: 1, bubbleRise: 12, bubbleColor: 0xa6d6b6,
  thread: 0xc6c6ce, threadWidth: 1, threadShake: 1,
} as const;
