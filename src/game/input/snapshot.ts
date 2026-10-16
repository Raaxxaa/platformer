// Builds one InputState per tick from device events (01 §1.2). Pure TypeScript, no Phaser.
import { BUTTON_IDS, type ButtonId, type ButtonState, type InputState } from '../../core/input.ts';
import { INPUT } from '../../core/tuning.ts';

export type { ButtonId };
export type DirId = 'left' | 'right' | 'up' | 'down';
export type Source = 'kb' | 'pad';

/** Directions also have the left stick as a source. */
type DirSource = Source | 'stick';

const DIR_IDS: readonly DirId[] = ['left', 'right', 'up', 'down'];

interface ButtonTrack { kb: boolean; pad: boolean; pressed: boolean; released: boolean }
interface DirTrack { kb: boolean; pad: boolean; stick: boolean; stamp: number }

function isDir(id: ButtonId | DirId): id is DirId {
  return (DIR_IDS as readonly string[]).includes(id);
}

export class SnapshotBuilder {
  private readonly buttons = new Map<ButtonId, ButtonTrack>();
  private readonly dirs = new Map<DirId, DirTrack>();
  private pressCounter = 0;

  constructor() {
    for (const id of BUTTON_IDS) this.buttons.set(id, { kb: false, pad: false, pressed: false, released: false });
    for (const id of DIR_IDS) this.dirs.set(id, { kb: false, pad: false, stick: false, stamp: 0 });
  }

  down(id: ButtonId | DirId, src: Source): void {
    if (isDir(id)) { this.setDir(id, src, true); return; }
    const b = this.buttons.get(id)!;
    if (!b.kb && !b.pad) b.pressed = true;
    b[src] = true;
  }

  up(id: ButtonId | DirId, src: Source): void {
    if (isDir(id)) { this.setDir(id, src, false); return; }
    const b = this.buttons.get(id)!;
    const wasHeld = b.kb || b.pad;
    b[src] = false;
    if (wasHeld && !b.kb && !b.pad) b.released = true;
  }

  /** Left stick position; crossing a threshold counts as pressing or releasing that direction. */
  setStick(x: number, y: number): void {
    this.setDir('left', 'stick', x <= -INPUT.STICK_X);
    this.setDir('right', 'stick', x >= INPUT.STICK_X);
    this.setDir('up', 'stick', y <= -INPUT.STICK_Y);
    this.setDir('down', 'stick', y >= INPUT.STICK_Y);
  }

  /** Lets go of everything, e.g. when the window loses focus. */
  releaseAll(): void {
    for (const b of this.buttons.values()) {
      if (b.kb || b.pad) b.released = true;
      b.kb = false; b.pad = false;
    }
    for (const d of this.dirs.values()) { d.kb = false; d.pad = false; d.stick = false; }
  }

  /** This tick's snapshot; clears the latched pressed/released flags. */
  build(): InputState {
    const out = {
      moveX: this.axis('left', 'right'),
      moveY: this.axis('up', 'down'),
    } as InputState;
    for (const id of BUTTON_IDS) {
      const b = this.buttons.get(id)!;
      const state: ButtonState = { held: b.kb || b.pad, pressed: b.pressed, released: b.released };
      out[id] = state;
      b.pressed = false; b.released = false;
    }
    return out;
  }

  private setDir(id: DirId, src: DirSource, on: boolean): void {
    const d = this.dirs.get(id)!;
    const wasHeld = d.kb || d.pad || d.stick;
    d[src] = on;
    if (on && !wasHeld) d.stamp = ++this.pressCounter;
  }

  /** Most recently pressed of two opposite directions wins (01 §1.2 step 3). */
  private axis(neg: DirId, pos: DirId): -1 | 0 | 1 {
    const n = this.dirs.get(neg)!;
    const p = this.dirs.get(pos)!;
    const nHeld = n.kb || n.pad || n.stick;
    const pHeld = p.kb || p.pad || p.stick;
    if (nHeld && pHeld) return p.stamp > n.stamp ? 1 : -1;
    if (pHeld) return 1;
    if (nHeld) return -1;
    return 0;
  }
}
