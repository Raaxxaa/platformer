// The HUD layout editor (07 §4.1a): pick a group, place it with a preset, 4 px nudges or a drag; Reset; overlap check.
import type Phaser from 'phaser';
import { HUD_GROUPS, HUD_LAYOUT as L, type HudGroupId } from '../../data/hudLayout.ts';
import { UI_COLOR } from '../../data/uiText.ts';
import type { HomePanelAction } from '../home/homePanels.ts';
import { boxOf, clampToScreen, defaultHud, nudge, presetPlace, problems, type HudLayout, type SavedHud } from '../model/hudLayout.ts';
import { MenuSurface } from './records.ts';

const NAME: Record<HudGroupId, string> = { vitals: 'Health', slots: 'Weapons', timer: 'Timer' };

/** Pure state of the editor: the draft layout and the picked group. */
export class HudEditorModel {
  layout: HudLayout;
  group: HudGroupId = 'slots';
  private readonly touch: boolean;
  constructor(start: HudLayout, touch: boolean) { this.layout = structuredClone(start); this.touch = touch; }
  get problems(): HudGroupId[] { return problems(this.layout); }
  pick(g: HudGroupId): void { this.group = g; }
  next(): void { this.group = HUD_GROUPS[(HUD_GROUPS.indexOf(this.group) + 1) % HUD_GROUPS.length]; }
  preset(i: number): void { this.layout = { ...this.layout, [this.group]: presetPlace(this.group, i) }; }
  reset(): void { this.layout = defaultHud(this.touch); }
  move(dx: number, dy: number): void { this.layout = nudge(this.layout, this.group, dx, dy); }
  place(x: number, y: number): void { this.layout = { ...this.layout, [this.group]: clampToScreen(this.group, { x, y }) }; }
  /** What to save: only groups away from the device default (so a later default change still reaches them). */
  saved(): SavedHud {
    const d = defaultHud(this.touch), out: SavedHud = {};
    for (const g of HUD_GROUPS) if (d[g].x !== this.layout[g].x || d[g].y !== this.layout[g].y) out[g] = { ...this.layout[g] };
    return out;
  }
  /** Confirm is refused while groups overlap. */
  action(a: HomePanelAction): 'save' | 'cancel' | null {
    if (a === 'back') return 'cancel';
    if (a === 'confirm') return this.problems.length ? null : 'save';
    if (a === 'left') this.move(-1, 0); if (a === 'right') this.move(1, 0); if (a === 'up') this.move(0, -1); if (a === 'down') this.move(0, 1);
    return null;
  }
}

export class HudEditorView extends MenuSurface {
  readonly model: HudEditorModel;
  private readonly onDone: (saved: SavedHud | null, layout: HudLayout | null) => void;
  private readonly onPreview: (layout: HudLayout) => void;
  private drag: { dx: number; dy: number } | null = null;
  constructor(scene: Phaser.Scene, start: HudLayout, touch: boolean, onPreview: (l: HudLayout) => void, onDone: (saved: SavedHud | null, layout: HudLayout | null) => void) {
    super(scene); this.model = new HudEditorModel(start, touch); this.onPreview = onPreview; this.onDone = onDone;
    scene.input.on('pointermove', this.pointerMove); scene.input.on('pointerup', this.pointerUp);
    this.render();
  }
  private readonly pointerMove = (p: Phaser.Input.Pointer) => {
    if (!this.drag || this.closed) return;
    this.model.place(p.x - this.drag.dx, p.y - this.drag.dy); this.onPreview(this.model.layout); this.render();
  };
  private readonly pointerUp = () => { this.drag = null; };
  protected override allowKey(e: KeyboardEvent): boolean {
    const m = this.model;
    if (e.code === 'Tab') { e.preventDefault(); if (!e.repeat) { m.next(); this.render(); } return false; }
    const n = /^Digit([1-5])$/.exec(e.code); if (n) { m.preset(Number(n[1]) - 1); this.onPreview(m.layout); this.render(); return false; }
    if (e.code === 'KeyR') { m.reset(); this.onPreview(m.layout); this.render(); return false; }
    return true;
  }
  action(a: HomePanelAction): void {
    if (!this.enabled || this.closed) return;
    const r = this.model.action(a);
    if (r === 'save') { const s = this.model.saved(), l = this.model.layout; this.destroy(); this.onDone(s, l); return; }
    if (r === 'cancel') { this.destroy(); this.onDone(null, null); return; }
    this.onPreview(this.model.layout); this.render();
  }
  destroy(): void {
    if (this.closed) return;
    this.scene.input.off('pointermove', this.pointerMove); this.scene.input.off('pointerup', this.pointerUp);
    super.destroy();
  }
  protected render(): void {
    const m = this.model, bad = m.problems;
    if (!this.beginDraw([m.layout, m.group, bad])) return;
    const E = L.editor, g = this.scene.add.graphics(); this.c.add(g);
    const z = L.bossZone; g.lineStyle(1, UI_COLOR.textOff, 1).strokeRect(z.x + 0.5, z.y + 0.5, z.w - 1, z.h - 1);
    this.text(z.x + z.w / 2, z.y + 14, 'Boss bar', UI_COLOR.textOff);
    for (const id of HUD_GROUPS) {
      const b = boxOf(id, m.layout[id]), sel = id === m.group;
      g.lineStyle(sel ? 2 : 1, bad.includes(id) ? UI_COLOR.bad : sel ? UI_COLOR.highlight : UI_COLOR.text, 1).strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
      this.text(b.x + b.w / 2, b.y + b.h / 2 - 4, NAME[id], sel ? UI_COLOR.highlight : UI_COLOR.text);
      const area = this.scene.add.rectangle(b.x, b.y, b.w, b.h).setOrigin(0).setScrollFactor(0).setInteractive({ useHandCursor: true });
      area.on('pointerdown', (p: Phaser.Input.Pointer) => { m.pick(id); this.drag = { dx: p.x - m.layout[id].x, dy: p.y - m.layout[id].y }; this.render(); });
      this.c.add(area);
    }
    // The toolbar: groups, presets, Reset / Done / Cancel (taps work too).
    const row = (y: number, items: { label: string; on: boolean; go: () => void }[]) => {
      const total = items.length * (E.buttonW + E.gap) - E.gap; let x = (L.screen.w - total) / 2;
      for (const it of items) {
        this.rect(x, y, E.buttonW, E.buttonH, it.on); this.text(x + E.buttonW / 2, y + 4, it.label, it.on ? UI_COLOR.highlight : UI_COLOR.text);
        this.target(x, y, E.buttonW, E.buttonH, () => {}, () => { it.go(); this.onPreview(m.layout); }); x += E.buttonW + E.gap;
      }
    };
    row(E.toolbarY, HUD_GROUPS.map((id) => ({ label: NAME[id], on: id === m.group, go: () => m.pick(id) })));
    row(E.toolbarY + E.buttonH + E.gap, L.presets.map((label, i) => ({ label, on: false, go: () => m.preset(i) })));
    row(E.toolbarY + 2 * (E.buttonH + E.gap), [{ label: 'Reset', on: false, go: () => m.reset() }, { label: 'Done', on: !bad.length, go: () => this.action('confirm') }, { label: 'Cancel', on: false, go: () => this.action('back') }]);
    this.text(L.screen.w / 2, E.toolbarY - 14, bad.length ? 'Groups overlap — move them apart' : '←↑↓→ Move   Tab Group   1-5 Presets   R Reset', bad.length ? UI_COLOR.bad : UI_COLOR.textDim);
  }
}
