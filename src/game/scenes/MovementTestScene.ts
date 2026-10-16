// M1 grey-box test level: steps the core at 120 Hz and draws it with plain rectangles.
import Phaser from 'phaser';
import type { TileGrid } from '../../core/level/tiles.ts';
import type { MoveStateId } from '../../core/player/body.ts';
import { FixedStepper } from '../../core/sim/fixedStep.ts';
import { PlayerSim } from '../../core/sim/playerSim.ts';
import { TILE_SIZE } from '../../core/tuning.ts';
import { MOVEMENT_TEST } from '../../data/levels/movementTest.ts';
import { debugEnabled, installDebugApi, type DebugHost } from '../debug.ts';
import { Devices } from '../input/devices.ts';

/** Grey-box colors (placeholder art for M1). */
const COLOR = {
  solid: 0x4a4f63,
  oneway: 0x8a90a8,
  hurtbox: 0x00ff00,
} as const;
const ONEWAY_STRIP = 4;   // px, one-way tiles are drawn as a strip at the tile top
const NOSE = 3;           // px, marks the facing side

const STATE_COLOR: Record<MoveStateId, number> = {
  ground: 0xe8e8f0, air: 0x9ad0ff, dash: 0xffd84a, slide: 0xffd84a, wallSlide: 0x7affb0, ledgeClimb: 0xff9a3c,
  diveWindup: 0xff5a5a, diveFall: 0xff5a5a, diveLand: 0xff5a5a, crawl: 0xc08aff,
  hurt: 0xe8e8f0, forced: 0xe8e8f0, minecart: 0xe8e8f0, dead: 0xe8e8f0,
};

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
    this.drawLevel(MOVEMENT_TEST.grid);
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

  /** Solid tiles as merged row runs; one-way tiles as a strip at the tile top. */
  private drawLevel(grid: TileGrid): void {
    const g = this.add.graphics();
    for (let ty = 0; ty < grid.h; ty++) {
      let tx = 0;
      while (tx < grid.w) {
        if (grid.isSolidTile(tx, ty)) {
          const start = tx;
          while (tx < grid.w && grid.isSolidTile(tx, ty)) tx++;
          g.fillStyle(COLOR.solid, 1).fillRect(start * TILE_SIZE, ty * TILE_SIZE, (tx - start) * TILE_SIZE, TILE_SIZE);
        } else {
          if (grid.kindAt(tx, ty) === 'oneway') g.fillStyle(COLOR.oneway, 1).fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, ONEWAY_STRIP);
          tx++;
        }
      }
    }
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
