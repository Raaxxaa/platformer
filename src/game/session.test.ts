import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSave, type SaveData } from '../core/save/schema.ts';
import { GameWorld } from '../core/sim/gameWorld.ts';
import { bossLevel, feet, levelFrom } from '../core/testkit/levelData.ts';
import { gameSession } from './session.ts';
import { grantKingUnlocks } from '../core/loot/blueprintItems.ts';
import { recordSplit } from '../core/run/splits.ts';

const testStore = vi.hoisted(() => ({ current: null as null | { data: SaveData; writes: number; update(change: (save: SaveData) => void): void } }));
vi.mock('./save/storage.ts', () => ({ saveStore: () => testStore.current, saveDate: () => '2026-10-18T02:00:00.000Z' }));
beforeEach(() => { testStore.current = { data: defaultSave(), writes: 0, update(change) { change(this.data); this.writes++; } }; });

describe('session write boundaries (06 §14–15)', () => {
  it('uses imported record caches for the live run without overwriting imported later best segments', async () => {
    const { SaveStore } = await vi.importActual<typeof import('./save/storage.ts')>('./save/storage.ts');
    const store = new SaveStore({ getItem: () => null, setItem: () => {} });
    const w = GameWorld.fromLevel(bossLevel(), { seedText: 'IMPORT', startKit: { cls: 'tank', weapon: 'war_maul' }, records: store.data });
    const imported = defaultSave(); imported.bestSegments['tank|forest'] = [500, 222, 333, 444];
    imported.pbs['tank|forest'] = { ticks: 2000, splits: [500, 1000, 1500, 2000], date: '2026-10-18T02:00:00.000Z', seedText: 'PB', kit: { displayName: 'Tank', weapons: [null, null], abilities: [null, null] } };
    expect(store.replace(imported)).toBe(true); testStore.current!.data = store.data;
    const pool = [...w.run.lootUnlocked], body = structuredClone(w.body);
    gameSession.refreshRecords(w); w.run.runTicks = 100;
    const result = recordSplit(w.run, 1, w.records)!; expect(result.deltaTicks).toBe(-400);
    w.events = [{ t: 'split', ...result }]; gameSession.events(w);
    expect(testStore.current!.data.bestSegments['tank|forest']).toEqual([100, 222, 333, 444]);
    expect(w.body).toEqual(body); expect(w.run.lootUnlocked).toEqual(pool);
  });
  it('saves King blueprint and third-starter unlock events immediately and without duplicates', () => {
    const w = GameWorld.fromLevel(bossLevel(), { seedText: 'KING', startKit: { cls: 'tank', weapon: 'war_maul' } });
    grantKingUnlocks(w); gameSession.events(w); gameSession.events(w);
    expect(testStore.current!.data.unlocks.blueprints).toHaveLength(1); expect(testStore.current!.data.unlocks.startWeapons.tank).toEqual(['giant_axe']);
    expect(w.run.lootUnlocked).not.toContain(testStore.current!.data.unlocks.blueprints[0]);
  });
  it('loads a valid saved third starter (all 19 weapons exist since M9) into playable Home without altering the saved kit', async () => {
    const { SaveStore } = await vi.importActual<typeof import('./save/storage.ts')>('./save/storage.ts');
    const raw = JSON.stringify({ v: 1, lastKit: { cls: 'tank', weapon: 'giant_axe' }, unlocks: { startWeapons: { tank: ['giant_axe'] } } });
    const store = new SaveStore({ getItem: () => raw, setItem: () => { throw Error('must not rewrite the kit'); } });
    testStore.current!.data = store.data;
    const home = levelFrom(['#........#', '#........#', '##########'], [feet('player_start', 2, 1)], 'home'); home.kind = 'village'; home.stage = 0;
    const w = gameSession.makeWorld(home);
    expect(w.combat.slots[0]?.weaponId).toBe('giant_axe'); expect(gameSession.takeKitNotice()).toBeNull();
    expect(testStore.current!.data.lastKit).toEqual({ cls: 'tank', weapon: 'giant_axe' });
    expect(testStore.current!.data.unlocks.startWeapons.tank).toEqual(['giant_axe']);
  });
  it('flushes a pre-reset restart snapshot once, retaining the old time, kit and counters', () => {
    const w = GameWorld.fromLevel(bossLevel(), { seedText: 'OLD', startKit: { cls: 'tank', weapon: 'war_maul' } });
    w.run.runTicks = 3600; w.run.stats.kills = 7; w.restart(); gameSession.events(w); gameSession.events(w);
    expect(testStore.current!.data.history).toHaveLength(1); expect(testStore.current!.data.history[0]).toMatchObject({ result: 'restart', seedText: 'OLD', runTicks: 3600, stats: { kills: 7 } });
    expect(w.pendingRunEnds).toEqual([]);
  });
  it('saves even a short death once, with all same-tick splits, and counts a real completed run only on its event', () => {
    const w = GameWorld.fromLevel(bossLevel(), { seedText: 'DEAD', startKit: { cls: 'tank', weapon: 'war_maul' } });
    w.run.runTicks = 2; w.run.splits[0] = 2; w.events = [{ t: 'playerDied', cause: 'spikes' }]; gameSession.events(w); gameSession.events(w);
    expect(testStore.current!.data.stats.deaths).toBe(1); expect(testStore.current!.data.history[0]).toMatchObject({ result: 'death', cause: 'spikes', splits: [2, null, null, null] });
    w.restart(); w.events = [{ t: 'runCompleted' }]; gameSession.events(w); expect(testStore.current!.data.stats.runsCompleted).toBe(1);
  });
  it('practice events cannot write normal progress, stats, class discoveries, PBs or best segments', () => {
    const w = GameWorld.fromLevel(bossLevel(), { seedText: 'PRACTICE', startKit: { cls: 'tank', weapon: 'war_maul' }, practice: true });
    const before = structuredClone(testStore.current!.data);
    w.events = [{ t: 'runStarted' }, { t: 'stageStarted', levelId: 'plains', stage: 1 }, { t: 'classDiscovered', id: 'iron_will' },
      { t: 'stationDone', id: 1 }, { t: 'split', index: 1, runTicks: 100, segmentTicks: 100, deltaTicks: null, bestSegment: true }];
    gameSession.events(w); expect(testStore.current!.writes).toBe(0); expect(testStore.current!.data).toEqual(before);
  });
});

describe('practice saves (06 §14)', () => {
  const setup = { levelId: 'plains', cls: 'tank', weapon: 'war_maul', dragon: 'off' } as const;
  const make = () => GameWorld.fromLevel(bossLevel(), { seedText: 'PRAC', startKit: { cls: 'tank', weapon: 'war_maul' }, practice: true, practiceSetup: setup });
  const clear = (w: GameWorld, ticks: number) => { w.practiceClear = { ticks, best: null, isNew: false }; w.events = [{ t: 'practiceCleared', ticks }]; gameSession.events(w); };
  it('writes the practice best only when faster, emits practiceBestSaved, and writes nothing else', () => {
    const w = make(); clear(w, 5000);
    expect(testStore.current!.data.practiceBests['plains|tank|1-1-1-1-1']).toBe(5000);
    expect(w.events).toContainEqual({ t: 'practiceBestSaved', key: 'plains|tank|1-1-1-1-1', ticks: 5000 }); expect(w.practiceClear).toMatchObject({ isNew: true, best: null });
    const slow = make(); clear(slow, 6000);
    expect(testStore.current!.data.practiceBests['plains|tank|1-1-1-1-1']).toBe(5000);
    expect(slow.events.some((e) => e.t === 'practiceBestSaved')).toBe(false); expect(slow.practiceClear).toMatchObject({ isNew: false, best: 5000 });
    const fast = make(); clear(fast, 4000); expect(testStore.current!.data.practiceBests['plains|tank|1-1-1-1-1']).toBe(4000); expect(fast.practiceClear!.best).toBe(5000);
    const d = testStore.current!.data; expect(d.history).toEqual([]); expect(d.pbs).toEqual({}); expect(d.stats.runsStarted).toBe(0);
  });
  it('makeWorld builds a practice world with the preset kit, even with a typed seed', () => {
    testStore.current!.data.typedSeed = 'RACE1';
    const w = gameSession.makeWorld(bossLevel(), undefined, null, undefined, setup);
    expect(w.opts.practice).toBe(true); expect(w.combat.slots[0]).toMatchObject({ weaponId: 'war_maul', grade: 'C' }); expect(w.run.seedText).toBe('RACE1'); expect(w.run.seeded).toBe(true);
  });
});
