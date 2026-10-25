// Records and the shared menu surface (07 §7.1, §7.5). Models only read save snapshots.
import type Phaser from 'phaser';
import type { BondId, HybridId } from '../../core/abilities/types.ts';
import type { PbKey, SaveData } from '../../core/save/schema.ts';
import { formatTime } from '../../core/time.ts';
import { ABILITIES, ABILITY_INFO } from '../../data/abilities.ts';
import { FONTS, itemIcon } from '../../data/animKeys.ts';
import { BONDS, CLASS_IDS, CLASS_NAME, HYBRIDS } from '../../data/classes.ts';
import { MENU_UI as U } from '../../data/menuUi.ts';
import { BLUEPRINT_IDS, THIRD_START_WEAPON } from '../../data/save.ts';
import { CLASS_COLOR, HYBRID_COLOR, UI_COLOR, WEAPON_NAME } from '../../data/uiText.ts';
import { WEAPONS } from '../../data/weapons.ts';
import type { WeaponId } from '../../core/combat/types.ts';
import type { AbilityId } from '../../core/abilities/types.ts';
import { activeHomePad, HomePanelInput, type HomePanelAction, type HomePanelPad } from '../home/homePanels.ts';
import { menuGlyphs, noteInputDevice } from '../inputSettings.ts';
import { PromptGlyph, menuPrompt } from '../hud/abilityHud.ts';
import { PROMPT } from '../../data/prompts.ts';
import { COSMETIC_TOTAL } from '../../data/cosmetics.ts';
import { WARDROBE_UI as W } from '../../data/wardrobeUi.ts';
import { collectionCount, collectionEntries } from '../wardrobe/collection.ts';
import { drawCollectionGrid } from '../wardrobe/collectionView.ts';

/** Shared direct input, rendering primitives and cleanup for these three menu panels. */
export abstract class MenuSurface {
  protected readonly scene: Phaser.Scene;
  protected readonly input = new HomePanelInput('training');
  protected readonly c: Phaser.GameObjects.Container;
  private readonly dim: Phaser.GameObjects.Graphics;
  protected closed = false;
  protected enabled = true;
  private drawn = '';
  constructor(scene: Phaser.Scene) {
    this.scene = scene; this.input.blockHeldPad(activeHomePad());
    this.dim = scene.add.graphics().setScrollFactor(0).setDepth(U.dimDepth);
    this.dim.fillStyle(UI_COLOR.ink, U.dimAlpha).fillRect(0, 0, scene.scale.width, scene.scale.height);
    this.c = scene.add.container(0, 0).setScrollFactor(0).setDepth(U.depth);
    window.addEventListener('keydown', this.keyDown); window.addEventListener('keyup', this.keyUp); scene.events.once('shutdown', this.shutdown);
  }
  get active(): boolean { return !this.closed; }
  setEnabled(on: boolean): void { if (this.enabled === on) return; this.enabled = on; this.input.clear(); if (on) this.input.blockHeldPad(activeHomePad()); }
  protected allowKey(_event: KeyboardEvent): boolean { return true; }
  private readonly keyDown = (event: KeyboardEvent) => {
    if (this.enabled && !this.closed && this.allowKey(event) && this.input.key(event.code, true, event.repeat)) { noteInputDevice('keyboard'); event.preventDefault(); }
  };
  private readonly keyUp = (event: KeyboardEvent) => { this.input.key(event.code, false); };
  private readonly shutdown = () => this.destroy();
  update(seconds: number, pad: HomePanelPad | null = activeHomePad()): void {
    if (!this.enabled || this.closed) return;
    if (pad?.buttons.some((button) => button.pressed) || pad?.axes.some((axis) => Math.abs(axis) >= U.stick)) noteInputDevice('gamepad', (pad as HomePanelPad & { id?: string }).id);
    for (const action of this.input.poll(Math.min(U.frameClamp, Math.max(0, seconds)), pad)) this.action(action);
    this.render();
  }
  abstract action(action: HomePanelAction): void;
  protected abstract render(): void;
  destroy(): void {
    if (this.closed) return; this.closed = true; this.input.clear();
    window.removeEventListener('keydown', this.keyDown); window.removeEventListener('keyup', this.keyUp); this.scene.events.off('shutdown', this.shutdown);
    this.c.destroy(); this.dim.destroy();
  }
  protected beginDraw(key: unknown): boolean {
    if (this.closed) return false; const next = JSON.stringify(key); if (next === this.drawn) return false;
    this.drawn = next; this.c.removeAll(true); return true;
  }
  protected text(x: number, y: number, value: string, color: number = UI_COLOR.text, large = false, align: 'left' | 'center' | 'right' = 'center'): Phaser.GameObjects.BitmapText {
    const t = this.scene.add.bitmapText(x, y, large ? FONTS.large : FONTS.small, value).setTint(color).setOrigin(align === 'left' ? 0 : align === 'right' ? 1 : 0.5, 0); this.c.add(t); return t;
  }
  protected rect(x: number, y: number, w: number, h: number, selected = false, fill: number = UI_COLOR.panel): void {
    const g = this.scene.add.graphics(); g.fillStyle(fill, 1).fillRect(x, y, w, h);
    g.lineStyle(U.border, selected ? UI_COLOR.highlight : UI_COLOR.panelBorder, 1).strokeRect(x + U.border / 2, y + U.border / 2, w - U.border, h - U.border); this.c.add(g);
  }
  protected panel(bounds: readonly [number, number, number, number]): void {
    const [x, y, w, h] = bounds;
    if (this.scene.textures.exists('ui') && this.scene.textures.get('ui').has(U.panelFrame)) this.c.add(this.scene.add.nineslice(x, y, 'ui', U.panelFrame, w, h, U.corner, U.corner, U.corner, U.corner).setOrigin(0));
    else this.rect(x, y, w, h);
  }
  protected target(x: number, y: number, w: number, h: number, select: () => void, confirm: () => void): void {
    const area = this.scene.add.rectangle(x, y, w, h).setOrigin(0).setScrollFactor(0).setInteractive({ useHandCursor: true });
    area.on('pointerover', () => { if (this.enabled && !this.closed) { select(); this.render(); } });
    area.on('pointerdown', (pointer: Phaser.Input.Pointer) => { if (this.enabled && !this.closed && pointer.button === 0) { select(); confirm(); this.render(); } }); this.c.add(area);
  }
  protected hint(x: number, y: number, parts: readonly (string | { menu: 'confirm' | 'back' })[]): void {
    const pieces = parts.map((part) => {
      if (typeof part === 'string') {
        const text = this.scene.add.bitmapText(0, y, FONTS.small, part).setTint(UI_COLOR.textDim).setOrigin(0);
        return { width: text.width ?? part.length * PROMPT.charWidth, text };
      }
      const glyph = new PromptGlyph(this.scene, 0, y, menuPrompt(part.menu)); return { width: glyph.width, glyph };
    });
    let left = x - pieces.reduce((sum, piece) => sum + piece.width, 0) / 2;
    for (const piece of pieces) {
      if (piece.text) { piece.text.setPosition(left, y); this.c.add(piece.text); }
      if (piece.glyph) { piece.glyph.container.setPosition(left + piece.width / 2, y); this.c.add(piece.glyph.container); }
      left += piece.width;
    }
  }
}

export class RecordsModel {
  tab = 0;
  cell = 0;
  footer = false;
  /** The LOOKS tab's cursor (M13). */
  look = 0;
  private readonly getSave: () => SaveData;
  constructor(getSave: () => SaveData) { this.getSave = getSave; }
  get bestRows() { const save = this.getSave(); return CLASS_IDS.map((cls) => ({ cls, name: CLASS_NAME[cls], times: U.records.roads.map((road) => { const pb = save.pbs[`${cls}|${road}`]; return pb ? formatTime(pb.ticks) : '—'; }) })); }
  get selectedKey(): PbKey { return `${CLASS_IDS[Math.floor(this.cell / U.records.roads.length)]}|${U.records.roads[this.cell % U.records.roads.length]}`; }
  get selectedLabel(): string { return `${CLASS_NAME[CLASS_IDS[Math.floor(this.cell / U.records.roads.length)]]} · ${U.records.roadNames[this.cell % U.records.roads.length]}`; }
  get segments(): string[] { return (this.getSave().bestSegments[this.selectedKey] ?? [null, null, null, null]).map((ticks) => ticks === null ? '—' : formatTime(ticks)); }
  get classes() {
    const found = this.getSave().progress.classesDiscovered;
    return [...CLASS_IDS.map((cls) => ({ id: BONDS[cls].id as BondId | HybridId, name: BONDS[cls].name, color: CLASS_COLOR[cls] })),
      ...Object.values(HYBRIDS).map((hybrid) => ({ ...hybrid, color: HYBRID_COLOR[hybrid.id] }))]
      .map((entry) => ({ ...entry, discovered: found.includes(entry.id), name: found.includes(entry.id) ? entry.name : '???' }));
  }
  get unlocks() {
    const save = this.getSave(); return BLUEPRINT_IDS.map((id) => {
      const isWeapon = Object.hasOwn(WEAPONS, id) || !Object.hasOwn(ABILITY_INFO, id), unlocked = save.unlocks.blueprints.includes(id);
      return { id, kind: isWeapon ? 'weapon' as const : 'ability' as const, name: unlocked ? isWeapon ? WEAPON_NAME(id as WeaponId) : ABILITY_INFO[id as AbilityId].name : '???',
        unlocked, ready: isWeapon ? !!WEAPONS[id as WeaponId] : !!ABILITIES[id as AbilityId] };
    });
  }
  get looks() { const c = this.getSave().cosmetics; return { entries: collectionEntries(c.owned, c.seenEnemies), count: collectionCount(c.owned) }; }
  get starters(): string[] { const save = this.getSave(); return CLASS_IDS.map((cls) => {
    const id = THIRD_START_WEAPON[cls]; return save.unlocks.startWeapons[cls]?.includes(id) ? `${WEAPON_NAME(id)}${WEAPONS[id] ? '' : ` · ${U.records.notReady}`}` : `Beat the King as ${CLASS_NAME[cls]}`;
  }); }
  selectTab(index: number): void { const next = Math.max(0, Math.min(U.records.tabs.length - 1, index)); if (next !== this.tab) { this.tab = next; this.footer = next !== 0; } }
  selectCell(index: number): void { this.cell = Math.max(0, Math.min(CLASS_IDS.length * U.records.roads.length - 1, index)); this.footer = false; }
  action(action: HomePanelAction): 'close' | null {
    if (action === 'back' || action === 'confirm' && this.footer) return 'close';
    const looks = this.tab === 3 && !this.footer, total = COSMETIC_TOTAL;
    if (action === 'left') { if (looks && this.look > 0) this.look--; else this.selectTab(this.tab - 1); }
    if (action === 'right') { if (looks && this.look < total - 1) this.look++; else this.selectTab(this.tab + 1); }
    if (this.tab === 3) {
      if (action === 'up') { if (this.footer) this.footer = false; else if (this.look >= W.recordsGrid.cols) this.look -= W.recordsGrid.cols; }
      if (action === 'down' && !this.footer) { if (this.look + W.recordsGrid.cols < total) this.look += W.recordsGrid.cols; else this.footer = true; }
    }
    if (this.tab === 0) {
      if (action === 'up') { if (this.footer) this.footer = false; else this.selectCell(this.cell - 1); }
      if (action === 'down' && !this.footer) { if (this.cell === CLASS_IDS.length * U.records.roads.length - 1) this.footer = true; else this.selectCell(this.cell + 1); }
    }
    return null;
  }
}

export class RecordsView extends MenuSurface {
  readonly model: RecordsModel;
  private readonly callbacks: { onClose(): void };
  constructor(scene: Phaser.Scene, getSave: () => SaveData, callbacks: { onClose(): void }) { super(scene); this.model = new RecordsModel(getSave); this.callbacks = callbacks; this.render(); }
  action(action: HomePanelAction): void { if (!this.enabled || this.closed) return; if (this.model.action(action) === 'close') { this.destroy(); this.callbacks.onClose(); } else this.render(); }
  protected render(): void {
    const m = this.model, rows = m.bestRows, classes = m.classes, unlocks = m.unlocks, starters = m.starters;
    const glyph = menuGlyphs(); if (!this.beginDraw([m.tab, m.cell, m.footer, rows, m.segments, classes, unlocks, starters, m.tab === 3 ? [m.look, m.looks.entries] : 0, glyph])) return;
    const R = U.records; this.panel(R.panel);
    R.tabs.forEach((label, i) => {
      this.text(R.tabXs[i], R.tabsY, label, m.tab === i ? UI_COLOR.highlight : UI_COLOR.textDim);
      this.target(R.tabXs[i] - R.tabW / 2, R.tabsY, R.tabW, R.tabH, () => m.selectTab(i), () => {});
    });
    if (m.tab === 0) {
      R.roadNames.forEach((label, i) => this.text(R.roadXs[i], R.headingsY, label, UI_COLOR.textDim));
      rows.forEach((row, i) => {
        const y = R.rowsY + i * R.rowH; this.text(R.classX, y, row.name, CLASS_COLOR[row.cls], false, 'left');
        row.times.forEach((value, j) => {
          const cell = i * R.roads.length + j, selected = !m.footer && m.cell === cell, x = R.roadXs[j];
          this.text(x, y, `${selected ? '▸ ' : ''}${value}`, selected ? UI_COLOR.highlight : UI_COLOR.text);
          this.target(x - R.cellW / 2, y, R.cellW, R.rowH, () => m.selectCell(cell), () => {});
        });
      });
      this.text(this.scene.scale.width / 2, R.selectedY, `Best segments · ${m.selectedLabel}`, UI_COLOR.textDim);
      m.segments.forEach((value, i) => this.text(R.segmentXs[i], R.segmentsY, `${i + 1}: ${value}`, UI_COLOR.text));
      this.hint(this.scene.scale.width / 2, R.hintY, ['←→ Tabs   ↑↓ Select record   ', { menu: 'back' }, ' Back']);
    } else if (m.tab === 1) {
      classes.forEach((entry, i) => {
        const x = R.gridX + (i % R.gridCols) * R.gridW, y = R.gridY + Math.floor(i / R.gridCols) * R.gridH;
        this.rect(x, y, R.gridW, R.gridH); this.text(x + R.gridW / 2, y + U.cursorGap, entry.name, entry.discovered ? entry.color : UI_COLOR.textOff).setMaxWidth(R.gridW - U.cursorGap);
      });
    } else if (m.tab === 3) {
      const { entries, count } = m.looks, G = W.recordsGrid;
      drawCollectionGrid(this.scene, this.c, entries, G, m.look);
      for (const cell of entries.map((_, i) => ({ i, x: G.x + (i % G.cols) * G.cell, y: G.y + Math.floor(i / G.cols) * G.cell }))) this.target(cell.x, cell.y, G.cell, G.cell, () => { m.look = cell.i; }, () => {});
      const e = entries[m.look];
      this.text(this.scene.scale.width / 2, G.nameY, e.name, e.owned ? UI_COLOR.text : UI_COLOR.textDim);
      this.text(this.scene.scale.width / 2, G.hintY, e.hint, UI_COLOR.textDim);
      this.text(this.scene.scale.width / 2, R.hintY + 4, count, UI_COLOR.highlight, true);
    } else {
      unlocks.forEach((entry, i) => {
        const x = R.unlockX + (i % R.unlockCols) * R.unlockW, y = R.unlockY + Math.floor(i / R.unlockCols) * R.unlockH, frame = itemIcon(entry.kind, entry.id);
        if (this.scene.textures.exists('ui') && this.scene.textures.get('ui').has(frame)) this.c.add(this.scene.add.image(x, y, 'ui', frame).setOrigin(0).setTint(entry.unlocked ? UI_COLOR.text : UI_COLOR.ink));
        else this.rect(x, y, R.icon, R.icon, false, entry.unlocked ? UI_COLOR.textDim : UI_COLOR.ink);
        this.text(x + R.iconTextGap, y, entry.name, entry.unlocked ? UI_COLOR.text : UI_COLOR.textOff, false, 'left').setMaxWidth(R.unlockNameW);
        if (entry.unlocked && !entry.ready) this.text(x + R.iconTextGap, y + R.starterRowH, R.notReady, UI_COLOR.textDim, false, 'left');
      });
      starters.forEach((line, i) => this.text(R.starterX, R.startersY + i * R.starterRowH, line, UI_COLOR.textDim, false, 'left'));
    }
    this.rect(R.backX, R.backY, R.backW, R.backH, m.footer); this.text(R.backX + R.backW / 2, R.backY + U.border, `${m.footer ? '▸ ' : ''}Back`, m.footer ? UI_COLOR.highlight : UI_COLOR.text);
    this.target(R.backX, R.backY, R.backW, R.backH, () => { m.footer = true; }, () => this.action('confirm'));
  }
}
