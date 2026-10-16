// Reads keyboard and gamepad into the SnapshotBuilder (07 §8.1–8.2).
import { INPUT } from '../../core/tuning.ts';
import { SnapshotBuilder, type ButtonId, type DirId } from './snapshot.ts';

type ActionId = ButtonId | DirId;

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
  private enabled = true;

  private readonly onKeyDown = (e: KeyboardEvent) => {
    const id = KEY_BINDINGS.get(e.code);
    if (!id) return;
    e.preventDefault();
    if (e.repeat || !this.enabled) return;
    this.builder.down(id, 'kb');
  };
  private readonly onKeyUp = (e: KeyboardEvent) => {
    const id = KEY_BINDINGS.get(e.code);
    if (!id) return;
    e.preventDefault();
    this.builder.up(id, 'kb');
  };
  /** Window lost focus: let go of everything so nothing stays held (alt-tab while running). */
  private readonly onBlur = () => {
    this.builder.releaseAll();
    this.padHeld.clear();
  };

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

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
      for (const [index, id] of Object.entries(PAD_BUTTONS)) {
        const b = pad.buttons[Number(index)];
        if (b && padButtonHeld(Number(index), b)) now.set(id, true);
      }
      this.builder.setStick(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
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
  }
}
