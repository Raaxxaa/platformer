// Run-end snapshots are taken before restart resets the live world (06 §15.2).
import type { GameWorld } from '../sim/gameWorld.ts';
import type { RunRecord, SaveData } from '../save/schema.ts';
import { SAVE_RULES } from '../../data/save.ts';
import { snapshotKit } from '../save/snapshot.ts';
export type RunEndSnapshot = Omit<RunRecord, 'date'>;
export function captureRunEnd(w: GameWorld, result: RunRecord['result'], cause: string | null = null): RunEndSnapshot | null {
  const r = w.run, kit = r.startKit;
  if (!kit || r.endRecorded || w.opts.practice || w.level?.kind === 'training' || r.phase === 'homeVillage' || w.level?.id === 'home') return null;
  const stageReached = (r.stage || Math.max(1, r.splits.filter((s) => s !== null).length)) as RunRecord['stageReached'];
  return { startClass: kit.cls, startWeapon: kit.weapon, road: r.road, seedText: r.seedText, seeded: r.seeded, result,
    stageReached, sectionReached: r.sectionReached, runTicks: r.runTicks, splits: [...r.splits], cause, dragon: 'absent',
    kit: snapshotKit({ displayName: w.classState.displayName, weapons: w.combat.slots, abilities: w.abilities.slots }),
    stats: { ...r.stats } };
}
export function appendHistory(save: SaveData, snapshot: RunEndSnapshot | null, date: string): boolean {
  if (!snapshot || ((snapshot.result === 'restart' || snapshot.result === 'quit') && snapshot.runTicks < SAVE_RULES.historyMinTicks)) return false;
  save.history.unshift({ ...structuredClone(snapshot), date }); save.history.length = Math.min(save.history.length, SAVE_RULES.historyLimit); return true;
}
