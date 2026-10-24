// Touch input model (07 §8.6): pure TypeScript, no DOM. Pointers in, `down`/`up` events out, in the same
// vocabulary the keyboard and gamepad give the 01 §1.2 latch. The overlay and tests drive it.
import type { ButtonId } from '../../core/input.ts';
import type { TouchSettings } from '../../core/save/schema.ts';
import { defaultTouchSettings, TOUCH as T } from '../../data/touch.ts';

export type DirId = 'left' | 'right' | 'up' | 'down';
export type TouchActionId = ButtonId | DirId;
export type TouchButtonId = (typeof T.buttonIds)[number];

export interface TouchSink { down(id: TouchActionId): void; up(id: TouchActionId): void }
export { defaultTouchSettings };
export interface Safe { l: number; r: number; t: number; b: number }
export interface ButtonRect { id: TouchButtonId; cx: number; cy: number; r: number }

/** `u` in CSS px (07 §8.6). */
export const unitOf = (w: number, h: number, sizePct: number): number =>
  Math.min(T.uMax, Math.max(T.uMin, Math.min(w, h) / T.uDiv)) * (sizePct / 100);

/** Button circles for a screen (CSS px). Interact is left out while there is no interact target. */
export function buttonRects(w: number, h: number, s: TouchSettings, interact: boolean, safe: Safe): ButtonRect[] {
  const u = unitOf(w, h, s.size), out: ButtonRect[] = [];
  for (const def of T.buttons) {
    if (def.id === 'interact' && !interact) continue;
    const saved = s.layout[def.id], scale = saved?.scale ?? 1, r = (def.d * u * scale) / 2;
    let cx: number, cy: number;
    if (saved) { cx = saved.x * w; cy = saved.y * h; }
    else {
      const fromSide = def.right * u;
      cx = s.leftHanded ? safe.l + fromSide : w - safe.r - fromSide;
      cy = def.top ? safe.t + def.bottom * u : h - safe.b - def.bottom * u;
    }
    out.push({ id: def.id, cx, cy, r });
  }
  return out;
}

type Role = { kind: 'button'; id: TouchButtonId } | { kind: 'stick' };

export class TouchModel {
  settings: TouchSettings = defaultTouchSettings();
  safe: Safe = { l: 0, r: 0, t: 0, b: 0 };
  w = 640; h = 360;
  private sink: TouchSink | null = null;
  private interact = false;
  private readonly pointers = new Map<number, Role>();
  private readonly buttonRefs = new Map<TouchButtonId, number>();
  private readonly dirs: Record<DirId, boolean> = { left: false, right: false, up: false, down: false };
  private pauseSince: number | null = null;
  /** The stick, while a finger holds it: center, knob (clamped to r) and radius, for drawing. */
  stick: { cx: number; cy: number; kx: number; ky: number; r: number } | null = null;

  attach(sink: TouchSink | null): void { this.releaseAll(); this.sink = sink; }
  setScreen(w: number, h: number): void { this.w = w; this.h = h; }
  setSettings(s: TouchSettings): void { this.settings = s; }
  setSafe(s: Safe): void { this.safe = s; }
  setInteract(on: boolean): void { this.interact = on; }
  get interactVisible(): boolean { return this.interact; }
  rects(): ButtonRect[] { return buttonRects(this.w, this.h, this.settings, this.interact, this.safe); }
  /** Which buttons are held right now, for the pressed look. */
  isHeld(id: TouchButtonId): boolean { return (this.buttonRefs.get(id) ?? 0) > 0; }

  /** `u` for the current screen and Button size. */
  unit(): number { return unitOf(this.w, this.h, this.settings.size); }
  private stickZone(x: number): boolean { return this.settings.leftHanded ? x >= this.w * (1 - T.stickZone) : x <= this.w * T.stickZone; }

  /** The button under a point: inside the circle grown by 0.15u; the nearest center wins. */
  private hit(x: number, y: number): TouchButtonId | null {
    const grow = T.hitGrow * this.unit();
    let best: TouchButtonId | null = null, bestD = Infinity;
    for (const b of this.rects()) {
      const d = Math.hypot(x - b.cx, y - b.cy);
      if (d <= b.r + grow && d < bestD) { best = b.id; bestD = d; }
    }
    return best;
  }

  pointerDown(id: number, x: number, y: number, now: number): void {
    if (this.pointers.has(id)) return;
    const b = this.hit(x, y);
    if (b) { this.pointers.set(id, { kind: 'button', id: b }); this.press(b, now); return; }
    if (!this.stick && this.stickZone(x)) {
      this.pointers.set(id, { kind: 'stick' });
      this.stick = { cx: x, cy: y, kx: x, ky: y, r: T.stickRadius * this.unit() };
    }
  }

  pointerMove(id: number, x: number, y: number): void {
    const role = this.pointers.get(id);
    if (!role || role.kind !== 'stick' || !this.stick) return;
    const s = this.stick, dx = x - s.cx, dy = y - s.cy, len = Math.hypot(dx, dy), k = len > s.r ? s.r / len : 1;
    s.kx = s.cx + dx * k; s.ky = s.cy + dy * k;
    this.setDir('left', dx <= -T.stickX * s.r); this.setDir('right', dx >= T.stickX * s.r);
    this.setDir('up', dy <= -T.stickY * s.r); this.setDir('down', dy >= T.stickY * s.r);
  }

  pointerUp(id: number, _x: number, _y: number, now: number): void {
    const role = this.pointers.get(id);
    if (!role) return;
    this.pointers.delete(id);
    if (role.kind === 'stick') this.endStick(); else this.release(role.id, now);
  }
  pointerCancel(id: number, now: number): void { this.pointerUp(id, 0, 0, now); }

  releaseAll(): void {
    for (const role of [...this.pointers.values()]) if (role.kind === 'stick') this.endStick();
    for (const [id, n] of [...this.buttonRefs]) if (n > 0) { this.buttonRefs.set(id, 0); this.emitUp(id, 0, true); }
    this.pointers.clear(); this.buttonRefs.clear(); this.pauseSince = null;
  }

  /** 0..1 progress of the Pause hold toward the restart (the ring), 0 when not held. */
  pauseHold(now: number): number { return this.pauseSince === null ? 0 : Math.min(1, (now - this.pauseSince) / T.restartHoldMs); }

  private setDir(d: DirId, on: boolean): void {
    if (this.dirs[d] === on) return;
    this.dirs[d] = on; if (on) this.sink?.down(d); else this.sink?.up(d);
  }
  private endStick(): void {
    for (const d of ['left', 'right', 'up', 'down'] as DirId[]) this.setDir(d, false);
    this.stick = null;
  }
  private press(id: TouchButtonId, now: number): void {
    const n = (this.buttonRefs.get(id) ?? 0) + 1; this.buttonRefs.set(id, n);
    if (n > 1) return;
    if (id === 'pause') { this.pauseSince = now; this.sink?.down('restart'); } else this.sink?.down(id);
  }
  private release(id: TouchButtonId, now: number): void {
    const n = (this.buttonRefs.get(id) ?? 1) - 1; this.buttonRefs.set(id, Math.max(0, n));
    if (n > 0) return;
    this.emitUp(id, now, false);
  }
  /** Pause: a tap (under 0.5 s) is a pause press; a hold only ends the restart. */
  private emitUp(id: TouchButtonId, now: number, cancelled: boolean): void {
    if (id !== 'pause') { this.sink?.up(id); return; }
    const held = this.pauseSince === null ? Infinity : now - this.pauseSince;
    this.pauseSince = null;
    this.sink?.up('restart');
    if (!cancelled && held < T.restartHoldMs) { this.sink?.down('pause'); this.sink?.up('pause'); }
  }
}
