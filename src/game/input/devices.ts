// Reads keyboard and gamepad into the SnapshotBuilder (07 §8.1–8.2).
import { INPUT } from '../../core/tuning.ts';
import { SnapshotBuilder, type ButtonId, type DirId } from './snapshot.ts';
import { defaultSettings, type SettingsData } from '../../core/save/schema.ts';
import { noteInputDevice } from '../../ui/inputSettings.ts';
import { PROMPT } from '../../data/prompts.ts';
import { touchModel } from '../../ui/touch/touchInput.ts';

type ActionId = ButtonId | DirId;
export function bindingsToKeys(bindings: SettingsData['bindings']): Map<string, ActionId> {
  const result = new Map<string, ActionId>();
  for (const [action, keys] of Object.entries(bindings.keyboard)) for (const key of keys) if (key) result.set(key, action as ActionId);
  return result;
}
export function bindingsToPad(bindings: SettingsData['bindings']): Record<number, ActionId> {
  const result: Record<number, ActionId> = { ...PROMPT.dpad };
  for (const [action, button] of Object.entries(bindings.gamepad)) if (button !== null) result[button] = action as ActionId;
  return result;
}

/** Default keys, by KeyboardEvent.code (07 §8.1). Rebinding arrives with the settings screen. */
export const KEY_BINDINGS: ReadonlyMap<string, ActionId> = new Map<string, ActionId>([
  ['KeyA', 'left'], ['ArrowLeft', 'left'],
  ['KeyD', 'right'], ['ArrowRight', 'right'],
  ['KeyW', 'up'], ['ArrowUp', 'up'],
  ['KeyS', 'down'], ['ArrowDown', 'down'],
  ['Space', 'jump'],
  ['ShiftLeft', 'dash'],
  ['KeyJ', 'attack1'],
  ['KeyK', 'attack2'],
  ['KeyU', 'ability1'],
  ['KeyI', 'ability2'],
  ['KeyQ', 'heal'],
  ['KeyE', 'interact'],
  ['KeyR', 'restart'],
  ['Escape', 'pause'], ['KeyP', 'pause'],
]);

/** Standard Gamepad button indices (07 §8.1). */
export const PAD_BUTTONS: Readonly<Record<number, ActionId>> = {
  0: 'jump', 1: 'interact', 2: 'attack1', 3: 'attack2', 4: 'heal', 5: 'dash',
  6: 'ability1', 7: 'ability2', 8: 'restart', 9: 'pause',
  12: 'up', 13: 'down', 14: 'left', 15: 'right',
};

/** Triggers (6, 7) are held at value >= 0.5; other buttons use `pressed` (07 §8.2). */
export function padButtonHeld(index: number, button: { pressed: boolean; value: number }): boolean {
  return index === 6 || index === 7 ? button.value >= INPUT.TRIGGER_HELD : button.pressed;
}

/** First connected pad with the standard mapping, else the first connected pad. */
function activePad(): Gamepad | null {
  const pads = (navigator.getGamepads?.() ?? []).filter((p): p is Gamepad => p !== null && p.connected);
  return pads.find((p) => p.mapping === 'standard') ?? pads[0] ?? null;
}

/** Keyboard (event-driven) and gamepad (polled once per rendered frame) into one SnapshotBuilder. */
export class Devices {
  readonly builder = new SnapshotBuilder();
  private readonly padHeld = new Map<ActionId, boolean>();
  private readonly downCodes = new Set<string>();
  private enabled = true;
  private keyBindings = new Map(KEY_BINDINGS);
  private padBindings = { ...PAD_BUTTONS };
  private bindingsKey = '';
  private pauseKey: string | null = null;

  private readonly onKeyDown = (e: KeyboardEvent) => {
    const id = this.keyBindings.get(e.code);
    if (!id) { if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); return; }
    noteInputDevice('keyboard');
    e.preventDefault();
    if (e.repeat || !this.enabled || this.downCodes.has(e.code)) return;
    if (id === 'pause') this.pauseKey = e.code;
    const alreadyHeld = this.keyboardHeld(id); this.downCodes.add(e.code);
    if (!alreadyHeld) this.builder.down(id, 'kb');
  };
  private readonly onKeyUp = (e: KeyboardEvent) => {
    const id = this.keyBindings.get(e.code);
    this.downCodes.delete(e.code);
    if (!id) return;
    e.preventDefault();
    if (!this.keyboardHeld(id)) this.builder.up(id, 'kb');
  };
  /** Window lost focus: let go of everything so nothing stays held (alt-tab while running). */
  private readonly onBlur = () => {
    this.builder.releaseAll();
    this.downCodes.clear();
    this.padHeld.clear();
    this.pauseKey = null;
    touchModel.releaseAll();
  };
  private keyboardHeld(id: ActionId): boolean {
    for (const code of this.downCodes) if (this.keyBindings.get(code) === id) return true;
    return false;
  }

  constructor(bindings = defaultSettings().bindings) {
    this.setBindings(bindings);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    // Touch is a third device (07 §8.6): the overlay's pointers become the same latched presses.
    touchModel.attach({
      down: (id) => { if (!this.enabled) return; noteInputDevice('touch'); this.builder.down(id, 'touch'); },
      up: (id) => this.builder.up(id, 'touch'),
    });
  }
  setBindings(bindings: SettingsData['bindings']): void {
    const key = JSON.stringify(bindings); if (key === this.bindingsKey) return;
    this.bindingsKey = key; this.onBlur(); this.keyBindings = bindingsToKeys(bindings); this.padBindings = bindingsToPad(bindings);
  }
  /** Preserve the physical source until the frame consumes its pressed edge (menu precedence). */
  takePauseKey(): string | null { const code = this.pauseKey; this.pauseKey = null; return code; }

  /** A tap on screen (an item card row): the press is latched like a button that went down and up. */
  tap(id: ActionId): void { if (!this.enabled) return; noteInputDevice('touch'); this.builder.down(id, 'touch'); this.builder.up(id, 'touch'); }

  /** Ignore devices (debug manual mode) and release whatever they held. */
  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.onBlur();
  }

  /** Reads the active gamepad; call once per rendered frame. */
  pollGamepad(): void {
    if (!this.enabled) return;
    const pad = activePad();
    const now = new Map<ActionId, boolean>();
    if (pad) {
      for (const [index, id] of Object.entries(this.padBindings)) {
        const b = pad.buttons[Number(index)];
        if (b && padButtonHeld(Number(index), b)) now.set(id, true);
      }
      this.builder.setStick(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
      if (now.size || pad.axes.some((axis) => Math.abs(axis) >= INPUT.STICK_X)) noteInputDevice('gamepad', pad.id);
    } else {
      this.builder.setStick(0, 0);
    }
    for (const id of new Set([...this.padHeld.keys(), ...now.keys()])) {
      const was = this.padHeld.get(id) === true, is = now.get(id) === true;
      if (is && !was) this.builder.down(id, 'pad');
      if (was && !is) this.builder.up(id, 'pad');
    }
    this.padHeld.clear();
    for (const id of now.keys()) this.padHeld.set(id, true);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    touchModel.attach(null);
  }
}
