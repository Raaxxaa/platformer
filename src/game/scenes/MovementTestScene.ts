// M1 grey-box test level: steps the core at 120 Hz and draws it with plain rectangles.
import Phaser from 'phaser';
import { FixedStepper } from '../../core/sim/fixedStep.ts';
import { PlayerSim } from '../../core/sim/playerSim.ts';
import { MOVEMENT_TEST } from '../../data/levels/movementTest.ts';
import { debugEnabled, installDebugApi, type DebugHost } from '../debug.ts';
import { Devices } from '../input/devices.ts';
import { COLOR, drawLevel, NOSE, STATE_COLOR } from '../greybox.ts';

export class MovementTestScene extends Phaser.Scene implements DebugHost {
  sim!: PlayerSim;
  private readonly stepper = new FixedStepper();
  private devices!: Devices;
  private manual = false;
  private debug = false;
  private player!: Phaser.GameObjects.Graphics;
  private hud: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('MovementTest');
  }

  create(): void {
    this.sim = new PlayerSim(MOVEMENT_TEST.grid, MOVEMENT_TEST.spawn);
    this.devices = new Devices();
    drawLevel(this, MOVEMENT_TEST.grid);
    this.player = this.add.graphics();
    this.debug = debugEnabled();
    if (this.debug) {
      this.hud = this.add.text(4, 4, '', { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff' }).setScrollFactor(0).setDepth(10);
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
