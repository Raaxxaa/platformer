// Village geometry (06 §12) and ART3 decorative anchors (08 §8).
export const VILLAGE = { width: 48, height: 23, floor: 20, wallLeft: 0, wallRight: 47, promptY: 4,
  homeProps: [{ frame: 'cottage_a_00', tile: 5 }, { frame: 'cottage_b_00', tile: 32 }, { frame: 'well_00', tile: 30 }],
  npcs: [{ frame: 'villager_a_idle_00', tile: 7 }, { frame: 'villager_b_idle_00', tile: 31 }],
} as const;
