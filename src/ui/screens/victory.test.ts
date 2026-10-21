import { describe, expect, it } from 'vitest';
import { arenaWorld } from '../../core/testkit/combatWorld.ts';
import { RunSoFarModel } from './runSoFar.ts';
import { victoryData, victoryLines } from './victory.ts';

function won() {
  const w = arenaWorld({ stage: 4 });
  w.setStartingKit({ cls: 'tank', weapon: 'war_maul' });
  w.run.phase = 'runComplete'; w.run.road = 'forest'; w.run.splits = [3600, 7200, 10800, 14400]; w.run.runTicks = 14400; w.run.stats.kills = 55;
  return w;
}
describe('Victory summary (07 §7.11)', () => {
  it('shows the final time, every split, the Dragon outcome and the kills', () => {
    const lines = victoryLines(won());
    expect(lines[0]).toBe('Time 2:00.00');
    expect(lines).toContain('Stage 1 0:30.00'); expect(lines).toContain('Stage 4 2:00.00');
    expect(lines.some((l) => l.startsWith('Dragon: Not this run') && l.includes('Kills: 55'))).toBe(true);
    expect(lines.some((l) => l.includes('Road: Forest'))).toBe(true);
  });
  it('marks a new personal best, a seeded run, and lists what was unlocked', () => {
    const w = won();
    const pb = { ticks: 14400, splits: [3600, 7200, 10800, 14400], date: '2026-10-20', seedText: 'X', kit: { displayName: 'Tank', weapons: [], abilities: [] } };
    w.records.pbs['tank|forest'] = pb as never;
    expect(victoryLines(w)[1]).toBe('* NEW PERSONAL BEST *');
    pb.ticks = 14000;
    expect(victoryLines(w)[1]).toBe('Personal best 1:56.66');
    w.run.winUnlocks = { blueprint: 'scythe', startWeapon: 'giant_axe' };
    expect(victoryLines(w)).toEqual(expect.arrayContaining(['Unlocked: Scythe', 'New starting weapon: Giant Axe']));
    w.run.seeded = true;
    expect(victoryLines(w)[1]).toBe('Seeded run - records not saved');
  });
  it('feeds the run-end panel with its own title and lines, Restart first', () => {
    const w = won(), data = victoryData(w), m = new RunSoFarModel(data);
    expect(data.title).toBe('VICTORY');
    expect(m.lines).toEqual(victoryLines(w));
    expect(m.action('confirm')).toBe('restart');
  });
});
