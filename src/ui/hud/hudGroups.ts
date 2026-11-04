// Moves whole HUD groups (07 §4.1a): every part is drawn by its own code at its §4.1 place, then shifted by the group's
// offset. A part its owner didn't move since the last shift keeps its remembered base, so offsets never pile up.
type Movable = { x: number; y: number };
const seen = new WeakMap<object, { bx: number; by: number; ax: number; ay: number }>();

export function shiftGroup(objs: readonly Movable[], dx: number, dy: number): void {
  for (const o of objs) {
    const s = seen.get(o);
    const fresh = !s || o.x !== s.ax || o.y !== s.ay;
    const bx = fresh ? o.x : s!.bx, by = fresh ? o.y : s!.by;
    o.x = bx + dx; o.y = by + dy;
    seen.set(o, { bx, by, ax: o.x, ay: o.y });
  }
}
