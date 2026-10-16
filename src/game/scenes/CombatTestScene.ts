// M2 grey-box combat test level: steps GameWorld at 120 Hz and draws it with plain rectangles.
import Phaser from 'phaser';
import { rushLevel } from '../../core/combat/rush.ts';
import { enemyRect, type EnemyState } from '../../core/enemies/enemy.ts';
import type { EnemyId } from '../../core/enemies/types.ts';
import { FixedStepper } from '../../core/sim/fixedStep.ts';
import { GameWorld } from '../../core/sim/gameWorld.ts';
import { specToInput, type InputSpec } from '../../core/sim/playerSim.ts';
import { COMBAT, ENEMY, TICK_RATE } from '../../core/tuning.ts';
import { COMBAT_TEST } from '../../data/levels/combatTest.ts';
import { debugEnabled, installCombatDebugApi, type CombatDebugHost } from '../debug.ts';
import { COLOR, drawLevel, NOSE, STATE_COLOR } from '../greybox.ts';
import { Devices } from '../input/devices.ts';

/** Grey-box enemy colors (plan M2, Task 17). */
const ENEMY_COLOR: Partial<Record<EnemyId, number>> = {
  wolf: 0x73809f, bandit: 0xb8443f, bandit_archer: 0xe27b5b, wild_boar: 0x7e2a34, bandit_brute: 0x4a1824, training_dummy: 0x9a6e3e,
};
const DRAW = {
  telegraph: 0xff9a3c, telegraphLast: 0xfff4d0, hurtFlash: 0xffffff, controlled: 0x8a8a8a,
  projectile: 0xffd84a, attackBox: 0xff3030, attackAlpha: 0.4, enemyHurtbox: 0x4080ff,
  hpBack: 0x202020, hpFill: 0xe04040, hpGap: 4, eye: 2, overlay: 0x000000, overlayAlpha: 0.6,
} as const;

function formatTime(ticks: number): string {
  const s = ticks / TICK_RATE;
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(2).padStart(5, '0')}`;
}

export class CombatTestScene extends Phaser.Scene implements CombatDebugHost {
  world!: GameWorld;
  private readonly stepper = new FixedStepper();
  private devices!: Devices;
  private manual = false;
  private debug = false;
  private prevSpec: InputSpec = {};
  private gfx!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Text;
  private overlay!: Phaser.GameObjects.Graphics;
  private overlayText!: Phaser.GameObjects.Text;
  private marks = new Map<number, Phaser.GameObjects.Text>();

  constructor() {
    super('CombatTest');
  }

  create(): void {
    this.world = new GameWorld({ grid: COMBAT_TEST.grid, spawn: COMBAT_TEST.spawn, enemies: COMBAT_TEST.enemies });
    this.devices = new Devices();
    drawLevel(this, COMBAT_TEST.grid);
    this.gfx = this.add.graphics();
    this.hud = this.add.text(4, 4, '', { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff' }).setScrollFactor(0).setDepth(10);
    const { width, height } = this.scale;
    this.overlay = this.add.graphics().setScrollFactor(0).setDepth(20);
    this.overlay.fillStyle(DRAW.overlay, DRAW.overlayAlpha).fillRect(0, 0, width, height);
    this.overlayText = this.add.text(width / 2, height / 2, 'You died — press R', { fontFamily: 'monospace', fontSize: '16px', color: '#ffffff' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(21);
    this.debug = debugEnabled();
    if (this.debug) installCombatDebugApi(this);
    this.render();
  }

  setManual(on: boolean): void {
    this.manual = on;
    this.devices.setEnabled(!on);
  }

  /** Runs n ticks holding `spec` (buttons pressed on the first tick only). */
  stepSpec(spec: InputSpec, n: number): void {
    for (let i = 0; i < n; i++) {
      this.world.step(specToInput(this.prevSpec, spec));
      this.prevSpec = spec;
    }
  }

  update(_time: number, delta: number): void {
    this.devices.pollGamepad();
    if (!this.manual) {
      const n = this.stepper.advance(delta / 1000);
      for (let i = 0; i < n; i++) this.world.step(this.devices.builder.build());
    }
    this.render();
  }

  private render(): void {
    const w = this.world;
    const cam = w.camera;
    this.cameras.main.setScroll(cam.x + cam.shakeX, cam.y + cam.shakeY);
    const g = this.gfx.clear();

    for (const e of w.enemies) this.drawEnemy(g, e);

    for (const p of w.projectiles) g.fillStyle(DRAW.projectile, 1).fillRect(p.x - p.def.w / 2, p.y - p.def.h / 2, p.def.w, p.def.h);

    const b = w.body;
    const left = b.x - b.w / 2, top = b.y - b.h;
    const blink = w.health.iframeTicks > 0 && Math.floor(w.tick / COMBAT.IFRAME_BLINK_TICKS) % 2 === 0;
    g.fillStyle(STATE_COLOR[b.state], blink ? 0.4 : 1).fillRect(left, top, b.w, b.h);
    g.fillRect(b.facing > 0 ? left + b.w : left - NOSE, top + 4, NOSE, NOSE);
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
  }

  private drawEnemy(g: Phaser.GameObjects.Graphics, e: EnemyState): void {
    if (e.dead && e.deathTicks <= 0) return;
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
    if (this.debug) g.lineStyle(1, DRAW.enemyHurtbox, 1).strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    // HP bar: elites always, regulars after the first damage.
    if (!e.dead && (e.def.hpBar === 'always' || e.everDamaged)) {
      const y = r.y - DRAW.hpGap;
      g.fillStyle(DRAW.hpBack, 1).fillRect(r.x, y, r.w, 1);
      g.fillStyle(DRAW.hpFill, 1).fillRect(r.x, y, Math.max(0, Math.round((r.w * e.hp) / e.maxHp)), 1);
    }
  }

  /** A "?" above an enemy that is noticing the player but not yet aware. */
  private drawMarks(): void {
    const seen = new Set<number>();
    for (const e of this.world.enemies) {
      if (e.dead || e.aware || e.noticeT <= 0) continue;
      seen.add(e.id);
      let t = this.marks.get(e.id);
      if (!t) {
        t = this.add.text(0, 0, '?', { fontFamily: 'monospace', fontSize: '10px', color: '#ffd84a' }).setOrigin(0.5, 1).setDepth(5);
        this.marks.set(e.id, t);
      }
      const r = enemyRect(e);
      t.setPosition(e.x, r.y - DRAW.hpGap - 2);
    }
    for (const [id, t] of this.marks) if (!seen.has(id)) { t.destroy(); this.marks.delete(id); }
  }

  private drawHud(): void {
    const w = this.world;
    const f = w.flask;
    const pips = '●'.repeat(f.charges) + '○'.repeat(f.maxCharges - f.charges);
    const weapons = w.combat.slots.map((s, i) => {
      if (!s) return `${i + 1}: -`;
      const name = s.weaponId.split('_').map((p) => p[0].toUpperCase() + p.slice(1)).join(' ');
      const cur = w.combat.current;
      const step = cur && cur.slot === i ? ` step ${cur.step + 1} ${cur.phase}` : '';
      return `${i + 1}: ${name}${step}`;
    });
    this.hud.setText([
      `HP ${w.health.hp}/${w.health.maxHp}`,
      `Flask ${pips} ${Math.floor(f.fillTenths / 10)}%`,
      `Rush ${Math.round(w.rush.value)} (L${rushLevel(w.rush)})`,
      `Gold ${w.gold}`,
      ...weapons,
      `Time ${formatTime(w.runTicks)}${this.manual ? '  [manual]' : ''}`,
    ]);
  }
}
