// "JUGGLE ×n" over a juggled enemy (02 §9.6a, M15): small, in `highlight`, rising and fading over 0.6 s.
import type Phaser from 'phaser';
import type { GameWorld, WorldEvent } from '../../core/sim/gameWorld.ts';
import { FONTS } from '../../data/animKeys.ts';
import { DEPTH } from '../../data/art.ts';
import { UI_COLOR } from '../../data/uiText.ts';

const LIFE_MS = 600, RISE = 14;

export class JuggleLabels {
  private readonly scene: Phaser.Scene;
  private readonly live: { t: Phaser.GameObjects.BitmapText; born: number; x: number; y: number }[] = [];
  constructor(scene: Phaser.Scene) { this.scene = scene; }
  update(w: GameWorld, events: readonly WorldEvent[], now: number): void {
    for (const e of events) {
      if (e.t !== 'juggle') continue;
      const en = w.enemies.find((x) => x.id === e.target); if (!en) continue;
      const y = en.y - en.def.hurtbox.h - 6;
      this.live.push({ t: this.scene.add.bitmapText(en.x, y, FONTS.small, `JUGGLE ×${e.count}`).setOrigin(0.5, 1).setTint(UI_COLOR.highlight).setDepth(DEPTH.hud - 2), born: now, x: en.x, y });
    }
    for (let i = this.live.length - 1; i >= 0; i--) {
      const l = this.live[i], k = (now - l.born) / LIFE_MS;
      if (k >= 1) { l.t.destroy(); this.live.splice(i, 1); continue; }
      l.t.setPosition(l.x, l.y - RISE * k).setAlpha(1 - k * k);
    }
  }
}
