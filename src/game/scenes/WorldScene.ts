// Shared scene for a GameWorld: steps it at 120 Hz and uses each biome's art, with grey fallbacks.
import Phaser from 'phaser';
import { rushLevel } from '../../core/combat/rush.ts';
import { enemyRect, type EnemyState } from '../../core/enemies/enemy.ts';
import type { EnemyId } from '../../core/enemies/types.ts';
import { FixedStepper } from '../../core/sim/fixedStep.ts';
import { BUTTON_IDS, emptyButton, emptyInput, type InputState } from '../../core/input.ts';
import { PauseModel, type PauseAction } from '../../ui/model/pauseModel.ts';
import { PauseView } from '../../ui/popups/pause.ts';
import { newAbility, newWeapon } from '../../core/abilities/runtime.ts';
import type { AbilityId, AbilityLevel, ClassId } from '../../core/abilities/types.ts';
import type { WeaponId } from '../../core/combat/types.ts';
import { ClassPickModel, type Kit } from '../../ui/popups/classPickModel.ts';
import { ClassPickView } from '../../ui/popups/classPick.ts';
import { GameWorld } from '../../core/sim/gameWorld.ts';
import { specToInput, type InputSpec } from '../../core/sim/playerSim.ts';
import { BOSS, ENEMY, TICK_RATE, ticks } from '../../core/tuning.ts';
import { KINGDOM } from '../../data/kingdom.ts';
import { formatTime } from '../../core/time.ts';
import { FONTS } from '../../data/animKeys.ts';
import { DEPTH } from '../../data/art.ts';
import { drawTerrain, Parallax } from '../view/levelView.ts';
import { timeFrame, type AnimDef } from '../view/animClock.ts';
import { AnimBank } from '../view/animBank.ts';
import { WeaponFxView } from '../view/weaponFx.ts';
import { EnemySprite, PlayerSprite, ProjectileSprites, type PlayerViewEvents } from '../view/EntitySprites.ts';
import { SfxPlayer } from '../audio/sfx.ts';
import { isSlow, music, musicSnapshot } from '../audio/music.ts';
import type { MusicEvent } from '../audio/musicDirector.ts';
import type { SfxRequest } from '../audio/sfxRules.ts';
import { SfxWatch } from '../audio/sfxTriggers.ts';
import { drawMarkers, VfxDirector, VfxPool, type TickEvent } from '../view/vfx.ts';
import { ItemViews } from '../view/yardView.ts';
import { AbilityView } from '../view/abilityView.ts';
import { AbilityHud } from '../../ui/hud/abilityHud.ts';
import { TopHud } from '../../ui/hud/topHud.ts';
import { LootHud } from '../../ui/hud/lootHud.ts';
import { LootView } from '../view/lootView.ts';
import { ItemCardPopup } from '../../ui/popups/itemCard.ts';
import { itemCard } from '../../ui/model/itemCard.ts';
import { interactTarget, type GroundItem } from '../../core/abilities/items.ts';
import { topHudView } from '../../ui/model/hudModel.ts';
import { loadAssets } from '../assets/loadAssets.ts';
import { debugEnabled, installCombatDebugApi, type CombatDebugHost } from '../debug.ts';
import { COLOR, STATE_COLOR } from '../greybox.ts';
import { Devices } from '../input/devices.ts';
import { pauseRun, resumeRun } from '../../core/run/phases.ts';
import { activeHomePad, HomePanelInput } from '../../ui/home/homePanels.ts';
import { gameSession } from '../session.ts';
import { PARALLAX } from '../../data/art.ts';
import { saveStore } from '../save/storage.ts';
import { SAVE_RULES } from '../../data/save.ts';
import { UI_COLOR } from '../../data/uiText.ts';
import { StatPickView } from '../../ui/popups/statPick.ts';
import { StatPickModel, type StatPickAction } from '../../ui/popups/statPickModel.ts';
import { StatPickInput } from '../input/statPickInput.ts';
import { STAT_PICK_UI } from '../../data/statUi.ts';
import { getUiSettings, menuConfirmKey, menuPauseKey } from '../../ui/inputSettings.ts';
import { applySettings } from '../settings.ts';
import { BIOME_VIEW as B } from '../../data/biomeView.ts';
import { DarknessView } from '../view/darkness.ts';
import { Stage2FeatureView } from '../view/stage2Features.ts';
import { KingdomFeatureView } from '../view/kingdomFeatures.ts';
import { CastleFeatureView } from '../view/castleFeatures.ts';
import { enemyDrawing } from '../view/enemyFallback.ts';

/** Battle Mage Teleport (04 §6): fades out for 0.3 s, then fades in for 0.3 s. */
function fadeAlpha(e: EnemyState): number {
  const f = e.kingdom;
  if (!f?.fade) return 1;
  const k = f.fadeTicks / ticks(KINGDOM.teleportFadeOutS);
  return f.fade === 'out' ? k : 1 - k;
}

const DRAGON_COLOR = { red: 0xc03a2a, white: 0xdfe8f0, storm: 0x5a5ad8, green: 0x4a9a3a } as const;

/** Grey-box enemy colors (plan M2, Task 17). */
const ENEMY_COLOR: Partial<Record<EnemyId, number>> = {
  soldier: 0x8e96a8, crossbowman: 0x9c7a4a, war_hound: 0x6a6f7a, battle_mage: 0xb04a8a, knight: 0x5a6070, black_knight: 0x15151c,
  royal_guard: 0xa88a52, gargoyle: 0x7a8088, castle_mage: 0x5a4ab0, living_armor: 0x6a7a8c, royal_executioner: 0x3a1418, enemy_king: 0xd8b030,
  dragon: 0xc03a2a,
  wolf: 0x73809f, bandit: 0xb8443f, bandit_archer: 0xe27b5b, wild_boar: 0x7e2a34, bandit_brute: 0x4a1824, training_dummy: 0x9a6e3e,
};
const DRAW = {
  telegraph: 0xff9a3c, telegraphLast: 0xfff4d0, hurtFlash: 0xffffff, controlled: 0x8a8a8a,
  projectile: 0xffd84a, attackBox: 0xff3030, attackAlpha: 0.4, enemyHurtbox: 0x4080ff,
  hpBack: 0x202020, hpFill: 0xe04040, hpGap: 4, eye: 2, overlay: 0x000000, overlayAlpha: 0.6,
  playerShot: 0xfff4c8, blast: 0xffa83a, blastAlpha: 0.5, hammer: 0x42d9ff, charge: 0xffd84a,
  // Placeholders for M9 part 2 weapon pieces that have no art yet: Javelin platforms, rune ring, raised Shield.
  platform: 0xc8a05a, rune: 0xb06cff, shield: 0x6fc4ff, shieldParry: 0xffffff,
} as const;

export abstract class WorldScene extends Phaser.Scene implements CombatDebugHost {
  world!: GameWorld;
  private kingdomView!: KingdomFeatureView;
  private castleView!: CastleFeatureView;
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
  private bossBoxes!: Phaser.GameObjects.Graphics;
  private playerShots!: Phaser.GameObjects.Graphics;
  private features!: Stage2FeatureView;
  private darkness!: DarknessView;
  private lastViewTime = 0;
  protected parallax!: Parallax;
  protected playerView!: PlayerSprite;
  protected enemyViews = new Map<EnemyState, EnemySprite>();
  protected bank!: AnimBank;
  protected projViews!: ProjectileSprites;
  protected playerProjViews!: ProjectileSprites;
  protected weaponFx!: WeaponFxView;
  protected hammerSprite!: Phaser.GameObjects.Sprite;
  protected vfx!: VfxDirector;
  protected markersGfx!: Phaser.GameObjects.Graphics;
  protected itemViews!: ItemViews;
  protected abilityView!: AbilityView;
  protected lootView!: LootView;
  protected lootHud!: LootHud;
  protected abilityHud!: AbilityHud;
  protected topHud!: TopHud;
  protected card!: ItemCardPopup;
  /** Events of every tick since the last render (core clears `world.events` each tick). */
  protected frameEvents: TickEvent[] = [];
  private playerEv: PlayerViewEvents = { lastDoubleJumpTick: -100000, lastWallJumpTick: -100000 };
  private lastRenderTick = -1;
  protected sfx!: SfxPlayer;
  private sfxWatch = new SfxWatch();
  /** Sounds found by the per-tick checks, played on the next render. */
  private sfxQueue: SfxRequest[] = [];
  private soundNote!: Phaser.GameObjects.BitmapText;
  /** The class pick panel while open; `pauseWorld` before a run (Stage 1), not for statues. */
  protected classPick: { model: ClassPickModel; view: ClassPickView; pauseWorld: boolean } | null = null;
  /** The kit picked this session (instant restart keeps it, 03 §3). */
  protected pickedKit: Kit | null = null;
  private statPopup: { model: StatPickModel; view: StatPickView; lastRunTick: number } | null = null;
  private readonly statMenu = new StatPickInput();
  private readonly classMenu = new HomePanelInput('training');
  private readonly pauseMenu = new HomePanelInput('training');
  /** `?boxes=1`: the old grey boxes instead of sprites (debugging). */
  protected boxesMode = false;
  /** Debug overview: the camera zooms out to show this world rect (screenshots of whole sections). */
  overview: { x: number; y: number; w: number; h: number } | null = null;

  /** The world this scene runs (called once in create). */
  protected abstract makeWorld(): GameWorld;
  /** Extra drawing after the shared pass (doors, markers, timer...). */
  protected renderExtra(): void {}
  protected extraMenuOpen(): boolean { return false; }
  protected freezesExtraMenuWorld(): boolean { return false; }
  protected pauseMenuCovered(): boolean { return false; }
  protected onPauseSettings(): void {}
  protected onKitEquipped(_kit: Kit): void {}

  preload(): void {
    loadAssets(this);
  }

  create(): void {
    this.world = this.makeWorld();
    this.pickedKit = this.world.run.startKit;
    this.prevSpec = {}; this.manual = false; this.frameEvents = []; this.classPick = null; this.pause = null;
    applySettings(this, saveStore().data.settings);
    this.devices = new Devices(getUiSettings().bindings);
    this.statPopup = null;
    this.statMenu.clear();
    window.addEventListener('keydown', this.onStatKeyDown);
    window.addEventListener('keyup', this.onStatKeyUp);
    this.events.once('shutdown', () => {
      window.removeEventListener('keydown', this.onStatKeyDown);
      window.removeEventListener('keyup', this.onStatKeyUp);
      this.statPopup?.view.destroy(); this.statPopup = null;
    });
    window.addEventListener('blur', this.onFocusLost);
    document.addEventListener('visibilitychange', this.onVisibilityChanged);
    this.events.once('shutdown', () => {
      this.devices.destroy();
      window.removeEventListener('keydown', this.onPauseKey);
      window.removeEventListener('blur', this.onFocusLost);
      document.removeEventListener('visibilitychange', this.onVisibilityChanged);
    });
    this.bank = new AnimBank(this.cache.json.get('anims') as AnimDef[]);
    this.boxesMode = new URLSearchParams(window.location.search).get('boxes') === '1';
    const bg = this.world.level?.kind === 'training' ? 'village_home' : this.world.level?.id === 'border' ? 'village_border' : this.world.level?.id === 'rebel_camp' ? 'village_rebel_camp' : this.world.level?.biome ?? 'plains';
    this.parallax = new Parallax(this, this.world.grid.heightPx, bg in PARALLAX ? bg as keyof typeof PARALLAX : 'plains');
    drawTerrain(this, this.world.grid, this.world.level?.biome ?? 'plains', this.world.level?.kind !== 'village');
    this.boxes = this.add.graphics().setDepth(DEPTH.enemies);
    this.bossBoxes = this.add.graphics().setDepth(DEPTH.boss);
    this.playerShots = this.add.graphics().setDepth(DEPTH.playerProjectiles);
    this.features = new Stage2FeatureView(this, this.world);
    this.kingdomView = new KingdomFeatureView(this);
    this.castleView = new CastleFeatureView(this);
    this.darkness = new DarknessView(this);
    this.lastViewTime = this.time.now;
    this.events.once('shutdown', () => { this.features.destroy(); this.darkness.destroy(); });
    this.playerView = new PlayerSprite(this, this.bank);
    if (this.pickedKit) this.playerView.setOutfit(this.pickedKit.cls);
    this.projViews = new ProjectileSprites(this, this.bank);
    this.playerProjViews = new ProjectileSprites(this, this.bank, DEPTH.playerProjectiles);
    this.weaponFx = new WeaponFxView(this);
    this.hammerSprite = this.add.sprite(0, 0, 'projectiles').setDepth(DEPTH.playerProjectiles).setVisible(false);
    this.vfx = new VfxDirector(new VfxPool(this, this.bank));
    this.markersGfx = this.add.graphics().setDepth(DEPTH.markers);
    this.itemViews = new ItemViews(this);
    this.abilityView = new AbilityView(this);
    this.lootView = new LootView(this);
    this.sfx = new SfxPlayer(this);
    music.attach(this);
    this.events.once('shutdown', () => music.resetDirector());
    // Browsers start audio only after a key press or click (08 §15, 07).
    // Bottom center, under the hint line: the bottom left holds the slots, the top center the boss bar (07 §4.1).
    this.soundNote = this.add.bitmapText(this.scale.width / 2, this.scale.height - 4, FONTS.small, 'Click or press any key for sound')
      .setOrigin(0.5, 1).setScrollFactor(0).setDepth(DEPTH.hud).setAlpha(0.8);
    this.gfx = this.add.graphics().setDepth(DEPTH.projectiles);
    this.hud = this.add.bitmapText(4, 60, FONTS.small, '')
      .setScrollFactor(0).setDepth(DEPTH.hud);
    const { width, height } = this.scale;
    this.overlay = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.hud + 5);
    this.overlay.fillStyle(DRAW.overlay, DRAW.overlayAlpha).fillRect(0, 0, width, height);
    this.overlayText = this.add.bitmapText(width / 2, height / 2, FONTS.large, 'You died — press R')
      .setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.hud + 6);
    this.abilityHud = new AbilityHud(this);
    this.topHud = new TopHud(this);
    this.lootHud = new LootHud(this);
    this.card = new ItemCardPopup(this);
    this.debug = debugEnabled();
    if (this.debug) installCombatDebugApi(this);
    this.createExtra();
    const api = window.__game as unknown as Record<string, unknown> | undefined;
    if (api) {
      api.vfx = () => this.vfx.pool.counts();
      api.sfxLog = () => [...this.sfx.log];
      api.musicLog = () => [...music.log];
      // M4 (plan "Global Constraints"): classes, abilities and weapons.
      api.abilityRuntime = () => structuredClone({ ...this.world.abilities, cast: this.world.abilities.cast ? { slot: this.world.abilities.cast.slot, startTick: this.world.abilities.cast.startTick, linked: this.world.abilities.cast.linked } : null });
      api.classState = () => structuredClone(this.world.classState);
      api.setKit = (cls: ClassId, weapon: WeaponId) => this.equipKit({ cls, weapon });
      api.giveAbility = (slot: 0 | 1, id: AbilityId | null, level: AbilityLevel = 1) => { this.world.abilities.slots[slot] = id ? newAbility(id, level) : null; this.world.refreshClassState(); };
      api.giveWeapon = (slot: 0 | 1, id: WeaponId) => { this.world.combat.slots[slot] = newWeapon(id); this.world.refreshClassState(); };
      api.spawnDummy = (x: number, y: number) => this.world.spawnExtra({ enemy: 'training_dummy', x, y, facing: -1 }).id;
      api.classPickOpen = () => this.classPick !== null;
      api.classPickAction = (action: Parameters<ClassPickModel['action']>[0]) => this.classAction(action);
      api.openPause = () => this.openPause();
      api.pauseAction = (a: PauseAction) => this.pauseAction(a);
      api.pauseState = () => (this.pause ? { tab: this.pause.model.tab, cursor: this.pause.model.cursor } : null);
      api.enemyAi = () => this.world.enemies.map((e) => ({ id: e.id, def: e.def.id, x: e.x, y: e.y, attack: e.ai.attack ? { phase: e.ai.attack.phase, t: e.ai.attack.t, len: e.ai.attack.len } : null }));
      api.interactables = () => this.world.interactables.map((o) => ({ id: o.id, kind: o.kind, label: o.label, x: o.x, y: o.y }));
      api.cardOpen = () => { const t = interactTarget(this.world); return !!t && !('use' in t); };
      api.groundItems = () => this.world.groundItems.map((i) => ({ id: i.id, x: i.x, y: i.y, weapon: i.weapon?.weaponId, ability: i.ability?.id }));
      api.statPick = () => this.world.statPick ? { ...structuredClone(this.world.statPick), cursor: this.statPopup?.model.cursor ?? STAT_PICK_UI.defaultCursor, stacks: { ...this.world.econ.statStacks } } : null;
      api.confirmStatPick = (index?: number) => this.chooseStat(index);
      api.statPickAction = (action: StatPickAction) => this.statAction(action);
    }
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

  /** Grey-box stand-ins until the weapons have art (M9 part 2): Javelin platforms (blinking in their last second), the rune ring, a raised shield. */
  /** Javelin platforms and Rune Ring runes are drawn by `WeaponFxView` (ART8); the raised Shield is the weapon layer. */
  private drawWeaponPlaceholders(_g: Phaser.GameObjects.Graphics, w: GameWorld): void {
    this.weaponFx.update(w);
  }

  /** Opens the class pick for these classes (07 §6.7). */
  openClassPick(classes: ClassId[], pauseWorld: boolean): void {
    this.classMenu.blockHeldPad(activeHomePad());
    this.classPick?.view.destroy();
    const model = new ClassPickModel(classes, this.pickedKit, saveStore().data.unlocks.startWeapons);
    const view = new ClassPickView(this, () => this.classAction('confirm'));
    view.draw(model, this.pickedKit);
    this.classPick = { model, view, pauseWorld };
  }

  /** Equips a starting kit at once (03 §3) and keeps it for restarts. */
  equipKit(kit: Kit): void {
    this.pickedKit = kit;
    this.playerView?.setOutfit(kit.cls);
    this.world.setStartingKit(kit);
    this.onKitEquipped(kit);
  }

  private classAction(action: Parameters<ClassPickModel['action']>[0]): void {
    if (!this.classPick || this.pause) return;
    const cp = this.classPick!;
    const r = cp.model.action(action);
    if (r === 'confirm') this.equipKit(cp.model.kit);
    if (r) { cp.view.destroy(); this.classPick = null; this.clearMenuInput(); return; }
    cp.view.draw(cp.model, this.pickedKit);
  }

  /** One world tick, keeping its events for the next render. */
  protected stepWorld(input: Parameters<GameWorld['step']>[0]): void {
    if (this.freezesExtraMenuWorld()) return;
    const before = this.world.tick, feet = { x: this.world.body.x, y: this.world.body.y };
    this.world.step(input);
    gameSession.events(this.world);
    if (this.world.tick < before) { this.sfxWatch.reset(); this.sfxQueue = []; }
    const evs = this.world.events.map((e) => ({ tick: this.world.tick, e }));
    this.frameEvents.push(...evs);
    this.sfxQueue.push(...this.sfxWatch.collect(this.world, evs));
    for (const { e } of evs) {
      if (e.t === 'bossDefeated') music.note({ t: 'bossDefeated', bossId: e.bossId });
      else if (e.t === 'playerDied' || e.t === 'runCompleted' || e.t === 'enterVillage' || e.t === 'stageStarted' || e.t === 'loadLevel') music.note({ t: e.t } as MusicEvent);
    }
    this.features?.onTick(this.world, evs);
    this.abilityView?.onTick(this.world, this.world.events, feet);
    if (this.vfx) this.vfx.update(this.world, evs, { atlas: `player_${this.playerView.outfit}`, frame: this.playerView.frameName, origin: [0.5, 46 / 48] });
    this.syncStatPick();
  }

  /** Stat cards use direct menu input; only the core owns/apply-checks the selected upgrade. */
  private syncStatPick(): void {
    const w = this.world;
    const visible = w.statPick && (w.run.phase === 'statPick' || (w.run.phase === 'paused' && w.run.pausedFrom === 'statPick'));
    if (!visible) {
      this.statPopup?.view.destroy(); this.statPopup = null; this.statMenu.clear(); return;
    }
    if (!this.statPopup) {
      const model = new StatPickModel();
      const view = new StatPickView(this, (i) => {
        if (this.world.run.phase !== 'statPick' || this.pause) return;
        this.statPopup?.model.select(i); this.syncStatPick();
      }, () => this.statAction('confirm'));
      this.statPopup = { model, view, lastRunTick: w.statPick!.openedAt };
    }
    const p = this.statPopup;
    p.model.advance((w.run.runTicks - p.lastRunTick) / TICK_RATE);
    p.lastRunTick = w.run.runTicks;
    p.view.draw(p.model, w.statPick!.offer, w.econ.statStacks);
  }
  protected chooseStat(index?: number): boolean {
    this.syncStatPick();
    const ok = this.world.confirmStatPick(index ?? this.statPopup?.model.cursor ?? STAT_PICK_UI.defaultCursor);
    if (!ok) return false;
    this.statPopup?.model.accept();
    const held = this.readInput().input;
    for (const b of BUTTON_IDS) if (held[b].held) this.swallow.add(b);
    this.syncStatPick();
    return true;
  }
  private statAction(action: StatPickAction): void {
    if (this.pause || this.world.run.phase !== 'statPick') return;
    this.syncStatPick();
    const index = this.statPopup?.model.input(action);
    if (index !== null && index !== undefined) this.chooseStat(index);
    this.syncStatPick();
  }
  private readonly onStatKeyDown = (e: KeyboardEvent) => {
    if (this.classPick && !this.pause) { if (this.classMenu.key(e.code, true, e.repeat)) e.preventDefault(); return; }
    if (this.pause || this.world.run.phase !== 'statPick') return;
    if ((e.code === 'Escape' || menuPauseKey(e.code)) && !e.repeat) { e.preventDefault(); this.openPause(); return; }
    if (this.statMenu.key(e.code, true, e.repeat)) e.preventDefault();
  };
  private readonly onStatKeyUp = (e: KeyboardEvent) => { this.statMenu.key(e.code, false, false); this.classMenu.key(e.code, false, false); this.pauseMenu.key(e.code, false, false); };
  private pollStatMenu(seconds: number): void {
    if (this.world.run.phase !== 'statPick') return;
    const pads = (navigator.getGamepads?.() ?? []).filter((p): p is Gamepad => p !== null && p.connected);
    const pad = pads.find((p) => p.mapping === 'standard') ?? pads[0];
    for (const action of this.statMenu.poll(Math.min(STAT_PICK_UI.frameClamp, seconds), pad)) this.statAction(action);
  }

  update(_time: number, delta: number): void {
    this.devices.setBindings(getUiSettings().bindings);
    this.devices.pollGamepad();
    const pad = activeHomePad(), pauseButton = getUiSettings().bindings.gamepad.pause;
    const menuPauseAllowed = (pauseKey: string | null) => pauseKey === null || pauseKey === 'Escape' || menuPauseKey(pauseKey) || (pauseButton !== null && !!pad?.buttons[pauseButton]?.pressed);
    if (this.pause) {
      if (!this.pauseMenuCovered()) for (const action of this.pauseMenu.poll(Math.min(STAT_PICK_UI.frameClamp, delta / 1000), activeHomePad())) if (typeof action === 'string' && action !== 'backspace') this.pauseAction(action);
      if (!this.pause) { this.render(); return; }
      // Paused (07 §1.5): no world, no run timer; drain the input latches so nothing fires on resume.
      const paused = this.readInput();
      if (!this.pauseMenuCovered() && paused.input.pause.pressed && menuPauseAllowed(paused.pauseKey)) { this.closePause(); this.render(); return; }
      this.pause.model.tick(this.time.now);
      this.pause.view.draw(this.pause.model, this.world, this.pauseInfo());
      this.render();
      return;
    }
    this.pollStatMenu(delta / 1000);
    if (this.classPick) {
      const pads = navigator.getGamepads?.() ?? [];
      const pad = Array.from(pads).find((p) => p?.connected && p.mapping === 'standard') ?? Array.from(pads).find((p) => p?.connected);
      for (const action of this.classMenu.poll(Math.min(STAT_PICK_UI.frameClamp, delta / 1000), pad)) if (typeof action === 'string' && action !== 'backspace') this.classAction(action);
    }
    if (!this.manual) {
      const n = this.stepper.advance(delta / 1000);
      for (let i = 0; i < n; i++) {
        const snapshot = this.readInput(), input = this.swallowHeld(snapshot.input);
        const menu = this.world.run.phase === 'statPick' || this.extraMenuOpen();
        if (input.pause.pressed && !this.classPick && (!menu || menuPauseAllowed(snapshot.pauseKey))) { this.openPause(); if (this.pause) break; }
        if (this.extraMenuOpen()) { if (!this.freezesExtraMenuWorld()) this.stepWorld({ ...emptyInput(), restart: input.restart }); continue; }
        if (this.classPick) {
          if (this.classPick?.pauseWorld) continue;
          this.stepWorld(emptyInput());                       // the world keeps running; the player gets neutral input
        } else this.stepWorld(input);
      }
    }
    this.render();
  }

  /** 07 §1.5 input swallow: buttons held when a menu closed count as not held until released. */
  private swallow = new Set<(typeof BUTTON_IDS)[number]>();
  /** Consume a physical key source only with the exact pressed edge it describes, including after zero-tick frames. */
  private readInput(): { input: InputState; pauseKey: string | null } {
    return { input: this.devices.builder.build(), pauseKey: this.devices.takePauseKey() };
  }
  protected clearMenuInput(): void {
    const held = this.readInput().input;
    for (const b of BUTTON_IDS) if (held[b].held) this.swallow.add(b);
    this.classMenu.clear();
  }
  private swallowHeld(input: InputState): InputState {
    if (!this.swallow.size) return input;
    const out = { ...input };
    for (const b of [...this.swallow]) {
      if (input[b].held) out[b] = emptyButton();
      else this.swallow.delete(b);
    }
    return out;
  }

  /** Where the pause menu is opened (its item list). */
  protected pausePlace(): 'run' | 'training' | 'home' { return 'run'; }
  protected pauseInfo(): string { return PauseView.info(1, this.world.run.runTicks, null); }
  /** Pause results the scene acts on: restart and quit. */
  protected onPauseQuit(): void {}

  pause: { model: PauseModel; view: PauseView } | null = null;
  private readonly onFocusLost = () => this.openPause(true);
  private readonly onVisibilityChanged = () => { if (document.hidden) this.openPause(true); };
  private readonly onPauseKey = (e: KeyboardEvent) => {
    if (!this.pause || this.pauseMenuCovered()) return;
    const map: Record<string, PauseAction> = {
      ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
      Enter: 'confirm', Space: 'confirm', Escape: 'back', Backspace: 'back',
    };
    const a = map[e.code] ?? (menuConfirmKey(e.code) ? 'confirm' : undefined);
    if (!a) return;
    e.preventDefault();
    this.pauseMenu.key(e.code, true, e.repeat);
  };

  pauseAction(a: PauseAction): void {
    if (!this.pause || this.pauseMenuCovered()) return;
    const r = this.pause.model.input(a, this.time.now);
    if (r === 'resume') this.closePause();
    else if (r === 'restart') { this.closePause(); this.world.restart(); }
    else if (r === 'quit') { this.closePause(); this.onPauseQuit(); }
    else if (r === 'settings') this.onPauseSettings();
  }

  openPause(focusLost = false): void {
    if (this.pause || this.world.run.phase === 'runSoFar') return;
    if (this.pauseMenuCovered() || !focusLost && this.freezesExtraMenuWorld()) return;
    if (!focusLost && !['homeVillage', 'stage', 'statPick', 'village', 'routeChoice'].includes(this.world.run.phase)) return;
    this.statMenu.clear();
    this.pauseMenu.blockHeldPad(activeHomePad());
    pauseRun(this.world.run);
    this.pause = { model: new PauseModel(this.pausePlace()), view: new PauseView(this) };
    this.readInput(); // The opening pause press must not become a fresh resume press.
    window.addEventListener('keydown', this.onPauseKey);
  }

  closePause(): void {
    if (!this.pause) return;
    resumeRun(this.world.run);
    this.pause.view.destroy();
    this.pause = null;
    this.pauseMenu.clear();
    if (this.world.run.phase === 'statPick') this.statMenu.blockUntilRelease();
    else this.statMenu.clear();
    window.removeEventListener('keydown', this.onPauseKey);
    const held = this.readInput().input;
    for (const b of BUTTON_IDS) if (held[b].held) this.swallow.add(b);
  }

  protected render(): void {
    const w = this.world;
    const warning = saveStore().takeWarning();
    if (warning) this.abilityHud.toast(warning, UI_COLOR.bad, this.time.now, SAVE_RULES.warningSeconds);
    const cam = w.camera;
    if (!getUiSettings().screenShake) { cam.shakeX = 0; cam.shakeY = 0; }
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
    this.parallax.update(cam.x + cam.shakeX, cam.y + cam.shakeY, Math.min(B.frameClamp, Math.max(0, this.time.now - this.lastViewTime) / 1000));
    this.lastViewTime = this.time.now;
    const g = this.gfx.clear();
    this.boxes.clear();
    this.bossBoxes.clear();
    this.playerShots.clear();
    // A restart rewinds the tick: drop effects of the old run.
    if (w.tick < this.lastRenderTick) {
      this.vfx.reset(); this.abilityView.reset(); this.lootView.reset(); this.frameEvents = []; this.playerEv = { lastDoubleJumpTick: -100000, lastWallJumpTick: -100000 };
      this.sfx.play([{ id: 'restart' }], w.tick, { camCenterX: cam.x, playerX: w.body.x });
    }
    this.lastRenderTick = w.tick;
    for (const { tick, e } of this.frameEvents) {
      if (e.t === 'openClassPick') this.openClassPick([e.cls], false);
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
    // Player projectiles with ART5 art (arrows, bolts, orbs); a grey box for any without.
    this.playerProjViews.update(this.boxesMode ? [] : w.playerProjectiles, w.tick);
    for (const p of w.playerProjectiles) {
      if (this.boxesMode || !this.playerProjViews.hasArt(p.def.id)) this.playerShots.fillStyle(DRAW.playerShot, 1).fillRect(p.x - p.def.w / 2, p.y - p.def.h / 2, p.def.w, p.def.h);
    }
    for (const id of w.blasts) { const bl = w.hitGroups.find((x) => x.id === id); if (bl) g.fillStyle(DRAW.blast, DRAW.blastAlpha).fillRect(bl.rect.x, bl.rect.y, bl.rect.w, bl.rect.h); }
    this.drawWeaponPlaceholders(g, w);

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
    this.features.update(w, [], w.tick / TICK_RATE);
    this.kingdomView.update(w);
    this.castleView.update(w);
    this.darkness.setVisible(!this.overview);
    this.darkness.update(w, w.tick / TICK_RATE);
    this.itemViews.update(w.groundItems, w.tick);
    this.abilityView.update(w);
    this.abilityHud.update(w, this.frameEvents.map((f) => f.e), this.time.now, !this.overview);
    this.topHud.update(topHudView(w), this.frameEvents.map((f) => f.e), this.time.now, !this.overview);
    this.lootView.update(w, this.frameEvents);
    this.lootHud.update(w, this.frameEvents.map((f) => f.e), this.time.now, !this.overview, (t, c, s) => this.abilityHud.toast(t, c, this.time.now, s));
    // The item card over the interact target, or the item an open swap choice is about (07 §6.1–6.3).
    const choiceId = w.weaponSwapChoice?.itemId ?? (w.abilities.swapChoice ? Number(w.abilities.swapChoice.itemId) : null);
    const tgt = choiceId !== null ? w.groundItems.find((i) => i.id === choiceId) ?? null : interactTarget(w);
    const item = tgt && !('use' in tgt) ? (tgt as GroundItem) : null;
    this.card.update(item, item ? itemCard(w, item) : null, this.time.now, !this.overview && !w.health.dead);
    const reqs = [...this.sfxQueue, ...this.sfxWatch.footsteps(this.playerView.anim, w)];
    this.sfxQueue = [];
    this.sfx.play(reqs, w.tick, { camCenterX: cam.x + this.scale.width / 2, playerX: b.x });
    this.sfx.updateCart(w);
    music.update(this, musicSnapshot(w), w.run.phase === 'paused' || !!this.pause, isSlow(w));
    this.soundNote.setVisible(this.sfx.locked && !this.overview);
    if (this.debug) g.lineStyle(1, COLOR.hurtbox, 1).strokeRect(left + 0.5, top + 0.5, b.w - 1, b.h - 1);

    // Active attack hitboxes: the player's always (M2), the enemies' with ?debug=1. Ability boxes now have
    // ART5 effects, so they show only in ?boxes=1.
    for (const h of w.hitGroups) {
      if (!h.active || (h.owner !== 'player' && !this.debug) || (h.ability && !this.boxesMode)) continue;
      g.fillStyle(DRAW.attackBox, DRAW.attackAlpha).fillRect(h.rect.x, h.rect.y, h.rect.w, h.rect.h);
    }
    // The thrown Storm Hammer, over its own hitbox (grey box until ART5).
    // The thrown Storm Hammer spins (ART5 `hammer_spin`).
    const spin = this.bank.projectile('hammer_spin');
    this.hammerSprite.setVisible(!!w.hammer && !!spin && !this.boxesMode);
    if (w.hammer && spin && !this.boxesMode) this.hammerSprite.setTexture(spin.atlas, spin.frames[timeFrame(spin, w.tick / TICK_RATE)]).setPosition(w.hammer.x, w.hammer.y);
    else if (w.hammer) g.fillStyle(DRAW.hammer, 1).fillRect(w.hammer.x - 8, w.hammer.y - 8, 16, 16);

    this.drawMarks();
    this.drawHud();
    const dead = w.phase === 'deathScreen';
    this.overlay.setVisible(dead);
    this.overlayText.setVisible(dead);
    this.renderExtra();
    this.syncStatPick();
    this.classPick?.view.draw(this.classPick.model, this.pickedKit);
    this.frameEvents = [];
  }

  /** For the browser tests: how an enemy is drawn right now. Enemies without art are always a grey body, never invisible. */
  enemyDrawMode(id: number): 'sprite' | 'box' | null {
    const e = this.world.enemies.find((x) => x.id === id);
    const view = e && this.enemyViews.get(e);
    return view ? (this.boxesMode || !view.hasArt ? 'box' : 'sprite') : null;
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
    const drawing = enemyDrawing(this.world, e);
    if (drawing.hidden) {
      if (drawing.bubble) {
        const phase = (this.time.now / 1000 / B.bubblePeriod) % 1;
        g.lineStyle(1, B.bubbleColor, 1 - phase).strokeCircle(e.x, e.y - phase * B.bubbleRise, B.bubbleRadius);
      }
      return;
    }
    const bodyGraphics = e.boss ? this.bossBoxes : this.boxes;
    if (drawing.threadTop !== null) {
      const shake = drawing.warning ? (this.world.tick % 2 ? B.threadShake : -B.threadShake) : 0;
      bodyGraphics.lineStyle(B.threadWidth, B.thread, 1).lineBetween(e.x + shake, drawing.threadTop, e.x + shake, r.y);
    }
    if (this.boxesMode || !this.enemyViews.get(e)?.hasArt) this.drawEnemyBox(bodyGraphics, e);
    // Fog dims the body, while eyes and the orange warning remain visible above it.
    const ex = e.facing > 0 ? r.x + r.w - B.eyeW - B.eyeInset : r.x + B.eyeInset;
    if (drawing.glint) g.fillStyle(B.eye, 1).fillRect(ex, r.y + B.eyeTop, B.eyeW, B.eyeH);
    if (drawing.warning) g.lineStyle(1, e.ai.attack!.len - e.ai.attack!.t <= ENEMY.TELEGRAPH_FLASH_LAST_TICKS ? DRAW.telegraphLast : DRAW.telegraph, 1).strokeRect(r.x, r.y, r.w, r.h);
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
    const alpha = e.dead ? Math.min(1, e.deathTicks / (e.boss ? BOSS.DEATH_ANIM_TICKS : ENEMY.DEATH_ANIM_TICKS)) : e.spawnInTicks > 0 ? 1 - e.spawnInTicks / ENEMY.SPAWN_IN_TICKS : 1;
    let color = e.dragon ? DRAGON_COLOR[e.dragon.color] : ENEMY_COLOR[e.def.id] ?? B.enemy;
    const a = e.ai.attack;
    if (a && a.phase === 'tele') color = a.len - a.t <= ENEMY.TELEGRAPH_FLASH_LAST_TICKS ? DRAW.telegraphLast : DRAW.telegraph;
    if (e.control && e.control.type !== 'dazed') color = DRAW.controlled;
    if (e.hurtFlashTicks > 0) color = DRAW.hurtFlash;
    g.fillStyle(color, alpha * fadeAlpha(e)).fillRect(r.x, r.y, r.w, r.h);
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
    // The M1 text readout, now only with ?hudtext=1 (07's HUD replaced it).
    this.hud.setText(new URLSearchParams(window.location.search).get('hudtext') === '1' ? this.hudLines() : '');
  }
}
