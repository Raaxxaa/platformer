// Character and projectile sprites drawn from core state (08 §4.2–4.3, §5, §6, §7). They read state; they never change it.
import Phaser from 'phaser';
import type { EnemyState } from '../../core/enemies/enemy.ts';
import { enemyRect } from '../../core/enemies/enemy.ts';
import type { EnemyProjectile } from '../../core/enemies/projectiles.ts';
import type { GameWorld } from '../../core/sim/gameWorld.ts';
import { COMBAT, ENEMY, TICK_RATE } from '../../core/tuning.ts';
import { DUMMY_FRAMES } from '../../data/animKeys.ts';
import { ANCHOR, ANIM, DEPTH, OVERLAY, TRIM_TINT, VFX, WEAPON_FRAME } from '../../data/art.ts';
import { AnimClock, runFps, timeFrame, walkFps } from './animClock.ts';
import type { AnimBank } from './animBank.ts';
import { pickEnemyAnim, pickPlayerAnim, type Lookup, type PlayerAnimState } from './pickAnim.ts';

/** The player outfit while there are no classes yet. */
// SPEC-GAP: no class or starting kit exists before M5, so the outfit is fixed to the Swordsman with Neutral trims.
export const OUTFIT = 'swordsman';

/** Feet-anchored origin for a frame: (w/2, h − 2) (08 §4.1). */
function feet(s: Phaser.GameObjects.Sprite): Phaser.GameObjects.Sprite {
  return s.setOrigin(0.5, (s.frame.height - ANCHOR.feetFromBottom) / s.frame.height);
}

/** Moves the player view needs that only events tell (double jump, wall jump starts). */
export interface PlayerViewEvents { lastDoubleJumpTick: number; lastWallJumpTick: number }

/** Player: body, trim A, trim B, weapon, smear, flipped together, plus a solid-fill overlay (08 §4.2, §5.3). */
export class PlayerSprite {
  private readonly body: Phaser.GameObjects.Sprite;
  private readonly trims: Phaser.GameObjects.Sprite[];
  private readonly weapon: Phaser.GameObjects.Sprite;
  private readonly smear: Phaser.GameObjects.Sprite;
  private readonly overlay: Phaser.GameObjects.Sprite;
  private readonly clock = new AnimClock();
  private readonly get: Lookup;
  /** The last frame drawn (afterimages copy it). */
  frameName = 'idle_00';
  /** The anim key and frame index drawn last (footstep sounds). */
  anim = { key: 'idle', frame: 0 };
  constructor(scene: Phaser.Scene, bank: AnimBank) {
    this.get = bank.player(OUTFIT);
    const body = `player_${OUTFIT}`, trim = `${body}_trim`;
    this.body = scene.add.sprite(0, 0, body, 'idle_00');
    this.trims = ['a', 'b'].map((l) => scene.add.sprite(0, 0, trim, `${l}/idle_00`).setTint(TRIM_TINT.none));
    this.weapon = scene.add.sprite(0, 0, 'weapon_greatsword', 'atk_greatsword_1_00').setVisible(false);
    this.smear = scene.add.sprite(0, 0, 'weapon_greatsword', 'atk_greatsword_1_smear').setVisible(false);
    this.overlay = scene.add.sprite(0, 0, body, 'idle_00').setTint(OVERLAY.hitFlash.color).setTintMode(Phaser.TintModes.FILL);
    for (const s of [this.body, ...this.trims, this.overlay]) feet(s).setDepth(DEPTH.player);
    for (const s of [this.weapon, this.smear]) s.setOrigin(WEAPON_FRAME.anchorX / WEAPON_FRAME.w, WEAPON_FRAME.anchorY / WEAPON_FRAME.h);
  }

  static animState(w: GameWorld, ev: PlayerViewEvents): PlayerAnimState {
    const b = w.body, cur = w.combat.current;
    const inst = cur ? w.combat.slots[cur.slot] : null;
    const diveSlot = w.dive?.slot ?? 0;
    return {
      state: b.state, stateTicks: b.stateTicks, vx: b.vx, vy: b.vy, facing: b.facing, landSpeed: b.landSpeed,
      dead: w.health.dead,
      attack: cur && inst ? { weaponId: inst.weaponId, step: cur.step, phase: cur.phase, phaseTicks: cur.phaseTicks, lens: cur.lens } : null,
      diveWeapon: w.combat.slots[diveSlot]?.weaponId ?? null,
      drinkTicks: w.drinking ? w.drinking.t : null,
      ticksSinceDoubleJump: w.tick - ev.lastDoubleJumpTick,
      ticksSinceWallJump: w.tick - ev.lastWallJumpTick,
    };
  }

  update(w: GameWorld, ev: PlayerViewEvents): void {
    const b = w.body;
    const s = PlayerSprite.animState(w, ev);
    const key0 = pickPlayerAnim(s, this.get, this.clock.t, this.clock.runPhase).key;
    const dt = this.clock.advance(key0, w.tick, b.hitStopTicks > 0);
    if (key0 === 'run') this.clock.runPhase += runFps(b.vx) * dt;
    const p = pickPlayerAnim(s, this.get, this.clock.t, this.clock.runPhase);
    const name = this.get(p.key)!.frames[p.frame];
    this.frameName = name;
    this.anim = { key: p.key, frame: p.frame };
    const flip = b.facing < 0;
    const blink = w.health.iframeTicks > 0 && Math.floor(w.tick / COMBAT.IFRAME_BLINK_TICKS) % 2 === 0;
    const alpha = blink ? 0.4 : 1;
    this.body.setFrame(name).setPosition(b.x, b.y).setFlipX(flip).setAlpha(alpha);
    this.trims.forEach((t, i) => t.setFrame(`${i === 0 ? 'a' : 'b'}/${name}`).setPosition(b.x, b.y).setFlipX(flip).setAlpha(alpha));
    // Weapon + smear (08 §4.2): behind the body on `weaponBehind` frames, else above trim B.
    const wl = p.weapon;
    this.weapon.setVisible(!!wl);
    this.smear.setVisible(!!wl?.smear);
    if (wl) {
      this.weapon.setTexture(wl.atlas, wl.frame).setPosition(b.x, b.y).setFlipX(flip).setAlpha(alpha)
        .setDepth(wl.behind ? DEPTH.player - 0.5 : DEPTH.player + 0.5);
      if (wl.smear) this.smear.setTexture(wl.atlas, wl.smear).setPosition(b.x, b.y).setFlipX(flip).setDepth(DEPTH.player + 0.6);
    }
    const hurtAgo = w.health.iframeTicks > 0 ? COMBAT.HURT_IFRAMES_TICKS - w.health.iframeTicks : Number.MAX_SAFE_INTEGER;
    this.overlay.setFrame(name).setPosition(b.x, b.y).setFlipX(flip).setDepth(DEPTH.player + 0.7).setVisible(hurtAgo < OVERLAY.hitFlash.minTicks);
  }

  setVisible(on: boolean): void {
    for (const s of [this.body, ...this.trims]) s.setVisible(on);
    if (!on) for (const s of [this.weapon, this.smear, this.overlay]) s.setVisible(false);
  }

  destroy(): void {
    for (const s of [this.body, ...this.trims, this.weapon, this.smear, this.overlay]) s.destroy();
  }
}

/** One enemy: anim from core state, overlays (hit flash > telegraph go > telegraph > spawn-in), jiggle, stun stars. */
export class EnemySprite {
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly overlay: Phaser.GameObjects.Sprite;
  private readonly stars: Phaser.GameObjects.Sprite;
  private readonly clock = new AnimClock();
  private readonly get: Lookup;
  private readonly bank: AnimBank;
  private readonly dummy: boolean;
  readonly hasArt: boolean;
  readonly e: EnemyState;
  /** True once the death anim has finished (the scene bursts it into particles once). */
  gone = false;
  constructor(scene: Phaser.Scene, bank: AnimBank, e: EnemyState) {
    this.e = e;
    this.bank = bank;
    this.get = bank.enemy(e.def.id, !!e.boss);
    this.dummy = e.def.id === 'training_dummy';
    const idle = this.get('idle');
    this.hasArt = !!idle || this.dummy;
    const atlas = this.dummy ? 'enemies_extra' : idle?.atlas ?? 'enemies_plains';
    const frame = this.dummy ? DUMMY_FRAMES.idle[0] : idle?.frames[0];
    const depth = e.boss ? DEPTH.boss : DEPTH.enemies;
    this.sprite = scene.add.sprite(0, 0, atlas, frame).setDepth(depth).setVisible(this.hasArt);
    this.overlay = scene.add.sprite(0, 0, atlas, frame).setDepth(depth + 0.5).setTintMode(Phaser.TintModes.FILL).setVisible(false);
    const st = bank.vfx('stun_stars')!;
    this.stars = scene.add.sprite(0, 0, 'vfx', st.frames[0]).setDepth(DEPTH.vfx).setVisible(false);
  }

  private dummyFrame(worldTick: number): string {
    const since = worldTick - this.e.lastPlayerHitTick;
    const i = Math.floor((since / TICK_RATE) * 20);       // hit: 3 frames once at 20 fps (08 §7.3)
    return i < DUMMY_FRAMES.hit.length ? DUMMY_FRAMES.hit[i] : DUMMY_FRAMES.idle[0];
  }

  update(worldTick: number): void {
    const e = this.e;
    if (!this.hasArt || this.gone) return;
    if (this.dummy) {
      feet(this.sprite.setFrame(this.dummyFrame(worldTick))).setPosition(e.x, e.y);
      this.updateOverlay(worldTick, 1);
      return;
    }
    const st = {
      dead: e.dead, vx: e.vx, vy: e.vy, knockback: !!e.knockback, control: e.control,
      attack: e.ai.attack ? { id: e.ai.attack.def.id, phase: e.ai.attack.phase, t: e.ai.attack.t, len: e.ai.attack.len } : null,
      boss: e.boss,
    };
    const frozen = e.hitStopTicks > 0;
    const key0 = pickEnemyAnim(st, this.get, this.clock.t, this.clock.runPhase).key;
    const dt = this.clock.advance(key0, worldTick, frozen);
    if (key0 === 'walk') this.clock.runPhase += walkFps(e.vx, e.def.walk) * dt;
    const { key, frame, alpha } = pickEnemyAnim(st, this.get, this.clock.t, this.clock.runPhase);
    const def = this.get(key)!;
    // Regular deaths last 0.4 s (04 §2.8); a boss's death plays its full anim (08 §7.4).
    const over = e.dead && (e.boss ? this.clock.key === 'death' && this.clock.t >= def.frames.length / (def.fps ?? 1) : e.deathTicks <= 0);
    if (over) { this.gone = true; this.hide(); return; }
    const flip = !e.def.noFacing && e.facing < 0;
    const jiggle = frozen ? (worldTick % 2 === 0 ? 1 : -1) : 0;      // hit-stop jiggle (08 §5.3)
    const spawn = e.spawnInTicks > 0 ? 1 - e.spawnInTicks / ENEMY.SPAWN_IN_TICKS : 1;
    for (const s of [this.sprite, this.overlay]) feet(s.setTexture(def.atlas, def.frames[frame])).setPosition(e.x + jiggle, e.y).setFlipX(flip);
    this.sprite.setVisible(true).setAlpha(alpha * spawn);
    this.updateOverlay(worldTick, alpha);
    // Stun stars orbit the head while dazed or broken (08 §11).
    const stunned = !e.dead && (e.control?.type === 'dazed' || (!!e.boss && e.control?.type === 'stagger'));
    this.stars.setVisible(stunned);
    if (stunned) {
      const sd = this.bank.vfx('stun_stars')!;
      const r = enemyRect(e);
      this.stars.setFrame(sd.frames[timeFrame(sd, worldTick / TICK_RATE)]).setPosition(e.x, r.y - VFX.stunStarsAbove);
    }
  }

  private updateOverlay(worldTick: number, alpha: number): void {
    const e = this.e, o = this.overlay;
    const flashFor = Math.max(OVERLAY.hitFlash.minTicks, e.hitStopTicks);
    const a = e.ai.attack;
    if (worldTick - e.lastPlayerHitTick < flashFor && !e.dead) {
      o.setTint(OVERLAY.hitFlash.color).setAlpha(OVERLAY.hitFlash.alpha * alpha).setVisible(true);
    } else if (a && a.phase === 'tele' && !e.dead) {
      if (a.len - a.t <= ENEMY.TELEGRAPH_FLASH_LAST_TICKS) {
        o.setTint(OVERLAY.telegraphGo.color).setAlpha(OVERLAY.telegraphGo.alpha).setVisible(true);
      } else {
        const T = OVERLAY.telegraph;
        const ph = ((a.t / TICK_RATE) % T.period) / T.period;               // triangle wave 0 → 1 → 0
        const tri = ph < 0.5 ? ph * 2 : 2 - ph * 2;
        o.setTint(a.def.hit?.unblockable ? T.unblockable : T.color).setAlpha(T.alphaMin + (T.alphaMax - T.alphaMin) * tri).setVisible(true);
      }
    } else if (e.spawnInTicks > 0) {
      o.setTint(OVERLAY.spawnIn.color).setAlpha(OVERLAY.spawnIn.alphaFrom * (e.spawnInTicks / ENEMY.SPAWN_IN_TICKS)).setVisible(true);
    } else o.setVisible(false);
  }

  private hide(): void {
    for (const s of [this.sprite, this.overlay, this.stars]) s.setVisible(false);
  }

  destroy(): void {
    for (const s of [this.sprite, this.overlay, this.stars]) s.destroy();
  }
}

/** Enemy projectiles: drawn facing right, rotated to the velocity in 22.5° steps (08 §11). Reports new ones (muzzle VFX). */
export class ProjectileSprites {
  private readonly sprites = new Map<number, Phaser.GameObjects.Sprite>();
  private readonly scene: Phaser.Scene;
  private readonly bank: AnimBank;
  constructor(scene: Phaser.Scene, bank: AnimBank) {
    this.scene = scene;
    this.bank = bank;
  }

  hasArt(id: string): boolean {
    return this.bank.projectile(id) !== undefined;
  }

  /** Returns the projectiles seen for the first time, and the ones that just went (for impact effects). */
  update(list: EnemyProjectile[], worldTick: number): { spawned: EnemyProjectile[]; gone: { id: number; x: number; y: number; def: string }[] } {
    const live = new Set<number>(), spawned: EnemyProjectile[] = [], gone: { id: number; x: number; y: number; def: string }[] = [];
    const step = (ANIM.PROJ_ANGLE_STEP * Math.PI) / 180;
    for (const p of list) {
      const def = this.bank.projectile(p.def.id);
      if (!def) continue;
      live.add(p.id);
      let s = this.sprites.get(p.id);
      if (!s) { s = this.scene.add.sprite(0, 0, def.atlas, def.frames[0]).setDepth(DEPTH.projectiles); s.setData('def', p.def.id); this.sprites.set(p.id, s); spawned.push(p); }
      const i = def.mode === 'loop' ? timeFrame(def, worldTick / TICK_RATE) : 0;
      const ang = Math.round(Math.atan2(p.vy, p.vx) / step) * step;
      s.setFrame(def.frames[i]).setPosition(p.x, p.y).setRotation(ang);
    }
    for (const [id, s] of this.sprites) if (!live.has(id)) { gone.push({ id, x: s.x, y: s.y, def: s.getData('def') }); s.destroy(); this.sprites.delete(id); }
    return { spawned, gone };
  }
}
