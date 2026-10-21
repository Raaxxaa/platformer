// ART8 weapon effects drawn from art: the stuck Javelin platforms (02 §10.5) and the Spell Tome's Rune Ring (02 §11).
// Reads core state only; never changes it.
import type Phaser from 'phaser';
import type { GameWorld } from '../../core/sim/gameWorld.ts';
import { DEPTH } from '../../data/art.ts';

export class WeaponFxView {
  private readonly platforms: Phaser.GameObjects.Sprite[] = [];
  private readonly runes: Phaser.GameObjects.Sprite[] = [];
  private readonly scene: Phaser.Scene;
  constructor(scene: Phaser.Scene) { this.scene = scene; }

  private pool(list: Phaser.GameObjects.Sprite[], n: number, frame: string): Phaser.GameObjects.Sprite[] {
    while (list.length < n) list.push(this.scene.add.sprite(0, 0, 'projectiles', frame).setDepth(DEPTH.playerProjectiles));
    return list;
  }

  update(w: GameWorld): void {
    const pf = this.pool(this.platforms, w.grid.pixelPlatforms.length, 'javelin_platform_00');
    pf.forEach((s, i) => {
      const q = w.grid.pixelPlatforms[i];
      const blink = !!q && q.expireTick - w.tick < 120 && Math.floor(w.tick / 8) % 2 === 0;
      s.setVisible(!!q && !blink);
      if (q) s.setPosition(q.x + q.w / 2, q.y + q.h / 2 + 1);
    });
    const list: { x: number; y: number; w: number; h: number }[] = [];
    for (const e of w.abilityEntities) {
      if (e.kind !== 'rune_ring') continue;
      for (const r of (e.view?.().runes as { x: number; y: number; w: number; h: number }[] | undefined) ?? []) list.push(r);
    }
    const rs = this.pool(this.runes, list.length, 'rune_00');
    rs.forEach((s, i) => {
      const r = list[i];
      s.setVisible(!!r);
      if (r) s.setFrame(`rune_0${Math.floor(w.tick / 10 + i) % 4}`).setPosition(r.x + r.w / 2, r.y + r.h / 2);
    });
  }
}
