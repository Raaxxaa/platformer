// InputState: one snapshot per simulation tick, built by the Phaser layer (01 §1.1).

export interface ButtonState {
  held: boolean;      // down at the moment the tick is built
  pressed: boolean;   // went down at least once since the previous tick (latched)
  released: boolean;  // went up at least once since the previous tick (latched)
}

export interface InputState {
  moveX: -1 | 0 | 1;   // -1 left, +1 right
  moveY: -1 | 0 | 1;   // -1 up, +1 down
  jump: ButtonState;
  dash: ButtonState;
  attack1: ButtonState;   // weapon slot 1
  attack2: ButtonState;   // weapon slot 2
  ability1: ButtonState;
  ability2: ButtonState;
  heal: ButtonState;
  interact: ButtonState;
  restart: ButtonState;   // hold length is measured by 06
  pause: ButtonState;     // handled by the Phaser layer; the core ignores it
}

export const BUTTON_IDS = [
  'jump', 'dash', 'attack1', 'attack2', 'ability1', 'ability2', 'heal', 'interact', 'restart', 'pause',
] as const;

export type ButtonId = (typeof BUTTON_IDS)[number];

export function emptyButton(): ButtonState {
  return { held: false, pressed: false, released: false };
}

export function emptyInput(): InputState {
  return {
    moveX: 0, moveY: 0,
    jump: emptyButton(), dash: emptyButton(), attack1: emptyButton(), attack2: emptyButton(),
    ability1: emptyButton(), ability2: emptyButton(), heal: emptyButton(), interact: emptyButton(),
    restart: emptyButton(), pause: emptyButton(),
  };
}
