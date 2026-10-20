// The combat world: player, combat state, enemies, hit groups, RNG streams and camera.
// Each tick runs 02 §2.1's order.
import { setupMerchant, type MerchantState } from '../loot/merchant.ts';
import { stepLucky, type LuckyBlock } from '../loot/lucky.ts';
import type { LuckyId } from '../../data/loot.ts';
import { setupLoot, type Chest } from '../loot/sources.ts';
import { newEconomy, stepCoins, type Coin, type EconomyState } from '../economy/gold.ts';
import { stepKeys } from '../economy/keys.ts';
import { stepSignatures } from '../combat/signatures.ts';
import { markShadowStep, onScytheKill, scytheFillTenths } from '../combat/weaponsM9.ts';
import { dashCooldownMult, extraSpeed } from '../loot/perks.ts';
import { cancelEnemyAttack } from '../enemies/attack.ts';
import { enemyActs, stepStatuses } from '../combat/status.ts';
import { createCamera, shake, snapCamera, stepCamera, type CameraState } from '../camera.ts';
import { createHealth, hurtPlayer, hurtPlayerDot, type PlayerHealth } from '../combat/health.ts';
import type { HitGroup } from '../combat/hitGroups.ts';
import { addRush, createRush, rushLevel, rushSpeedPercent, stepRush } from '../combat/rush.ts';
import { enemyRect } from '../enemies/enemy.ts';
import { overlaps } from '../combat/hitGroups.ts';
import { playerRect } from '../combat/resolve.ts';
import { cancelAttack, createPlayerCombat, stepPlayerCombat, syncPlayerGroups, type PlayerCombat } from '../combat/playerCombat.ts';
import type { ElementId, FlaskState, HealRefusedReason, RushState } from '../combat/types.ts';
import { cancelDrink, createFlask, onKillFill, stepDrink, stepFlask, tryStartDrink, type DrinkState } from '../combat/flask.ts';
import { CAMERA, COMBAT, FLASK, RESTART, RUN, RUSH, VIEW_H, VIEW_W } from '../tuning.ts';
import { emptyInput, type InputState } from '../input.ts';
import type { TileGrid } from '../level/tiles.ts';
import { isGrounded, pushOut } from '../physics/collide.ts';
import { Bodies, type SolidBody } from '../physics/bodies.ts';
import { checkSpikes } from '../hazards/spikes.ts';
import { createPlayerBody, type MoveEvent, type PlayerBody } from '../player/body.ts';
import { cloneLoadout, createAbilityRuntime, defaultLoadout, kitLoadout, type Loadout } from '../abilities/runtime.ts';
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
import { stepGuardianSpecial, afterGuardianBody } from '../enemies/guardians2.ts';
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
import { beginTransition, canHoldRestart, completeLoading, simulatesWorld, stepTransition } from '../run/phases.ts';
import type { StartKit } from '../save/schema.ts';
import type { WorldCarry } from '../run/session.ts';
import { setupVillage, stepVillage } from '../run/villages.ts';
import { setupShop, stepAltarInteraction, type AltarHold, type ShopState } from '../economy/shop.ts';
import { applyStatUpgrade, maxPlayerHp, offerStatUpgrades } from '../economy/stats.ts';
import { STAT_PICK_DEFAULT_INDEX, type StatUpgradeId } from '../../data/economy.ts';
import { recordSplit, type RunRecords } from '../run/splits.ts';
import { captureRunEnd, type RunEndSnapshot } from '../run/history.ts';
import { unlockedCatalog, type BlueprintId } from '../loot/blueprints.ts';
import { stepBlueprints } from '../loot/blueprintItems.ts';
import { boardCart, createMinecart, landOnMinecart, stepMinecarts, type MinecartState, type CartStop } from '../player/minecart.ts';
import { buildCollapsingPlatforms, stepCollapsingPlatforms, type CollapsingPlatform } from '../hazards/collapsingPlatforms.ts';
import { breakCrackedWalls } from '../abilities/list/shoulder_charge.ts';
import { buildLevelFeatures, type DarkZone, type Firefly, type GrapplePoint } from '../level/features.ts';
import { createFallingRocks, stepFallingRocks, type FallingRocksState } from '../hazards/fallingRocks.ts';
import { CANNON, FALLING_ROCKS } from '../../data/hazards.ts';
import { createCannons, stepCannons, type CannonsState } from '../hazards/cannons.ts';
import { stepMountainReaction } from '../enemies/mountains.ts';
import { cancelKingdomReaction, onKingdomDamaged, stepKingdomReaction } from '../enemies/kingdom.ts';
import { onSwampDamaged, stepSwampSpecial } from '../enemies/swamps.ts';
import { createPlayerStatus, stepPlayerStatus, type PlayerStatuses } from '../combat/playerStatus.ts';
import { PLAYER_STATUS } from '../../data/playerStatus.ts';
import { stepPuddles, type EnemyPuddle } from '../enemies/projectiles.ts';

export type Stage = 1 | 2 | 3 | 4;

/** Loot objects that are only grey markers until M4. */
const MARKER_TYPES = new Set<string>([]);

/** 'stage' while playing, 'dead' for the 1 s after death, then 'deathScreen' (06 §6.1). */
export type WorldPhase = 'stage' | 'dead' | 'deathScreen';

export type WorldEvent =
  | { t: 'move'; e: MoveEvent }
  | { t: 'hit'; target: 'player' | number; amount: number; crit: boolean; heavy: boolean; slot?: 0 | 1; step?: number; ability?: string; chainFrom?: number; dot?: boolean; element?: ElementId }
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
  | { t: 'itemTaken'; itemId: number; slot: 0 | 1; kind?: 'weapon' | 'ability' }
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
  | { t: 'cantAfford' }
  | { t: 'chestLocked' }
  | { t: 'loadLevel'; levelId: LevelData['id']; stage: RunState['stage'] }
  | { t: 'enterVillage'; villageId: LevelData['id'] }
  | { t: 'stageStarted'; levelId: LevelData['id']; stage: RunState['stage'] }
  | { t: 'runStarted' }
  | { t: 'pbSaved' }
  | { t: 'runCompleted' }
  | { t: 'blueprintFound'; id: BlueprintId }
  | { t: 'startingWeaponUnlocked'; cls: ClassId; weapon: import('../combat/types.ts').WeaponId }
  | { t: 'openHomePanel'; panel: 'training' | 'seed' | 'records' };

export interface GameWorldOptions {
  grid: TileGrid;
  spawn: { x: number; y: number };
  facing?: 1 | -1;
  seedText?: string;
  /** Typed seeds survive restart. The Phaser layer supplies fresh random seed text otherwise. */
  seeded?: boolean;
  nextRandomSeed?: () => string;
  startKit?: StartKit | null;
  carry?: WorldCarry;
  records?: RunRecords;
  practice?: boolean;
  unlockedBlueprints?: readonly BlueprintId[];
  /** Phaser supplies the current in-memory unlock list only when a new run starts. */
  nextRunUnlocks?: () => readonly BlueprintId[];
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
  runSeed: number;
  body!: PlayerBody;
  mods!: MoveModifiers;
  ctx!: MoveContext;
  health!: PlayerHealth;
  playerStatus: PlayerStatuses=createPlayerStatus();
  puddles: EnemyPuddle[]=[];
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
  statPick: { offer: StatUpgradeId[]; openedAt: number } | null = null;
  coins: Coin[] = [];
  chests: Chest[] = [];
  luckyBlocks: LuckyBlock[] = [];
  merchant: MerchantState | null = null;
  /** Shown gold (05 §9.1). */
  get gold(): number { return Math.floor(this.econ.goldTenths / 10); }
  rng!: { enemyAI: Rng; combat: Rng; cosmetic: Rng };
  bodies!: Bodies;
  run!: RunState;
  readonly records: RunRecords;
  /** Outlives reset until the browser session persists each old-run snapshot once. */
  readonly pendingRunEnds: RunEndSnapshot[] = [];
  arenas = new Map<string, ArenaRt>();
  timedDoors: TimedDoorRt[] = [];
  activeHint: HintAction | null = null;
  rockMarkers: RockMarker[] = [];
  minecarts: MinecartState[] = [];
  cartStops: CartStop[] = [];
  collapsingPlatforms: CollapsingPlatform[] = [];
  worldTimeScale = 1;
  grapplePoints: GrapplePoint[] = [];
  darkZones: DarkZone[] = [];
  fireflies: Firefly[] = [];
  fallingRocks!: FallingRocksState;
  cannons!: CannonsState;
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
  private villageEntryPending = false;
  private loadRequestPending = false;
  villageMessage: string | null = null;
  shop: ShopState | null = null;
  altarHold: AltarHold | null = null;

  constructor(opts: GameWorldOptions) {
    this.opts = opts;
    this.records = { pbs: structuredClone(opts.records?.pbs ?? {}), bestSegments: structuredClone(opts.records?.bestSegments ?? {}) };
    this.grid = opts.grid;
    this.stage = opts.stage ?? 1;
    this.runSeed = opts.seedText !== undefined ? fnv1a32(opts.seedText) : opts.runSeed ?? 1;
    this.level = opts.level ?? null;
    this.waveSpawns = opts.waveSpawns ?? [];
    this.markers = opts.markers ?? [];
    this.reset();
  }

  /** A stage world from level data (M3 Task 4): player start, placed enemies, bodies, markers, run state. */
  static fromLevel(d: LevelData, opts: { seedText: string; seeded?: boolean; nextRandomSeed?: () => string; startKit?: StartKit | null; carry?: WorldCarry; records?: RunRecords; practice?: boolean; unlockedBlueprints?: readonly BlueprintId[]; nextRunUnlocks?: () => readonly BlueprintId[] }): GameWorld {
    const parts = buildWorldParts(d);
    const start = d.objects.find((o) => o.type === 'player_start');
    if (!start) throw new Error(`level ${d.id} has no player_start`);
    const bodies: SolidBody[] = parts.bodies.map((b) => ({
      id: b.id, x: b.x, y: b.y, w: b.w, h: b.h, oneWay: b.oneWay, surface: b.surface, grabbable: b.grabbable, noTeleport: b.noTeleport, active: b.active,
    }));
    return new GameWorld({
      grid: parts.grid, spawn: { x: start.x, y: start.y }, facing: Number(start.props.facing ?? 1) < 0 ? -1 : 1,
      stage: (d.stage || 1) as Stage, seedText: opts.seedText, seeded: opts.seeded, nextRandomSeed: opts.nextRandomSeed, level: d, bodies,
      startKit: opts.carry?.run.startKit ?? opts.startKit, carry: opts.carry,
      records: opts.records, practice: opts.practice,
      unlockedBlueprints: opts.unlockedBlueprints, nextRunUnlocks: opts.nextRunUnlocks,
      loadout: (opts.carry?.run.startKit ?? opts.startKit) ? kitLoadout((opts.carry?.run.startKit ?? opts.startKit)!.cls, (opts.carry?.run.startKit ?? opts.startKit)!.weapon) : undefined,
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
    const carry = this.opts.carry;
    const carriedState = carry && carry.run.transition?.kind !== 'homeGate' ? carry : null;
    this.opts.carry = undefined; // consumed once: resetting must never replay an old shop/gear snapshot
    this.bodies = new Bodies(grid.w, grid.h);
    for (const b of this.opts.bodies ?? []) this.bodies.add({ ...b });
    grid.bodies = this.bodies;
    this.body = createPlayerBody(spawn.x, spawn.y);
    this.body.facing = this.opts.facing ?? 1;
    // The restart hold survives a restart (06 §6.2: holding through one never restarts twice).
    const hold = this.run ? { h: this.run.restartHoldTicks, n: this.run.restartNeedsRelease } : { h: 0, n: false };
    this.run = carry ? structuredClone(carry.run) : createRunState(this.opts.seedText ?? '', this.opts.seeded ?? false);
    this.opts.seeded = this.run.seeded;
    this.run.startKit = this.opts.startKit ?? null;
    this.run.runSeed = this.runSeed;
    if (!carry) {
      this.run.lootUnlocked = unlockedCatalog(this.opts.nextRunUnlocks?.() ?? this.opts.unlockedBlueprints ?? [], this.run.seeded || this.opts.practice);
      this.run.stage = this.level?.stage ?? this.stage;
      this.run.levelId = this.level?.id ?? 'plains';
      if (this.level?.kind === 'village') this.run.phase = this.level.id === 'home' ? 'homeVillage' : 'village';
      this.run.restartHoldTicks = hold.h;
      this.run.restartNeedsRelease = hold.n;
    }
    this.villageEntryPending = this.level?.kind === 'village';
    this.loadRequestPending = false;
    if (!isGrounded(this.body, grid, 0)) {
      this.body.state = 'air';
      this.body.grounded = false;
    }
    this.mods = defaultModifiers();
    this.ctx = { slotUsable: [true, true] };
    this.health = createHealth();
    this.playerStatus=createPlayerStatus();this.puddles=[];
    this.rush = createRush();
    this.flask = createFlask();
    this.drinking = null;
    this.drinkBufferTicks = 0;
    const lo = cloneLoadout(carriedState?.loadout ?? this.opts.loadout ?? (this.level?.kind === 'village' || this.level?.kind === 'training' ? { weapons: [null, null], abilities: [null, null] } : defaultLoadout()));
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
    this.econ = carriedState ? structuredClone(carriedState.econ) : newEconomy();
    if (this.level?.kind === 'village') this.clearStageEffects();
    this.statPick = null;
    this.coins = [];
    this.rng = {
      enemyAI: new Rng(deriveSeed(this.runSeed, 'enemyAI', this.stage)),
      combat: new Rng(deriveSeed(this.runSeed, 'combat', this.level?.kind === 'village' ? this.level.id : this.stage)),
      cosmetic: new Rng(deriveSeed(this.runSeed, 'cosmetic', this.level?.kind === 'village' ? this.level.id : this.stage)),
    };
    this.hitGroups = [];
    this.events = [];
    this.nextId = 1;
    this.refreshClassState();
    if (carriedState) {
      this.health.hp = carriedState.hp; this.health.maxHp = carriedState.maxHp; this.flask = { ...carriedState.flask };
      this.ironWillAddedHP = this.classState.bond === 'iron_will' ? carriedState.maxHp - maxPlayerHp(this, false) : 0;
    }
    this.enemies = (this.opts.enemies ?? []).map((s) => spawnEnemy(this, s));
    this.pendingDeaths = [];
    this.projectiles = [];
    this.playerProjectiles = [];
    this.blasts = [];
    this.grid.pixelPlatforms = [];                         // Javelin platforms go with the stage (02 §10.5)
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
    this.worldTimeScale = 1;
    this.minecarts = (this.level?.objects ?? []).filter((o) => o.type === 'minecart').map((o) => createMinecart(o.id, o.x, o.y, Number(o.props.dir ?? 1) < 0 ? -1 : 1));
    this.cartStops = (this.level?.objects ?? []).filter((o) => o.type === 'minecart_stop').map((o) => ({ x: o.x, y: o.y, w: o.w, h: o.h }));
    this.collapsingPlatforms = buildCollapsingPlatforms(this.level?.objects ?? []);
    Object.assign(this, buildLevelFeatures(this.level?.objects ?? []));
    this.fallingRocks = createFallingRocks(this.level?.objects ?? []);
    this.cannons = createCannons(this.level?.objects ?? []);
    for (const c of this.minecarts) this.interactables.push({ id: c.id, x: c.spawnX, y: c.spawnY, w: c.w, h: c.h, kind: 'minecart', label: 'Ride', use: (w) => {
      if (c.active && !c.started && boardCart(c, w.body)) w.events.push({ t: 'move', e: 'cartBoard' });
    } });
    this.shop = null; this.altarHold = null;
    this.villageMessage = null;
    if (this.level?.kind === 'training') setupTraining(this);
    if (this.level?.kind === 'village') setupVillage(this);
    if (this.level?.kind !== 'village' && this.level) this.rollStageLoot();
    if (!carry || this.level?.kind === 'stage') fillAbilities(this);
  }

  restart(): void {
    const ended = captureRunEnd(this, 'restart'); if (ended) this.pendingRunEnds.push(ended);
    if (!this.run.seeded && this.opts.nextRandomSeed) {
      this.opts.seedText = this.opts.nextRandomSeed();
      this.runSeed = fnv1a32(this.opts.seedText);
    }
    this.reset();
    // Every restart entry point requires release, including summary and pause buttons.
    this.run.restartNeedsRelease = true;
    // Same-Plains reload is synchronous. Other scenes must really load Plains before acknowledging it.
    beginTransition(this.run, 'restart', { phase: 'stage', levelId: 'plains', stage: 1 });
    if (!this.level || this.level.id === 'plains') this.completeLoading();
    else this.loadRequestPending = true;
  }

  setStartingKit(kit: StartKit): void {
    this.opts.startKit = { ...kit }; this.run.startKit = { ...kit };
    this.setLoadout(kitLoadout(kit.cls, kit.weapon));
  }

  /** The scene calls this after loading the requested next world. */
  completeLoading(): void {
    const target = this.run.phase === 'loading' ? this.run.transition?.target : null;
    completeLoading(this.run);
    this.loadRequestPending = false;
    if (target?.phase === 'village' || target?.phase === 'homeVillage') { this.clearStageEffects(); this.villageEntryPending = true; }
  }

  /** Lucky effects and curse last for this stage only (05 §7.4, §8). */
  private clearStageEffects(): void { this.econ.buffs = []; this.econ.debuffs = []; this.econ.curse = null; }

  /** Compulsory choice (07 §6.11): the core owns the guard, offered IDs and apply-once rule. */
  confirmStatPick(index = STAT_PICK_DEFAULT_INDEX): boolean {
    const pick = this.statPick;
    if (this.run.phase !== 'statPick' || !pick || this.run.runTicks - pick.openedAt < RUN.STAT_PICK_CONFIRM_TICKS) return false;
    const id = pick.offer[index];
    if (!id || !applyStatUpgrade(this, id)) return false;
    this.run.statPickDone = true;
    this.run.phase = 'stage';
    this.statPick = null;
    return true;
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
    const split = recordSplit(r, this.stage, this.records, this.opts.practice);
    if (!split) return;
    r.bossDefeatedTick = this.tick;
    r.statPickDone = false;
    this.events.push({ t: 'split', ...split });
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
    this.playerStatus=createPlayerStatus();
    this.phase = 'dead';
    this.deathTick = this.tick;
    this.run.phase = 'dead';
    this.run.deathTick = this.tick;
    this.clearStageEffects();
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
    onSwampDamaged(this,e);
    onKingdomDamaged(this,e);
    becomeAware(this, e, true);
  }

  onPlayerStatusDot(damageA:number,cause:'burning'|'poisoned'):void { hurtPlayerDot(this,damageA,cause); }

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
    if (this.run.phase === 'dead') {
      if (r.pressed && this.tick + 1 - this.deathTick >= RESTART.PRESS_AFTER_TICKS) {
        this.run.restartNeedsRelease = r.held;
        this.run.restartHoldTicks = 0;
        this.restart();
        return true;
      }
      return false;                               // while dead only a press counts (06 §6.2)
    }
    if (!canHoldRestart(this.run.phase)) return false;
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
  onPlayerKill(e: EnemyState, tier: 'regular' | 'elite'): void {
    this.run.stats.kills += 1;
    onScytheKill(this, e);
    if (tier === 'elite') this.run.stats.eliteKills += 1;
    // Bosses refill charges in onBossKilled; their banked fill stays unchanged (02 §7.3).
    if (e.def.tier !== 'boss') onKillFill(this, tier, vampireTenths(this) + scytheFillTenths(e));
    addRush(this, e.def.tier==='boss'?RUSH.KILL_BOSS:tier === 'elite' ? RUSH.KILL_ELITE : RUSH.KILL_REGULAR);
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
      markShadowStep(this, e);
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
    if (e.control || e.status.frozen || e.knockback) {cancelKingdomReaction(e);stepMountainReaction(this,e);if(e.def.id==='swamp_witch')stepSwampSpecial(this,e);} // cancel even when its final control tick ends below
    stepEnemyReactions(e);
    // Frozen: no action (its attack is cancelled); Chilled: acts on a fraction of ticks (02 §6.3). Gravity always.
    if (!enemyActs(e, this.worldTimeScale)) {
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
    if (e.boss && (e.boss.transitionTicks ?? 0) > 0) {   // phase transition: no acting, damage still lands (04 §9.3)
      e.boss.transitionTicks! -= 1;
      e.control = null;
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
      if (stepGuardianSpecial(this,e)||stepSwampSpecial(this,e)||stepMountainReaction(this,e)||stepKingdomReaction(this,e)) { /* Waiting states and reactions own movement. */ }
      else if (e.ai.attack) {
        stepEnemyAttack(this, e, attackHooks(e));
        if (sparring && !e.ai.attack) stepSparring(this, e);   // the next swing starts as the last ends (every 2.0 s)
      } else if (sparring) stepSparring(this, e);
      else stepAi(this, e);
    }
    stepAwareness(this, e);
    e.hitWall = false;
    stepEnemyBody(this, e);
    afterGuardianBody(this,e);
  }

  /** One 120 Hz tick in 02 §2.1 order. */
  step(rawInput: InputState): void {
    this.events = [];
    if (this.loadRequestPending && this.run.phase === 'loading' && this.run.transition) {
      const { target } = this.run.transition;
      this.events.push({ t: 'loadLevel', levelId: target.levelId, stage: target.stage });
      this.loadRequestPending = false;
    }
    if (this.villageEntryPending && this.run.phase !== 'loading' && this.run.phase !== 'paused') {
      this.events.push({ t: 'enterVillage', villageId: this.run.levelId });
      if (this.level?.id !== 'home' && this.level?.kind === 'village') setupShop(this, this.level.id === 'crossroads' ? 1 : this.level.id === 'border' ? 2 : 3);
      this.villageEntryPending = false;
    }
    if (this.handleRestart(rawInput)) return;
    if (this.phase === 'deathScreen' && this.run.phase === 'dead') return;
    if (this.level?.kind !== 'training') stepClocks(this.run);
    if (!simulatesWorld(this.run.phase)) {
      const transition = this.run.transition;
      const action = stepTransition(this.run);
      if (action === 'load' && transition) {
        if (transition.kind === 'sleep') this.health.hp = this.health.maxHp;
        this.events.push({ t: 'loadLevel', levelId: transition.target.levelId, stage: transition.target.stage });
      } else if (action === 'arrive') {
        if (this.run.phase === 'stage') this.events.push({ t: 'stageStarted', levelId: this.run.levelId, stage: this.run.stage });
      }
      return;
    }
    // A dead player takes no input; the world keeps running around them.
    if (this.level?.kind === 'stage' && this.run.stage === 1 && !this.run.started) {
      this.run.started = true; this.events.push({ t: 'runStarted' });
    }
    let input = this.health.dead ? emptyInput() : rawInput;
    this.tick += 1;
    clearSpentGroups(this);
    this.playerFrozenAtTickStart = this.body.hitStopTicks > 0;
    for (const e of this.enemies) e.frozenAtTickStart = e.hitStopTicks > 0;
    // Wall-clock timers.
    if (this.health.iframeTicks > 0) this.health.iframeTicks -= 1;
    if (this.health.hitstunTicks > 0 && this.body.hitStopTicks === 0) this.health.hitstunTicks -= 1;
    if (this.health.abilityIframeTicks > 0 && this.body.hitStopTicks === 0) this.health.abilityIframeTicks -= 1;
    stepPlayerStatus(this);this.mods.rooted=this.playerStatus.rooted>0;this.mods.statusMult=this.playerStatus.chilled>0?PLAYER_STATUS.chilledMult:1;
    if(this.health.dead)input=emptyInput();
    // 3. Player actions.
    // A slot whose Storm Hammer is out cannot dive (02 §11).
    this.ctx.slotUsable = [this.combat.slots[0] !== null && !hammerOutIn(this, 0), this.combat.slots[1] !== null && !hammerOutIn(this, 1)];
    input = stepAltarInteraction(this, input);
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
    if (this.body.forced?.owner === 'ability:shoulder_charge') breakCrackedWalls(this, this.body.forced.fm.vx < 0 ? -1 : 1);
    if (this.body.state === 'minecart') this.mods.actionMoveMult = 1;
    const beforeMove = { x: this.body.x, y: this.body.y };
    const cartStep = stepMinecarts(this.minecarts, this.body, input, this.grid, this.mods, this.cartStops);
    const moveEvents = cartStep.events;
    if (!cartStep.handled) {
      moveEvents.push(...stepPlayer(this.body, cartStep.input, this.grid, this.mods, this.ctx));
      if (landOnMinecart(this.minecarts, this.body, beforeMove)) moveEvents.push('cartBoard');
    }
    moveEvents.push(...stepCollapsingPlatforms(this.collapsingPlatforms, this.bodies, this.grid, this.body, this.minecarts, this.worldTimeScale, moveEvents.includes('diveLand')));
    if (checkSpikes(this)) moveEvents.push('spikeHit');   // 01 §3 step 9
    for (const e of moveEvents) {
      this.events.push({ t: 'move', e });
      if (e === 'dashStart' || e === 'slideStart') { cancelAttack(this, 'dash'); cancelDrink(this); onCastCancelMove(this); }
      else if (e === 'jump' || e === 'cartJump' || e === 'doubleJump' || e === 'wallJump' || e === 'dropThrough') { cancelAttack(this, 'jump'); cancelDrink(this); onCastCancelMove(this); }
      else if (e === 'diveStart') cancelAttack(this, 'dive');
    }
    if (moveEvents.includes('dashStart')) this.dashThrough.clear();
    if (moveEvents.includes('dashEnd')) this.lastDashEndTick = this.tick;
    onDiveEvents(this, moveEvents, input);
    syncPlayerGroups(this);
    // 5. Enemy AI and movement; hazard timers (06 §2.8: rock markers).
    stepRockfall(this);
    for (const e of this.enemies) if (e.ward && (e.ward.ticks -= this.worldTimeScale) <= 0) e.ward = null;
    if (stepFallingRocks(this.fallingRocks, this.grid, playerRect(this), this.worldTimeScale)) hurtPlayer(this, { kind: 'hazard', cause: 'hazard', damageA: FALLING_ROCKS.damage });
    const ball = stepCannons(this.cannons, this.grid, { x: this.camera.x, y: this.camera.y, w: VIEW_W, h: VIEW_H }, playerRect(this), this.worldTimeScale);
    if (ball) hurtPlayer(this, { kind: 'hazard', cause: 'hazard', damageA: CANNON.damage, playerKb: CANNON.kb, travelDir: ball.dir });
    activateEnemies(this);
    stepStatuses(this);
    stepSignatures(this);
    for (const e of [...this.enemies].sort((a, b) => a.id - b.id)) this.stepEnemy(e);
    separateEnemies(this);
    syncEnemyGroups(this);
    // 6. Moving hit groups and ability entities (world ticks).
    stepPlayerProjectiles(this);
    stepHammer(this);
    stepPuddles(this);
    stepProjectiles(this);
    stepAbilityEntities(this);
    stepGroundItems(this);
    stepKeys(this);
    stepBlueprints(this);
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
    stepVillage(this);
    stepArenas(this);
    stepTraining(this);
    stepCamera(this.camera, this.body, () => this.rng.cosmetic.next());
    // Phase changes take effect on the following tick (06 §2.8).
    if (this.run.phase === 'stage' && this.stage < 4 && this.run.bossDefeatedTick !== null
      && !this.run.statPickDone && this.tick - this.run.bossDefeatedTick >= RUN.STAT_PICK_DELAY_TICKS) {
      this.run.phase = 'statPick';
      this.statPick = { offer: offerStatUpgrades(this, this.stage), openedAt: this.run.runTicks };
    }
    if (this.phase === 'dead' && this.tick - this.deathTick >= RESTART.DEATH_SIM_TICKS) this.phase = 'deathScreen';
  }
}
