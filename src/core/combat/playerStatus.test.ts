import { describe, expect, it } from 'vitest';
import { arenaWorld } from '../testkit/combatWorld.ts';
import { applyLucky } from '../loot/lucky.ts';
import { applyPlayerStatus, clearPlayerDamageStatus, createPlayerStatus, stepPlayerStatus } from './playerStatus.ts';

function world(stage: 1 | 2 = 1) {
  const w = arenaWorld({ stage }); w.playerStatus = createPlayerStatus(); return w;
}
const step = (w: ReturnType<typeof world>, count: number) => { for (let i = 0; i < count; i++) stepPlayerStatus(w); };

describe('player statuses (02 §5.4)', () => {
  it('poison starts after sixty player ticks, caps at three, and rounds the combined stage-scaled stacks once', () => {
    const w = world(2); applyPlayerStatus(w, 'poisoned', 5);
    expect(w.playerStatus.poisoned).toEqual({ stacks: 3, left: 480, next: 60, damageA: 1.3 });
    step(w, 59); expect(w.health.hp).toBe(100);
    step(w, 1); expect(w.health.hp).toBe(96); expect(w.run.stats.damageTaken).toBe(4);
  });

  it('refreshes poison duration without postponing its next damage tick and expires all stacks together', () => {
    const w = world(); applyPlayerStatus(w, 'poisoned'); step(w, 40); applyPlayerStatus(w, 'poisoned');
    expect(w.playerStatus.poisoned).toMatchObject({ stacks: 2, left: 480, next: 20 });
    step(w, 20); expect(w.health.hp).toBe(98);
    step(w, 460); expect(w.playerStatus.poisoned).toBeNull(); expect(w.health.hp).toBe(84);
  });

  it('pauses all status clocks during player hit-stop and does not slow them with worldTimeScale', () => {
    const w = world(); applyPlayerStatus(w, 'poisoned'); applyPlayerStatus(w, 'rooted'); applyPlayerStatus(w, 'chilled');
    const before = structuredClone(w.playerStatus); w.body.hitStopTicks = 10; step(w, 10); expect(w.playerStatus).toEqual(before);
    w.body.hitStopTicks = 0; w.worldTimeScale = 0.5; step(w, 60); expect(w.health.hp).toBe(99); expect(w.playerStatus.rooted).toBe(60);
  });

  it('root lasts one second and a new application does not reset an active root', () => {
    const w = world(); applyPlayerStatus(w, 'rooted'); step(w, 60); applyPlayerStatus(w, 'rooted', 1, 3);
    expect(w.playerStatus.rooted).toBe(60); step(w, 60); expect(w.playerStatus.rooted).toBe(0);
    applyPlayerStatus(w, 'rooted', 1, 0.25); expect(w.playerStatus.rooted).toBe(30);
  });

  it('DOT ignores i-frames and changes only damage/death statistics, without hurt reactions or Rush loss', () => {
    const w = world(); w.health.iframeTicks = 240; w.health.abilityIframeTicks = 240; w.body.dashIframes = true;
    w.body.vx = 140; w.body.vy = -80; w.hitStreak = 9; w.rush.value = 200;
    const body = structuredClone(w.body), rush = structuredClone(w.rush);
    applyPlayerStatus(w, 'poisoned'); step(w, 60);
    expect(w.health.hp).toBe(99); expect(w.health.iframeTicks).toBe(240); expect(w.health.hitstunTicks).toBe(0);
    expect(w.body).toEqual(body); expect(w.rush).toEqual(rush); expect(w.hitStreak).toBe(9);
  });

  it('clears only Burning and Poisoned when the flask removes damage statuses', () => {
    const w = world(); applyPlayerStatus(w, 'poisoned'); applyPlayerStatus(w, 'burning'); applyPlayerStatus(w, 'rooted'); applyPlayerStatus(w, 'chilled');
    clearPlayerDamageStatus(w);
    expect(w.playerStatus).toEqual({ poisoned: null, burning: null, rooted: 120, chilled: 240 }); step(w, 60); expect(w.health.hp).toBe(100);
  });

  it('Burning does not stack, lasts two seconds, and refreshes on reapply', () => {
    const w = world(); applyPlayerStatus(w, 'burning'); step(w, 60); expect(w.health.hp).toBe(97);
    applyPlayerStatus(w, 'burning', 5); expect(w.playerStatus.burning).toMatchObject({ stacks: 1, left: 240 });
    step(w, 240); expect(w.health.hp).toBe(85); expect(w.playerStatus.burning).toBeNull();
  });

  it('DOT can trigger Second Wind and a curse can make the first tick lethal', () => {
    const saved = world(); applyLucky(saved, 'second_wind', 0, 0); saved.health.hp = 2;
    applyPlayerStatus(saved, 'burning'); step(saved, 60); expect(saved.health.hp).toBe(50); expect(saved.health.dead).toBe(false); expect(saved.econ.secondWindUsed).toBe(true);
    const cursed = world(); cursed.econ.curse = { id: 'one_hit', killsLeft: 10 };
    applyPlayerStatus(cursed, 'poisoned'); applyPlayerStatus(cursed, 'rooted'); step(cursed, 60);
    expect(cursed.health.dead).toBe(true); expect(cursed.health.hp).toBe(0); expect(cursed.playerStatus).toEqual(createPlayerStatus());
  });
});
