// Rebinding rules (07 §8.3), pure. Each action has 2 keyboard cells and 1 gamepad cell; a key or button lives in one cell.
import type { ActionId, SettingsData } from '../../core/save/schema.ts';

export type Bindings = SettingsData['bindings'];
/** 0 and 1 are the keyboard cells, 2 the gamepad cell. */
export type BindCol = 0 | 1 | 2;
export const ACTIONS: readonly ActionId[] = ['left', 'right', 'up', 'down', 'jump', 'dash', 'attack1', 'attack2', 'ability1', 'ability2', 'heal', 'interact', 'restart', 'pause'];

const NO_KEYS = new Set(['Escape', 'Tab', 'MetaLeft', 'MetaRight', 'ContextMenu', 'PrintScreen', ...Array.from({ length: 12 }, (_, i) => `F${i + 1}`)]);
const NO_PAD = new Set([9, 12, 13, 14, 15]);
export const canCaptureKey = (code: string): boolean => !NO_KEYS.has(code);
export const canCapturePad = (button: number): boolean => !NO_PAD.has(button);

/** Fixed cells (07 §7.8): the four directions on the pad (D-pad / L-stick), Pause key 1 (Esc) and Pause on the pad (Start). */
export function isFixed(action: ActionId, col: BindCol): boolean {
  if (col === 2) return action === 'left' || action === 'right' || action === 'up' || action === 'down' || action === 'pause';
  return action === 'pause' && col === 0;
}

const valid = (b: Bindings): boolean => ACTIONS.every((a) => b.keyboard[a].some((k) => k !== null));

/** Sets keyboard cell `col` of `action` to `code`; null when refused (fixed cell, uncapturable key, or an action left with no key). */
export function bindKey(src: Bindings, action: ActionId, col: 0 | 1, code: string): Bindings | null {
  if (isFixed(action, col) || !canCaptureKey(code)) return null;
  const b = structuredClone(src), old = b.keyboard[action][col];
  for (const a of ACTIONS) for (const c of [0, 1] as const) {
    if (b.keyboard[a][c] !== code || (a === action && c === col)) continue;
    if (a === action) b.keyboard[a][c] = null;            // the other cell of the same action: the key moves
    else { if (isFixed(a, c)) return null; b.keyboard[a][c] = old; }     // another action: swap
  }
  b.keyboard[action][col] = code;
  return valid(b) ? b : null;
}

/** Empties a keyboard cell; null when refused. */
export function clearKey(src: Bindings, action: ActionId, col: 0 | 1): Bindings | null {
  if (isFixed(action, col)) return null;
  const b = structuredClone(src); b.keyboard[action][col] = null;
  return valid(b) ? b : null;
}

/** Sets the gamepad cell; a button already used swaps with the other action. Null when refused. */
export function bindPad(src: Bindings, action: ActionId, button: number): Bindings | null {
  if (isFixed(action, 2) || !canCapturePad(button)) return null;
  const b = structuredClone(src), old = b.gamepad[action];
  for (const a of ACTIONS) if (a !== action && b.gamepad[a] === button) b.gamepad[a] = old;
  b.gamepad[action] = button;
  return b;
}
