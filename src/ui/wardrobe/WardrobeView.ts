// The wardrobe popup (09 §6): live 3× preview, four tabs, Random / Undo / Confirm. Keyboard, gamepad and taps.
import Phaser from 'phaser';
import type { EnemyId } from '../../core/enemies/types.ts';
import { TRIM_TINT } from '../../data/art.ts';
import { OUTFIT_ATLAS, type CosmeticId, type Look } from '../../data/cosmetics.ts';
import { UI_COLOR } from '../../data/uiText.ts';
import { WARDROBE_UI as W } from '../../data/wardrobeUi.ts';
import type { AnimDef } from '../../game/view/animClock.ts';
import { LookRig } from '../../game/view/LookRig.ts';
import type { HomePanelAction } from '../home/homePanels.ts';
import { menuGlyphs } from '../inputSettings.ts';
import { MenuSurface } from '../screens/records.ts';
import { collectionCount, collectionEntries } from './collection.ts';
import { drawCollectionGrid } from './collectionView.ts';
import { FOOTER, PREVIEW_ANIMS, ROW_LABEL, TAB_LABEL, WARDROBE_TABS, WardrobeModel, type PreviewAnim } from './wardrobeModel.ts';

export interface WardrobeCallbacks {
  /** Show the draft look on the world player too (or `null` to go back to the saved look). */
  onPreview(look: Look | null): void;
  onConfirm(look: Look): void;
  onClose(): void;
  /** Which trim color the preview wears (the equipped kit's class, or neutral). */
  trim: number;
}

/** The anim each preview button plays (the greatsword swing for the attack). */
const PREVIEW_KEYS: Record<PreviewAnim, string> = { idle: 'idle', run: 'run', jump: 'jump', attack: 'atk_greatsword_1' };

export class WardrobeView extends MenuSurface {
  readonly model: WardrobeModel;
  private readonly cb: WardrobeCallbacks;
  private readonly owned: readonly CosmeticId[];
  private readonly seen: readonly EnemyId[];
  private readonly rig: LookRig;
  private readonly anims: AnimDef[];
  private time = 0;
  constructor(scene: Phaser.Scene, look: Look, owned: readonly CosmeticId[], seen: readonly EnemyId[], intro: boolean, cb: WardrobeCallbacks) {
    super(scene);
    this.model = new WardrobeModel(look, owned, { intro }); this.cb = cb; this.owned = owned; this.seen = seen;
    this.rig = new LookRig(scene, W.preview.depth, { screen: true, scale: W.preview.scale });
    this.anims = (scene.cache.json.get('anims') ?? []) as AnimDef[];
    this.cb.onPreview(this.model.look);
    this.render(); this.animate();
  }

  private sync(): void { this.cb.onPreview(this.model.look); this.render(); }
  action(action: HomePanelAction): void {
    if (!this.enabled || this.closed) return;
    const r = this.model.action(action);
    if (r?.type === 'confirm') { this.destroy(); this.cb.onConfirm(r.look); this.cb.onClose(); return; }
    if (r?.type === 'close') { this.destroy(); this.cb.onPreview(null); this.cb.onClose(); return; }
    this.sync();
  }
  /** A tap changes an option: apply it, then show the new look on the world player too. */
  private change(fn: () => void): () => void { return () => { fn(); this.cb.onPreview(this.model.look); }; }

  update(seconds: number, pad?: Parameters<MenuSurface['update']>[1]): void {
    super.update(seconds, pad);
    if (this.closed) return;
    this.time += seconds; this.animate();
  }

  private animate(): void {
    const m = this.model, l = m.look, P = W.preview, key = PREVIEW_KEYS[m.anim], atlas = `player_${OUTFIT_ATLAS[l.outfit]}`;
    const def = this.anims.find((a) => a.atlas === atlas && a.key === key) ?? this.anims.find((a) => a.atlas === atlas && a.key === 'idle');
    const n = def?.frames.length ?? 1, i = Math.floor(this.time * (def?.fps ?? P.fps)) % n;
    this.rig.draw(l, { x: P.x, y: P.y, flip: false, alpha: 1, frame: def?.frames[i] ?? 'idle_00', anim: def?.key ?? 'idle', points: def?.points?.[i], trims: [this.cb.trim, this.cb.trim], t: this.time });
  }

  protected render(): void {
    const m = this.model, glyph = menuGlyphs(), entries = collectionEntries(this.owned, this.seen);
    if (!this.beginDraw([m.tab, m.zone, m.row, m.cell, m.anim, m.footer, m.look, this.owned.length, glyph])) return;
    this.panel(W.panel, W.panelFrame);
    this.text(W.preview.x, W.titleY, m.intro ? W.introTitle : W.title, UI_COLOR.text, true);
    const T = W.tabs;
    WARDROBE_TABS.forEach((t, i) => {
      const x = T.x + i * T.w, sel = m.tab === t, focus = m.zone === 'tabs' && sel;
      this.rect(x, T.y, T.w, T.h, focus, sel ? UI_COLOR.ink : UI_COLOR.panel);
      if (this.scene.textures.get('ui').has(T.icons[i])) this.c.add(this.scene.add.image(x + T.w / 2, T.y + T.iconY, 'ui', T.icons[i]).setOrigin(0.5, 0).setAlpha(sel ? 1 : 0.6));
      this.text(x + T.w / 2, T.y + T.labelY, TAB_LABEL[t], sel ? UI_COLOR.highlight : UI_COLOR.textDim);
      this.target(x, T.y, T.w, T.h, () => { m.zone = 'tabs'; }, () => { m.setTab(t); m.zone = 'rows'; });
    });
    if (m.tab === 'collection') this.renderCollection(entries); else this.renderRows();
    // Preview animation buttons (09 §6).
    const B = W.animButtons;
    PREVIEW_ANIMS.forEach((a, i) => {
      const x = B.x + i * (B.w + B.gap), sel = m.anim === a;
      this.rect(x, B.y, B.w, B.h, m.zone === 'anim' && sel, sel ? UI_COLOR.ink : UI_COLOR.panel);
      this.text(x + B.w / 2, B.y + 4, a[0].toUpperCase() + a.slice(1), sel ? UI_COLOR.highlight : UI_COLOR.textDim);
      this.target(x, B.y, B.w, B.h, () => { m.zone = 'anim'; }, () => { m.anim = a; });
    });
    this.text(W.preview.x, W.preview.labelY, `Trim: ${this.cb.trim === TRIM_TINT.none ? 'Neutral' : 'your class'}`, UI_COLOR.textDim);
    // Footer buttons.
    const F = W.buttons;
    FOOTER.forEach((label, i) => {
      const x = F.xs[i], focus = m.zone === 'footer' && m.footer === i, dis = i === 1 && !m.changed;
      this.rect(x, F.y, F.w, F.h, focus);
      this.text(x + F.w / 2, F.y + 5, label, dis ? UI_COLOR.textOff : focus ? UI_COLOR.highlight : UI_COLOR.text);
      this.target(x, F.y, F.w, F.h, () => { m.zone = 'footer'; m.footer = i; }, () => { this.action('confirm'); });
    });
    this.hint(W.rows.x + 140, W.hintY, ['←→ Change   ↑↓ Move   ', { menu: 'confirm' }, ' Select   ', { menu: 'back' }, ' Cancel']);
  }

  private renderRows(): void {
    const m = this.model, R = W.rows;
    m.rows.forEach((row, i) => {
      const y = R.y + i * R.h, sel = m.zone === 'rows' && m.row === i, o = m.current(row), vx = R.x + R.labelW;
      this.rect(R.x, y, R.labelW + R.valueW, R.h - 4, sel);
      this.text(R.x + 6, y + 6, ROW_LABEL[row], sel ? UI_COLOR.highlight : UI_COLOR.textDim, false, 'left');
      this.text(vx + 12, y + 6, '<', UI_COLOR.text); this.text(vx + R.valueW - 12, y + 6, '>', UI_COLOR.text);
      if (o.hex !== undefined) { const g = this.scene.add.graphics(); g.fillStyle(o.hex, 1).fillRect(vx + 24, y + 6, R.swatch, R.swatch); this.c.add(g); }
      this.text(vx + R.valueW / 2 + (o.hex !== undefined ? 8 : 0), y + 6, o.name, UI_COLOR.text).setMaxWidth(R.valueW - 56);
      const focus = () => { m.zone = 'rows'; m.row = i; };
      const pick = (dir: 1 | -1) => this.change(() => { focus(); m.cycle(row, dir); });
      const arrow = R.arrowW + 4;
      this.target(R.x, y, R.labelW, R.h - 4, focus, () => {});
      this.target(vx, y, arrow, R.h - 4, focus, pick(-1));
      this.target(vx + arrow, y, R.valueW - 2 * arrow, R.h - 4, focus, pick(1));
      this.target(vx + R.valueW - arrow, y, arrow, R.h - 4, focus, pick(1));
    });
  }

  private renderCollection(entries: ReturnType<typeof collectionEntries>): void {
    const m = this.model, G = W.grid, sel = m.zone === 'rows' ? m.cell : null;
    const cells = drawCollectionGrid(this.scene, this.c, entries, G, sel);
    for (const c of cells) this.target(c.x, c.y, c.w, c.h, () => { m.zone = 'rows'; m.cell = c.i; }, () => {});
    const e = entries[m.cell];
    this.text(G.x + 140, G.nameY, e.name, e.owned ? UI_COLOR.text : UI_COLOR.textDim);
    this.text(G.x + 140, G.hintY, e.hint, UI_COLOR.textDim).setMaxWidth(270);
    this.text(G.x + 140, G.countY, collectionCount(this.owned), UI_COLOR.highlight, true);
  }

  destroy(): void {
    if (this.closed) return;
    super.destroy(); this.cb.onPreview(null);
    this.rig.destroy();
  }
}
