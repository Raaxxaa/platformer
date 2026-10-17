// VFX (08 §11): a pool of at most 256 effects, started from world events and state changes. View only.
import Phaser from 'phaser';
import { rushLevel } from '../../core/combat/rush.ts';
import { enemyRect, type EnemyState } from '../../core/enemies/enemy.ts';
import type { GameWorld, WorldEvent } from '../../core/sim/gameWorld.ts';
import { TICK_RATE } from '../../core/tuning.ts';
import { DEATH_BURST_COLORS, DEPTH, VFX } from '../../data/art.ts';
import { WEAPONS } from '../../data/weapons.ts';
import { hash2 } from '../../core/level/autotile.ts';
import { timeFrame } from './animClock.ts';
import type { AnimBank } from './animBank.ts';

type Fx =
  | { kind: 'anim'; born: number; key: string; sprite: Phaser.GameObjects.Sprite }
  | { kind: 'ghost'; born: number; life: number; alpha: number; sprite: Phaser.GameObjects.Sprite }
  | { kind: 'particle'; born: number; life: number; x: number; y: number; vx: number; vy: number; g: number; color: number; size: number };

export interface TickEvent { tick: number; e: WorldEvent }

/** Number of live effects of each kind, for tests (window.__game.vfx()). */
export interface VfxCounts { total: number; byKey: Record<string, number>; spawned: Record<string, number> }

export class VfxPool {
  private readonly list: Fx[] = [];
  /** Effects started since the scene began, by key (tests). */
  private readonly spawned: Record<string, number> = {};
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly scene: Phaser.Scene;
  private readonly bank: AnimBank;
  constructor(scene: Phaser.Scene, bank: AnimBank) {
    this.scene = scene;
    this.bank = bank;
    this.gfx = scene.add.graphics().setDepth(DEPTH.vfx);
  }

  private add(fx: Fx): void {
    if (this.list.length >= VFX.max) this.remove(0);          // the oldest is recycled
    this.list.push(fx);
    const k = fx.kind === 'anim' ? fx.key : fx.kind;
    this.spawned[k] = (this.spawned[k] ?? 0) + 1;
  }
  private remove(i: number): void {
    const fx = this.list[i];
    if (fx.kind !== 'particle') fx.sprite.destroy();
    this.list.splice(i, 1);
  }

  /** A one-shot anim from the `vfx` atlas at (x, y): feet-anchored for dust and columns, else centered. */
  anim(key: string, x: number, y: number, tick: number, flip = false): void {
    const def = this.bank.vfx(key);
    if (!def) return;
    const s = this.scene.add.sprite(Math.round(x), Math.round(y), 'vfx', def.frames[0]).setDepth(DEPTH.vfx).setFlipX(flip);
    if (VFX.feetOrigin.includes(key)) s.setOrigin(0.5, 1);
    this.add({ kind: 'anim', born: tick, key, sprite: s });
  }

  /** A solid-fill copy of a frame fading out (dash afterimages). */
  ghost(atlas: string, frame: string, x: number, y: number, flip: boolean, tick: number, origin: [number, number]): void {
    const A = VFX.afterimage;
    const s = this.scene.add.sprite(x, y, atlas, frame).setOrigin(origin[0], origin[1]).setFlipX(flip)
      .setTint(A.color).setTintMode(Phaser.TintModes.FILL).setAlpha(A.alpha).setDepth(DEPTH.afterimage);
    this.add({ kind: 'ghost', born: tick, life: A.life, alpha: A.alpha, sprite: s });
  }

  /** `death_burst`: 2×2 squares in the enemy's 2 main colors, radial, with gravity (08 §11). */
  burst(x: number, y: number, colors: [number, number], count: number, tick: number, salt: number): void {
    const B = VFX.deathBurst;
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + (hash2(salt, i, 11) % 100) / 100;
      const sp = B.speedMin + (hash2(salt, i, 12) % (B.speedMax - B.speedMin + 1));
      this.add({ kind: 'particle', born: tick, life: B.life, x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, g: B.gravity, color: colors[i % 2], size: B.size });
    }
  }

  update(tick: number): void {
    const g = this.gfx.clear();
    for (let i = this.list.length - 1; i >= 0; i--) {
      const fx = this.list[i];
      const t = (tick - fx.born) / TICK_RATE;
      if (fx.kind === 'anim') {
        const def = this.bank.vfx(fx.key)!;
        const n = def.frames.length, fps = def.fps ?? 1;
        if (t >= n / fps) { this.remove(i); continue; }
        fx.sprite.setFrame(def.frames[timeFrame(def, t)]);
      } else if (fx.kind === 'ghost') {
        if (t >= fx.life) { this.remove(i); continue; }
        fx.sprite.setAlpha(fx.alpha * (1 - t / fx.life));
      } else {
        if (t >= fx.life) { this.remove(i); continue; }
        g.fillStyle(fx.color, 1).fillRect(Math.round(fx.x + fx.vx * t), Math.round(fx.y + fx.vy * t + 0.5 * fx.g * t * t), fx.size, fx.size);
      }
    }
  }

  counts(): VfxCounts {
    const byKey: Record<string, number> = {};
    for (const fx of this.list) {
      const k = fx.kind === 'anim' ? fx.key : fx.kind;
      byKey[k] = (byKey[k] ?? 0) + 1;
    }
    return { total: this.list.length, byKey, spawned: { ...this.spawned } };
  }

  clear(): void {
    while (this.list.length) this.remove(this.list.length - 1);
  }
}

/** Hit point: the hurtbox center moved a quarter of its width toward the player, ± 3 px of hash2 jitter (08 §11). */
function hitPoint(e: EnemyState, playerX: number, tick: number): [number, number] {
  const r = enemyRect(e);
  const j = VFX.hitJitter;
  const jx = (hash2(tick, e.id, 21) % (2 * j + 1)) - j, jy = (hash2(tick, e.id, 22) % (2 * j + 1)) - j;
  return [r.x + r.w / 2 + Math.sign(playerX - (r.x + r.w / 2)) * (r.w / 4) + jx, r.y + r.h / 2 + jy];
}

/** Turns world events and state changes into VFX. One per scene; `restart` clears it with the world. */
export class VfxDirector {
  private lastRush = 0;
  private sipped = false;
  readonly pool: VfxPool;
  constructor(pool: VfxPool) {
    this.pool = pool;
  }

  /** Events since the last render, then the per-render state checks. `ghostFrame` is the player's current frame. */
  update(w: GameWorld, events: TickEvent[], ghostFrame: { atlas: string; frame: string; origin: [number, number] }): void {
    const P = this.pool, b = w.body;
    for (const { tick, e } of events) {
      if (e.t === 'move') {
        if (e.e === 'jump') P.anim('dust_jump', b.x, b.y, tick);
        else if (e.e === 'doubleJump') P.anim('ring_djump', b.x, b.y, tick);
        else if (e.e === 'wallJump') P.anim('dust_walljump', b.x - b.facing * (b.w / 2), b.y - b.h / 2, tick, b.facing < 0);
        else if (e.e === 'land' && b.landSpeed >= VFX.landMinVy) P.anim('dust_land', b.x, b.y, tick);
        else if (e.e === 'diveLand') {
          const slot = w.dive?.slot ?? 0, wid = w.combat.slots[slot]?.weaponId;
          P.anim(wid && WEAPONS[wid]?.weight === 'heavy' ? 'dive_impact_heavy' : 'dive_impact', b.x, b.y, tick);
        } else if (e.e === 'diveBounce') P.anim('dive_bounce', b.x, b.y, tick);
        else if (e.e === 'spikeHit') P.anim('spike_spark', b.x, b.y - b.h / 2, tick);
      } else if (e.t === 'hit' && e.target !== 'player') {
        const en = w.enemies.find((x) => x.id === e.target);
        if (!en) continue;
        const [hx, hy] = hitPoint(en, b.x, tick);
        P.anim(e.crit ? 'crit_spark' : e.heavy || en.hitStopTicks >= VFX.hitHeavyStopTicks ? 'hit_heavy' : 'hit_spark', hx, hy, tick);
      } else if (e.t === 'kill') {
        const en = w.enemies.find((x) => x.id === e.enemyId);
        if (en) { const r = enemyRect(en); P.anim('flask_orb', r.x + r.w / 2, r.y + r.h / 2, tick); }
      } else if (e.t === 'arenaWave' || e.t === 'arenaLocked') {
        // Spawn-in columns are started per enemy below (state), so nothing here.
      }
    }
    // State-driven effects (every n ticks while the state lasts).
    const t = w.tick;
    if (b.state === 'wallSlide' && t % VFX.wallDustEvery === 0) P.anim('dust_wall', b.x - b.facing * (b.w / 2), b.y - b.h / 2, t);
    if (b.state === 'slide' && t % VFX.slideDustEvery === 0) P.anim('dust_slide', b.x - b.facing * (b.w / 2), b.y, t);
    if (b.state === 'diveFall' && t % VFX.diveTrailEvery === 0) P.anim('dive_trail', b.x, b.y - b.h, t);
    if (b.state === 'dash' && b.stateTicks % VFX.afterimage.every === 1) P.ghost(ghostFrame.atlas, ghostFrame.frame, b.x, b.y, b.facing < 0, t, ghostFrame.origin);
    const lvl = rushLevel(w.rush);
    if (lvl > this.lastRush) P.anim('rush_up', b.x, b.y, t);
    this.lastRush = lvl;
    const sipped = !!w.drinking?.sipped;
    if (sipped && !this.sipped) P.anim('heal', b.x, b.y, t);
    this.sipped = sipped;
  }

  /** Spawn-in column for a newly seen enemy that is spawning in; the death burst when its death anim ends. */
  spawnIn(e: EnemyState, tick: number): void {
    this.pool.anim('spawn_in', e.x, e.y, tick);
  }
  deathBurst(e: EnemyState, tick: number): void {
    const colors = DEATH_BURST_COLORS[e.def.id];
    if (!colors) return;
    const r = enemyRect(e);
    this.pool.burst(r.x + r.w / 2, r.y + r.h / 2, colors, e.boss ? VFX.deathBurst.bossCount : VFX.deathBurst.count, tick, e.id);
  }
  muzzle(x: number, y: number, tick: number): void {
    this.pool.anim('muzzle', x, y, tick);
  }

  reset(): void {
    this.pool.clear();
    this.lastRush = 0;
    this.sipped = false;
  }
}

/** Telegraph floor markers (08 §11): Stomp Quake's floor strip and the falling-rock shadows. Depth 88. */
export function drawMarkers(g: Phaser.GameObjects.Graphics, w: GameWorld): void {
  const M = VFX.marker;
  const tick = w.tick;
  const pulse = M.alphaMin + (M.alphaMax - M.alphaMin) * (0.5 + 0.5 * Math.sin((tick / TICK_RATE) * Math.PI * 2 * M.hz));
  for (const e of w.enemies) {
    const a = e.ai.attack;
    if (!a || a.phase !== 'tele' || e.dead || a.def.id !== 'stomp_quake' || !a.def.hit) continue;
    const last = a.len - a.t <= TICK_RATE * 0.15;
    const bw = a.def.hit.box.w;
    g.fillStyle(last ? M.go : M.color, last ? 1 : pulse).fillRect(Math.round(e.x - bw / 2), Math.round(e.y - M.h), bw, M.h);
  }
  const boss = [...w.arenas.values()].find((x) => x.kind === 'boss');
  for (const r of w.rockMarkers) {
    const floor = boss ? boss.rect.y + boss.rect.h : r.topY;
    const k = M.shadowFrom + (1 - M.shadowFrom) * Math.min(1, 1 - r.ticks / TICK_RATE / 0.8);
    g.fillStyle(0x0d0b14, 0.5).fillEllipse(r.x, floor - 1, M.shadowW * k, M.shadowH * k);
    g.fillStyle(M.color, pulse).fillRect(Math.round(r.x - (M.shadowW * k) / 2), floor - M.h, Math.round(M.shadowW * k), 1);
  }
}
