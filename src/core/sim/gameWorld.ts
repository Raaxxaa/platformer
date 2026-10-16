// The combat world: player, combat state, enemies, hit groups, RNG streams and camera.
// Each tick runs 02 §2.1's order.
import { createCamera, stepCamera, type CameraState } from '../camera.ts';
import { createHealth, type PlayerHealth } from '../combat/health.ts';
import type { HitGroup } from '../combat/hitGroups.ts';
import { addRush, createRush, rushLevel, rushSpeedPercent, stepRush } from '../combat/rush.ts';
import { enemyRect } from '../enemies/enemy.ts';
import { overlaps } from '../combat/hitGroups.ts';
import { playerRect } from '../combat/resolve.ts';
import { cancelAttack, createPlayerCombat, stepPlayerCombat, syncPlayerGroups, type PlayerCombat } from '../combat/playerCombat.ts';
import type { FlaskState, HealRefusedReason, RushState } from '../combat/types.ts';
import { cancelDrink, createFlask, onKillFill, stepDrink, stepFlask, tryStartDrink, type DrinkState } from '../combat/flask.ts';
import { FLASK, RUSH } from '../tuning.ts';
import type { InputState } from '../input.ts';
import type { TileGrid } from '../level/tiles.ts';
import { isGrounded } from '../physics/collide.ts';
import { createPlayerBody, type MoveEvent, type PlayerBody } from '../player/body.ts';
import { defaultModifiers, type MoveContext, type MoveModifiers } from '../player/modifiers.ts';
import { stepPlayer } from '../player/movement.ts';
import { deriveSeed, Rng } from '../rng.ts';
import { activateEnemies, spawnEnemy, type EnemyState } from '../enemies/enemy.ts';
import { stepEnemyAttack, syncEnemyGroups } from '../enemies/attack.ts';
import { separateEnemies, stepEnemyBody } from '../enemies/body.ts';
import { becomeAware, stepAwareness } from '../enemies/awareness.ts';
import { stepAi } from '../enemies/ai.ts';
import { stepEnemyReactions } from '../combat/enemyReactions.ts';
import { processDeaths, resolveEnemyHits, resolvePlayerHits } from '../combat/resolve.ts';
import { onDiveEvents, onDiveGroupHit, stepDiveImpact, type DiveState } from '../combat/dive.ts';
import type { EnemySpawn } from '../enemies/types.ts';

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
  enemies?: EnemySpawn[];
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
  flask!: FlaskState;
  drinking: DrinkState | null = null;
  drinkBufferTicks = 0;
  camera!: CameraState;
  tick = 0;
  runTicks = 0;
  gold = 0;
  rng!: { enemyAI: Rng; combat: Rng; cosmetic: Rng };
  hitGroups: HitGroup[] = [];
  enemies: EnemyState[] = [];
  pendingDeaths: EnemyState[] = [];
  dive: DiveState | null = null;
  lastDashEndTick = -100000;
  lastAttackStartTick = -100000;
  /** Player-side notice multipliers (Thief Silent Steps, 03); 1 by default. */
  noticeTimeMult = 1;
  noticeRangeMult = 1;
  private rushedInstances = new Set<number>();
  private dashThrough = new Set<number>();
  /** Was the player already in hit-stop when this tick started (its melee boxes are frozen)? */
  playerFrozenAtTickStart = false;
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
    this.flask = createFlask();
    this.drinking = null;
    this.drinkBufferTicks = 0;
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
    this.enemies = (this.opts.enemies ?? []).map((s) => spawnEnemy(this, s));
    this.pendingDeaths = [];
    this.dive = null;
    this.lastDashEndTick = -100000;
    this.lastAttackStartTick = -100000;
    this.rushedInstances = new Set();
    this.dashThrough = new Set();
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
    cancelDrink(this);
  }

  /** A player hit group landed a direct hit on an enemy (Rush hooks). */
  onPlayerLandedHit(g: HitGroup, e: EnemyState): void {
    if (g.attackInstance < 0) onDiveGroupHit(this, g, e.id);
    if (this.rushedInstances.has(g.attackInstance)) return;
    this.rushedInstances.add(g.attackInstance);
    const dashing = this.body.state === 'dash' || this.tick - this.lastDashEndTick <= RUSH.DASH_HIT_WINDOW_TICKS;
    addRush(this, RUSH.HIT + (dashing ? RUSH.DASH_HIT : 0));
  }

  /** An enemy took player damage: instant awareness (04 §2.4). */
  onEnemyHitByPlayer(e: EnemyState): void {
    becomeAware(this, e, true);
  }

  /** An enemy shot hit the player (projectiles stop). */
  onEnemyShotLanded(_g: HitGroup): void {}

  /** On-kill effects that belong to other systems (flask, Rush). */
  onPlayerKill(_e: EnemyState, tier: 'regular' | 'elite'): void {
    onKillFill(this, tier);
    addRush(this, tier === 'elite' ? RUSH.KILL_ELITE : RUSH.KILL_REGULAR);
  }

  /** Drinking the flask (filled in by the flask task). */
  isDrinking(): boolean {
    return this.drinking !== null;
  }

  /** Dashing through an enemy: +4 Rush per enemy per dash (02 §8.2). */
  private dashThroughRush(): void {
    if (this.body.state !== 'dash') return;
    const pr = playerRect(this);
    for (const e of this.enemies) {
      if (e.dead || e.dormant || this.dashThrough.has(e.id) || !overlaps(pr, enemyRect(e))) continue;
      this.dashThrough.add(e.id);
      addRush(this, RUSH.DASH_THROUGH);
    }
  }

  /** Step 5 for one enemy: hit-stop, reactions, attack, AI and movement. */
  private stepEnemy(e: EnemyState): void {
    if (e.dormant) return;
    if (e.dead) {
      if (e.deathTicks > 0) e.deathTicks -= 1;
      return;
    }
    if (e.hitStopTicks > 0) {
      e.hitStopTicks -= 1;
      return;
    }
    stepEnemyReactions(e);
    for (const [id, n] of e.ai.cooldowns) if (n > 0) e.ai.cooldowns.set(id, n - 1);
    if (e.ai.gapTicks > 0) e.ai.gapTicks -= 1;
    if (e.control) {
      if (!e.knockback && e.grounded) e.vx = 0;
    } else if (!e.knockback) {
      if (e.ai.attack) stepEnemyAttack(this, e);
      else stepAi(this, e);
    }
    stepAwareness(this, e);
    e.hitWall = false;
    stepEnemyBody(this, e);
  }

  /** One 120 Hz tick in 02 §2.1 order. */
  step(input: InputState): void {
    this.events = [];
    this.tick += 1;
    this.playerFrozenAtTickStart = this.body.hitStopTicks > 0;
    if (!this.health.dead) this.runTicks += 1;
    // Wall-clock timers.
    if (this.health.iframeTicks > 0) this.health.iframeTicks -= 1;
    if (this.health.hitstunTicks > 0 && this.body.hitStopTicks === 0) this.health.hitstunTicks -= 1;
    // 3. Player actions.
    this.ctx.slotUsable = [this.combat.slots[0] !== null, this.combat.slots[1] !== null];
    stepPlayerCombat(this, input);
    tryStartDrink(this, input);
    stepDrink(this);
    if (this.drinking) this.mods.actionMoveMult = FLASK.MOVE_CAP;
    // 4. Player movement and collision. A dash, jump or dive that happened cancels the attack (01 §3 step 5).
    this.mods.speedPercents = [rushSpeedPercent(rushLevel(this.rush))];
    const moveEvents = stepPlayer(this.body, input, this.grid, this.mods, this.ctx);
    for (const e of moveEvents) {
      this.events.push({ t: 'move', e });
      if (e === 'dashStart' || e === 'slideStart') { cancelAttack(this, 'dash'); cancelDrink(this); }
      else if (e === 'jump' || e === 'doubleJump' || e === 'wallJump' || e === 'dropThrough') { cancelAttack(this, 'jump'); cancelDrink(this); }
      else if (e === 'diveStart') cancelAttack(this, 'dive');
    }
    if (moveEvents.includes('dashStart')) this.dashThrough.clear();
    if (moveEvents.includes('dashEnd')) this.lastDashEndTick = this.tick;
    onDiveEvents(this, moveEvents, input);
    syncPlayerGroups(this);
    // 5. Enemy AI and movement.
    activateEnemies(this);
    for (const e of [...this.enemies].sort((a, b) => a.id - b.id)) this.stepEnemy(e);
    separateEnemies(this);
    syncEnemyGroups(this);
    // 6. Moving hit groups.
    // 7. Hit resolution: player hits first (ties go to the player), then enemy hits.
    resolvePlayerHits(this);
    resolveEnemyHits(this);
    // 8. Statuses (none in M2). 9. Deaths.
    processDeaths(this);
    stepDiveImpact(this);
    this.dashThroughRush();
    stepRush(this);
    stepFlask(this);
    // 10. Rush and flask.
    stepCamera(this.camera, this.body);
  }
}
