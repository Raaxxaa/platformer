// Runs the player's movement on a level, tick by tick. Used by the game scene, tests and replays.
import { emptyInput, type ButtonState, type InputState } from '../input.ts';
import type { TileGrid } from '../level/tiles.ts';
import { isGrounded } from '../physics/collide.ts';
import { createPlayerBody, type MoveEvent, type PlayerBody } from '../player/body.ts';
import { defaultModifiers, type MoveContext, type MoveModifiers } from '../player/modifiers.ts';
import { stepPlayer } from '../player/movement.ts';
import { createCamera, snapCamera, stepCamera, type CameraState } from '../camera.ts';

/** Held inputs for one tick, the easy way (tests, debug API). */
export interface InputSpec {
  moveX?: -1 | 0 | 1;
  moveY?: -1 | 0 | 1;
  jump?: boolean;
  dash?: boolean;
  attack1?: boolean;
  attack2?: boolean;
}

function button(before: boolean | undefined, now: boolean | undefined): ButtonState {
  const was = before === true, is = now === true;
  return { held: is, pressed: is && !was, released: was && !is };
}

/** Builds an InputState from two held-specs: pressed = held now and not before; released = the reverse. */
export function specToInput(prev: InputSpec, next: InputSpec): InputState {
  const s = emptyInput();
  s.moveX = next.moveX ?? 0;
  s.moveY = next.moveY ?? 0;
  s.jump = button(prev.jump, next.jump);
  s.dash = button(prev.dash, next.dash);
  s.attack1 = button(prev.attack1, next.attack1);
  s.attack2 = button(prev.attack2, next.attack2);
  return s;
}

export class PlayerSim {
  readonly grid: TileGrid;
  body: PlayerBody;
  mods: MoveModifiers = defaultModifiers();
  ctx: MoveContext = { slotUsable: [true, true] };   // M1 has no weapons; dive slam needs a usable slot
  camera: CameraState;
  tick = 0;
  private prevSpec: InputSpec = {};

  constructor(g: TileGrid, spawn: { x: number; y: number }) {
    this.grid = g;
    this.body = PlayerSim.freshBody(g, spawn);
    this.camera = createCamera({ x: 0, y: 0, w: g.widthPx, h: g.heightPx }, this.body);
  }

  private static freshBody(g: TileGrid, spawn: { x: number; y: number }): PlayerBody {
    const body = createPlayerBody(spawn.x, spawn.y);
    if (!isGrounded(body, g, 0)) {
      body.state = 'air';
      body.grounded = false;
    }
    return body;
  }

  /** A fresh player body at `spawn` (feet position) with the camera snapped to it. */
  respawn(spawn: { x: number; y: number }): void {
    this.body = PlayerSim.freshBody(this.grid, spawn);
    this.prevSpec = {};
    snapCamera(this.camera, this.body);
  }

  step(input: InputState): MoveEvent[] {
    this.tick += 1;
    const events = stepPlayer(this.body, input, this.grid, this.mods, this.ctx);
    stepCamera(this.camera, this.body);
    return events;
  }

  /** Runs `n` ticks holding `spec`; buttons count as pressed only on the first tick (relative to the previous spec). */
  stepSpec(spec: InputSpec, n = 1): MoveEvent[] {
    const events: MoveEvent[] = [];
    for (let i = 0; i < n; i++) {
      const input = specToInput(this.prevSpec, spec);
      this.prevSpec = spec;
      events.push(...this.step(input));
    }
    return events;
  }
}
