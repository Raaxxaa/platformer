import type Phaser from 'phaser';
import type { LevelData } from '../../core/level/loadLevel.ts';
import { TILE_SIZE, VIEW_W } from '../../core/tuning.ts';
import { ANCHOR, DEPTH } from '../../data/art.ts';
import { VILLAGE } from '../../data/villages.ts';
import { FONTS } from '../../data/animKeys.ts';
import { UI_COLOR } from '../../data/uiText.ts';
import type { GameWorld } from '../../core/sim/gameWorld.ts';
export class VillageView {
  private gatePrompt: Phaser.GameObjects.BitmapText;
  private seedLabel: Phaser.GameObjects.BitmapText | null = null;
  constructor(scene: Phaser.Scene, level: LevelData) {
    const add = (atlas: string, frame: string, x: number, y: number) => {
      if (scene.textures.get(atlas).has(frame)) scene.add.image(x, y, atlas, frame).setOrigin(0.5, 1).setDepth(DEPTH.doors);
    };
    if (level.id === 'home') {
      for (const p of VILLAGE.homeProps) add('objects', p.frame, p.tile * TILE_SIZE + TILE_SIZE / 2, VILLAGE.floor * TILE_SIZE);
      for (const p of VILLAGE.npcs) if (scene.textures.get('npcs').has(p.frame)) scene.add.image(p.tile * TILE_SIZE + TILE_SIZE / 2, VILLAGE.floor * TILE_SIZE, 'npcs', p.frame)
        .setOrigin(0.5, (ANCHOR.human.h - ANCHOR.feetFromBottom) / ANCHOR.human.h).setDepth(DEPTH.doors);
    }
    for (const o of level.objects) {
      const x = o.w ? o.x + o.w / 2 : o.x, y = o.h ? o.y + o.h : o.y;
      const frame = o.type === 'class_statue' ? `class_statue_${o.props.cls}_00` : ({ mirror_spot: 'mirror_spot_00', training_gate: 'training_gate_00', unlocks_board: 'unlocks_board_00', seed_board: 'seed_board_00', exit: 'gate_idle_00' } as Record<string, string>)[o.type];
      if (frame) add('objects', frame, x, y);
      if (o.type === 'seed_board') this.seedLabel = scene.add.bitmapText(x, y - scene.textures.get('objects').get('seed_board_00').height - VILLAGE.promptY, FONTS.small, '').setOrigin(0.5, 1).setDepth(DEPTH.items);
    }
    this.gatePrompt = scene.add.bitmapText(0, 0, FONTS.small, '').setOrigin(0.5, 1).setDepth(DEPTH.hud).setTint(UI_COLOR.bad);
  }
  update(w: GameWorld, seed: string | null): void {
    this.gatePrompt.setText(w.villageMessage ?? '');
    const half = this.gatePrompt.width / 2;
    const x = Math.max(w.camera.x + half + VILLAGE.promptY, Math.min(w.camera.x + VIEW_W - half - VILLAGE.promptY, w.body.x));
    this.gatePrompt.setPosition(x, w.body.y - w.body.h - VILLAGE.promptY);
    this.seedLabel?.setText(seed ? `SEED ${seed}` : '');
  }
}
