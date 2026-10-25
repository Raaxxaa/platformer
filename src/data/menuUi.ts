// Records, settings and portable save panels (07 §7.5, §7.7, §7.9).
import { MAX_FRAME_SECONDS } from '../core/tuning.ts';
export const MENU_UI = {
  depth: 1600, dimDepth: 1500, dimAlpha: 0.60, border: 1, corner: 8, panelFrame: 'panel_9', frameClamp: MAX_FRAME_SECONDS,
  cursorGap: 8, fontSize: 12, domZ: 1000, stick: 0.5,
  records: {
    panel: [24, 8, 592, 344], tabs: ['BEST RUNS', 'CLASSES', 'UNLOCKS', 'LOOKS'], tabXs: [98, 246, 394, 542], tabsY: 24, tabW: 140, tabH: 18,
    roads: ['mountain', 'forest'], roadNames: ['Mountain road', 'Forest road'], classX: 112, roadXs: [320, 472], headingsY: 66,
    rowsY: 92, rowH: 26, cellW: 144, selectedY: 210, segmentsY: 234, segmentXs: [104, 248, 392, 536],
    gridX: 40, gridY: 96, gridCols: 5, gridW: 112, gridH: 40,
    unlockX: 56, unlockY: 72, unlockCols: 3, unlockW: 176, unlockH: 48, icon: 16, iconTextGap: 24, unlockNameW: 148,
    startersY: 232, starterX: 112, starterRowH: 14, backX: 280, backY: 316, backW: 80, backH: 20,
    hintY: 292, notReady: 'Not ready',
  },
  settings: {
    panel: [112, 16, 416, 300], titleY: 28, rowsY: 56, rowH: 16, labelX: 160, valueX: 480, rowW: 336,
    rows: ['controls', 'master', 'sfx', 'timer', 'shake', 'icons', 'touch', 'fullscreen', 'export', 'import', 'back'],
    /** The touch page (07 §7.7, §8.6): opened by the `touch` row. */
    touchRows: ['mode', 'opacity', 'size', 'hand', 'vibe', 'effects', 'layout', 'tback'],
    touchLabels: { mode: 'Touch controls', opacity: 'Touch opacity', size: 'Button size', hand: 'Left-handed', vibe: 'Vibration', effects: 'Effects', layout: 'Edit layout ▸', tback: 'Back' },
    modeNames: { auto: 'Auto', on: 'On', off: 'Off' }, opacityStep: 5, sizeStep: 10,
    labels: { controls: 'Controls ▸', master: 'Master volume', sfx: 'SFX volume', timer: 'Show timer', shake: 'Screen shake', icons: 'Button icons', touch: 'Touch controls ▸', fullscreen: 'Fullscreen', export: 'Export save ▸', import: 'Import save ▸', back: 'Back' },
    styles: ['auto', 'keyboard', 'xbox', 'playstation'], styleNames: ['Auto', 'Keyboard', 'Xbox', 'PlayStation'],
    volumeCells: 10, cell: 6, cellGap: 2, barX: 370, barY: 2, minusX: 350, plusX: 488, stepW: 14,
    hintY: 270, controlsRowsY: 64, controlsRowH: 14, controlsBackY: 280,
    controlNames: { left: 'Left', right: 'Right', up: 'Up', down: 'Down', jump: 'Jump', dash: 'Dash', attack1: 'Attack 1', attack2: 'Attack 2', ability1: 'Ability 1', ability2: 'Ability 2', heal: 'Heal', interact: 'Interact', restart: 'Restart (hold)', pause: 'Pause' },
  },
  saveCode: {
    panel: [40, 80, 560, 200], titleY: 88, textarea: [56, 110, 528, 112], statusY: 232, buttonXs: [232, 328], buttonY: 252, buttonW: 80, buttonH: 20,
    exportButtons: ['Copy', 'Back'], importButtons: ['Import', 'Back'], confirmButtons: ['Confirm', 'Cancel'],
    invalid: "That code isn't valid", warning: "Replace your save? This can't be undone", copyFailed: 'Copy failed', applyFailed: "Can't replace this save", copied: 'Copied',
  },
} as const;
