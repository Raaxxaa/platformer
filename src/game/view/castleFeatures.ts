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
  private readonly scene: Phaser.Scene;
  private readonly bladeSprites: Phaser.GameObjects.Sprite[] = [];
  private readonly linkSprites: Phaser.GameObjects.Sprite[] = [];
  private readonly pivotSprites: Phaser.GameObjects.Sprite[] = [];
  private readonly fx: Phaser.GameObjects.Sprite[] = [];
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.gfx = scene.add.graphics().setDepth(DEPTH.markers);
    scene.events.once('shutdown', () => this.gfx.destroy());
  }

  update(w: GameWorld): void {
    const g = this.gfx.clear(), C = CASTLE_VIEW, S = SWINGING_BLADE.size;
    const art = this.scene.textures.exists('objects') && this.scene.textures.get('objects').has('swinging_blade_00');
    const enemyArt = this.scene.textures.exists('enemies_castle');
    const grow = (list: Phaser.GameObjects.Sprite[], n: number, frame: string, depth: number) => {
      while (list.length < n) list.push(this.scene.add.sprite(0, 0, 'objects', frame).setDepth(depth));
      list.forEach((sp, i) => sp.setVisible(i < n));
    };
    const blades = w.blades.blades;
    // chain links every 8 px along each rope, then the pivot and the blade (08 §8)
    const links: { x: number; y: number }[] = [];
    blades.forEach((b, i) => {
      const c = bladeCenter(b, w.blades.t);
      if (!art) {
        g.lineStyle(1, C.bladeRope, 1).lineBetween(b.px, b.py, c.x, c.y);
        g.fillStyle(C.pivot, 1).fillRect(b.px - 2, b.py - 2, 4, 4);
        g.fillStyle(C.blade, 1).fillRect(c.x - S / 2, c.y - S / 2, S, S);
        return;
      }
      const len = Math.hypot(c.x - b.px, c.y - b.py), n = Math.max(0, Math.floor((len - S / 2) / 8));
      for (let k = 1; k <= n; k++) links.push({ x: b.px + (c.x - b.px) * (k * 8) / len, y: b.py + (c.y - b.py) * (k * 8) / len });
      this.bladeSprites[i]?.setPosition(c.x, c.y).setRotation(Math.atan2(c.y - b.py, c.x - b.px) - Math.PI / 2);
    });
    if (art) {
      grow(this.bladeSprites, blades.length, 'swinging_blade_00', DEPTH.doors + 0.2);
      grow(this.pivotSprites, blades.length, 'blade_pivot_00', DEPTH.doors + 0.3);
      grow(this.linkSprites, links.length, 'blade_chain_00', DEPTH.doors + 0.1);
      blades.forEach((b, i) => {
        const c = bladeCenter(b, w.blades.t);
        this.bladeSprites[i].setPosition(c.x, c.y).setRotation(Math.atan2(c.y - b.py, c.x - b.px) - Math.PI / 2);
        this.pivotSprites[i].setPosition(b.px, b.py);
      });
      links.forEach((l, i) => this.linkSprites[i].setPosition(l.x, l.y));
    }
    for (const e of w.enemies) {
      if (e.dead || e.dormant && !e.dragon) continue;
      const r = enemyRect(e), a = e.ai.attack;
      if (!enemyArt && e.castle?.stone) g.fillStyle(C.stone, C.stoneAlpha).fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
      if (!enemyArt && isPile(e)) g.fillStyle(C.pile, 1).fillRect(r.x, r.y, r.w, r.h);
      if (e.castle?.wardTarget != null) {
        const ally = w.enemies.find((o) => o.id === e.castle!.wardTarget);
        if (ally && !ally.dead) { const p = enemyCenter(e), q = enemyCenter(ally); g.lineStyle(1, C.ward, C.wardAlpha).lineBetween(p.x, p.y, q.x, q.y); }
      }
      if (e.def.id === 'enemy_king' && a?.def.id === 'throne_beam' && a.phase === 'tele' && a.t >= 36) {      // the thin line shows the beam's height
        const arena = w.arenas.get(e.boss!.arenaId)!.rect, band = beamBand(e), wall = e.facing > 0 ? arena.x + arena.w : arena.x;
        g.lineStyle(1, C.beamLine, C.beamAlpha).lineBetween(e.x, e.y + (band.top + band.bottom) / 2, wall, e.y + (band.top + band.bottom) / 2);
      }
    }
    const vfxArt = this.scene.textures.exists('vfx') && this.scene.textures.get('vfx').has('dragon_breath_red_00');
    const fxList: { frame: string; x: number; y: number; w: number; h: number; ox: number; oy: number; rot: number; alpha: number; flip: boolean }[] = [];
    for (const gr of w.hitGroups) {
      const owner = typeof gr.owner === 'number' ? w.enemies.find((e) => e.id === gr.owner) : null;
      if (!owner || !gr.active) continue;
      if (owner.def.id === 'enemy_king' && gr.enemyHit?.unblockable) {
        if (vfxArt) fxList.push({ frame: `throne_beam_0${Math.floor(w.tick / 10) % 2}`, x: gr.rect.x, y: gr.rect.y, w: gr.rect.w, h: gr.rect.h, ox: 0, oy: 0, rot: 0, alpha: 1, flip: false, tile: true } as never);
        else g.fillStyle(C.beam, C.beamAlpha).fillRect(gr.rect.x, gr.rect.y, gr.rect.w, gr.rect.h);
      }
      else if (owner.dragon && gr.kind === 'shot' && owner.dragon.effects.some((f) => f.groupId === gr.id)) {
        const f = owner.dragon.effects.find((x) => x.groupId === gr.id)!;
        if (vfxArt && f.kind === 'spike') fxList.push({ frame: `ice_spike_0${Math.min(2, Math.floor((w.tick - f.start) / 6))}`, x: gr.rect.x, y: gr.rect.y, w: gr.rect.w, h: gr.rect.h, ox: 0, oy: 0, rot: 0, alpha: 1, flip: false });
        else if (vfxArt && f.kind === 'bolt') fxList.push({ frame: `thunder_0${Math.min(3, Math.floor((w.tick - f.start) / 2))}`, x: gr.rect.x, y: gr.rect.y, w: gr.rect.w, h: gr.rect.h, ox: 0, oy: 0, rot: 0, alpha: 1, flip: false });
        else g.fillStyle(f.kind === 'bolt' ? C.bolt : C.spike, 0.9).fillRect(gr.rect.x, gr.rect.y, gr.rect.w, gr.rect.h);
      }
    }
    for (const e of w.enemies) {
      const d = e.dragon;
      if (!d || e.dead) continue;
      const arena = w.arenas.get(e.boss!.arenaId)!.rect, floor = arena.y + arena.h;
      for (const f of d.effects) {
        if (f.x === null) continue;
        if (f.kind === 'cloud') {
          if (vfxArt && this.scene.textures.get('projectiles').has('toxic_cloud_00')) fxList.push({ frame: `toxic_cloud_0${Math.floor(w.tick / 20) % 4}`, x: f.x - 32, y: floor - 48, w: 64, h: 48, ox: 0, oy: 0, rot: 0, alpha: 0.7, flip: false, atlas: 'projectiles' } as never);
          else g.fillStyle(C.cloud, C.cloudAlpha).fillRect(f.x - 32, floor - 48, 64, 48);
          continue;
        }
        if (w.tick >= f.start || w.tick < f.markFrom) continue;
        const k = (w.tick - f.markFrom) / Math.max(1, f.start - f.markFrom);
        if (f.kind === 'bolt') g.lineStyle(1, C.marker, C.markerAlpha).strokeRect(f.x - 12, arena.y, 24, arena.h).fillStyle(C.marker, 0.2 + 0.4 * k).fillRect(f.x - 12, floor - 6, 24, 6);
        else g.fillStyle(C.marker, 0.2 + 0.4 * k).fillRect(f.x - 12, floor - 4, 24, 4);
      }
      const a = e.ai.attack;
      if (vfxArt && a?.phase === 'act' && (a.def.id === 'breath' || a.def.id === 'strafing_breath')) {
        const fr = `dragon_breath_${d.color}_0${Math.floor(w.tick / 8) % 4}`;
        if (a.def.id === 'breath') fxList.push({ frame: fr, x: e.x + e.facing * 28, y: e.y - 26, w: 240, h: 56, ox: e.facing > 0 ? 0 : 1, oy: 0.5, rot: 0, alpha: 0.9, flip: e.facing < 0 });
        else fxList.push({ frame: fr, x: e.x, y: e.y, w: 104, h: 48, ox: 0, oy: 0.5, rot: Math.PI / 2, alpha: 0.9, flip: false });
      }
      if (a?.def.id === 'dive_bomb' && d.markerX !== null && a.phase === 'tele') {                 // the 128 px floor marker
        g.fillStyle(C.marker, d.markerLocked ? 0.9 : 0.5).fillRect(d.markerX - 64, floor - 4, 128, 4);
      }
      if (d.passive) g.lineStyle(1, C.stone, 1).strokeRect(e.x - 36, e.y - 48, 72, 48);
    }
    while (this.fx.length < fxList.length) this.fx.push(this.scene.add.sprite(0, 0, 'vfx', 'ice_spike_00').setDepth(DEPTH.vfx));
    this.fx.forEach((sp, i) => {
      const f = fxList[i] as typeof fxList[number] & { tile?: boolean; atlas?: string };
      sp.setVisible(!!f);
      if (!f) return;
      sp.setTexture(f.atlas ?? 'vfx', f.frame).setOrigin(f.ox, f.oy).setPosition(f.x + (f.ox || f.oy ? 0 : 0), f.y + (f.oy ? 0 : 0)).setRotation(f.rot).setAlpha(f.alpha).setFlipX(f.flip);
      if (f.tile) sp.setDisplaySize(f.w, f.h);
      else if (f.rot) sp.setDisplaySize(f.w, f.h).setPosition(f.x, f.y);
      else if (f.w === 240) sp.setScale(1, 1);
      else sp.setDisplaySize(f.w, f.h);
    });
  }
}
