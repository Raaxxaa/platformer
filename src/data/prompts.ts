// Prompt labels (07 §8.4). Geometry is in pixels.
export const PROMPT = { height: 11, minWidth: 11, padding: 4, border: 1, corner: 2, charWidth: 6, glyphInset: 3, depthOffset: 1,
  hudActions: ['attack1', 'attack2', 'ability1', 'ability2'], menuButtons: { confirm: 0, back: 1 },
  psButtons: { cross: 0, circle: 1, square: 2, triangle: 3 },
  dpad: { 12: 'up', 13: 'down', 14: 'left', 15: 'right' },
  directions: { left: '←', right: '→', up: '↑', down: '↓' },
  xbox: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'SEL', 'STA', 'L3', 'R3', '↑', '↓', '←', '→'],
  playstation: ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'SHR', 'OPT', 'L3', 'R3', '↑', '↓', '←', '→'],
  psFrames: ['prompt_ps_cross', 'prompt_ps_circle', 'prompt_ps_square', 'prompt_ps_triangle'],
  xboxColors: [0x3fbf4f, 0xe0463c, 0x3c8ce0, 0xf0c030], psColors: [0x7aa8ff, 0xff6a6a, 0xff8ad8, 0x4fd6a0],
} as const;
export const KEY_LABELS: Record<string, string> = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'SPC', ShiftLeft: 'SHF', ShiftRight: 'RSH', ControlLeft: 'CTL', ControlRight: 'RCT', AltLeft: 'ALT', AltRight: 'RAL', Enter: 'ENT', Backspace: 'BSP', CapsLock: 'CAP', Escape: 'ESC', Delete: 'DEL', Insert: 'INS', Home: 'HOM', End: 'END', PageUp: 'PGU', PageDown: 'PGD', Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Backslash: '\\', Minus: '-', Equal: '=', Backquote: '`' };
export const LONG_KEYS: Record<string, string> = { Space: 'Space', ShiftLeft: 'Left Shift', ShiftRight: 'Right Shift', ControlLeft: 'Left Ctrl', ControlRight: 'Right Ctrl', AltLeft: 'Left Alt', AltRight: 'Right Alt', Enter: 'Enter', Backspace: 'Backspace', ArrowLeft: 'Left Arrow', ArrowRight: 'Right Arrow', ArrowUp: 'Up Arrow', ArrowDown: 'Down Arrow' };
