// Mountain enemy special rules, 04 §4; base values scale at runtime.
export const MOUNTAIN = {
  batWaypointTicks: 60, batXMin: -48, batXMax: 48, batYMin: -72, batYMax: -32, batDiveSpeed: 260,
  wardRange: 160, wardTargets: 3, wardBaseHP: 20, wardTicks: 960,
  blinkRange: 48, blinkDistance: 160, blinkTicks: 36, blinkCooldownTicks: 600, blinkGroundScan: 64,
  guardFrontalSlop: 4, guardPoiseMult: .5, guardRecoil: 120,
} as const;
