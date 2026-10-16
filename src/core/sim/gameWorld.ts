// The combat world: player, combat state, enemies, hit groups, RNG streams and camera.
// Each tick runs 02 §2.1's order.
import { createCamera, stepCamera, type CameraState } from '../camera.ts';
import { createHealth, type PlayerHealth } from '../combat/health.ts';
import type { HitGroup } from '../combat/hitGroups.ts';
import { createRush } from '../combat/rush.ts';
import { cancelAttack, createPlayerCombat, stepPlayerCombat, syncPlayerGroups, type PlayerCombat } from '../combat/playerCombat.ts';
import type { HealRefusedReason, RushState } from '../combat/types.ts';
import type { InputState } from '../input.ts';
import type { TileGrid } from '../level/tiles.ts';
import { isGrounded } from '../physics/collide.ts';
import { createPlayerBody, type MoveEvent, type PlayerBody } from '../player/body.ts';
import { defaultModifiers, type MoveContext, type MoveModifiers } from '../player/modifiers.ts';
import { stepPlayer } from '../player/movement.ts';
import { deriveSeed, Rng } from '../rng.ts';

export type Stage = 1 | 2 | 3 | 4;

export type WorldEvent =
  | { t: 'move'; e: MoveEvent }
  | { t: 'hit'; target: 'player' | number; amount: number; crit: boolean; heavy: boolean }
  | { t: 'shake'; level: 'small' | 'medium' }
  | { t: 'enemyTelegraph'; enemyId: number; attackId: string; duration: number }
  | { t: 'kill'; enemyId: number; tier: 'regular' | 'elite' }
  | { t: 'playerDied'; cause: string }
  | { t: 'healRefused'; reason: HealRefusedReason }
  | { t: 'drink' };

export interface GameWorldOptions {
  grid: TileGrid;
  spawn: { x: number; y: number };
  stage?: Stage;
  runSeed?: number;
}

export class GameWorld {
  readonly opts: GameWorldOptions;
  readonly grid: TileGrid;
  readonly stage: Stage;
  readonly runSeed: number;
  body!: PlayerBody;
  mods!: MoveModifiers;
  ctx!: MoveContext;
  health!: PlayerHealth;
  rush!: RushState;
  combat!: PlayerCombat;
  camera!: CameraState;
  tick = 0;
  runTicks = 0;
  gold = 0;
  rng!: { enemyAI: Rng; combat: Rng; cosmetic: Rng };
  hitGroups: HitGroup[] = [];
  events: WorldEvent[] = [];
  private nextId = 1;

  constructor(opts: GameWorldOptions) {
    this.opts = opts;
    this.grid = opts.grid;
    this.stage = opts.stage ?? 1;
    this.runSeed = opts.runSeed ?? 1;
    this.reset();
  }

  /** A fresh entity or hit-group id. */
  newId(): number {
    return this.nextId++;
  }

  private reset(): void {
    const { grid, spawn } = this.opts;
    this.body = createPlayerBody(spawn.x, spawn.y);
    if (!isGrounded(this.body, grid, 0)) {
      this.body.state = 'air';
      this.body.grounded = false;
    }
    this.mods = defaultModifiers();
    this.ctx = { slotUsable: [true, true] };
    this.health = createHealth();
    this.rush = createRush();
    this.combat = createPlayerCombat([
      { weaponId: 'greatsword', grade: 'C', element: null, perk: null },
      { weaponId: 'war_maul', grade: 'C', element: null, perk: null },
    ]);
    this.camera = createCamera({ x: 0, y: 0, w: grid.widthPx, h: grid.heightPx }, this.body);
    this.tick = 0;
    this.runTicks = 0;
    this.gold = 0;
    this.rng = {
      enemyAI: new Rng(deriveSeed(this.runSeed, 'enemyAI', this.stage)),
      combat: new Rng(deriveSeed(this.runSeed, 'combat', this.stage)),
      cosmetic: new Rng(deriveSeed(this.runSeed, 'cosmetic', this.stage)),
    };
    this.hitGroups = [];
    this.events = [];
    this.nextId = 1;
  }

  restart(): void {
    this.reset();
  }

  /** Hurt pipeline hook: the player died this tick (06 §6.1). */
  onPlayerDied(cause: string): void {
    this.events.push({ t: 'playerDied', cause });
  }

  /** Hurt pipeline hook: hitstun cancels the attack, charge and drink (02 §5.2 step 7). */
  onPlayerHitstun(): void {
    cancelAttack(this, 'hurt');
  }

  /** Drinking the flask (filled in by the flask task). */
  isDrinking(): boolean {
    return false;
  }

  /** One 120 Hz tick in 02 §2.1 order. */
  step(input: InputState): void {
    this.events = [];
    this.tick += 1;
    if (!this.health.dead) this.runTicks += 1;
    // Wall-clock timers.
    if (this.health.iframeTicks > 0) this.health.iframeTicks -= 1;
    if (this.health.hitstunTicks > 0 && this.body.hitStopTicks === 0) this.health.hitstunTicks -= 1;
    // 3. Player actions.
    this.ctx.slotUsable = [this.combat.slots[0] !== null, this.combat.slots[1] !== null];
    stepPlayerCombat(this, input);
    // 4. Player movement and collision. A dash, jump or dive that happened cancels the attack (01 §3 step 5).
    for (const e of stepPlayer(this.body, input, this.grid, this.mods, this.ctx)) {
      this.events.push({ t: 'move', e });
      if (e === 'dashStart' || e === 'slideStart') cancelAttack(this, 'dash');
      else if (e === 'jump' || e === 'doubleJump' || e === 'wallJump' || e === 'dropThrough') cancelAttack(this, 'jump');
      else if (e === 'diveStart') cancelAttack(this, 'dive');
    }
    syncPlayerGroups(this);
    // 5. Enemy AI and movement. 6. Moving hit groups. 7. Hit resolution. 8. Statuses. 9. Deaths. 10. Rush and flask.
    stepCamera(this.camera, this.body);
  }
}
