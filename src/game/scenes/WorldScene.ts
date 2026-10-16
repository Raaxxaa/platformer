// Shared scene for a GameWorld: steps it at 120 Hz and draws it with the Plains art (boxes where art doesn't exist yet).
import Phaser from 'phaser';
import { rushLevel } from '../../core/combat/rush.ts';
import { enemyRect, type EnemyState } from '../../core/enemies/enemy.ts';
import type { EnemyId } from '../../core/enemies/types.ts';
import { FixedStepper } from '../../core/sim/fixedStep.ts';
import { GameWorld } from '../../core/sim/gameWorld.ts';
import { specToInput, type InputSpec } from '../../core/sim/playerSim.ts';
import { ENEMY } from '../../core/tuning.ts';
import { formatTime } from '../../core/time.ts';
import { FONTS } from '../../data/animKeys.ts';
import { DEPTH } from '../../data/art.ts';
import { drawTerrain, Parallax } from '../view/levelView.ts';
import type { AnimDef } from '../view/animClock.ts';
import { AnimBank } from '../view/animBank.ts';
import { EnemySprite, OUTFIT, PlayerSprite, ProjectileSprites, type PlayerViewEvents } from '../view/EntitySprites.ts';
import { SfxPlayer } from '../audio/sfx.ts';
import type { SfxRequest } from '../audio/sfxRules.ts';
import { SfxWatch } from '../audio/sfxTriggers.ts';
import { drawMarkers, VfxDirector, VfxPool, type TickEvent } from '../view/vfx.ts';
import { loadAssets } from '../assets/loadAssets.ts';
import { debugEnabled, installCombatDebugApi, type CombatDebugHost } from '../debug.ts';
import { COLOR, STATE_COLOR } from '../greybox.ts';
import { Devices } from '../input/devices.ts';

/** Grey-box enemy colors (plan M2, Task 17). */
const ENEMY_COLOR: Partial<Record<EnemyId, number>> = {
  wolf: 0x73809f, bandit: 0xb8443f, bandit_archer: 0xe27b5b, wild_boar: 0x7e2a34, bandit_brute: 0x4a1824, training_dummy: 0x9a6e3e,
};
const DRAW = {
  telegraph: 0xff9a3c, telegraphLast: 0xfff4d0, hurtFlash: 0xffffff, controlled: 0x8a8a8a,
  projectile: 0xffd84a, attackBox: 0xff3030, attackAlpha: 0.4, enemyHurtbox: 0x4080ff,
  hpBack: 0x202020, hpFill: 0xe04040, hpGap: 4, eye: 2, overlay: 0x000000, overlayAlpha: 0.6,
  playerShot: 0xfff4c8, blast: 0xffa83a, blastAlpha: 0.5, hammer: 0x42d9ff, charge: 0xffd84a,
} as const;

export abstract class WorldScene extends Phaser.Scene implements CombatDebugHost {
  world!: GameWorld;
  protected readonly stepper = new FixedStepper();
  protected devices!: Devices;
  protected manual = false;
  protected debug = false;
  protected prevSpec: InputSpec = {};
  protected gfx!: Phaser.GameObjects.Graphics;
  protected hud!: Phaser.GameObjects.BitmapText;
  protected overlay!: Phaser.GameObjects.Graphics;
  protected overlayText!: Phaser.GameObjects.BitmapText;
  protected marks = new Map<number, Phaser.GameObjects.Text>();
  protected boxes!: Phaser.GameObjects.Graphics;
  protected parallax!: Parallax;
  protected playerView!: PlayerSprite;
  protected enemyViews = new Map<EnemyState, EnemySprite>();
  protected bank!: AnimBank;
  protected projViews!: ProjectileSprites;
  protected vfx!: VfxDirector;
  protected markersGfx!: Phaser.GameObjects.Graphics;
  /** Events of every tick since the last render (core clears `world.events` each tick). */
  protected frameEvents: TickEvent[] = [];
  private playerEv: PlayerViewEvents = { lastDoubleJumpTick: -100000, lastWallJumpTick: -100000 };
  private lastRenderTick = -1;
  protected sfx!: SfxPlayer;
  private sfxWatch = new SfxWatch();
  /** Sounds found by the per-tick checks, played on the next render. */
  private sfxQueue: SfxRequest[] = [];
  private soundNote!: Phaser.GameObjects.BitmapText;
  /** `?boxes=1`: the old grey boxes instead of sprites (debugging). */
  protected boxesMode = false;
  /** Debug overview: the camera zooms out to show this world rect (screenshots of whole sections). */
  overview: { x: number; y: number; w: number; h: number } | null = null;

  /** The world this scene runs (called once in create). */
  protected abstract makeWorld(): GameWorld;
  /** Extra drawing after the shared pass (doors, markers, timer...). */
  protected renderExtra(): void {}

  preload(): void {
    loadAssets(this);
  }

  create(): void {
    this.world = this.makeWorld();
    this.devices = new Devices();
    this.bank = new AnimBank(this.cache.json.get('anims') as AnimDef[]);
    this.boxesMode = new URLSearchParams(window.location.search).get('boxes') === '1';
    this.parallax = new Parallax(this, this.world.grid.heightPx);
    drawTerrain(this, this.world.grid);
    this.boxes = this.add.graphics().setDepth(DEPTH.enemies);
    this.playerView = new PlayerSprite(this, this.bank);
    this.projViews = new ProjectileSprites(this, this.bank);
    this.vfx = new VfxDirector(new VfxPool(this, this.bank));
    this.markersGfx = this.add.graphics().setDepth(DEPTH.markers);
    this.sfx = new SfxPlayer(this);
    // Browsers start audio only after a key press or click (08 §15, 07).
    this.soundNote = this.add.bitmapText(4, this.scale.height - 4, FONTS.small, 'Click or press any key for sound')
      .setOrigin(0, 1).setScrollFactor(0).setDepth(DEPTH.hud).setAlpha(0.8);
    this.gfx = this.add.graphics().setDepth(DEPTH.projectiles);
    this.hud = this.add.bitmapText(4, 4, FONTS.small, '')
      .setScrollFactor(0).setDepth(DEPTH.hud);
    const { width, height } = this.scale;
    this.overlay = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.hud + 5);
    this.overlay.fillStyle(DRAW.overlay, DRAW.overlayAlpha).fillRect(0, 0, width, height);
    this.overlayText = this.add.bitmapText(width / 2, height / 2, FONTS.large, 'You died — press R')
      .setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.hud + 6);
    this.debug = debugEnabled();
    if (this.debug) installCombatDebugApi(this);
    this.createExtra();
    const api = window.__game as unknown as Record<string, unknown> | undefined;
    if (api) { api.vfx = () => this.vfx.pool.counts(); api.sfxLog = () => [...this.sfx.log]; }
    this.render();
  }

  /** Extra objects made after the shared ones (called in create). */
  protected createExtra(): void {}

  setManual(on: boolean): void {
    this.manual = on;
    this.devices.setEnabled(!on);
  }

  /** Runs n ticks holding `spec` (buttons pressed on the first tick only). */
  stepSpec(spec: InputSpec, n: number): void {
    for (let i = 0; i < n; i++) {
      this.stepWorld(specToInput(this.prevSpec, spec));
      this.prevSpec = spec;
    }
  }

  /** One world tick, keeping its events for the next render. */
  protected stepWorld(input: Parameters<GameWorld['step']>[0]): void {
    const before = this.world.tick;
    this.world.step(input);
    if (this.world.tick < before) { this.sfxWatch.reset(); this.sfxQueue = []; }
    const evs = this.world.events.map((e) => ({ tick: this.world.tick, e }));
    this.frameEvents.push(...evs);
    this.sfxQueue.push(...this.sfxWatch.collect(this.world, evs));
    if (this.vfx) this.vfx.update(this.world, evs, { atlas: `player_${OUTFIT}`, frame: this.playerView.frameName, origin: [0.5, 46 / 48] });
  }

  update(_time: number, delta: number): void {
    this.devices.pollGamepad();
    if (!this.manual) {
      const n = this.stepper.advance(delta / 1000);
      for (let i = 0; i < n; i++) this.stepWorld(this.devices.builder.build());
    }
    this.render();
  }

  protected render(): void {
    const w = this.world;
    const cam = w.camera;
    const main = this.cameras.main;
    if (this.overview) {
      const o = this.overview;
      main.setZoom(Math.min(this.scale.width / o.w, this.scale.height / o.h));
      main.centerOn(o.x + o.w / 2, o.y + o.h / 2);
    } else {
      main.setZoom(1);
      main.setScroll(cam.x + cam.shakeX, cam.y + cam.shakeY);
    }
    this.parallax.setVisible(!this.overview);
    this.hud.setVisible(!this.overview);
    this.parallax.update(cam.x + cam.shakeX, cam.y + cam.shakeY);
    const g = this.gfx.clear();
    this.boxes.clear();
    // A restart rewinds the tick: drop effects of the old run.
    if (w.tick < this.lastRenderTick) {
      this.vfx.reset(); this.frameEvents = []; this.playerEv = { lastDoubleJumpTick: -100000, lastWallJumpTick: -100000 };
      this.sfx.play([{ id: 'restart' }], w.tick, { camCenterX: cam.x, playerX: w.body.x });
    }
    this.lastRenderTick = w.tick;
    for (const { tick, e } of this.frameEvents) {
      if (e.t === 'move' && e.e === 'doubleJump') this.playerEv.lastDoubleJumpTick = tick;
      if (e.t === 'move' && e.e === 'wallJump') this.playerEv.lastWallJumpTick = tick;
    }

    this.syncEnemyViews();
    for (const e of w.enemies) this.drawEnemy(g, e);

    const proj = this.projViews.update(this.boxesMode ? [] : w.projectiles, w.tick);
    for (const p of proj.spawned) this.vfx.muzzle(p.x, p.y, w.tick);
    for (const p of w.projectiles) {
      if (this.boxesMode || !this.projViews.hasArt(p.def.id)) g.fillStyle(DRAW.projectile, 1).fillRect(p.x - p.def.w / 2, p.y - p.def.h / 2, p.def.w, p.def.h);
    }

    // Player projectiles, blasts and the thrown Storm Hammer: grey boxes until ART5 (rotated boxes are drawn as their swept box).
    for (const p of w.playerProjectiles) g.fillStyle(DRAW.playerShot, 1).fillRect(p.x - p.def.w / 2, p.y - p.def.h / 2, p.def.w, p.def.h);
    for (const id of w.blasts) { const bl = w.hitGroups.find((x) => x.id === id); if (bl) g.fillStyle(DRAW.blast, DRAW.blastAlpha).fillRect(bl.rect.x, bl.rect.y, bl.rect.w, bl.rect.h); }
    if (w.hammer) g.fillStyle(DRAW.hammer, 1).fillRect(w.hammer.x - 8, w.hammer.y - 8, 16, 16);

    const b = w.body;
    const left = b.x - b.w / 2, top = b.y - b.h;
    // Charge bar (07 §5.5, simplest form): fills over the charge time, white when full.
    const ch = w.combat.charge;
    if (ch) {
      const f = Math.min(1, ch.ticks / Math.max(1, ch.need));
      g.fillStyle(DRAW.hpBack, 1).fillRect(b.x - 10, top - 6, 20, 2);
      g.fillStyle(f >= 1 ? 0xffffff : DRAW.charge, 1).fillRect(b.x - 10, top - 6, Math.round(20 * f), 2);
    }
    this.playerView.setVisible(!this.boxesMode);
    if (this.boxesMode) this.boxes.fillStyle(STATE_COLOR[b.state], 1).fillRect(left, top, b.w, b.h);
    else this.playerView.update(w, this.playerEv);
    this.vfx.pool.update(w.tick);
    drawMarkers(this.markersGfx.clear(), w);
    const reqs = [...this.sfxQueue, ...this.sfxWatch.footsteps(this.playerView.anim)];
    this.sfxQueue = [];
    this.sfx.play(reqs, w.tick, { camCenterX: cam.x + this.scale.width / 2, playerX: b.x });
    this.soundNote.setVisible(this.sfx.locked && !this.overview);
    if (this.debug) g.lineStyle(1, COLOR.hurtbox, 1).strokeRect(left + 0.5, top + 0.5, b.w - 1, b.h - 1);

    // Active attack hitboxes: the player's always (M2), the enemies' with ?debug=1.
    for (const h of w.hitGroups) {
      if (!h.active || (h.owner !== 'player' && !this.debug)) continue;
      g.fillStyle(DRAW.attackBox, DRAW.attackAlpha).fillRect(h.rect.x, h.rect.y, h.rect.w, h.rect.h);
    }

    this.drawMarks();
    this.drawHud();
    const dead = w.phase === 'deathScreen';
    this.overlay.setVisible(dead);
    this.overlayText.setVisible(dead);
    this.renderExtra();
    this.frameEvents = [];
  }

  /** One view per enemy; a restart makes new enemies, so stale views go. */
  private syncEnemyViews(): void {
    const live = new Set(this.world.enemies);
    for (const [e, v] of this.enemyViews) if (!live.has(e)) { v.destroy(); this.enemyViews.delete(e); }
    for (const e of this.world.enemies) {
      let v = this.enemyViews.get(e);
      if (!v) {
        v = new EnemySprite(this, this.bank, e);
        this.enemyViews.set(e, v);
        if (e.spawnInTicks > 0) this.vfx.spawnIn(e, this.world.tick);
      }
      if (this.boxesMode) continue;
      const wasGone = v.gone;
      v.update(this.world.tick);
      if (v.gone && !wasGone) this.vfx.deathBurst(e, this.world.tick);
    }
  }

  private drawEnemy(g: Phaser.GameObjects.Graphics, e: EnemyState): void {
    if (e.dead && e.deathTicks <= 0) return;
    const r = enemyRect(e);
    if (this.boxesMode || !this.enemyViews.get(e)?.hasArt) this.drawEnemyBox(this.boxes, e);
    if (this.debug) g.lineStyle(1, DRAW.enemyHurtbox, 1).strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    // HP bar: elites always, regulars after the first damage.
    if (!e.dead && (e.def.hpBar === 'always' || e.everDamaged)) {
      const y = r.y - DRAW.hpGap;
      g.fillStyle(DRAW.hpBack, 1).fillRect(r.x, y, r.w, 1);
      g.fillStyle(DRAW.hpFill, 1).fillRect(r.x, y, Math.max(0, Math.round((r.w * e.hp) / e.maxHp)), 1);
    }
  }

  /** Enemies without art yet (the Training Dummy) stay grey boxes. */
  private drawEnemyBox(g: Phaser.GameObjects.Graphics, e: EnemyState): void {
    const r = enemyRect(e);
    const alpha = e.dead ? e.deathTicks / ENEMY.DEATH_ANIM_TICKS : 1;
    let color = ENEMY_COLOR[e.def.id] ?? 0xffffff;
    const a = e.ai.attack;
    if (a && a.phase === 'tele') color = a.len - a.t <= ENEMY.TELEGRAPH_FLASH_LAST_TICKS ? DRAW.telegraphLast : DRAW.telegraph;
    if (e.control && e.control.type !== 'dazed') color = DRAW.controlled;
    if (e.hurtFlashTicks > 0) color = DRAW.hurtFlash;
    g.fillStyle(color, alpha).fillRect(r.x, r.y, r.w, r.h);
    // The eye on the facing side.
    const ex = e.facing > 0 ? r.x + r.w - DRAW.eye - 1 : r.x + 1;
    g.fillStyle(0x000000, alpha).fillRect(ex, r.y + 2, DRAW.eye, DRAW.eye);
  }

  /** A "?" above an enemy that is noticing the player but not yet aware. */
  private drawMarks(): void {
    const seen = new Set<number>();
    for (const e of this.world.enemies) {
      if (e.dead || e.aware || e.noticeT <= 0) continue;
      seen.add(e.id);
      let t = this.marks.get(e.id);
      if (!t) {
        t = this.add.text(0, 0, '?', { fontFamily: 'monospace', fontSize: '10px', color: '#ffd84a' }).setOrigin(0.5, 1).setDepth(DEPTH.projectiles);
        this.marks.set(e.id, t);
      }
      const r = enemyRect(e);
      t.setPosition(e.x, r.y - DRAW.hpGap - 2);
    }
    for (const [id, t] of this.marks) if (!seen.has(id)) { t.destroy(); this.marks.delete(id); }
  }

  /** HUD lines (the stage scene puts the timer top-right instead). */
  protected hudLines(): string[] {
    const w = this.world;
    const f = w.flask;
    const pips = `${f.charges}/${f.maxCharges}`;
    const weapons = w.combat.slots.map((s, i) => {
      if (!s) return `${i + 1}: -`;
      const name = s.weaponId.split('_').map((p) => p[0].toUpperCase() + p.slice(1)).join(' ');
      const cur = w.combat.current;
      const step = cur && cur.slot === i ? ` step ${cur.step + 1} ${cur.phase}` : '';
      return `${i + 1}: ${name}${step}`;
    });
    return [
      `HP ${w.health.hp}/${w.health.maxHp}`,
      `Flask ${pips} ${Math.floor(f.fillTenths / 10)}%`,
      `Rush ${Math.round(w.rush.value)} (L${rushLevel(w.rush)})`,
      `Gold ${w.gold}`,
      ...weapons,
      `Time ${formatTime(w.runTicks)}${this.manual ? '  [manual]' : ''}`,
    ];
  }

  private drawHud(): void {
    this.hud.setText(this.hudLines());
  }
}
