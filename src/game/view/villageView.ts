import type Phaser from 'phaser';
import type { LevelData } from '../../core/level/loadLevel.ts';
import { TILE_SIZE, VIEW_W } from '../../core/tuning.ts';
import { ANCHOR, DEPTH } from '../../data/art.ts';
import { VILLAGE } from '../../data/villages.ts';
import { FONTS } from '../../data/animKeys.ts';
import { UI_COLOR } from '../../data/uiText.ts';
import type { GameWorld } from '../../core/sim/gameWorld.ts';
import { SHOP_UI } from '../../data/shopUi.ts';
export class VillageView {
  private gatePrompt: Phaser.GameObjects.BitmapText;
  private seedLabel: Phaser.GameObjects.BitmapText | null = null;
  private keyProp: Phaser.GameObjects.Image | null = null;
  constructor(scene: Phaser.Scene, level: LevelData) {
    const add = (atlas: string, frame: string, x: number, y: number) => {
      if (scene.textures.get(atlas).has(frame)) scene.add.image(x, y, atlas, frame).setOrigin(0.5, 1).setDepth(DEPTH.doors);
    };
    if (level.id === 'home') {
      for (const p of VILLAGE.homeProps) add('objects', p.frame, p.tile * TILE_SIZE + TILE_SIZE / 2, VILLAGE.floor * TILE_SIZE);
      for (const p of VILLAGE.npcs) if (scene.textures.get('npcs').has(p.frame)) scene.add.image(p.tile * TILE_SIZE + TILE_SIZE / 2, VILLAGE.floor * TILE_SIZE, 'npcs', p.frame)
        .setOrigin(0.5, (ANCHOR.human.h - ANCHOR.feetFromBottom) / ANCHOR.human.h).setDepth(DEPTH.doors);
    }
    if (level.id !== 'home') {
      scene.add.image(SHOP_UI.market.x, SHOP_UI.market.feetY, 'objects', 'market_roof_00').setOrigin(0, 1).setDepth(DEPTH.doors);
      scene.add.image(SHOP_UI.inn.x, SHOP_UI.inn.y, 'objects', 'inn_00').setOrigin(0).setDepth(DEPTH.doors);
      for (const [role, p] of [['shopkeeper', SHOP_UI.shopkeeper], ['innkeeper', SHOP_UI.innkeeper], ['merchant', SHOP_UI.merchant]] as const)
        scene.add.image(p.x, p.y, 'npcs', `${role}_idle_00`).setOrigin(0.5, (ANCHOR.human.h - ANCHOR.feetFromBottom) / ANCHOR.human.h).setDepth(DEPTH.doors);
    }
    for (const o of level.objects) {
      const x = o.w ? o.x + o.w / 2 : o.x, y = o.h ? o.y + o.h : o.y;
      const frame = o.type === 'class_statue' ? `class_statue_${o.props.cls}_00` : ({ mirror_spot: 'mirror_spot_00', training_gate: 'training_gate_00', unlocks_board: 'unlocks_board_00', seed_board: 'seed_board_00', exit: 'gate_idle_00', shop_item: 'shop_item_00', ability_altar: 'ability_altar_idle_00', shop_flask: 'shop_flask_00', shop_refill: 'shop_refill_idle_00', shop_reroll: 'shop_reroll_00' } as Record<string, string>)[o.type];
      if (frame) add('objects', frame, x, y);
      if (o.type === 'shop_key') this.keyProp = scene.add.image(x, y, 'objects', 'shop_key_00').setOrigin(0.5, 1).setDepth(DEPTH.doors);
      if (o.type === 'seed_board') this.seedLabel = scene.add.bitmapText(x, y - scene.textures.get('objects').get('seed_board_00').height - VILLAGE.promptY, FONTS.small, '').setOrigin(0.5, 1).setDepth(DEPTH.items);
    }
    this.gatePrompt = scene.add.bitmapText(0, 0, FONTS.small, '').setOrigin(0.5, 1).setDepth(DEPTH.hud).setTint(UI_COLOR.bad);
  }
  update(w: GameWorld, seed: string | null): void {
    this.keyProp?.setVisible(!!w.shop?.keyInStock);
    this.gatePrompt.setText(w.villageMessage ?? '');
    const half = this.gatePrompt.width / 2;
    const x = Math.max(w.camera.x + half + VILLAGE.promptY, Math.min(w.camera.x + VIEW_W - half - VILLAGE.promptY, w.body.x));
    this.gatePrompt.setPosition(x, w.body.y - w.body.h - VILLAGE.promptY);
    this.seedLabel?.setText(seed ? `SEED ${seed}` : '');
  }
}
