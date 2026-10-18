// Browser session: the sole save repository and the source to return to after Training.
import { saveDate, saveStore } from './save/storage.ts';
import { GameWorld } from '../core/sim/gameWorld.ts';
import type { LevelData } from '../core/level/loadLevel.ts';
import type { WorldCarry } from '../core/run/session.ts';
import { randomSeed } from './seed.ts';
import { savePersonalBest } from '../core/run/splits.ts';
export const gameSession = {
  trainingReturn: 'title' as 'home' | 'title',
  makeWorld(level: LevelData, carry?: WorldCarry, debugSeed?: string | null): GameWorld {
    const save = saveStore().data;
    const homeTransition = carry?.run.transition?.target.phase === 'homeVillage' ? structuredClone(carry.run.transition) : null;
    if (homeTransition) carry = undefined;
    const seed = carry?.run.seedText ?? debugSeed ?? save.typedSeed;
    const w = GameWorld.fromLevel(level, { seedText: seed ?? randomSeed(), seeded: carry?.run.seeded ?? seed !== null,
      startKit: carry?.run.startKit ?? (level.kind !== 'stage' ? save.lastKit : null), carry, nextRandomSeed: randomSeed, records: save });
    if (carry?.run.phase === 'loading') w.completeLoading();
    if (homeTransition) { w.run.transition = homeTransition; w.run.phase = 'loading'; w.completeLoading(); }
    if (level.kind === 'training') for (const id of save.training) w.trainingDone.add(id);
    return w;
  },
  events(w: GameWorld): void {
    // Practice owns a separate best-time write path (M10); no normal-run save event is allowed.
    if (w.opts.practice) return;
    for (const e of w.events) {
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
};
