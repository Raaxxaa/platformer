import { describe, expect, it } from 'vitest';
import { WEAPONS } from './weapons.ts';
import { upMoveStep } from './upMoves.ts';

// 02 §9.6a: the three moves derive from step 1 and weight.
describe('derived up/dash moves (02 §9.6a)', () => {
  it('heavy (Greatsword): Launcher 0.22/0.12/0.34, ×1.2 damage, ×1.5 poise, KB 40,−400, launches', () => {
    const l = upMoveStep(WEAPONS.greatsword!, 'launcher')!;
    expect(l).toMatchObject({ startup: 0.22, active: 0.12, recovery: 0.34, box: { dx: 14, dy: -34, w: 44, h: 44 } });
    expect(l.hit).toMatchObject({ damage: 19, poise: 23, kb: [40, -400], hitStop: 0.075, control: { type: 'launch' } });
    expect(upMoveStep(WEAPONS.greatsword!, 'upAir')!.hit).toMatchObject({ damage: 16, poise: 15, kb: [20, -320] });
    const d = upMoveStep(WEAPONS.greatsword!, 'dashAtk')!;
    expect(d).toMatchObject({ startup: 0.06, active: 0.12, recovery: 0.32, box: { dx: 22, dy: -16, w: 48, h: 28 } });
    expect(d.hit).toMatchObject({ damage: 21, poise: 23, kb: [260, -80] }); expect(d.hit!.control).toBeUndefined();
  });
  it('medium (Katana) and heavy (War Maul) numbers', () => {
    expect(upMoveStep(WEAPONS.katana!, 'launcher')).toMatchObject({ startup: 0.14, active: 0.10, recovery: 0.26, hit: { damage: 14, poise: 15, kb: [40, -380] } });
    expect(upMoveStep(WEAPONS.katana!, 'dashAtk')).toMatchObject({ startup: 0.04, active: 0.10, recovery: 0.26, hit: { damage: 16, kb: [220, -60] } });
    expect(upMoveStep(WEAPONS.war_maul!, 'launcher')!.hit).toMatchObject({ damage: 30, poise: 53 });
  });
  it('light (Iron Fists) up air attack timing', () => {
    expect(upMoveStep(WEAPONS.iron_fists!, 'upAir')).toMatchObject({ startup: 0.08, active: 0.08, recovery: 0.18 });
  });
  it('ranged weapons shoot straight up and have no dash attack; the Spear and Shield keep their own dash move', () => {
    const b = upMoveStep(WEAPONS.bow!, 'launcher')!;
    expect(b.projectiles![0].angle).toBe(-90); expect(b.shotOrigin).toEqual({ dx: 0, dy: -30 });
    expect(upMoveStep(WEAPONS.bow!, 'dashAtk')).toBeNull();
    expect(upMoveStep(WEAPONS.spear!, 'dashAtk')).toBeNull(); expect(upMoveStep(WEAPONS.shield!, 'dashAtk')).toBeNull();
    expect(upMoveStep(WEAPONS.spell_tome!, 'launcher')!.box).toMatchObject({ dx: 0, dy: -40 });
  });
});
