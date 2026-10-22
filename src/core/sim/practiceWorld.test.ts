import { describe, expect, it } from 'vitest';
import plainsJson from '../../../public/levels/plains.json';
import kingdomJson from '../../../public/levels/kingdom.json';
import swampsJson from '../../../public/levels/swamps.json';
import { killEnemy } from '../combat/resolve.ts';
import { loadLevel } from '../level/loadLevel.ts';
import { GameWorld } from './gameWorld.ts';
import { stepSpec } from '../testkit/combatWorld.ts';
import { defaultSave } from '../save/schema.ts';
import { practiceLoadout, type PracticeSetup } from '../run/practice.ts';

function practice(json: unknown, setup: PracticeSetup, seedText = 'PRAC') {
  const level = loadLevel(json);
  return { level, w: GameWorld.fromLevel(level, { seedText, startKit: { cls: setup.cls, weapon: setup.weapon }, records: defaultSave(), practice: true, practiceSetup: setup }) };
}
const kill = (w: GameWorld, level: ReturnType<typeof loadLevel>) => {
  const arena = level.objects.find((o) => o.type === 'arena' && o.props.kind === 'boss')!;
  w.teleportPlayer(arena.x + 32, arena.y + arena.h); stepSpec(w, {});
  const boss = w.enemies.find((e) => e.boss)!; killEnemy(w, boss); return stepSpec(w, {});
};

describe('practice world (06 §14)', () => {
  it('starts with the stage 1 preset', () => {
    const s: PracticeSetup = { levelId: 'plains', cls: 'tank', weapon: 'war_maul', dragon: 'off' };
    const { w } = practice(plainsJson, s);
    expect(w.combat.slots[0]).toMatchObject({ weaponId: 'war_maul', grade: 'C' }); expect(w.combat.slots[1]).toBeNull();
    expect(w.abilities.slots[0]!.level).toBe(1); expect(w.flask).toMatchObject({ charges: 2, maxCharges: 2 });
    expect(w.health.hp).toBe(100); expect(w.econ.keys).toBe(0); expect(w.econ.goldTenths).toBe(0);
  });
  it('starts with the stage 2 preset: B + element, Lv2, one key', () => {
    const { w } = practice(swampsJson, { levelId: 'swamps', cls: 'archer', weapon: 'bow', dragon: 'off' });
    expect(w.combat.slots[0]).toMatchObject({ grade: 'B', element: 'wind' }); expect(w.abilities.slots[0]!.level).toBe(2); expect(w.econ.keys).toBe(1);
  });
  it('the boss death emits practiceCleared with stageTicks and no split, stat pick or PB', () => {
    const { w, level } = practice(plainsJson, { levelId: 'plains', cls: 'swordsman', weapon: 'greatsword', dragon: 'off' });
    stepSpec(w, {}, 30);
    const events = kill(w, level);
    const cleared = events.find((e) => e.t === 'practiceCleared');
    expect(cleared).toBeDefined();
    expect(events.some((e) => e.t === 'split')).toBe(false);
    stepSpec(w, {}, 400);
    expect(w.run.phase).toBe('stage'); expect(w.run.splits[0]).toBeNull(); expect(w.statPick).toBeNull(); expect(w.practiceClear).not.toBeNull();
  });
  it('restart keeps the setup, the level and the preset', () => {
    const s: PracticeSetup = { levelId: 'swamps', cls: 'wizard', weapon: 'staff', dragon: 'off' };
    const { w } = practice(swampsJson, s);
    w.econ.keys = 0; w.flask.charges = 0; stepSpec(w, { moveX: 1 }, 50);
    w.restart();
    for (let i = 0; i < 120 && w.run.phase !== 'stage'; i++) stepSpec(w, {});
    expect(w.run.phase).toBe('stage'); expect(w.run.levelId).toBe('swamps'); expect(w.run.stageTicks).toBeLessThan(10);
    expect(w.econ.keys).toBe(1); expect(w.flask.charges).toBe(2);
    expect(w.combat.slots[0]).toMatchObject(practiceLoadout(s).weapons[0]!);
    expect(w.practiceClear).toBeNull();
  });
  it('06 checklist 29: kingdom with the Tank kit starts with a B lightning War Maul, Shockwave Lv3 and a 3/3 flask', () => {
    const { w } = practice(kingdomJson, { levelId: 'kingdom', cls: 'tank', weapon: 'war_maul', dragon: 'off' });
    expect(w.combat.slots[0]).toMatchObject({ weaponId: 'war_maul', grade: 'B', element: 'lightning' });
    expect(w.abilities.slots[0]).toMatchObject({ id: 'shockwave', level: 3 }); expect(w.flask).toMatchObject({ charges: 3, maxCharges: 3 });
  });
  it('a Dragon option puts the perched Dragon in the level; Off removes a rolled one', () => {
    const on = practice(swampsJson, { levelId: 'swamps', cls: 'tank', weapon: 'war_maul', dragon: 'storm' }).w;
    expect(on.run.dragon).toMatchObject({ present: true, stage: 2, color: 'storm' });
    for (const seed of ['A', 'B', 'C', 'D', 'E', 'F']) expect(practice(swampsJson, { levelId: 'swamps', cls: 'tank', weapon: 'war_maul', dragon: 'off' }, seed).w.run.dragon.present).toBe(false);
  });
});
