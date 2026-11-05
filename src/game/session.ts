// Browser session: the sole save repository and the source to return to after Training.
import { isAssisted } from '../core/run/runState.ts';
import { assembleLevel, type LevelPack, type Picks } from '../core/level/assemble.ts';
import { classicLayout, layoutCode, rollLayout, rollVariety } from '../core/run/layout.ts';
import { fnv1a32 } from '../core/rng.ts';
import type { StageLevelId } from '../data/levelRules.ts';
import { saveDate, saveStore } from './save/storage.ts';
import { GameWorld, type GameWorldOptions } from '../core/sim/gameWorld.ts';
import type { LevelData } from '../core/level/loadLevel.ts';
import type { WorldCarry } from '../core/run/session.ts';
import { applyPracticeTime, practiceKey, type PracticeSetup } from '../core/run/practice.ts';
import { randomSeed } from './seed.ts';
import { savePersonalBest } from '../core/run/splits.ts';
import { appendHistory, captureRunEnd } from '../core/run/history.ts';
import type { RunRecord } from '../core/save/schema.ts';
import { WEAPONS } from '../data/weapons.ts';
import { STARTING_KITS } from '../data/classes.ts';
import { WEAPON_NAME } from '../data/uiText.ts';
import { dailyTwist, recordDailyEnd, recordSeedBest } from '../core/run/daily.ts';
import type { BossRushAttempt } from '../core/run/bossRush.ts';
import type { BossRushSetup } from '../ui/screens/bossRush.ts';
import type { StartKit } from '../core/save/schema.ts';
export const gameSession = {
  trainingReturn: 'title' as 'home' | 'title',
  kitNotice: null as string | null,
  /** The last practice setup, so `Retry` and `Change setup` come back to it (06 §14). */
  practiceSetup: null as PracticeSetup | null,
  /** 06 §14.1 (M15): set while a Daily challenge is being played (Title → Daily); Play clears it. */
  /** `official` false = a seed challenge (06 §14.1, M18). */
  daily: null as { day: string; seed: string; kit: StartKit; official?: boolean } | null,
  /** 06 §14.2 (M15): the Boss Rush attempt being played, and the last setup (for Retry / Change setup). */
  bossRush: null as BossRushAttempt | null,
  bossRushSetup: null as BossRushSetup | null,
  takeKitNotice(): string | null { const text = this.kitNotice; this.kitNotice = null; return text; },
  /** A confirmed import replaces comparisons too; live gear, run state and its frozen pool stay intact. */
  refreshRecords(w: GameWorld): void {
    const save = saveStore().data;
    w.records.pbs = structuredClone(save.pbs); w.records.bestSegments = structuredClone(save.bestSegments);
  },
  /** `pack`: the level's section versions (06 §8.7); the run's picks (or `forcedLayout`) assemble the level. */
  makeWorld(level: LevelData, carry?: WorldCarry, debugSeed?: string | null, dragon?: GameWorldOptions['dragon'], practice?: PracticeSetup | null,
    pack?: LevelPack | null, forcedLayout?: Picks | null): GameWorld {
    const save = saveStore().data;
    const homeTransition = carry?.run.transition?.target.phase === 'homeVillage' ? structuredClone(carry.run.transition) : null;
    if (homeTransition) carry = undefined;
    const rush = !practice && this.bossRush && level.kind === 'stage' && !carry ? this.bossRush : null;
    if (rush) {
      const f = rush.fights[rush.index];
      dragon = f.boss === 'dragon' && rush.dragonColor ? { present: true, stage: 2, color: rush.dragonColor, outcome: 'absent' } : { present: false, stage: 2, color: 'red', outcome: 'absent' };
    }
    const daily = !practice && !rush && this.daily && level.kind === 'stage' ? this.daily : null;
    const seed = carry?.run.seedText ?? (rush ? 'BOSSRUSH' : null) ?? daily?.seed ?? debugSeed ?? save.typedSeed;
    let startKit = practice ? { cls: practice.cls, weapon: practice.weapon } : carry?.run.startKit ?? (rush ? { cls: rush.cls, weapon: rush.weapon } : null) ?? daily?.kit ?? (level.kind !== 'stage' ? save.lastKit : null);
    this.kitNotice = null;
    if (startKit && !WEAPONS[startKit.weapon]) {
      // SPEC-GAP: How should this build load a valid saved lastKit whose unlocked weapon is not implemented yet?
      const weapon = STARTING_KITS[startKit.cls].weapons.find((id) => WEAPONS[id])!;
      this.kitNotice = `${WEAPON_NAME(startKit.weapon)} not ready. Using ${WEAPON_NAME(weapon)}.`;
      startKit = { cls: startKit.cls, weapon }; // Runtime fallback only: preserve saved kit and unlocks.
    }
    const seedText = seed ?? randomSeed();
    let layout: Picks | undefined;
    if (pack) {
      layout = forcedLayout ?? carry?.run.layout?.[pack.levelId as StageLevelId] ?? rollLayout(fnv1a32(seedText))[pack.levelId as StageLevelId];
      // 06 §8.10: spots and formations from the seed; a forced layout (practice, debug) is placed as authored.
      level = assembleLevel(pack, layout, forcedLayout ? undefined : rollVariety(fnv1a32(seedText))[pack.levelId as StageLevelId]);
    }
    // SPEC-GAP: does practice Random pick a new layout on Retry? No: it keeps its layout (its best and ghost belong to it).
    const w = GameWorld.fromLevel(level, { seedText, layout, layoutForced: !!forcedLayout || (!!practice && !!layout), seeded: carry?.run.seeded ?? seed !== null,
      startKit, carry, cosmetics: save.cosmetics, nextRandomSeed: randomSeed, records: save, unlockedBlueprints: save.unlocks.blueprints,
      nextRunUnlocks: () => saveStore().data.unlocks.blueprints, assist: () => saveStore().data.settings.assist, dragon, practice: !!practice, practiceSetup: practice ?? undefined, daily: daily && daily.official !== false ? daily.day : undefined, challenge: daily?.official === false, bossRush: !!rush, twist: daily ? dailyTwist(daily.seed) : undefined });
    if (carry?.run.phase === 'loading') w.completeLoading();
    if (homeTransition) { w.run.transition = homeTransition; w.run.phase = 'loading'; w.completeLoading(); }
    if (level.kind === 'training') for (const id of save.training) w.trainingDone.add(id);
    return w;
  },
  /** 09 §3–§5 (M13): a new cosmetic or a met enemy type is saved at once, in practice runs too. */
  persistCosmetics(w: GameWorld): void {
    for (const e of w.events) {
      if (e.t === 'cosmeticUnlocked') saveStore().update((s) => { if (!s.cosmetics.owned.includes(e.id)) s.cosmetics.owned.push(e.id); });
      if (e.t === 'enemySeen') saveStore().update((s) => { if (!s.cosmetics.seenEnemies.includes(e.enemy)) s.cosmetics.seenEnemies.push(e.enemy); });
    }
  },
  events(w: GameWorld): void {
    if (w.opts.bossRush) return;            // 06 §14.2: no unlocks, accessories, stats or history from boss rush
    this.persistCosmetics(w);
    // Practice owns a separate best-time write path (06 §14); no normal-run save event is allowed.
    if (w.opts.practice) { this.practiceEvents(w); return; }
    this.flushRunEnds(w);
    for (const e of w.events) {
      if (e.t === 'blueprintFound') saveStore().update((s) => { if (!s.unlocks.blueprints.includes(e.id)) s.unlocks.blueprints.push(e.id); });
      if (e.t === 'startingWeaponUnlocked') saveStore().update((s) => { const list = s.unlocks.startWeapons[e.cls] ??= []; if (!list.includes(e.weapon)) list.push(e.weapon); });
      if (e.t === 'bossDefeated' && e.bossId === 'dragon') saveStore().update((s) => { s.stats.dragonsKilled++; });
      if (e.t === 'bossDefeated' && e.bossId === 'enemy_king') saveStore().update((s) => { s.progress.kingBeaten = true; });   // 06 §14.2: unlocks Boss Rush      // 06 §4: normal runs only (practice returned above)
      if (e.t === 'playerDied') this.endRun(w, 'death', e.cause);
      if (e.t === 'runCompleted') this.endRun(w, 'complete');
      if (e.t === 'split') saveStore().update((s) => {
        if (e.index === 1) s.progress.stage1Cleared = true;
        if (!w.run.seeded && !w.opts.practice) s.bestSegments = structuredClone(w.records.bestSegments);
        if (savePersonalBest(w.run, w.records, saveDate(), { displayName: w.classState.displayName, weapons: w.combat.slots,
          abilities: w.abilities.slots.map((a) => a ? { id: a.id, level: a.level } : null) }, w.opts.practice)) {
          s.pbs = structuredClone(w.records.pbs); w.events.push({ t: 'pbSaved' });
        }
      });
      if (e.t === 'runStarted') saveStore().update((s) => { s.stats.runsStarted++; if (!s.progress.levelsReached.includes('plains')) s.progress.levelsReached.push('plains'); });
      if (e.t === 'stageStarted') saveStore().update((s) => { if (!s.progress.levelsReached.includes(e.levelId)) s.progress.levelsReached.push(e.levelId); });
      if (e.t === 'stationDone') saveStore().update((s) => { if (!s.training.includes(e.id)) s.training.push(e.id); });
      if (e.t === 'classDiscovered') saveStore().update((s) => { if (!s.progress.classesDiscovered.includes(e.id)) s.progress.classesDiscovered.push(e.id); });
    }
  },
  /** 06 §14: practice writes only `practiceBests`, and only when the time is faster. */
  practiceEvents(w: GameWorld): void {
    const setup = w.opts.practiceSetup;
    for (const e of [...w.events]) {
      if (e.t !== 'practiceCleared' || !setup || !w.practiceClear || isAssisted(w.run)) continue;   // 06 §5.4: assisted practice writes no best
      const key = practiceKey(setup.levelId, setup.cls, layoutCode(w.opts.layout ?? classicLayout()));
      saveStore().update((s) => {
        const old = s.practiceBests[key], r = applyPracticeTime(s.practiceBests, key, e.ticks);
        w.practiceClear!.isNew = r.isNew; w.practiceClear!.best = r.isNew ? old ?? null : r.best;
      });
      if (w.practiceClear.isNew) w.events.push({ t: 'practiceBestSaved', key, ticks: e.ticks });
    }
  },
  flushRunEnds(w: GameWorld): void {
    for (const ended of w.pendingRunEnds.splice(0)) saveStore().update((s) => { appendHistory(s, ended, saveDate()); s.daily = recordDailyEnd(s.daily, ended); });
  },
  endRun(w: GameWorld, result: RunRecord['result'], cause: string | null = null): void {
    const ended = captureRunEnd(w, result, cause); if (!ended) return;
    w.run.endRecorded = true;
    saveStore().update((s) => {
      appendHistory(s, ended, saveDate());
      s.daily = recordDailyEnd(s.daily, ended);
      if (result === 'complete' && w.run.challenge && !isAssisted(w.run)) { const r = recordSeedBest(s.seedBests, w.run.seedText, w.run.runTicks); s.seedBests = r.bests; if (r.isNew) w.events.push({ t: 'pbSaved' }); }
      if (result === 'death') s.stats.deaths++;
      if (result === 'complete') s.stats.runsCompleted++;
    });
  },
};
