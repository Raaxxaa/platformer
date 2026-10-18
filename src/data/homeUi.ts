// Home panels: seed geometry is 07 §6.12; the other panels reuse the existing popup skin.
export const HOME_UI = {
  depth: 1200, dimDepth: 89.5, dimAlpha: 0.60, panelFrame: 'panel_9', panelEdge: 'panel_9_edge', corner: 8,
  border: 1, cursorGap: 8, textInset: 8, frameClamp: 0.1,
  repeatDelay: 0.35, repeatEvery: 0.10, stick: 0.5,
  pad: { left: 14, right: 15, up: 12, down: 13, confirm: 0, back: 1 },
  seed: {
    panel: [200, 110, 240, 110], titleY: 6, boxesY: 30, length: 12, boxW: 14, boxH: 18, boxGap: 2,
    actionsY: 60, actionW: 50, actionH: 16, actionGap: 4, hintY: 88, randomLength: 8,
    alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', buttons: ['Use', 'Random', 'Clear', 'Back'],
    hint: 'Arrows edit  Enter use  Esc back',
  },
  training: {
    panel: [210, 125, 220, 110], titleY: 10, bodyY: 36, actionsY: 70, actionW: 80, actionH: 20, actionGap: 16,
    title: 'TRAINING YARD', body: 'Try the Training Yard first?', buttons: ['Yes', 'No'],
  },
  records: {
    panel: [140, 50, 360, 260], titleY: 12, headingsY: 44, rowsY: 64, rowH: 12,
    columns: [24, 192], columnW: 144, backY: 228, backW: 80, backH: 20,
    title: 'DISCOVERIES', classes: 'Classes found', blueprints: 'Blueprints', empty: 'None yet',
  },
} as const;
