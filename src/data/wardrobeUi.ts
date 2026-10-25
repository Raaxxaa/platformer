// Wardrobe layout (09 §6, 07 §6): a full-screen panel, preview on the left, tabs and rows on the right.
export const WARDROBE_UI = {
  panel: [24, 8, 592, 344] as const, panelFrame: 'panel_mirror_9', titleY: 20,
  preview: { x: 166, y: 228, scale: 3, fps: 8, labelY: 262, depth: 1601, weaponFrame: 'atk_greatsword_1' },
  animButtons: { x: 44, y: 290, w: 56, h: 16, gap: 6 },
  tabs: { x: 328, y: 18, w: 70, h: 30, gap: 0, iconY: 3, labelY: 18, icons: ['tab_body', 'tab_clothes', 'tab_acc', 'tab_collection'] as const },
  rows: { x: 328, y: 58, h: 24, labelW: 80, arrowW: 20, valueW: 168, swatch: 8 },
  buttons: { y: 318, w: 88, h: 20, xs: [328, 424, 520] as const },
  hintY: 296, detailY: 226,
  grid: { x: 328, y: 56, cols: 10, cell: 28, icon: 20, nameY: 232, hintY: 246, countY: 270 },
  introTitle: 'Make your hero', title: 'Wardrobe', seenFlag: 'wardrobeIntroDone',
  recordsGrid: { x: 64, y: 70, cols: 10, cell: 48, icon: 32, nameY: 270, hintY: 284 },
} as const;
