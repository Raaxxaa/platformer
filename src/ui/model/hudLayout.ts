// HUD groups and their placement (07 §4.1a), pure. A layout is each group's top-left; parts keep their inner arrangement.
import { HUD_GROUPS, HUD_LAYOUT as L, type Box, type HudGroupId } from '../../data/hudLayout.ts';

export type HudLayout = Record<HudGroupId, { x: number; y: number }>;
export type SavedHud = Partial<Record<HudGroupId, { x: number; y: number }>>;

export function defaultHud(touch: boolean): HudLayout {
  return { vitals: { ...L.defaults.vitals }, slots: { ...L.defaults.slots }, timer: { ...(touch ? L.touchTimer : L.defaults.timer) } };
}
/** The saved places over the device's defaults (missing = default). */
export function resolveHud(saved: SavedHud | undefined, touch: boolean): HudLayout {
  const out = defaultHud(touch);
  for (const g of HUD_GROUPS) { const p = saved?.[g]; if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) out[g] = clampToScreen(g, p); }
  return out;
}
export const boxOf = (g: HudGroupId, p: { x: number; y: number }): Box => ({ x: p.x, y: p.y, w: L.home[g].w, h: L.home[g].h });
export const offsetOf = (g: HudGroupId, p: { x: number; y: number }) => ({ dx: p.x - L.home[g].x, dy: p.y - L.home[g].y });
const hits = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export function clampToScreen(g: HudGroupId, p: { x: number; y: number }): { x: number; y: number } {
  const { w, h } = L.home[g], m = L.margin;
  return { x: Math.max(m, Math.min(L.screen.w - m - w, Math.round(p.x))), y: Math.max(m, Math.min(L.screen.h - m - h, Math.round(p.y))) };
}
/** The groups in trouble: overlapping another group or the boss bar's zone. Empty = the layout can be confirmed. */
export function problems(layout: HudLayout): HudGroupId[] {
  const bad = new Set<HudGroupId>();
  for (const a of HUD_GROUPS) {
    if (hits(boxOf(a, layout[a]), L.bossZone)) bad.add(a);
    for (const b of HUD_GROUPS) if (a < b && hits(boxOf(a, layout[a]), boxOf(b, layout[b]))) { bad.add(a); bad.add(b); }
  }
  return HUD_GROUPS.filter((g) => bad.has(g));
}
/** A preset place for a group (07 §4.1a): 0 top-left, 1 top-center, 2 top-right, 3 bottom-left, 4 bottom-right. */
export function presetPlace(g: HudGroupId, preset: number): { x: number; y: number } {
  const { w, h } = L.home[g], m = L.margin, W = L.screen.w, H = L.screen.h;
  const x = [m, (W - w) / 2, W - m - w, m, W - m - w][preset], y = preset < 3 ? m : H - m - h;
  return clampToScreen(g, { x, y });
}
/** The editor's nudge: 4 px steps, kept on screen. */
export function nudge(layout: HudLayout, g: HudGroupId, dx: number, dy: number): HudLayout {
  return { ...layout, [g]: clampToScreen(g, { x: layout[g].x + dx * L.step, y: layout[g].y + dy * L.step }) };
}
