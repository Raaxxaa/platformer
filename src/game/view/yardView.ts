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
import { CLASS_COLOR, GRADE_COLOR, UI_COLOR } from '../../data/uiText.ts';
import { ABILITY_INFO } from '../../data/abilities.ts';
import { ITEM_FX } from '../../data/stageUi.ts';
import { TICK_RATE } from '../../core/tuning.ts';
import type { ClassId } from '../../core/abilities/types.ts';
import { checklistLines } from '../../ui/hud/checklist.ts';

const titleCase = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Items on the ground: icon over its glow (tinted by grade or class), a bob, the A/S beam, the badge (07 §5.6), a
 *  loot stand under stand and armory items; keys are their own sprite. */
interface ItemObjs { stand?: Phaser.GameObjects.Image; beam?: Phaser.GameObjects.Image; glow?: Phaser.GameObjects.Image; icon: Phaser.GameObjects.Image;
  badge?: Phaser.GameObjects.Graphics; badgeText?: Phaser.GameObjects.BitmapText }
export class ItemViews {
  private views = new Map<GroundItem, ItemObjs>();
  private scene: Phaser.Scene;
  constructor(scene: Phaser.Scene) { this.scene = scene; }

  private make(it: GroundItem): ItemObjs | null {
    const sc = this.scene;
    if (it.key) return { icon: sc.add.image(0, 0, 'items', ITEM_FX.keyFrame).setOrigin(0.5, 1).setDepth(DEPTH.items) };
    if (it.blueprint) return { icon: sc.add.image(0, 0, 'items', ITEM_FX.blueprintFrame).setDepth(DEPTH.items) };
    const kind = it.weapon ? 'weapon' : 'ability';
    const id = it.weapon?.weaponId ?? it.ability?.id;
    if (!id) return null;
    const o: ItemObjs = { icon: sc.add.image(0, 0, 'ui', itemIcon(kind, id)).setDepth(DEPTH.items + 1) };
    if (it.endless || it.stand) o.stand = sc.add.image(0, 0, 'objects', YARD_FRAMES.stand).setOrigin(0.5, 1).setDepth(DEPTH.items - 1);
    const grade = it.weapon?.grade;
    if (grade === 'A' || grade === 'S') o.beam = sc.add.image(0, 0, 'items', ITEM_FX.beamFrame).setOrigin(0.5, 1).setDepth(DEPTH.items - 1).setTint(GRADE_COLOR[grade]);
    o.glow = sc.add.image(0, 0, 'items', itemGlow(kind, id)).setDepth(DEPTH.items).setTint(this.colorOf(it));
    o.badge = sc.add.graphics().setDepth(DEPTH.items + 2);
    o.badgeText = sc.add.bitmapText(0, 0, FONTS.smallPlain, it.weapon ? it.weapon.grade : String(it.ability!.level)).setOrigin(0.5, 0).setTint(UI_COLOR.ink).setDepth(DEPTH.items + 3);
    return o;
  }

  private colorOf(it: GroundItem): number {
    if (it.weapon) return GRADE_COLOR[it.weapon.grade];
    const cls = it.ability ? ABILITY_INFO[it.ability.id]?.cls : null;
    return cls ? CLASS_COLOR[cls] : CLASS_COLOR.neutral;
  }

  update(items: readonly GroundItem[], tick = 0): void {
    const live = new Set(items);
    const kill = (o: ItemObjs) => { for (const x of Object.values(o)) (x as Phaser.GameObjects.GameObject | undefined)?.destroy(); };
    for (const [it, o] of this.views) if (!live.has(it)) { kill(o); this.views.delete(it); }
    const t = tick / TICK_RATE;
    for (const it of items) {
      let o = this.views.get(it);
      if (!o) { const m = this.make(it); if (!m) continue; o = m; this.views.set(it, o); }
      if (it.key) { o.icon.setPosition(it.x, it.y); continue; }
      const bob = it.resting ? Math.round(Math.sin(t * Math.PI * 2 * ITEM_FX.bobHz) * ITEM_FX.bobPx) : 0;
      const lift = o.stand ? o.stand.height + YARD_UI.iconLift : it.shopSlot !== undefined ? this.scene.textures.get('objects').get('shop_item_00').height + YARD_UI.iconLift : 0;
      const cy = it.y - lift - 8 + bob;
      o.stand?.setPosition(it.x, it.y);
      o.beam?.setPosition(it.x, it.y - (o.stand ? o.stand.height : 0));
      o.glow?.setPosition(it.x, cy).setAlpha(ITEM_FX.glowMin + (1 - ITEM_FX.glowMin) * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 * ITEM_FX.glowHz)));
      o.icon.setPosition(it.x, cy);
      // Badge: 9 x 9 in the grade or class color, 2 px above the icon.
      const by = cy - 8 - ITEM_FX.badgeGap - ITEM_FX.badge, bx = Math.round(it.x - ITEM_FX.badge / 2);
      o.badge?.clear().fillStyle(UI_COLOR.ink, 1).fillRect(bx - 1, by - 1, ITEM_FX.badge + 2, ITEM_FX.badge + 2)
        .fillStyle(this.colorOf(it), 1).fillRect(bx, by, ITEM_FX.badge, ITEM_FX.badge);
      o.badgeText?.setPosition(it.x + 0.5, by + 1);
    }
  }
}

export class YardView {
  private flags: { station: number; img: Phaser.GameObjects.Image }[] = [];
  private boards: { x: number; y: number }[] = [];
  private panelBg: Phaser.GameObjects.Graphics;
  private panelText: Phaser.GameObjects.BitmapText;
  private fade: Phaser.GameObjects.Graphics;
  private statues = new Map<number, Phaser.GameObjects.Image>();

  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, level: LevelData) {
    this.scene = scene;
    for (const o of level.objects) {
      if (o.type === 'station_flag') {
        this.flags.push({ station: Number(o.props.station), img: scene.add.image(o.x, o.y, 'objects', YARD_FRAMES.flagTodo).setOrigin(0.5, 1).setDepth(DEPTH.items - 1) });
      }
      // A sign post at the start of each station's hint zone (ART5 `station_sign`).
      if (o.type === 'hint' && o.props.station !== undefined) {
        scene.add.image(o.x + YARD_UI.signDx, o.y + o.h, 'objects', YARD_FRAMES.sign).setOrigin(0.5, 1).setDepth(DEPTH.items - 2);
      }
      if (o.type === 'checklist_board') {
        this.boards.push({ x: o.x, y: o.y });
        scene.add.image(o.x, o.y, 'objects', YARD_FRAMES.board).setOrigin(0.5, 1).setDepth(DEPTH.items - 2);
      }
      if (o.type === 'armory_label') {
        const cls = String(o.props.cls) as ClassId;
        scene.add.bitmapText(o.x, o.y, FONTS.small, titleCase(cls)).setOrigin(0, 1).setTint(CLASS_COLOR[cls] ?? UI_COLOR.text).setDepth(DEPTH.items);
      }
    }
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
    for (const f of this.flags) f.img.setFrame(w.trainingDone.has(f.station) ? YARD_FRAMES.flagDone : YARD_FRAMES.flagTodo);
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
