// M3 stage scene: loads public/levels/<id>.json and plays it, with doors, loot markers, hints, the boss bar,
// the run timer, the split popup and the temporary stage-clear screen.
import Phaser from 'phaser';
import { killEnemy } from '../../core/combat/resolve.ts';
import { loadLevel, type LevelData } from '../../core/level/loadLevel.ts';
import { sectionAt } from '../../core/level/routeLint.ts';
import { timedDoorTimeLeft } from '../../core/run/timedDoors.ts';
import type { HintAction } from '../../core/run/zones.ts';
import { GameWorld } from '../../core/sim/gameWorld.ts';
import { formatTime } from '../../core/time.ts';
import { TICK_RATE } from '../../core/tuning.ts';
import { FONTS } from '../../data/animKeys.ts';
import { DEPTH } from '../../data/art.ts';
import { DoorViews, drawGuideArrows } from '../view/levelView.ts';
import { YardView } from '../view/yardView.ts';
import { STAGE_UI } from '../../data/stageUi.ts';
import { HUD_COLOR, UI_COLOR } from '../../data/uiText.ts';
import { WorldScene } from './WorldScene.ts';
import { PauseView } from '../../ui/popups/pause.ts';
import { applyLucky } from '../../core/loot/lucky.ts';
import type { LuckyId } from '../../data/loot.ts';
import { dropItem } from '../../core/abilities/items.ts';
import { newWeapon } from '../../core/abilities/runtime.ts';
import type { ElementId, Grade, WeaponId } from '../../core/combat/types.ts';
import { parseKit } from '../../ui/popups/classPickModel.ts';
import { CLASS_IDS } from '../../data/classes.ts';
import { LEVEL_FILE } from '../../data/run.ts';
import { debugSeed, randomSeed } from '../seed.ts';
import { captureWorld, type WorldCarry } from '../../core/run/session.ts';
import { gameSession } from '../session.ts';
import { saveStore } from '../save/storage.ts';
import { HomePanels, type HomePanelKind } from '../../ui/home/homePanels.ts';
import type { Kit } from '../../ui/popups/classPickModel.ts';
import { VillageView } from '../view/villageView.ts';
import { RUN } from '../../core/tuning.ts';
import { interactTarget } from '../../core/abilities/items.ts';
import { ShopView } from '../../ui/popups/shop.ts';
import { interactPrompt } from '../../ui/model/prompt.ts';
import { RouteChoiceView } from '../../ui/popups/routeChoice.ts';
import { RunSoFarView } from '../../ui/screens/runSoFar.ts';
import { cancelRoad, chooseRoad } from '../../core/run/roads.ts';
import { beginTransition } from '../../core/run/phases.ts';

/** Hint text with the M1 key names (07 shows real button prompts later). */
const HINT_TEXT: Record<HintAction, string> = {
  move: 'A / D — move', jump: 'Space — jump', double_jump: 'Space in the air — double jump', dash: 'Shift — dash (through attacks)',
  wall_jump: 'Space on a wall — wall jump', slide: 'S + Shift — slide', dive_slam: 'S + J in the air — dive slam',
  attack: 'J / K — attack', lucky_block: 'Hit the block!', ability: 'U / I — ability', heal: 'Q — drink the flask',
  interact: 'E — pick up', drop_through: 'S + Space — drop through',
};
/** Grey marker letters for loot objects that start working in M4. */
const MARKER_LETTER: Record<string, string> = {
  lucky_block: 'L', loot_stand: 'S', key: 'K', key_chest: 'C', cursed_chest: 'Q', timed_chest: 'T', merchant_spot: 'M',
};
const CENTER_MARKERS = new Set(['lucky_block', 'key']);

export class StageScene extends WorldScene {
  private levelId = 'plains';
  private level!: LevelData;
  private props!: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.BitmapText[] = [];
  private doorText = new Map<string, Phaser.GameObjects.BitmapText>();
  private doorViews!: DoorViews;
  private hintText!: Phaser.GameObjects.BitmapText;
  private timerText!: Phaser.GameObjects.BitmapText;
  private splitText!: Phaser.GameObjects.BitmapText;
  private splitUntil = -1;
  private bossBarGfx!: Phaser.GameObjects.Graphics;
  private bossText!: Phaser.GameObjects.BitmapText;
  private bossTitle!: Phaser.GameObjects.BitmapText;
  private segmentText!: Phaser.GameObjects.BitmapText;
  private infoText!: Phaser.GameObjects.BitmapText;
  private yard: YardView | null = null;
  private homePanel: HomePanels | null = null;
  private carry: WorldCarry | undefined;
  private leaving = false;
  private fade!: Phaser.GameObjects.Graphics;
  private villageView: VillageView | null = null;
  private shopView: ShopView | null = null;
  private routeChoice: RouteChoiceView | null = null;
  private runSoFar: RunSoFarView | null = null;

  constructor(key = 'Stage') {
    super(key);
  }

  /** The level the start screen chose (else the URL decides). */
  private chosen: string | null = null;
  init(data?: { level?: string; carry?: WorldCarry }): void {
    this.chosen = data?.level ?? null;
    this.carry = data?.carry; this.leaving = false; this.yard = null; this.homePanel = null; this.villageView = null; this.shopView = null; this.routeChoice = null; this.runSoFar = null; this.labels = []; this.doorText.clear(); this.splitUntil = -1;
  }

  preload(): void {
    super.preload();
    const q = new URLSearchParams(window.location.search);
    // `?start=training` opens the Training Yard (06 §12.4: until the Home Village gate exists); other levels need ?debug=1.
    const start = q.get('start');
    this.levelId = this.chosen ?? (start === 'training' ? 'training_yard' : (q.get('debug') === '1' && start) || 'plains');
    this.load.json(`level_${this.levelId}`, `levels/${LEVEL_FILE[this.levelId] ?? this.levelId}.json`);
  }

  protected makeWorld(): GameWorld {
    this.level = loadLevel(this.cache.json.get(`level_${this.levelId}`));
    const q = new URLSearchParams(window.location.search);
    const typedSeed = debugSeed(q);
    const w = gameSession.makeWorld(this.level, this.carry, typedSeed);
    const section = q.get('debug') === '1' ? Number(q.get('section') ?? 0) : 0;
    if (section > 0) {
      // 06 §16: the player goes to the first main_path vertex inside section n.
      const p = this.level.objects.find((o) => o.type === 'main_path')?.points?.find((v) => sectionAt(this.level, v.x, v.y) === section);
      if (p) w.teleportPlayer(p.x, Math.floor(p.y / 16) * 16 + 16);
    }
    return w;
  }

  protected createExtra(): void {
    const U = STAGE_UI;
    const { width, height } = this.scale;
    this.props = this.add.graphics().setDepth(DEPTH.terrain + 5);
    for (const m of this.world.markers) {
      const y = CENTER_MARKERS.has(m.type) ? m.y + U.marker / 2 : m.y;
      this.labels.push(this.add.bitmapText(m.x, y - U.marker / 2, FONTS.small, MARKER_LETTER[m.type] ?? '?')
        .setOrigin(0.5).setDepth(DEPTH.terrain + 6));
    }
    this.doorViews = new DoorViews(this);
    drawGuideArrows(this, this.level.objects);
    this.hintText = this.add.bitmapText(width / 2, height - U.hintBottom, FONTS.small, '').setOrigin(0.5, 1).setScrollFactor(0).setDepth(DEPTH.hud);
    this.timerText = this.add.bitmapText(U.timer[0], U.timer[1], FONTS.large, '').setOrigin(1, 0).setScrollFactor(0).setDepth(DEPTH.hud);
    this.segmentText = this.add.bitmapText(U.segment[0], U.segment[1], FONTS.small, '').setTint(UI_COLOR.textDim).setOrigin(1, 0).setScrollFactor(0).setDepth(DEPTH.hud);
    this.infoText = this.add.bitmapText(U.info[0], U.info[1], FONTS.small, '').setOrigin(1, 0).setScrollFactor(0).setDepth(DEPTH.hud);
    this.splitText = this.add.bitmapText(U.alert[0], U.alert[1], FONTS.small, '').setTint(UI_COLOR.highlight).setOrigin(0.5, 0).setScrollFactor(0).setDepth(DEPTH.hud);
    this.bossBarGfx = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.hud);
    this.bossText = this.add.bitmapText(U.bossName[0], U.bossName[1], FONTS.small, '').setScrollFactor(0).setDepth(DEPTH.hud);
    this.bossTitle = this.add.bitmapText(U.bossTitleRight, U.bossName[1], FONTS.small, '').setOrigin(1, 0).setTint(UI_COLOR.textDim).setScrollFactor(0).setDepth(DEPTH.hud);
    if (this.level.kind === 'training') this.yard = new YardView(this, this.level);
    if (this.level.kind === 'village') this.villageView = new VillageView(this, this.level);
    if (this.level.kind === 'village' && this.level.id !== 'home') this.shopView = new ShopView(this);
    this.fade = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.hud + 30).fillStyle(UI_COLOR.ink).fillRect(0, 0, width, height).setVisible(false);
    this.installStageDebug();
    // Before the run, pick a class and weapon (M4 plan Task 13). `?kit=archer:bow` skips the panel; debug runs keep
    // the M2 loadout unless a kit is given.
    const q = new URLSearchParams(window.location.search);
    const kit = parseKit(q.get('kit'));
    if (kit) this.equipKit(kit);
    // In the Training Yard the class statues at the start do the picking (06 §12.4).
    else if (this.level.kind === 'stage' && !this.world.run.startKit && (q.get('debug') !== '1' || q.get('picker') === '1')) this.openClassPick([...CLASS_IDS], true);
  }

  private installStageDebug(): void {
    const api = window.__game as unknown as Record<string, unknown> | undefined;
    if (!api) return;
    api.runState = () => structuredClone(this.world.run);
    api.confirmStatPick = (index?: number) => this.chooseStat(index);
    api.completeLoading = () => this.world.completeLoading();
    api.killAll = () => { for (const e of this.world.enemies) if (!e.dead && !e.dormant && e.spawnInTicks === 0) killEnemy(this.world, e); };
    api.setBossHp = (hp: number) => { const b = this.world.enemies.find((e) => e.boss); if (b) b.hp = hp; };
    api.levelId = () => this.level.id;
    api.save = () => structuredClone(saveStore().data);
    api.shop = () => structuredClone(this.world.shop);
    api.routeChoice = () => this.routeChoice ? { cursor: this.routeChoice.model.cursor, road: this.routeChoice.model.road } : null;
    api.routeAction = (action: Parameters<RouteChoiceView['action']>[0]) => this.routeChoice?.action(action);
    api.summaryAction = (action: Parameters<RunSoFarView['action']>[0]) => this.runSoFar?.action(action);
    api.restartRun = () => this.world.restart();
    api.loadout = () => structuredClone({ weapons: this.world.combat.slots, abilities: this.world.abilities.slots });
    api.homePanel = () => this.homePanel?.model.kind ?? null;
    api.homeAction = (action: Parameters<HomePanels['action']>[0]) => this.homePanel?.action(action);
    api.openHomePanel = (kind: HomePanelKind) => this.openHomePanel(kind);
    api.levelObjects = (type: string) => this.level.objects.filter((o) => o.type === type).map((o) => ({ x: o.x, y: o.y, w: o.w, h: o.h, props: o.props }));
    // Training Yard: progress, and a jump to a station's checkpoint.
    api.training = () => {
      const t = this.world.training;
      return t ? { done: [...this.world.trainingDone].sort((a, b) => a - b), current: t.current, sign: t.sign, fade: t.fade } : null;
    };
    api.stations = () => this.world.training?.stations.map((x) => ({ id: x.id, rect: x.rect, checkpoint: x.checkpoint })) ?? [];
    api.toStation = (id: number) => {
      const s = this.world.training?.stations.find((x) => x.id === id);
      if (s) this.world.teleportPlayer(s.checkpoint.x, s.checkpoint.y);
    };
    // Zooms out to show section n whole (0 = back to normal), for screenshots.
    api.overview = (n: number) => {
      const s = this.level.objects.find((o) => o.type === 'section' && o.props.index === n);
      const rows = this.level.objects.filter((o) => o.type === 'main_path')[0]?.points ?? [];
      const ys = rows.filter((p) => s && p.x >= s.x && p.x < s.x + s.w).map((p) => p.y);
      const top = Math.max(0, Math.min(...ys) - STAGE_UI.overviewAbove * 16), bottom = Math.min(this.world.grid.heightPx, Math.max(...ys) + STAGE_UI.overviewBelow * 16);
      this.overview = n > 0 && s ? { x: s.x, y: top, w: s.w, h: Math.max(bottom - top, (s.w * 9) / 16) } : null;
    };
    // M5 loot helpers: a forced Lucky Block result at the player, a forced merchant, a dropped weapon, the loot state.
    api.forceLucky = (id: LuckyId) => {
      const n = this.world.events.length;
      applyLucky(this.world, id, this.world.body.x, this.world.body.y - 24);
      // Outside a tick: hand its events to the next render (the core clears them at the next tick's start).
      this.frameEvents.push(...this.world.events.slice(n).map((e) => ({ tick: this.world.tick, e })));
    };
    api.enemyStatus = () => this.world.enemies.filter((e) => !e.dead && e.status).map((e) => ({ id: e.id, frozen: !!e.status!.frozen, chill: !!e.status!.chill, burn: !!e.status!.burn }));
    api.setKeys = (n: number) => { this.world.econ.keys = n; };
    api.setGold = (n: number) => { this.world.econ.goldTenths = n * 10; };
    api.forceMerchant = () => this.world.rollStageLoot(true);
    api.dropWeapon = (weaponId: WeaponId, grade: Grade, element: ElementId | null = null, perk: string | null = null, price?: number) => {
      const it = dropItem(this.world, this.world.body.x + 24, this.world.body.y - 4, { weapon: { ...newWeapon(weaponId), grade, element, perk: perk as never } });
      if (price !== undefined) it.price = price;
      return it.id;
    };
    api.loot = () => structuredClone({
      econ: this.world.econ, gold: this.world.gold,
      chests: this.world.chests, lucky: this.world.luckyBlocks, coins: this.world.coins.length,
      merchant: this.world.merchant,
      items: this.world.groundItems.map((i) => ({ id: i.id, x: i.x, y: i.y, key: !!i.key, price: i.price, weapon: i.weapon ?? null, ability: i.ability?.id ?? null })),
    });
    api.arenas = () => [...this.world.arenas.values()].map((a) => ({ id: a.id, kind: a.kind, rect: a.rect }));
  }

  protected pausePlace(): 'run' | 'training' | 'home' { return this.level.kind === 'training' ? 'training' : this.level.id === 'home' ? 'home' : 'run'; }
  protected pauseInfo(): string {
    if (this.level.kind === 'training') return 'Training Yard';
    return PauseView.info(this.level.stage, this.world.run.runTicks, null);
  }
  /** Quitting, or leaving the Training Yard: back to the start screen (M4.1 Task 2). */
  protected onPauseQuit(): void {
    if (this.level.kind === 'training' && gameSession.trainingReturn === 'home') this.goLevel('home');
    else if (this.level.kind === 'stage' || this.world.run.started) this.requestHome();
    else this.toTitle();
  }
  protected onKitEquipped(kit: Kit): void {
    if (this.level.kind === 'stage') return;
    const first = saveStore().data.lastKit === null;
    saveStore().update((s) => { s.lastKit = { ...kit }; });
    if (first && this.level.id === 'home') this.openHomePanel('training');
  }
  protected extraMenuOpen(): boolean { return !!this.homePanel?.active || !!this.routeChoice || !!this.runSoFar; }
  private requestHome(): void {
    this.runSoFar?.destroy(); this.runSoFar = null;
    beginTransition(this.world.run, 'toHome', { phase: 'homeVillage', levelId: 'home', stage: 0 });
  }
  private syncRunPanels(): void {
    const w = this.world;
    if (w.run.phase !== 'routeChoice' && !(w.run.phase === 'paused' && w.run.pausedFrom === 'routeChoice')) { this.routeChoice?.destroy(); this.routeChoice = null; }
    if (w.run.phase === 'routeChoice' && !this.routeChoice) this.routeChoice = new RouteChoiceView(this,
      { lastRoad: saveStore().data.lastRoad, startClass: w.run.startKit?.cls ?? null, pbs: saveStore().data.pbs }, {
        onConfirm: (road) => { if (chooseRoad(w, road)) saveStore().update((s) => { s.lastRoad = road; }); this.routeChoice?.destroy(); this.routeChoice = null; this.clearMenuInput(); },
        onCancel: () => { cancelRoad(w); this.routeChoice?.destroy(); this.routeChoice = null; this.clearMenuInput(); },
      });
    if (w.run.phase !== 'runSoFar') { this.runSoFar?.destroy(); this.runSoFar = null; }
    if (w.run.phase === 'runSoFar' && !this.runSoFar) this.runSoFar = new RunSoFarView(this, {
      runTicks: w.run.runTicks, split1: w.run.splits[0], gold: w.gold, kills: w.run.stats.kills,
      kit: { weapons: structuredClone(w.combat.slots), abilities: w.abilities.slots.map((s) => s ? { id: s.id, level: s.level } : null), displayName: w.classState.displayName },
    }, { onRestart: () => { this.runSoFar?.destroy(); this.runSoFar = null; w.restart(); }, onHomeVillage: () => this.requestHome(), onTitle: () => this.toTitle() });
  }
  private openHomePanel(kind: HomePanelKind): void {
    this.homePanel?.destroy();
    this.homePanel = new HomePanels(this, kind, saveStore().data, {
      onSeedChange: (seed) => { saveStore().update((s) => { s.typedSeed = seed; }); this.world.opts.seeded = seed !== null; this.world.opts.seedText = seed ?? randomSeed(); this.world.run.seeded = seed !== null; this.world.run.seedText = this.world.opts.seedText; },
      onTraining: () => this.enterTraining(), onClose: () => { this.homePanel?.destroy(); this.homePanel = null; this.clearMenuInput(); },
    }, randomSeed);
  }
  private enterTraining(): void { gameSession.trainingReturn = this.level.id === 'home' ? 'home' : 'title'; this.goLevel('training_yard'); }
  private goLevel(level: string, carry?: WorldCarry): void {
    if (this.leaving) return; this.leaving = true;
    this.homePanel?.destroy();
    if (window.__game) window.__game.ready = false;
    this.scene.start(['home', 'crossroads', 'border', 'rebel_camp'].includes(level) ? 'Village' : 'Stage', { level, carry });
  }
  update(time: number, delta: number): void {
    if (this.homePanel?.active) { this.homePanel.setEnabled(!this.pause); this.homePanel.update(delta / 1000); }
    this.routeChoice?.setEnabled(!this.pause); this.routeChoice?.update(delta / 1000);
    this.runSoFar?.update(delta / 1000);
    super.update(time, delta);
  }
  private toTitle(): void {
    if (this.scene.get('Title')) this.scene.start('Title');
  }

  protected hudLines(): string[] {
    return super.hudLines().filter((l) => !l.startsWith('Time'));
  }

  protected renderExtra(): void {
    const w = this.world, U = STAGE_UI;
    this.syncRunPanels();
    this.villageView?.update(w, saveStore().data.typedSeed);
    this.shopView?.update(w, this.frameEvents.some(({ e }) => e.t === 'cantAfford'));
    if (w.run.phase === 'loading' && w.run.transition) {
      if (w.run.transition.target.phase === 'runSoFar') w.completeLoading();
      else { this.goLevel(w.run.transition.target.levelId, captureWorld(w)); return; }
    }
    for (const { e } of this.frameEvents) if (e.t === 'openHomePanel') {
      if (e.panel === 'training') this.enterTraining(); else this.openHomePanel(e.panel);
    }
    const transition = w.run.transition;
    this.fade?.setVisible(w.run.phase === 'transition').setAlpha(transition ? (transition.part === 'out' ? 1 - transition.left / RUN.FADE_TICKS : transition.left / (transition.kind === 'restart' ? RUN.RESTART_FADE_TICKS : RUN.FADE_TICKS)) : 0);
    const g = this.props.clear();
    // Doors (sprites) and the timed door's countdown.
    this.doorViews.update(w);
    for (const b of w.bodies.list) {
      const timed = w.timedDoors.find((t) => t.id === b.id);
      if (!timed) continue;
      const state = w.run.timedDoors[b.id];
      let t = this.doorText.get(b.id);
      if (!t) { t = this.add.bitmapText(0, 0, FONTS.small, '').setOrigin(0.5, 1).setDepth(DEPTH.doors + 1); this.doorText.set(b.id, t); }
      t.setPosition(b.x + b.w / 2, b.y - 2).setText(state === 'pending' ? `${Math.ceil(timedDoorTimeLeft(w, b.id))}` : '');
    }
    // Loot markers (grey boxes with a letter) and guide arrows.
    for (const m of w.markers) {
      const cy = CENTER_MARKERS.has(m.type) ? m.y : m.y - U.marker / 2;
      g.fillStyle(U.markerColor, 1).fillRect(m.x - U.marker / 2, cy - U.marker / 2, U.marker, U.marker);
    }
    // Hint, timer, split popup, boss bar, stage clear.
    const target = this.level.kind === 'village' ? interactTarget(w) : null;
    const sign = w.villageMessage ?? w.training?.sign ?? (target && 'use' in target ? (interactPrompt(w, target) ? '' : `[E] ${target.label === 'training' ? 'Training Yard' : target.label === 'seed' ? 'Seed' : target.label === 'records' ? 'Discoveries' : target.label}`) : w.activeHint ? HINT_TEXT[w.activeHint] : '');
    this.hintText.setText(!this.overview ? sign : '');
    this.yard?.update(w);
    if (this.frameEvents.some(({ e }) => e.t === 'leftTraining')) { if (gameSession.trainingReturn === 'home') this.goLevel('home'); else this.toTitle(); return; }
    const timerOn = !this.overview && !this.yard && w.run.phase !== 'homeVillage';
    this.timerText.setVisible(timerOn).setText(formatTime(w.run.runTicks));
    this.segmentText.setVisible(timerOn && this.level.kind === 'stage').setText(`STAGE ${this.level.stage}  ${formatTime(w.run.stageTicks ?? w.run.runTicks)}`);
    // Info line: a pending timed door within 640 px (07 §4.11).
    let info = '', infoBad = false;
    for (const d of w.timedDoors) {
      const b = w.bodies.list.find((x) => x.id === d.id);
      if (!b || w.run.timedDoors[d.id] !== 'pending' || Math.abs(b.x - w.body.x) > U.doorInfoRange) continue;
      const left = Math.max(0, timedDoorTimeLeft(w, d.id));
      info = `DOOR ${formatTime(Math.round(left * TICK_RATE))}`; infoBad = left < U.doorInfoBadS;
      break;
    }
    this.infoText.setVisible(timerOn).setText(info).setTint(infoBad ? UI_COLOR.bad : UI_COLOR.text);
    for (const { e } of this.frameEvents) if (e.t === 'split') { this.splitUntil = w.tick + U.splitSeconds * TICK_RATE; this.splitText.setText(`Split ${e.index}  ${formatTime(e.runTicks)}`); }
    this.splitText.setVisible(w.tick < this.splitUntil);
    const bar = w.bossBar;
    const bg = this.bossBarGfx.clear();
    if (bar && !this.overview) {
      const [hx, hy, hw, hh] = U.bossHp;
      bg.fillStyle(UI_COLOR.ink, 1).fillRect(hx, hy, hw, hh);
      bg.fillStyle(HUD_COLOR.hp, 1).fillRect(hx + 1, hy + 1, bar.hp <= 0 ? 0 : Math.max(1, Math.round(((hw - 2) * bar.hp) / bar.maxHp)), hh - 2);
      for (const m of bar.marks) bg.fillStyle(UI_COLOR.ink, 1).fillRect(hx + 1 + Math.round((hw - 2) * m), hy + 1, 1, hh - 2);
      const [px, py, pw, ph] = U.bossPoise;
      bg.fillStyle(UI_COLOR.ink, 1).fillRect(px, py, pw, ph);
      this.bossText.setText(bar.name);
      this.bossTitle.setText(bar.title);
    } else { this.bossText.setText(''); this.bossTitle.setText(''); }
  }
}
