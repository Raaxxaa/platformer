// Stage 4 placeholders that need no art (08 §4.3 depths): swinging blades, the Castle Mage's ward beam, the Gargoyle's stone
// shell, the Living Armor pile, the Enemy King's Throne Beam, and the Dragon's marks, bolts, spikes and clouds.
import type Phaser from 'phaser';
import { bladeCenter } from '../../core/hazards/swingingBlades.ts';
import { beamBand, isPile } from '../../core/enemies/castle.ts';
import { enemyCenter, enemyRect } from '../../core/enemies/enemy.ts';
import type { GameWorld } from '../../core/sim/gameWorld.ts';
import { DEPTH } from '../../data/art.ts';
import { SWINGING_BLADE } from '../../data/hazards.ts';

export const CASTLE_VIEW = {
  blade: 0xc9ced8, bladeRope: 0x6b6f7a, pivot: 0x3a3d46, ward: 0x5ad0ff, wardAlpha: 0.8, stone: 0x30343c, stoneAlpha: 0.55,
  pile: 0x8a8f9c, beam: 0xfff0a0, beamLine: 0xff5a3c, beamAlpha: 0.75,
  marker: 0xff6030, markerAlpha: 0.55, spike: 0xbfe8ff, bolt: 0xfff27a, cloud: 0x6fbf4a, cloudAlpha: 0.4,
} as const;

export class CastleFeatureView {
  private readonly gfx: Phaser.GameObjects.Graphics;
  constructor(scene: Phaser.Scene) {
    this.gfx = scene.add.graphics().setDepth(DEPTH.markers);
    scene.events.once('shutdown', () => this.gfx.destroy());
  }

  update(w: GameWorld): void {
    const g = this.gfx.clear(), C = CASTLE_VIEW, S = SWINGING_BLADE.size;
    for (const b of w.blades.blades) {
      const c = bladeCenter(b, w.blades.t);
      g.lineStyle(1, C.bladeRope, 1).lineBetween(b.px, b.py, c.x, c.y);
      g.fillStyle(C.pivot, 1).fillRect(b.px - 2, b.py - 2, 4, 4);
      g.fillStyle(C.blade, 1).fillRect(c.x - S / 2, c.y - S / 2, S, S);
    }
    for (const e of w.enemies) {
      if (e.dead || e.dormant && !e.dragon) continue;
      const r = enemyRect(e), a = e.ai.attack;
      if (e.castle?.stone) g.fillStyle(C.stone, C.stoneAlpha).fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
      if (isPile(e)) g.fillStyle(C.pile, 1).fillRect(r.x, r.y, r.w, r.h);
      if (e.castle?.wardTarget != null) {
        const ally = w.enemies.find((o) => o.id === e.castle!.wardTarget);
        if (ally && !ally.dead) { const p = enemyCenter(e), q = enemyCenter(ally); g.lineStyle(1, C.ward, C.wardAlpha).lineBetween(p.x, p.y, q.x, q.y); }
      }
      if (e.def.id === 'enemy_king' && a?.def.id === 'throne_beam' && a.phase === 'tele' && a.t >= 36) {      // the thin line shows the beam's height
        const arena = w.arenas.get(e.boss!.arenaId)!.rect, band = beamBand(e), wall = e.facing > 0 ? arena.x + arena.w : arena.x;
        g.lineStyle(1, C.beamLine, C.beamAlpha).lineBetween(e.x, e.y + (band.top + band.bottom) / 2, wall, e.y + (band.top + band.bottom) / 2);
      }
    }
    for (const gr of w.hitGroups) {
      const owner = typeof gr.owner === 'number' ? w.enemies.find((e) => e.id === gr.owner) : null;
      if (!owner || !gr.active) continue;
      if (owner.def.id === 'enemy_king' && gr.enemyHit?.unblockable) g.fillStyle(C.beam, C.beamAlpha).fillRect(gr.rect.x, gr.rect.y, gr.rect.w, gr.rect.h);
      else if (owner.dragon && gr.kind === 'shot' && owner.dragon.effects.some((f) => f.groupId === gr.id)) {
        const f = owner.dragon.effects.find((x) => x.groupId === gr.id)!;
        g.fillStyle(f.kind === 'bolt' ? C.bolt : C.spike, 0.9).fillRect(gr.rect.x, gr.rect.y, gr.rect.w, gr.rect.h);
      }
    }
    for (const e of w.enemies) {
      const d = e.dragon;
      if (!d || e.dead) continue;
      const arena = w.arenas.get(e.boss!.arenaId)!.rect, floor = arena.y + arena.h;
      for (const f of d.effects) {
        if (f.x === null) continue;
        if (f.kind === 'cloud') { g.fillStyle(C.cloud, C.cloudAlpha).fillRect(f.x - 32, floor - 48, 64, 48); continue; }
        if (w.tick >= f.start || w.tick < f.markFrom) continue;
        const k = (w.tick - f.markFrom) / Math.max(1, f.start - f.markFrom);
        if (f.kind === 'bolt') g.lineStyle(1, C.marker, C.markerAlpha).strokeRect(f.x - 12, arena.y, 24, arena.h).fillStyle(C.marker, 0.2 + 0.4 * k).fillRect(f.x - 12, floor - 6, 24, 6);
        else g.fillStyle(C.marker, 0.2 + 0.4 * k).fillRect(f.x - 12, floor - 4, 24, 4);
      }
      const a = e.ai.attack;
      if (a?.def.id === 'dive_bomb' && d.markerX !== null && a.phase === 'tele') {                 // the 128 px floor marker
        g.fillStyle(C.marker, d.markerLocked ? 0.9 : 0.5).fillRect(d.markerX - 64, floor - 4, 128, 4);
      }
      if (d.passive) g.lineStyle(1, C.stone, 1).strokeRect(e.x - 36, e.y - 48, 72, 48);
    }
  }
}
