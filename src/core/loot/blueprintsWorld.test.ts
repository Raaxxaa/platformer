import { describe, expect, it } from 'vitest';
import { GameWorld } from '../sim/gameWorld.ts';
import { bossLevel, feet, levelFrom } from '../testkit/levelData.ts';
import { stepSpec } from '../testkit/combatWorld.ts';
import { captureWorld } from '../run/session.ts';
import { dropBlueprint, blueprintOnKill } from './blueprintItems.ts';
import { weaponPool, abilityPool } from './roll.ts';
import { sourceRng } from './pick.ts';
import { fnv1a32 } from '../rng.ts';
import { killEnemy, processDeaths } from '../combat/resolve.ts';
describe('blueprint touch and frozen run pools (05 §14)', () => {
  it('intersects implemented definitions with the supplied frozen catalog for weapons and abilities', () => {
    expect(weaponPool([], ['war_maul', 'scythe'])).toEqual(['war_maul']);
    expect(abilityPool([], [], ['shockwave', 'time_slow'])).toEqual(['shockwave', 'time_slow']);
  });
  it('collects by touch, freezes the pool through a village carry, and refreshes on same-world restart', () => {
    let unlocked: ('scythe')[] = [];
    const w = GameWorld.fromLevel(bossLevel(), { seedText: 'BP', nextRunUnlocks: () => unlocked });
    expect(w.run.lootUnlocked).not.toContain('scythe'); const id = dropBlueprint(w, 'scythe', w.body.x, w.body.y); expect(id).not.toBe(false);
    expect(w.events.some((e) => e.t === 'blueprintFound')).toBe(false); expect(stepSpec(w, {})).toContainEqual({ t: 'blueprintFound', id: 'scythe' });
    expect(w.run.lootUnlocked).not.toContain('scythe'); expect(w.run.blueprintsDropped).toEqual(['scythe']);
    unlocked = ['scythe'];
    const d = levelFrom(['#........#', '#........#', '##########'], [feet('player_start', 2, 1)], 'crossroads'); d.kind = 'village'; d.stage = 0;
    const village = GameWorld.fromLevel(d, { seedText: 'BP', carry: captureWorld(w), unlockedBlueprints: unlocked });
    expect(village.run.lootUnlocked).not.toContain('scythe'); expect(village.run.blueprintsDropped).toEqual(['scythe']);
    w.restart(); expect(w.run.lootUnlocked).toContain('scythe'); expect(w.run.blueprintsDropped).toEqual([]);
    expect(weaponPool([], w.run.lootUnlocked)).not.toContain('scythe'); expect(abilityPool([], [], w.run.lootUnlocked)).not.toContain('time_slow');
  });
  it.each([true, false])('typed/practice full catalogs never create blueprints (seeded=%s)', (seeded) => {
    const w = GameWorld.fromLevel(bossLevel(), { seedText: 'ALL', seeded, practice: !seeded });
    expect(w.run.lootUnlocked).toHaveLength(36); expect(dropBlueprint(w, 'scythe', w.body.x, w.body.y)).toBe(false);
    expect(w.groundItems.some((i) => i.blueprint)).toBe(false);
  });
  it.each([true, false])('refreshes the catalog when the Home seed board changes seeded=%s before the gate', (seeded) => {
    const d = levelFrom(['#........#', '#........#', '##########'], [feet('player_start', 2, 1), { type: 'exit', x: 32, y: 0, w: 16, h: 32, props: {} }], 'home'); d.kind = 'village'; d.stage = 0;
    const w = GameWorld.fromLevel(d, { seedText: 'INITIAL', seeded: !seeded, startKit: { cls: 'tank', weapon: 'war_maul' } }); expect(w.run.lootUnlocked).toHaveLength(seeded ? 27 : 36);
    w.run.seeded = seeded; w.run.seedText = 'CHANGED'; w.teleportPlayer(40, 32); stepSpec(w, {});
    expect(w.run.phase).toBe('transition'); expect(w.run.lootUnlocked).toHaveLength(seeded ? 36 : 27);
  });
  it('only elite or listed boss kills roll a blueprint on their own source stream', () => {
    let seed = '';
    for (let n = 0; n < 10000; n++) if (sourceRng(fnv1a32(String(n)), 'blueprint', 'plains', 'great_boar')() < 0.25) { seed = String(n); break; }
    // Search actual hashed run seeds; the roll is tied to the boss id, not the item RNG or runtime item ids.
    const w = GameWorld.fromLevel(bossLevel(), { seedText: seed || 'BOSS' });
    const e = w.enemies.find((e) => e.def.id === 'great_boar')!;
    const regular = w.spawnExtra({ enemy: 'bandit', x: 48, y: 272, facing: 1 }); blueprintOnKill(w, regular); expect(w.run.blueprintsDropped).toEqual([]);
    const reference = GameWorld.fromLevel(bossLevel(), { seedText: seed || 'BOSS' });
    killEnemy(w, e); processDeaths(w); expect(w.run.blueprintsDropped).toHaveLength(1); expect(w.rng.combat.next()).toBe(reference.rng.combat.next());
  });
  it('uses a placed elite spawn object ID so unrelated item allocations cannot change its blueprint roll', () => {
    const spawnId = 987; let seed = '';
    const d = bossLevel(); d.objects.push({ id: spawnId, ...feet('enemy', 2, 16, { enemy: 'bandit_brute' }) });
    const runtimeId = GameWorld.fromLevel(d, { seedText: 'PROBE' }).enemies.find((e) => e.def.id === 'bandit_brute')!.id;
    for (let n = 0; n < 10000; n++) {
      const text = `ELITE${n}`;
      if (sourceRng(fnv1a32(text), 'blueprint', 'plains', spawnId)() < 0.02 && sourceRng(fnv1a32(text), 'blueprint', 'plains', runtimeId)() >= 0.02) { seed = text; break; }
    }
    const w = GameWorld.fromLevel(d, { seedText: seed }); const elite = w.enemies.find((e) => e.def.id === 'bandit_brute')!;
    expect(elite.id).not.toBe(spawnId); blueprintOnKill(w, elite); expect(w.run.blueprintsDropped).toHaveLength(1);
  });
});
