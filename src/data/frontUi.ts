// Boot, Title and Death screen geometry and UI clocks (07 §7.2, §7.3, §7.10).
export const FRONT_UI = {
  fadeDepth: 2000,
  boot: { textY: 170, bar: [240, 184, 160, 6], percent: 100, font: '12px monospace' },
  title: { titleY: 70, scale: 2, promptY: 220, blinkHz: 1, rowsY: 170, rowStep: 16, rowW: 160, rowH: 14, version: [632, 344], soundY: 316, warningY: 300, fadeSeconds: 0.25 },
  death: { heroX: 150, heroY: 236, titleY: 100, infoY: 126, lineH: 12, rowsY: 200, rowStep: 16, rowW: 160, rowH: 14, guardSeconds: 0.25 },
  // SPEC-GAP 43: where does Practice go? Last, so the earlier row numbers stay the same. (07 §7.3)
  // Practice (07 §7.3) is last so the earlier row numbers stay the same.
  // M15: Daily sits between Play and Training Yard (06 §14.1). Debug `titleChoose(i)` keeps the old numbers (`titleLegacy`).
  titleRows: ['Play', 'Daily', 'Boss Rush', 'Training Yard', 'Records', 'Settings', 'Practice'], titleCommands: ['play', 'daily', 'bossRush', 'training', 'records', 'settings', 'practice'],
  titleLegacy: ['play', 'training', 'records', 'settings', 'practice', 'daily', 'bossRush'],
  deathRows: ['Restart', 'Change class', 'Title'], deathCommands: ['restart', 'home', 'title'],
  // M15: a Daily death adds Share (06 §14.1).
  deathShareRows: ['Restart', 'Change class', 'Title', 'Share'], deathShareCommands: ['restart', 'home', 'title', 'share'], sharedText: 'Copied!',
  biomes: { plains: 'Plains & Forest', mountains: 'Caves & Mountains', swamps: 'Dark Forest & Swamps', kingdom: 'Enemy Kingdom', castle: "King's Castle" },
  causes: { hazard: 'Killed by a trap', spikes: 'Killed by spikes', burning: 'Burned', poisoned: 'Poisoned' },
  newer: "Save is from a newer version — progress won't be saved",
} as const;
