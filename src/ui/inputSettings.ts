// Applied UI/input settings; no storage or Phaser dependency. Menus always keep their fixed meanings.
import { defaultSettings, type ActionId, type SettingsData } from '../core/save/schema.ts';
import { KEY_LABELS, LONG_KEYS, PROMPT } from '../data/prompts.ts';
/** Prompt style `touch` (07 §8.4): the on-screen button each action is on. */
const TOUCH_LABEL: Record<ActionId, string> = { left: '◂', right: '▸', up: '▴', down: '▾', jump: 'JUMP', dash: 'DASH', attack1: 'ATK', attack2: 'ATK2', ability1: 'AB1', ability2: 'AB2', heal: 'HEAL', interact: 'USE', restart: 'HOLD ❚❚', pause: '❚❚' };
let settings = defaultSettings(), lastDevice: 'keyboard' | 'gamepad' | 'touch' = 'keyboard', padId = '';
let confirmKeys = new Set(['Enter', 'Space', 'KeyE']);
let layout: ReadonlyMap<string, string> | null = null;
export function configureMenuBindings(keys: readonly string[]): void { confirmKeys = new Set(['Enter', 'Space', ...keys]); }
export function applyUiSettings(value: SettingsData): void {
  settings = structuredClone(value); configureMenuBindings([...settings.bindings.keyboard.jump, ...settings.bindings.keyboard.interact].filter((key): key is string => key !== null));
}
export const getUiSettings = (): SettingsData => settings;
export const menuConfirmKey = (code: string): boolean => confirmKeys.has(code);
type FixedMenuAction = 'left' | 'right' | 'up' | 'down' | 'confirm' | 'back';
export function fixedMenuAction(code: string): FixedMenuAction | undefined {
  return ({ ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', Enter: 'confirm', Space: 'confirm', Escape: 'back', Backspace: 'back' } as Record<string, FixedMenuAction>)[code];
}
/** A binding may pause a popup only when it has no fixed menu meaning. */
export const menuPauseKey = (code: string): boolean => settings.bindings.keyboard.pause.includes(code) && !fixedMenuAction(code);
export function noteInputDevice(device: 'keyboard' | 'gamepad' | 'touch', id = ''): void { lastDevice = device; if (device === 'gamepad') padId = id; }
/** 07 §8.6: the last device used was touch (Auto shows the overlay, prompts name the on-screen buttons). */
export const lastDeviceIsTouch = (): boolean => lastDevice === 'touch';
export function setKeyboardLayout(value: ReadonlyMap<string, string>): void { layout = value; }
export function shownPromptStyle(): Exclude<SettingsData['promptStyle'], 'auto'> {
  return settings.promptStyle !== 'auto' ? settings.promptStyle : lastDevice === 'keyboard' || lastDevice === 'touch' ? 'keyboard' : /054c|dualshock|dualsense|playstation/i.test(padId) ? 'playstation' : 'xbox';
}
export function keyLabel(code: string, long = false): string {
  if (long && LONG_KEYS[code]) return LONG_KEYS[code];
  if (layout?.has(code) && /^(Key|Digit|Comma|Period|Slash|Semicolon|Quote|Bracket|Backslash|Minus|Equal|Backquote)/.test(code)) return layout.get(code)!.toUpperCase();
  if (/^Key[A-Z]$/.test(code)) return code.slice(3); if (/^Digit[0-9]$/.test(code)) return code.slice(5); if (/^Numpad[0-9]$/.test(code)) return `N${code.at(-1)}`;
  return KEY_LABELS[code] ?? code.slice(0, 3).toUpperCase();
}
export function actionLabel(action: ActionId, long = false): string {
  if (settings.promptStyle === 'auto' && lastDevice === 'touch') return TOUCH_LABEL[action];
  const style = shownPromptStyle();
  if (style === 'keyboard') { const code = settings.bindings.keyboard[action].find((key) => key !== null); return code ? keyLabel(code, long) : '—'; }
  const index = settings.bindings.gamepad[action]; return index === null ? PROMPT.directions[action as keyof typeof PROMPT.directions] ?? '—' : PROMPT[style][index] ?? '—';
}
export const menuGlyphs = () => settings.promptStyle === 'auto' && lastDevice === 'touch' ? { confirm: 'TAP', back: 'BACK' } : shownPromptStyle() === 'keyboard' ? { confirm: 'ENT', back: 'ESC' } : shownPromptStyle() === 'playstation' ? { confirm: '✕', back: '○' } : { confirm: 'A', back: 'B' };
