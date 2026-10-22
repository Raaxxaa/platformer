import { describe, expect, it } from 'vitest';
import { GameWorld } from '../../core/sim/gameWorld.ts';
import { bossLevel, feet, levelFrom, rect } from '../../core/testkit/levelData.ts';
import { TimerBlock, timerBlockModel, SplitAlerts, splitAlertModel } from './timerBlock.ts';
import { UI_COLOR } from '../../data/uiText.ts';

describe('timer block and split alerts (07 §4.11, §6.9)', () => {
  const split = (deltaTicks: number | null, bestSegment = false) => ({ t: 'split' as const, index: 1, runTicks: 12345, segmentTicks: 12345, deltaTicks, bestSegment });
  it('uses signed green/red/zero deltas and a separate best-segment badge; no comparison shows none', () => {
    expect(splitAlertModel(split(-390, true))).toMatchObject({ title: 'STAGE 1 CLEAR', time: '1:42.87', delta: '−3.25', deltaColor: UI_COLOR.good, badge: '★ BEST SEGMENT' });
    expect(splitAlertModel(split(120))).toMatchObject({ delta: '+1.00', deltaColor: UI_COLOR.bad, badge: '' });
    expect(splitAlertModel(split(0))).toMatchObject({ delta: '±0.00', deltaColor: UI_COLOR.text });
    expect(splitAlertModel(split(null))).toMatchObject({ delta: '', badge: '' });
  });
  it('expires after3seconds even while simulation is frozen, but pauses its own clock', () => {
    const a = new SplitAlerts(); a.push(split(-10)); a.advance(2.9, false); expect(a.current).not.toBeNull();
    a.advance(10, true); expect(a.current).not.toBeNull(); a.advance(0.1, false); expect(a.current).toBeNull();
  });
  it('queues split alerts in order', () => {
    const a = new SplitAlerts(); a.push(split(0)); a.push({ ...split(1), index: 2 }); a.advance(3, false);
    expect(a.current?.event.index).toBe(2); a.clear(); expect(a.current).toBeNull();
  });
  it('caps the real frame entry point to0.1seconds so a long frame cannot erase an alert', () => {
    const text = () => { const t = { setScrollFactor: () => t, setDepth: () => t, setOrigin: () => t, setTint: () => t, setMaxWidth: () => t }; return t; };
    const view = new TimerBlock({ add: { bitmapText: text } } as unknown as ConstructorParameters<typeof TimerBlock>[0]);
    view.alerts.push(split(0)); view.advance(10, false);
    expect(view.alerts.current?.elapsed).toBe(0.1); view.advance(10, true); expect(view.alerts.current?.elapsed).toBe(0.1);
  });
  it('hides only time and segment with Show timer off; seeded info remains', () => {
    const w = GameWorld.fromLevel(bossLevel(), { seedText: 'ABC', seeded: true });
    expect(timerBlockModel(w, false)).toMatchObject({ timeVisible: false, segmentVisible: false, infoVisible: true, info: 'SEED ABC' });
    w.run.phase = 'homeVillage'; expect(timerBlockModel(w, true)).toMatchObject({ timeVisible: false, segmentVisible: false, infoVisible: false });
  });
  it('shows the village short name and the stage clock in stages', () => {
    const d = levelFrom(['#........#', '#........#', '##########'], [feet('player_start', 2, 1)], 'crossroads'); d.kind = 'village'; d.stage = 0;
    const village = GameWorld.fromLevel(d, { seedText: 'A' }); expect(timerBlockModel(village, true).segment).toBe('CROSSROADS');
    const w = GameWorld.fromLevel(bossLevel(), { seedText: 'A' }); w.run.stageTicks = 120; expect(timerBlockModel(w, true).segment).toBe('STAGE 1  0:01.00');
  });
  it('prioritizes a nearby pending timed door over a typed seed, including the under5second warning', () => {
    const d = levelFrom(['#........#', '#........#', '##########'], [feet('player_start', 2, 1), rect('timed_door', 6, 0, 1, 2, { id: 'door', timeLimit: 10 })]);
    const w = GameWorld.fromLevel(d, { seedText: 'ABC', seeded: true }); w.run.stageTicks = 6 * 120;
    expect(timerBlockModel(w, false)).toMatchObject({ info: 'DOOR 0:04.00', infoBad: true, infoVisible: true });
    w.run.timedDoors.door = 'open'; expect(timerBlockModel(w, true).info).toBe('SEED ABC');
  });
});

describe('timer block in practice and seeded runs (07 §3)', () => {
  it('practice shows the practice time, hides the segment line and says PRACTICE (before any SEED)', () => {
    const w = GameWorld.fromLevel(bossLevel(), { seedText: 'RACE1', seeded: true, startKit: { cls: 'tank', weapon: 'war_maul' }, practice: true, practiceSetup: { levelId: 'plains', cls: 'tank', weapon: 'war_maul', dragon: 'off' } });
    w.run.runTicks = 9000; w.run.stageTicks = 600;
    const m = timerBlockModel(w, true);
    expect(m.time).toBe('0:05.00'); expect(m.segmentVisible).toBe(false); expect(m.info).toBe('PRACTICE');
  });
  it('a typed seed shows SEED <text> and a normal run shows nothing', () => {
    const mk = (seeded: boolean) => GameWorld.fromLevel(bossLevel(), { seedText: 'RACE1', seeded, startKit: { cls: 'tank', weapon: 'war_maul' } });
    expect(timerBlockModel(mk(true), true).info).toBe('SEED RACE1'); expect(timerBlockModel(mk(false), true).info).toBe('');
  });
});
