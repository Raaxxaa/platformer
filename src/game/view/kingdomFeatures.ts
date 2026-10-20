// Stage 3 placeholders that need no art: cannons and their balls, the Crossbowman aim line, the Flame Burst area
// marker and the Black Knight's raised shield. They are drawn with flat shapes above the terrain (08 §4.3 depths).
import type Phaser from 'phaser';
import { cannonFlashing } from '../../core/hazards/cannons.ts';
import { enemyRect } from '../../core/enemies/enemy.ts';
import type { GameWorld } from '../../core/sim/gameWorld.ts';
import { DEPTH } from '../../data/art.ts';
import { CANNON } from '../../data/hazards.ts';
import { ticks } from '../../core/tuning.ts';
import { bulwarkActive } from '../../core/enemies/kingdom.ts';
import { boxToWorld } from '../../core/combat/hitGroups.ts';

export const KINGDOM_VIEW = {
  cannon: 0x55555c, cannonRim: 0x1a1a1e, cannonW: 16, cannonH: 12, flash: 0xfff4c8, flashR: 5,
  ball: 0x2a2a30, aim: 0xff3030, aimLocked: 0xfff4c8, aimAlpha: 0.8, burst: 0xff8a1f, burstAlpha: 0.3,
  shield: 0x6fc4ff, shieldAlpha: 0.9,
} as const;

export class KingdomFeatureView {
  private readonly gfx: Phaser.GameObjects.Graphics;
  constructor(scene: Phaser.Scene) {
    this.gfx = scene.add.graphics().setDepth(DEPTH.markers);
    scene.events.once('shutdown', () => this.gfx.destroy());
  }

  update(w: GameWorld): void {
    const g = this.gfx.clear(), K = KINGDOM_VIEW;
    for (const c of w.cannons.cannons) {
      g.fillStyle(K.cannon, 1).fillRect(c.x - K.cannonW / 2, c.y - K.cannonH / 2, K.cannonW, K.cannonH);
      g.lineStyle(1, K.cannonRim, 1).strokeRect(c.x - K.cannonW / 2 + 0.5, c.y - K.cannonH / 2 + 0.5, K.cannonW - 1, K.cannonH - 1);
      if (cannonFlashing(c)) g.fillStyle(K.flash, 1).fillCircle(c.x + c.dir * (K.cannonW / 2 + 2), c.y, K.flashR);   // the 0.6 s muzzle telegraph
    }
    for (const b of w.cannons.balls) g.fillStyle(K.ball, 1).fillRect(b.x - CANNON.size / 2, b.y - CANNON.size / 2, CANNON.size, CANNON.size);
    for (const e of w.enemies) {
      if (e.dead || e.dormant) continue;
      const a = e.ai.attack;
      if (e.def.id === 'crossbowman' && a?.def.id === 'bolt' && a.phase === 'tele' && e.kingdom?.aim) {
        const sx = e.x + e.facing * (e.def.hurtbox.w / 2 + 4), sy = e.y - 0.6 * e.def.hurtbox.h;
        const locked = a.len - a.t <= ticks(0.2);
        const dx = e.kingdom.aim.x - sx, dy = e.kingdom.aim.y - sy, len = Math.hypot(dx, dy) || 1;
        g.lineStyle(1, locked ? K.aimLocked : K.aim, K.aimAlpha).lineBetween(sx, sy, sx + dx / len * 400, sy + dy / len * 400);
      }
      if (e.def.id === 'battle_mage' && a?.def.id === 'flame_burst' && a.phase === 'tele' && a.def.hit) {
        const r = boxToWorld(a.def.hit.box, e.x, e.y, e.facing);
        g.fillStyle(K.burst, K.burstAlpha).fillRect(r.x, r.y, r.w, r.h);
      }
      if (e.def.id === 'black_knight' && bulwarkActive(w, e)) {
        const r = enemyRect(e);
        g.lineStyle(2, K.shield, K.shieldAlpha).strokeRect(r.x + (e.facing > 0 ? r.w - 2 : -2), r.y, 4, r.h);
      }
    }
  }
}
