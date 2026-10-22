import { describe, expect, it } from 'vitest';
import { RushLayers, StepClock, chooseLoop, stepSeconds, bossLayerLevel, type MusicSnapshot } from './musicRules.ts';
import { MusicDirector } from '../game/audio/musicDirector.ts';

const snap = (o: Partial<MusicSnapshot> = {}): MusicSnapshot => ({ levelId: 'plains', levelKind: 'stage', boss: null, rush: 0, dead: false, runComplete: false, ...o });

describe('music rules (08 §14)', () => {
  it('a step at 120 BPM is 0.125 s; a tempo change waits for the next bar line', () => {
    expect(stepSeconds(120, 1)).toBeCloseTo(0.125);
    const c = new StepClock(120, 4, 1, 0);
    for (let i = 0; i < 5; i++) c.next();                 // steps 0-4, inside bar 1
    c.setTempo(1.04);
    const a = c.next()!;                                  // step 5 still lasts 0.125 s
    expect(a.step).toBe(5);
    expect(c.time - a.time).toBeCloseTo(0.125);
    for (let i = 0; i < 10; i++) c.next();                // steps 6-15
    const bar = c.next()!;                                // step 16: the bar line, new tempo applies
    expect(bar.step).toBe(16);
    expect(c.time - bar.time).toBeCloseTo(stepSeconds(120, 1.04));
  });
  it('loops back to loopStartBar and stops for non-looping tracks', () => {
    const c = new StepClock(120, 2, 2, 0);
    const steps = Array.from({ length: 34 }, () => c.next()!.step);
    expect(steps[32]).toBe(16);
    const s = new StepClock(120, 1, 1, 0, false);
    for (let i = 0; i < 16; i++) s.next();
    expect(s.next()).toBeNull();
  });
  it('Rush layers: on in 0.5 s, off only after 1.0 s lower, then 1.5 s', () => {
    const r = new RushLayers();
    expect(r.update(0, 3)).toEqual([1, 2, 3].map((layer) => ({ layer, target: 1, seconds: 0.5 })));
    expect(r.update(10, 2)).toEqual([]);
    expect(r.update(10.9, 2)).toEqual([]);
    expect(r.update(11.0, 2)).toEqual([{ layer: 3, target: 0, seconds: 1.5 }]);
    expect(r.update(12, 3)).toEqual([{ layer: 3, target: 1, seconds: 0.5 }]);
  });
  it('picks the track per place', () => {
    expect(chooseLoop(snap())).toBe('plains');
    expect(chooseLoop(snap({ levelId: 'kingdom' }))).toBe('kingdom');
    expect(chooseLoop(snap({ levelId: 'border', levelKind: 'village' }))).toBe('village');
    expect(chooseLoop(snap({ levelId: 'training_yard', levelKind: 'training' }))).toBe('village');
    expect(chooseLoop(snap({ boss: { id: 'spider_queen', phase: 1, enraged: false } }))).toBe('boss_guardian');
    expect(chooseLoop(snap({ boss: { id: 'dragon', phase: 1, enraged: false } }))).toBe('boss_dragon');
    expect(chooseLoop(snap({ dead: true }))).toBeNull();
    expect(bossLayerLevel('boss_king', 3, false)).toBe(2);
    expect(bossLayerLevel('boss_black_knight', 2, false)).toBe(1);
  });
  it('director: boss fight crossfades, victory sting then silence, Dragon resumes the stage track', () => {
    const d = new MusicDirector();
    expect(d.update(snap(), [], false).loop).toEqual({ track: 'plains', fade: 0 });
    const boss = snap({ boss: { id: 'great_boar', phase: 1, enraged: false } });
    expect(d.update(boss, [], false).loop).toEqual({ track: 'boss_guardian', fade: 1 });
    const won = d.update(snap(), [{ t: 'bossDefeated', bossId: 'great_boar' }], false);
    expect(won.sting).toBe('sting_victory');
    expect(won.loop).toEqual({ track: null, fade: 0.5 });
    expect(d.update(snap(), [], true).loop).toBeUndefined();
    expect(d.update(snap({ levelId: 'crossroads', levelKind: 'village' }), [{ t: 'enterVillage' }], false).loop).toEqual({ track: 'village', fade: 1 });
    const dr = new MusicDirector();
    dr.update(snap({ levelId: 'castle' }), [], false);
    dr.update(snap({ levelId: 'castle', boss: { id: 'dragon', phase: 1, enraged: false } }), [], false);
    expect(dr.update(snap({ levelId: 'castle' }), [{ t: 'bossDefeated', bossId: 'dragon' }], false).sting).toBe('sting_victory');
    expect(dr.update(snap({ levelId: 'castle' }), [], true).loop).toBeUndefined();
    expect(dr.update(snap({ levelId: 'castle' }), [], false).loop).toEqual({ track: 'castle', fade: 1 });
  });
  it('director: death sting, then silence until the run restarts', () => {
    const d = new MusicDirector();
    d.update(snap(), [], false);
    const dead = d.update(snap({ dead: true }), [{ t: 'playerDied' }], false);
    expect(dead.sting).toBe('sting_death');
    expect(dead.loop).toEqual({ track: null, fade: 0.2 });
    expect(d.update(snap(), [{ t: 'stageStarted' }], false).loop?.track).toBe('plains');
  });
  it('director: completing the run plays the fanfare, then title', () => {
    const d = new MusicDirector();
    d.update(snap({ levelId: 'castle' }), [], false);
    const k = d.update(snap({ levelId: 'castle' }), [{ t: 'bossDefeated', bossId: 'enemy_king' }, { t: 'runCompleted' }], false);
    expect(k.sting).toBe('sting_complete');
    expect(d.update(snap({ levelId: 'castle', runComplete: true }), [], true).loop).toBeUndefined();
    expect(d.update(snap({ levelId: 'castle', runComplete: true }), [], false).loop?.track).toBe('title');
  });
});
