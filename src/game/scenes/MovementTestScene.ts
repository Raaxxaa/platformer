// M1 movement test level: steps the core at 120 Hz. Plains tiles and background; the player stays a
// state-colored box here so every movement state stays readable.
import Phaser from 'phaser';
import { FixedStepper } from '../../core/sim/fixedStep.ts';
import { PlayerSim } from '../../core/sim/playerSim.ts';
import { MOVEMENT_TEST } from '../../data/levels/movementTest.ts';
import { debugEnabled, installDebugApi, type DebugHost } from '../debug.ts';
import { Devices } from '../input/devices.ts';
import { COLOR, NOSE, STATE_COLOR } from '../greybox.ts';
import { drawTerrain, Parallax, preloadArt } from '../art/artViews.ts';
import { DEPTH } from '../../data/art.ts';

export class MovementTestScene extends Phaser.Scene implements DebugHost {
  sim!: PlayerSim;
  private readonly stepper = new FixedStepper();
  private devices!: Devices;
  private manual = false;
  private debug = false;
  private player!: Phaser.GameObjects.Graphics;
  private hud: Phaser.GameObjects.Text | null = null;
  private parallax!: Parallax;

  constructor() {
    super('MovementTest');
  }

  preload(): void {
    preloadArt(this);
  }

  create(): void {
    this.sim = new PlayerSim(MOVEMENT_TEST.grid, MOVEMENT_TEST.spawn);
    this.devices = new Devices();
    this.parallax = new Parallax(this, MOVEMENT_TEST.grid.heightPx);
    drawTerrain(this, MOVEMENT_TEST.grid);
    this.player = this.add.graphics().setDepth(DEPTH.player);
    this.debug = debugEnabled();
    if (this.debug) {
      this.hud = this.add.text(4, 4, '', { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff', stroke: '#0d0b14', strokeThickness: 2 }).setScrollFactor(0).setDepth(DEPTH.hud);
      installDebugApi(this);
    }
    this.render();
  }

  setManual(on: boolean): void {
    this.manual = on;
    this.devices.setEnabled(!on);
  }

  update(_time: number, delta: number): void {
    this.devices.pollGamepad();
    if (!this.manual) {
      const n = this.stepper.advance(delta / 1000);
      for (let i = 0; i < n; i++) this.sim.step(this.devices.builder.build());
    }
    this.render();
  }

  private render(): void {
    const b = this.sim.body;
    const cam = this.sim.camera;
    this.cameras.main.setScroll(cam.x, cam.y);
    this.parallax.update(cam.x, cam.y);

    const left = b.x - b.w / 2, top = b.y - b.h;
    const g = this.player.clear();
    g.fillStyle(STATE_COLOR[b.state], 1).fillRect(left, top, b.w, b.h);
    g.fillRect(b.facing > 0 ? left + b.w : left - NOSE, top + 4, NOSE, NOSE);
    if (this.debug) g.lineStyle(1, COLOR.hurtbox, 1).strokeRect(left + 0.5, top + 0.5, b.w - 1, b.h - 1);

    if (this.hud) {
      const cooldown = Math.max(0, b.dashReadyPt - b.pt);
      this.hud.setText([
        `state ${b.state}  pt ${b.pt}`,
        `vx ${b.vx.toFixed(1)}  vy ${b.vy.toFixed(1)}`,
        `grounded ${b.grounded}  airDash ${b.airDashAvailable}  doubleJump ${b.doubleJumpAvailable}`,
        `dash cooldown ${cooldown}${this.manual ? '  [manual]' : ''}`,
      ]);
    }
  }
}
