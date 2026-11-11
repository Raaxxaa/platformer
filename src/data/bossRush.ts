// Boss rush numbers (06 §14.2, M15).
export const BOSS_RUSH = { fadeSeconds: 1.0, healFraction: 0.5, secondAbilityLevel: 3, preset: 4 } as const;
export const BOSS_RUSH_UI = {
  panel: [112, 56, 416, 200] as const, titleY: 68, rowsY: 100, rowStep: 16, labelX: 160, valueX: 480, rowW: 336, hintY: 236,
  rows: ['class', 'weapon', 'dragon', 'best', 'start', 'back'] as const,
  labels: { class: 'Class', weapon: 'Weapon', dragon: 'Dragon', best: 'Best' },
  dragons: ['off', 'random', 'red', 'white', 'storm', 'green'] as const,
  dragonLabel: { off: 'Off', random: 'Random color', red: 'Red', white: 'White', storm: 'Storm', green: 'Green' },
  locked: 'Boss Rush (locked)', lockedHint: 'Beat the Enemy King to unlock',
  bossName: { great_boar: 'Great Boar', stone_colossus: 'Stone Colossus', spider_queen: 'Spider Queen', dragon: 'Dragon', black_knight: 'Black Knight', enemy_king: 'Enemy King' } as Record<string, string>,
  result: { titleY: 70, timeY: 94, linesY: 122, lineH: 12, rowsY: 222, rowStep: 16, rowW: 160, rowH: 14, guardSeconds: 0.5,
    rows: ['Retry', 'Change setup', 'Title'], commands: ['retry', 'setup', 'title'] },
} as const;
