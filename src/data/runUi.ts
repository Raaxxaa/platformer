// Route choice is 07 §6.6. The temporary M7 summary uses the existing popup style.
export const RUN_UI = {
  depth: 1200, dimDepth: 89.5, dimAlpha: 0.60, border: 1, corner: 8, panelFrame: 'panel_9',
  frameClamp: 0.10, stick: 0.5, textInset: 8, cursorGap: 8,
  glyphs: { keyboard: { confirm: 'ENT', back: 'ESC' }, pad: { confirm: 'A', back: 'B' } },
  route: {
    panel: [160, 90, 320, 150], title: 'CHOOSE YOUR ROAD', titleY: 98,
    cardXs: [168, 324], cardY: 122, cardW: 148, cardH: 100, lineY: 6, lineGap: 11, hintY: 228,
    cards: [
      { road: 'mountain', lines: ['MOUNTAIN ROAD', 'Caves & Mountains', 'Guardian: Stone Colossus', 'More climbing'] },
      { road: 'forest', lines: ['FOREST ROAD', 'Dark Forest & Swamps', 'Guardian: Spider Queen', 'More fighting'] },
    ],
  },
  summary: {
    panel: [112, 64, 416, 232], title: 'TO BE CONTINUED', titleY: 80,
    linesY: 112, lineGap: 14, textW: 384, buttons: ['Restart', 'Home Village', 'Title'],
    commands: ['restart', 'homeVillage', 'title'], buttonXs: [176, 276, 376], buttonY: 244, buttonW: 88, buttonH: 20, hintY: 276,
  },
} as const;
