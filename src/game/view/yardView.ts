// Training Yard view (06 §12.4): class statues, check flags, the checklist board and its panel, armory labels and
// the pit fade. Ground items (stands included) are drawn by ItemViews for every level.
import Phaser from 'phaser';
import type { GroundItem } from '../../core/abilities/items.ts';
import type { LevelData } from '../../core/level/loadLevel.ts';
import { TRAINING_RULES } from '../../core/run/training.ts';
import type { GameWorld } from '../../core/sim/gameWorld.ts';
import { ticks } from '../../core/tuning.ts';
import { FONTS, YARD_FRAMES, itemGlow, itemIcon } from '../../data/animKeys.ts';
import { DEPTH } from '../../data/art.ts';
import { YARD_UI } from '../../data/stageUi.ts';
import { CLASS_COLOR, UI_COLOR } from '../../data/uiText.ts';
import type { ClassId } from '../../core/abilities/types.ts';
import { checklistLines } from '../../ui/hud/checklist.ts';

const titleCase = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Weapon and ability items on the ground: icon over its glow, on a stand if it is an endless one. */
export class ItemViews {
  private views = new Map<GroundItem, Phaser.GameObjects.Image[]>();
  private scene: Phaser.Scene;
  constructor(scene: Phaser.Scene) { this.scene = scene; }

  update(items: readonly GroundItem[]): void {
    const live = new Set(items);
    for (const [it, imgs] of this.views) if (!live.has(it)) { for (const i of imgs) i.destroy(); this.views.delete(it); }
    for (const it of items) {
      let imgs = this.views.get(it);
      const kind = it.weapon ? 'weapon' : 'ability';
      const id = it.weapon?.weaponId ?? it.ability?.id;
      if (!id) continue;
      if (!imgs) {
        imgs = [];
        if (it.endless) imgs.push(this.scene.add.image(0, 0, 'objects', YARD_FRAMES.stand).setOrigin(0.5, 1).setDepth(DEPTH.items - 1));
        imgs.push(this.scene.add.image(0, 0, 'items', itemGlow(kind, id)).setDepth(DEPTH.items));
        imgs.push(this.scene.add.image(0, 0, 'ui', itemIcon(kind, id)).setDepth(DEPTH.items));
        this.views.set(it, imgs);
      }
      const stand = it.endless ? imgs[0] : null;
      const cy = it.y - (stand ? stand.height + YARD_UI.iconLift : 0) - 8;
      stand?.setPosition(it.x, it.y);
      for (const img of imgs) if (img !== stand) img.setPosition(it.x, cy);
    }
  }
}

export class YardView {
  private flags: { station: number; x: number; y: number }[] = [];
  private flagGfx: Phaser.GameObjects.Graphics;
  private boards: { x: number; y: number }[] = [];
  private panelBg: Phaser.GameObjects.Graphics;
  private panelText: Phaser.GameObjects.BitmapText;
  private fade: Phaser.GameObjects.Graphics;
  private statues = new Map<number, Phaser.GameObjects.Image>();

  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, level: LevelData) {
    this.scene = scene;
    for (const o of level.objects) {
      if (o.type === 'station_flag') this.flags.push({ station: Number(o.props.station), x: o.x, y: o.y });
      if (o.type === 'checklist_board') {
        this.boards.push({ x: o.x, y: o.y });
        scene.add.image(o.x, o.y, 'objects', YARD_FRAMES.board).setOrigin(0.5, 1).setDepth(DEPTH.items - 2);
      }
      if (o.type === 'armory_label') {
        const cls = String(o.props.cls) as ClassId;
        scene.add.bitmapText(o.x, o.y, FONTS.small, titleCase(cls)).setOrigin(0, 1).setTint(CLASS_COLOR[cls] ?? UI_COLOR.text).setDepth(DEPTH.items);
      }
    }
    this.flagGfx = scene.add.graphics().setDepth(DEPTH.items - 1);
    const { width, height } = scene.scale;
    this.panelBg = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.hud);
    this.panelText = scene.add.bitmapText(0, 0, FONTS.small, '').setScrollFactor(0).setDepth(DEPTH.hud + 1);
    this.fade = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.hud + 4);
    this.fade.fillStyle(0x000000, 1).fillRect(0, 0, width, height);
  }

  update(w: GameWorld): void {
    const U = YARD_UI;
    for (const o of w.interactables) {
      if (o.kind !== 'class_statue' || this.statues.has(o.id)) continue;
      this.statues.set(o.id, this.scene.add.image(o.x, o.y, 'objects', YARD_FRAMES.statue(o.label)).setOrigin(0.5, 1).setDepth(DEPTH.items - 2));
    }
    const g = this.flagGfx.clear();
    for (const f of this.flags) {
      g.fillStyle(U.pole, 1).fillRect(f.x - 1, f.y - U.flagPole, 2, U.flagPole);
      g.fillStyle(w.trainingDone.has(f.station) ? U.flagDone : U.flagTodo, 1).fillRect(f.x + 1, f.y - U.flagPole, U.flagW, U.flagH);
    }
    // The checklist panel while the player stands at the board.
    const near = this.boards.some((b) => Math.abs(w.body.x - b.x) < U.boardRange && Math.abs(w.body.y - b.y) < U.boardRange);
    this.panelText.setVisible(near);
    this.panelBg.clear().setVisible(near);
    if (near) {
      this.panelText.setText(checklistLines(w.trainingDone));
      // Top right (the yard has no run timer there), clear of the board and the player.
      const bw = this.panelText.width + 2 * U.panelPad, bh = this.panelText.height + 2 * U.panelPad;
      const x = this.scene.scale.width - bw - U.panelPad, y = U.panelPad;
      this.panelText.setPosition(x + U.panelPad, y + U.panelPad);
      this.panelBg.fillStyle(UI_COLOR.panel, 0.92).fillRect(x, y, bw, bh);
      this.panelBg.lineStyle(1, UI_COLOR.panelBorder, 1).strokeRect(x + 0.5, y + 0.5, bw - 1, bh - 1);
    }
    // Pit fade: dark over the 0.3 s before the respawn.
    const t = w.training?.fade ?? null;
    this.fade.setVisible(t !== null).setAlpha(t === null ? 0 : 1 - t / ticks(TRAINING_RULES.fadeS));
  }
}
