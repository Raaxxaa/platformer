import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSave, type SaveData } from '../core/save/schema.ts';
import { GameWorld } from '../core/sim/gameWorld.ts';
import { bossLevel } from '../core/testkit/levelData.ts';
import { gameSession } from './session.ts';

const testStore = vi.hoisted(() => ({ current: null as null | { data: SaveData; writes: number; update(change: (save: SaveData) => void): void } }));
vi.mock('./save/storage.ts', () => ({ saveStore: () => testStore.current, saveDate: () => '2026-10-18T02:00:00.000Z' }));
beforeEach(() => { testStore.current = { data: defaultSave(), writes: 0, update(change) { change(this.data); this.writes++; } }; });

describe('session write boundaries (06 §14–15)', () => {
  it('practice events cannot write normal progress, stats, class discoveries, PBs or best segments', () => {
    const w = GameWorld.fromLevel(bossLevel(), { seedText: 'PRACTICE', startKit: { cls: 'tank', weapon: 'war_maul' }, practice: true });
    const before = structuredClone(testStore.current!.data);
    w.events = [{ t: 'runStarted' }, { t: 'stageStarted', levelId: 'plains', stage: 1 }, { t: 'classDiscovered', id: 'iron_will' },
      { t: 'stationDone', id: 1 }, { t: 'split', index: 1, runTicks: 100, segmentTicks: 100, deltaTicks: null, bestSegment: true }];
    gameSession.events(w); expect(testStore.current!.writes).toBe(0); expect(testStore.current!.data).toEqual(before);
  });
});
