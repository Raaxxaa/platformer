// The combat world: player, combat state, enemies, hit groups, RNG streams and camera.
// Each tick runs 02 §2.1's order.
import { setupMerchant, type MerchantState } from '../loot/merchant.ts';
import { stepLucky, type LuckyBlock } from '../loot/lucky.ts';
import type { LuckyId } from '../../data/loot.ts';
import { setupLoot, type Chest } from '../loot/sources.ts';
import { newEconomy, stepCoins, type Coin, type EconomyState } from '../economy/gold.ts';
import { stepKeys } from '../economy/keys.ts';
import { stepSignatures } from '../combat/signatures.ts';
import { dashCooldownMult, extraSpeed } from '../loot/perks.ts';
import { cancelEnemyAttack } from '../enemies/attack.ts';
import { enemyActs, stepStatuses } from '../combat/status.ts';
import { createCamera, shake, snapCamera, stepCamera, type CameraState } from '../camera.ts';
import { createHealth, type PlayerHealth } from '../combat/health.ts';
import type { HitGroup } from '../combat/hitGroups.ts';
import { addRush, createRush, rushLevel, rushSpeedPercent, stepRush } from '../combat/rush.ts';
import { enemyRect } from '../enemies/enemy.ts';
import { overlaps } from '../combat/hitGroups.ts';
import { playerRect } from '../combat/resolve.ts';
import { cancelAttack, createPlayerCombat, stepPlayerCombat, syncPlayerGroups, type PlayerCombat } from '../combat/playerCombat.ts';
import type { FlaskState, HealRefusedReason, RushState } from '../combat/types.ts';
import { addFlaskFill, cancelDrink, createFlask, onKillFill, stepDrink, stepFlask, tryStartDrink, type DrinkState } from '../combat/flask.ts';
import { CAMERA, COMBAT, FLASK, RESTART, RUSH } from '../tuning.ts';
import { emptyInput, type InputState } from '../input.ts';
import type { TileGrid } from '../level/tiles.ts';
import { isGrounded, pushOut } from '../physics/collide.ts';
import { Bodies, type SolidBody } from '../physics/bodies.ts';
import { checkSpikes } from '../hazards/spikes.ts';
import { createPlayerBody, type MoveEvent, type PlayerBody } from '../player/body.ts';
import { cloneLoadout, createAbilityRuntime, defaultLoadout, type Loadout } from '../abilities/runtime.ts';
import type { AbilityId, AbilityRuntime, BondId, ClassId, ClassState, HybridId } from '../abilities/types.ts';
import { clearAbilityEffects, fillAbilities, onCastCancelMove, onCastHurt, stepAbilities } from '../abilities/abilitySystem.ts';
import { stepAbilityEntities, type AbilityEntity } from '../abilities/entities.ts';
import '../abilities/list/index.ts';
import { refreshTrainingStands, setupTraining, stepTraining, type TrainingState } from '../run/training.ts';
import { onHurtCloseChoice, stepGroundItems, stepInteract, type GroundItem, type Interactable } from '../abilities/items.ts';
import { vampireTenths } from '../abilities/list/vampire.ts';
import { hammerOutIn, removeHammer, stepHammer, type HammerState } from '../combat/stormHammer.ts';
import { clearPlayerProjectiles, clearSpentGroups, stepPlayerProjectiles, type PlayerProjectile } from '../combat/playerProjectiles.ts';
import { classChanged, computeClassState } from '../classes/classState.ts';
import { onBondChange, stepBonds } from '../classes/bonds.ts';
import { clearHybridState, hybridNoticeMult, hybridSpeed } from '../classes/hybrids.ts';
import { defaultModifiers, type MoveContext, type MoveModifiers } from '../player/modifiers.ts';
import { stepPlayer } from '../player/movement.ts';
import { deriveSeed, Rng } from '../rng.ts';
import { activateEnemies, spawnEnemy, type EnemyState } from '../enemies/enemy.ts';
import { stepEnemyAttack, syncEnemyGroups } from '../enemies/attack.ts';
import { separateEnemies, stepEnemyBody } from '../enemies/body.ts';
import { becomeAware, stepAwareness } from '../enemies/awareness.ts';
import { stepAi, stepSparring } from '../enemies/ai.ts';
import { attackHooks } from '../enemies/special.ts';
import { removeProjectile, stepProjectiles, type EnemyProjectile } from '../enemies/projectiles.ts';
import { stepEnemyReactions } from '../combat/enemyReactions.ts';
import { processDeaths, resolveEnemyHits, resolvePlayerHits } from '../combat/resolve.ts';
import { endDive, onDiveEvents, onDiveGroupHit, stepDiveImpact, type DiveState } from '../combat/dive.ts';
import type { EnemySpawn } from '../enemies/types.ts';
import { buildWorldParts, type LevelData, type LevelEnemySpawn, type LevelObject } from '../level/loadLevel.ts';
import { createRunState, type RunState } from '../run/runState.ts';
import { fnv1a32 } from '../rng.ts';
import { buildArenas, stepArenas, type ArenaRt } from '../run/arenas.ts';
import { buildTimedDoors, stepTimedDoors, type TimedDoorRt } from '../run/timedDoors.ts';
import { stepZones, type HintAction } from '../run/zones.ts';
import { stepClocks } from '../run/runState.ts';
import { bossBar, stepBossPhases, type BossBar } from '../enemies/boss.ts';
import { stepRockfall, type RockMarker } from '../enemies/greatBoar.ts';

export type Stage = 1 | 2 | 3 | 4;

/** Loot objects that are only grey markers until M4. */
const MARKER_TYPES = new Set<string>([]);

/** 'stage' while playing, 'dead' for the 1 s after death, then 'deathScreen' (06 §6.1). */
export type WorldPhase = 'stage' | 'dead' | 'deathScreen';

export type WorldEvent =
  | { t: 'move'; e: MoveEvent }
  | { t: 'hit'; target: 'player' | number; amount: number; crit: boolean; heavy: boolean; slot?: 0 | 1; step?: number; ability?: string; chainFrom?: number; dot?: boolean }
  | { t: 'shake'; level: 'small' | 'medium' }
  | { t: 'enemyTelegraph'; enemyId: number; attackId: string; duration: number }
  | { t: 'kill'; enemyId: number; tier: 'regular' | 'elite' }
  | { t: 'playerDied'; cause: string }
  | { t: 'healRefused'; reason: HealRefusedReason }
  | { t: 'drink' }
  | { t: 'arenaLocked'; arenaId: string }
  | { t: 'arenaWave'; arenaId: string; wave: number }
  | { t: 'arenaCleared'; arenaId: string; clearTicks: number; fast: boolean }
  | { t: 'timedDoorOpened'; doorId: string }
  | { t: 'timedDoorMissed'; doorId: string }
  | { t: 'bossDefeated'; bossId: string; stage: Stage }
  | { t: 'split'; index: number; runTicks: number; segmentTicks: number; deltaTicks: number | null; bestSegment: boolean }
  | { t: 'classChanged'; displayName: string; bond: BondId | null; hybrid: HybridId | null }
  | { t: 'classDiscovered'; id: BondId | HybridId }
  | { t: 'abilityUsed'; slot: 0 | 1; id: AbilityId; linked: boolean }
  | { t: 'abilityLinked'; slot: 0 | 1 }
  | { t: 'abilityFizzle'; slot: 0 | 1 }
  | { t: 'abilityNotReady'; slot: 0 | 1 }
  | { t: 'lockpickUsed' }
  | { t: 'itemTaken'; itemId: number; slot: 0 | 1 }
  | { t: 'sparringHit' }
  | { t: 'openClassPick'; cls: ClassId }
  | { t: 'stationDone'; id: number }
  | { t: 'leftTraining' }
  | { t: 'goldChanged'; tenths: number; reason: string }
  | { t: 'keysFull' }
  | { t: 'keyTaken' }
  | { t: 'chestOpened'; kind: 'key' | 'cursed' | 'timed'; objectId: number }
  | { t: 'curseApplied'; id: string }
  | { t: 'curseLifted' }
  | { t: 'luckyResult'; id: LuckyId }
  | { t: 'luckyBroken'; objectId: number }
  | { t: 'purchase'; what: string; price: number }
  | { t: 'cantAfford' };

export interface GameWorldOptions {
  grid: TileGrid;
  spawn: { x: number; y: number };
  facing?: 1 | -1;
  seedText?: string;
  level?: LevelData;
  /** Arena wave spawns, spawned by the arena logic (06 §9.2). */
  waveSpawns?: LevelEnemySpawn[];
  /** Loot objects that don't work yet (M4): drawn as markers. */
  markers?: LevelObject[];
  stage?: Stage;
  runSeed?: number;
  enemies?: EnemySpawn[];
  /** Solid bodies at stage load (doors etc.); copied fresh on every restart. */
  bodies?: SolidBody[];
  /** Items on the ground at stage start (M4 armory stands). */
  items?: GroundItem[];
  /** Weapons and abilities at stage start and on restart (default: the M2 loadout). */
  loadout?: Loadout;
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
  abilities!: AbilityRuntime;
  /** Live ability entities (zones, bolts, marks...): each ticks itself; death and stage start clear them (03 §7.9). */
  abilityEntities: AbilityEntity[] = [];
  /** Weapon and ability items on the ground, and placed interactables (05 §5.7, 06 §11). */
  groundItems: GroundItem[] = [];
  interactables: Interactable[] = [];
  /** Straw targets waiting to come back (04 §2.12). */
  respawns: { spawn: EnemySpawn; at: number }[] = [];
  /** Training Yard state (null elsewhere) and the stations done this session (06 §12.4; saved in M7). */
  training: TrainingState | null = null;
  readonly trainingDone = new Set<number>();
  weaponSwapChoice: { itemId: number } | null = null;
  classState!: ClassState;
  /** Bonds and hybrids seen this session (06 saves them in M7). */
  readonly discoveredClasses = new Set<BondId | HybridId>();
  /** 02 §1 hit streak: attack instances that landed, the streak and its last landing tick. */
  hitStreak = 0;
  lastLandingTick = -100000;
  landedInstances = new Set<number>();
  /** Attack instances whose landing made the streak a multiple of 3 (Blademaster). */
  streakCrit = new Set<number>();
  /** HP Iron Will added when it turned on (03 §5.3). */
  ironWillAddedHP = 0;
  /** Extra additive bonus per attack instance (Gladiator switch, Warden melee prime). */
  instanceBonus = new Map<number, number>();
  /** Thunderlord bolts called per attack instance (03 §6.5). */
  thunderBolts = new Map<number, number>();
  flask!: FlaskState;
  drinking: DrinkState | null = null;
  drinkBufferTicks = 0;
  camera!: CameraState;
  tick = 0;
  econ: EconomyState = newEconomy();
  coins: Coin[] = [];
  chests: Chest[] = [];
  luckyBlocks: LuckyBlock[] = [];
  merchant: MerchantState | null = null;
  /** Shown gold (05 §9.1). */
  get gold(): number { return Math.floor(this.econ.goldTenths / 10); }
  rng!: { enemyAI: Rng; combat: Rng; cosmetic: Rng };
  bodies!: Bodies;
  run!: RunState;
  arenas = new Map<string, ArenaRt>();
  timedDoors: TimedDoorRt[] = [];
  activeHint: HintAction | null = null;
  rockMarkers: RockMarker[] = [];
  readonly level: LevelData | null;
  readonly waveSpawns: LevelEnemySpawn[];
  readonly markers: LevelObject[];
  hitGroups: HitGroup[] = [];
  enemies: EnemyState[] = [];
  pendingDeaths: EnemyState[] = [];
  projectiles: EnemyProjectile[] = [];
  playerProjectiles: PlayerProjectile[] = [];
  /** The thrown Storm Hammer (02 §11) and each slot's last launch tick. */
  hammer: HammerState | null = null;
  hammerLaunchTick: [number, number] = [-100000, -100000];
  /** Blast hit groups: they live for the tick they appear (02 §10.4). */
  blasts: number[] = [];
  dive: DiveState | null = null;
  lastDashEndTick = -100000;
  lastAttackStartTick = -100000;
  /** Player-side notice multipliers (Thief Silent Steps, 03); 1 by default. */
  noticeTimeMult = 1;
  /** 04 §2.4 player-side notice time: the base times Thief's ×2 (03 §6.1). */
  get noticeTime(): number {
    return this.noticeTimeMult * hybridNoticeMult(this);
  }
  noticeRangeMult = 1;
  private rushedInstances = new Set<number>();
  private dashThrough = new Set<number>();
  /** Was the player already in hit-stop when this tick started (its melee boxes are frozen)? */
  playerFrozenAtTickStart = false;
  events: WorldEvent[] = [];
  phase: WorldPhase = 'stage';
  deathTick = 0;
  private nextId = 1;

  constructor(opts: GameWorldOptions) {
    this.opts = opts;
    this.grid = opts.grid;
    this.stage = opts.stage ?? 1;
    this.runSeed = opts.seedText !== undefined ? fnv1a32(opts.seedText) : opts.runSeed ?? 1;
    this.level = opts.level ?? null;
    this.waveSpawns = opts.waveSpawns ?? [];
    this.markers = opts.markers ?? [];
    this.reset();
  }

  /** A stage world from level data (M3 Task 4): player start, placed enemies, bodies, markers, run state. */
  static fromLevel(d: LevelData, opts: { seedText: string }): GameWorld {
    const parts = buildWorldParts(d);
    const start = d.objects.find((o) => o.type === 'player_start');
    if (!start) throw new Error(`level ${d.id} has no player_start`);
    const bodies: SolidBody[] = parts.bodies.map((b) => ({
      id: b.id, x: b.x, y: b.y, w: b.w, h: b.h, oneWay: b.oneWay, surface: 'normal', grabbable: b.grabbable, noTeleport: b.noTeleport, active: b.active,
    }));
    return new GameWorld({
      grid: parts.grid, spawn: { x: start.x, y: start.y }, facing: Number(start.props.facing ?? 1) < 0 ? -1 : 1,
      stage: (d.stage || 1) as Stage, seedText: opts.seedText, level: d, bodies,
      enemies: parts.spawns.filter((s) => s.wave === 0),
      waveSpawns: parts.spawns.filter((s) => s.wave > 0),
      markers: d.objects.filter((o) => MARKER_TYPES.has(o.type)),
    });
  }

  /** A fresh entity or hit-group id. */
  newId(): number {
    return this.nextId++;
  }

  private reset(): void {
    const { grid, spawn } = this.opts;
    this.bodies = new Bodies(grid.w, grid.h);
    for (const b of this.opts.bodies ?? []) this.bodies.add({ ...b });
    grid.bodies = this.bodies;
    this.body = createPlayerBody(spawn.x, spawn.y);
    this.body.facing = this.opts.facing ?? 1;
    // The restart hold survives a restart (06 §6.2: holding through one never restarts twice).
    const hold = this.run ? { h: this.run.restartHoldTicks, n: this.run.restartNeedsRelease } : { h: 0, n: false };
    this.run = createRunState(this.opts.seedText ?? '');
    this.run.runSeed = this.runSeed;
    this.run.restartHoldTicks = hold.h;
    this.run.restartNeedsRelease = hold.n;
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
    const lo = cloneLoadout(this.opts.loadout ?? defaultLoadout());
    this.combat = createPlayerCombat(lo.weapons);
    this.abilities = createAbilityRuntime(lo.abilities);
    this.classState = computeClassState([null, null], [null, null]);
    this.hitStreak = 0;
    this.lastLandingTick = -100000;
    this.landedInstances = new Set();
    this.streakCrit = new Set();
    this.ironWillAddedHP = 0;
    this.instanceBonus = new Map();
    this.camera = createCamera({ x: 0, y: 0, w: grid.widthPx, h: grid.heightPx }, this.body);
    this.tick = 0;
    this.econ = newEconomy();
    this.coins = [];
    this.rng = {
      enemyAI: new Rng(deriveSeed(this.runSeed, 'enemyAI', this.stage)),
      combat: new Rng(deriveSeed(this.runSeed, 'combat', this.stage)),
      cosmetic: new Rng(deriveSeed(this.runSeed, 'cosmetic', this.stage)),
    };
    this.hitGroups = [];
    this.events = [];
    this.nextId = 1;
    this.refreshClassState();
    this.enemies = (this.opts.enemies ?? []).map((s) => spawnEnemy(this, s));
    this.pendingDeaths = [];
    this.projectiles = [];
    this.playerProjectiles = [];
    this.blasts = [];
    this.hammer = null;
    this.hammerLaunchTick = [-100000, -100000];
    this.dive = null;
    this.lastDashEndTick = -100000;
    this.lastAttackStartTick = -100000;
    this.rushedInstances = new Set();
    this.dashThrough = new Set();
    this.rockMarkers = [];
    this.arenas = buildArenas(this);
    this.timedDoors = buildTimedDoors(this);
    this.activeHint = null;
    this.phase = 'stage';
    this.deathTick = 0;
    this.abilityEntities = [];
    this.groundItems = (this.opts.items ?? []).map((i) => ({ ...i, weapon: i.weapon && { ...i.weapon }, ability: i.ability && { ...i.ability } }));
    this.weaponSwapChoice = null;
    this.respawns = [];
    this.training = null;
    this.interactables = [];
    if (this.level?.kind === 'training') setupTraining(this);
    if (this.level) this.rollStageLoot();
    fillAbilities(this);
  }

  restart(): void {
    this.reset();
  }

  /** Replace the loadout now and for every restart (kit pick, debug). */
  setLoadout(l: Loadout): void {
    this.opts.loadout = cloneLoadout(l);
    const c = cloneLoadout(l);
    this.combat.slots = c.weapons;
    this.combat.current = null;
    this.abilities.slots = c.abilities;
    this.refreshClassState();
    refreshTrainingStands(this);
    // Before the run starts (the kit pick), stage-load loot rolls again with the abilities now carried (05 §5.1, §12).
    if (this.tick === 0 && this.level && this.level.kind !== 'training') this.rollStageLoot();
  }

  /** Stage-load loot: stands, placed keys, chests, Lucky Blocks, elite drops, the merchant. */
  rollStageLoot(forceMerchant = false): void {
    this.groundItems = this.groundItems.filter((i) => !i.stand && !i.key && i.merchantSlot === undefined);
    this.interactables = this.interactables.filter((i) => !i.kind.endsWith('_chest') && i.kind !== 'merchant_altar');
    setupLoot(this);
    setupMerchant(this, forceMerchant);
  }

  /** 03 §4.4: recompute the class state after any slot change; emit classChanged / classDiscovered. */
  refreshClassState(): void {
    const prev = this.classState;
    const next = computeClassState(this.abilities.slots.map((s) => s?.id ?? null), this.combat.slots.map((s) => s?.weaponId ?? null));
    this.classState = next;
    onBondChange(this, prev, next);
    if (prev.hybrid !== next.hybrid) clearHybridState(this);
    if (classChanged(prev, next)) this.events.push({ t: 'classChanged', displayName: next.displayName, bond: next.bond, hybrid: next.hybrid });
    const found = next.bond ?? next.hybrid;
    if (found && !this.discoveredClasses.has(found)) {
      this.discoveredClasses.add(found);
      this.events.push({ t: 'classDiscovered', id: found });
    }
  }

  /** Run time in ticks (06 §5.1). */
  get runTicks(): number {
    return this.run.runTicks;
  }

  /** The stage boss died (06 §2.5): split 1 on this tick, unless the player died on an earlier tick. */
  onStageBossDefeated(): void {
    const r = this.run;
    if (r.phase === 'dead' && r.deathTick !== this.tick) return;
    if (r.splits[0] !== null) return;
    r.splits[0] = r.runTicks;
    // PB comparison (deltaTicks, bestSegment) arrives with save data in M7.
    this.events.push({ t: 'split', index: 1, runTicks: r.runTicks, segmentTicks: r.runTicks, deltaTicks: null, bestSegment: false });
  }

  /** The boss bar while a boss arena is locked (04 §9.4). */
  get bossBar(): BossBar | null {
    return bossBar(this);
  }

  /** Adds a solid body now (tests, debug). */
  addBody(b: SolidBody): void {
    this.bodies.add({ ...b });
  }

  /** Turns a body on or off. A body turning on over the player pushes the player out (01 §13.9, §2.8). */
  setBodyActive(id: string, on: boolean): void {
    this.bodies.setActive(id, on);
    if (on) pushOut(this.body, this.grid);
  }

  /** Debug: a fresh player body with its feet at (x, y); everything else stays. */
  teleportPlayer(x: number, y: number): void {
    this.body = createPlayerBody(x, y);
    if (!isGrounded(this.body, this.grid, 0)) {
      this.body.state = 'air';
      this.body.grounded = false;
    }
    cancelAttack(this, 'hurt');
    snapCamera(this.camera, this.body);
  }

  /** Debug: spawn one more enemy (active at once). */
  spawnExtra(s: EnemySpawn): EnemyState {
    const e = spawnEnemy(this, s);
    e.dormant = false;
    this.enemies.push(e);
    return e;
  }

  /** Hurt pipeline hook: the player died this tick (06 §6.1). */
  onPlayerDied(cause: string): void {
    this.phase = 'dead';
    this.deathTick = this.tick;
    this.run.phase = 'dead';
    this.run.deathTick = this.tick;
    // No ghost hits: every player hit group goes now; Rush resets at death (02 §8.1).
    cancelAttack(this, 'hurt');
    endDive(this);
    clearAbilityEffects(this);
    clearHybridState(this);
    clearPlayerProjectiles(this);
    removeHammer(this, true);
    this.hitGroups = this.hitGroups.filter((g) => g.owner !== 'player');
    this.rush.value = 0;
    this.events.push({ t: 'playerDied', cause });
  }

  /** 02 §1: an attack instance's first direct hit on an enemy adds 1 to the hit streak. */
  noteLanding(g: HitGroup): boolean {
    if (this.landedInstances.has(g.attackInstance)) return false;
    this.landedInstances.add(g.attackInstance);
    this.hitStreak += 1;
    this.lastLandingTick = this.tick;
    if (this.hitStreak % 3 === 0) this.streakCrit.add(g.attackInstance);
    return true;
  }

  /** Unblocked damage to the player resets the hit streak (02 §5.2 step 10). */
  onPlayerDamaged(): void {
    this.hitStreak = 0;
    onHurtCloseChoice(this);
  }

  /** Hurt pipeline hook: hitstun cancels the attack, charge and drink (02 §5.2 step 7). */
  onPlayerHitstun(): void {
    cancelAttack(this, 'hurt');
    cancelDrink(this);
    onCastHurt(this);
  }

  /** A player hit group landed a direct hit on an enemy (Rush hooks). */
  onPlayerLandedHit(g: HitGroup, e: EnemyState): void {
    if (g.attackInstance < 0) onDiveGroupHit(this, g, e.id);
    if (this.rushedInstances.has(g.attackInstance)) return;
    this.rushedInstances.add(g.attackInstance);
    const dashing = g.dashAttack || this.body.state === 'dash' || this.tick - this.lastDashEndTick <= RUSH.DASH_HIT_WINDOW_TICKS;
    addRush(this, RUSH.HIT + (dashing ? RUSH.DASH_HIT : 0));
  }

  /** An enemy took player damage: instant awareness (04 §2.4). */
  onEnemyHitByPlayer(e: EnemyState): void {
    becomeAware(this, e, true);
  }

  /** An enemy shot hit the player (projectiles stop). */
  onEnemyShotLanded(g: HitGroup): void {
    const p = this.projectiles.find((q) => q.groupId === g.id);
    if (p) removeProjectile(this, p);
  }

  /** camera.shake(amplitude, seconds) from gameplay (01 §14.4). */
  requestShake(amplitude: number, seconds: number): void {
    shake(this.camera, amplitude, seconds);
    this.events.push({ t: 'shake', level: amplitude >= CAMERA.SHAKE_MEDIUM.amplitude ? 'medium' : 'small' });
  }

  /** A named shake level (01 §14.4): small = 2 px / 0.12 s, medium = 4 px / 0.25 s. */
  shakeLevel(level: 'small' | 'medium'): void {
    const s = level === 'medium' ? CAMERA.SHAKE_MEDIUM : CAMERA.SHAKE_SMALL;
    this.requestShake(s.amplitude, s.seconds);
  }

  /** Restart rules (06 §6.1–6.2). Returns true when the world restarted this tick. */
  private handleRestart(input: InputState): boolean {
    const r = input.restart;
    if (this.run.phase === 'stageClear') {          // M3's temporary stage-clear screen: a fresh press runs again
      if (r.pressed) { this.run.restartNeedsRelease = r.held; this.run.restartHoldTicks = 0; this.restart(); return true; }
      return false;
    }
    if (this.phase === 'deathScreen' || this.phase === 'dead') {
      if (r.pressed && this.tick + 1 - this.deathTick >= RESTART.PRESS_AFTER_TICKS) {
        this.run.restartNeedsRelease = r.held;
        this.run.restartHoldTicks = 0;
        this.restart();
        return true;
      }
      return false;                               // while dead only a press counts (06 §6.2)
    }
    if (!r.held) {
      this.run.restartHoldTicks = 0;
      this.run.restartNeedsRelease = false;
      return false;
    }
    if (this.run.restartNeedsRelease) return false;
    this.run.restartHoldTicks += 1;
    if (this.run.restartHoldTicks >= RESTART.HOLD_TICKS) {
      this.run.restartHoldTicks = 0;
      this.run.restartNeedsRelease = true;
      this.restart();
      return true;
    }
    return false;
  }

  /** On-kill effects that belong to other systems (flask, Rush). */
  onPlayerKill(_e: EnemyState, tier: 'regular' | 'elite'): void {
    onKillFill(this, tier);
    const vamp = vampireTenths(this);
    if (vamp > 0) addFlaskFill(this, vamp);                       // 03 §12
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
    if (e.spawnInTicks > 0) {                 // spawn-in: cannot act (04 §2.2)
      e.spawnInTicks -= 1;
      e.vx = 0;
      stepEnemyBody(this, e);
      return;
    }
    stepEnemyReactions(e);
    // Frozen: no action (its attack is cancelled); Chilled: acts on a fraction of ticks (02 §6.3). Gravity always.
    if (!enemyActs(e)) {
      if (e.status.frozen && e.ai.attack) cancelEnemyAttack(this, e);
      const vx = e.vx;
      if (!e.knockback) e.vx = 0;
      stepEnemyBody(this, e);
      if (!e.status.frozen && !e.knockback) e.vx = vx;
      return;
    }
    if (e.boss && e.boss.introTicks > 0) {      // boss intro: takes damage, doesn't act (04 §9.2)
      e.boss.introTicks -= 1;
      if (!e.knockback) e.vx = 0;
      stepEnemyBody(this, e);
      return;
    }
    for (const [id, n] of e.ai.cooldowns) if (n > 0) e.ai.cooldowns.set(id, n - 1);
    if (e.ai.gapTicks > 0) e.ai.gapTicks -= 1;
    if (e.control) {
      if (!e.knockback && e.grounded) e.vx = 0;
    } else if (!e.knockback) {
      const sparring = e.def.id === 'sparring_dummy';
      if (e.ai.attack) {
        stepEnemyAttack(this, e, attackHooks(e));
        if (sparring && !e.ai.attack) stepSparring(this, e);   // the next swing starts as the last ends (every 2.0 s)
      } else if (sparring) stepSparring(this, e);
      else stepAi(this, e);
    }
    stepAwareness(this, e);
    e.hitWall = false;
    stepEnemyBody(this, e);
  }

  /** One 120 Hz tick in 02 §2.1 order. */
  step(rawInput: InputState): void {
    this.events = [];
    if (this.handleRestart(rawInput)) return;
    if (this.phase === 'deathScreen' || this.run.phase === 'stageClear') return;   // frozen; clocks stopped
    // A dead player takes no input; the world keeps running around them.
    let input = this.health.dead ? emptyInput() : rawInput;
    this.tick += 1;
    clearSpentGroups(this);
    if (this.level?.kind !== 'training') stepClocks(this.run);   // the Training Yard has no run timer (06 §12.4)
    this.playerFrozenAtTickStart = this.body.hitStopTicks > 0;
    for (const e of this.enemies) e.frozenAtTickStart = e.hitStopTicks > 0;
    // Wall-clock timers.
    if (this.health.iframeTicks > 0) this.health.iframeTicks -= 1;
    if (this.health.hitstunTicks > 0 && this.body.hitStopTicks === 0) this.health.hitstunTicks -= 1;
    if (this.health.abilityIframeTicks > 0 && this.body.hitStopTicks === 0) this.health.abilityIframeTicks -= 1;
    // 3. Player actions.
    // A slot whose Storm Hammer is out cannot dive (02 §11).
    this.ctx.slotUsable = [this.combat.slots[0] !== null && !hammerOutIn(this, 0), this.combat.slots[1] !== null && !hammerOutIn(this, 1)];
    input = stepInteract(this, input);
    stepPlayerCombat(this, input);
    tryStartDrink(this, input);
    stepDrink(this);
    if (this.drinking) this.mods.actionMoveMult = FLASK.MOVE_CAP;
    stepAbilities(this, input);
    if (this.tick - this.lastLandingTick > COMBAT.HIT_STREAK_TIMEOUT_TICKS) this.hitStreak = 0;
    stepBonds(this);
    // 4. Player movement and collision. A dash, jump or dive that happened cancels the attack (01 §3 step 5).
    this.mods.speedPercents = [rushSpeedPercent(rushLevel(this.rush)), ...hybridSpeed(this), extraSpeed(this)];
    this.mods.dashCooldownMult = dashCooldownMult(this);
    const moveEvents = stepPlayer(this.body, input, this.grid, this.mods, this.ctx);
    if (checkSpikes(this)) moveEvents.push('spikeHit');   // 01 §3 step 9
    for (const e of moveEvents) {
      this.events.push({ t: 'move', e });
      if (e === 'dashStart' || e === 'slideStart') { cancelAttack(this, 'dash'); cancelDrink(this); onCastCancelMove(this); }
      else if (e === 'jump' || e === 'doubleJump' || e === 'wallJump' || e === 'dropThrough') { cancelAttack(this, 'jump'); cancelDrink(this); onCastCancelMove(this); }
      else if (e === 'diveStart') cancelAttack(this, 'dive');
    }
    if (moveEvents.includes('dashStart')) this.dashThrough.clear();
    if (moveEvents.includes('dashEnd')) this.lastDashEndTick = this.tick;
    onDiveEvents(this, moveEvents, input);
    syncPlayerGroups(this);
    // 5. Enemy AI and movement; hazard timers (06 §2.8: rock markers).
    stepRockfall(this);
    activateEnemies(this);
    stepStatuses(this);
    stepSignatures(this);
    for (const e of [...this.enemies].sort((a, b) => a.id - b.id)) this.stepEnemy(e);
    separateEnemies(this);
    syncEnemyGroups(this);
    // 6. Moving hit groups and ability entities (world ticks).
    stepPlayerProjectiles(this);
    stepHammer(this);
    stepProjectiles(this);
    stepAbilityEntities(this);
    stepGroundItems(this);
    stepKeys(this);
    if (this.phase === 'stage') stepLucky(this);
    stepCoins(this);
    for (const r of this.respawns.filter((x) => x.at <= this.tick)) this.spawnExtra(r.spawn);
    this.respawns = this.respawns.filter((x) => x.at > this.tick);
    // 7. Hit resolution: player hits first (ties go to the player), then enemy hits.
    resolvePlayerHits(this);
    resolveEnemyHits(this);
    // 8. Statuses (none in M2). 9. Deaths.
    processDeaths(this);
    stepBossPhases(this);
    stepDiveImpact(this);
    this.dashThroughRush();
    stepRush(this);
    stepFlask(this);
    // 10. Rush and flask. 11. Level logic (06 §2.8).
    stepTimedDoors(this);
    stepZones(this);
    stepArenas(this);
    stepTraining(this);
    stepCamera(this.camera, this.body, () => this.rng.cosmetic.next());
    if (this.phase === 'dead' && this.tick - this.deathTick >= RESTART.DEATH_SIM_TICKS) this.phase = 'deathScreen';
  }
}
