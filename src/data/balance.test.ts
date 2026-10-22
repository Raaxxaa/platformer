import { describe, expect, it } from 'vitest';
import { STAGE_SCALING, TICK_RATE } from '../core/tuning.ts';
import { GRADE_MULT } from '../core/combat/damage.ts';
import { ABILITIES } from './abilities.ts';
import { CASTLE_ENEMIES } from './castle.ts';
import { GUARDIANS2 } from './guardians2.ts';
import { KINGDOM_ENEMIES } from './kingdom.ts';
import { ENEMIES } from './enemies.ts';
import { WEAPONS } from './weapons.ts';
import { PLAYER_PROJECTILES } from './playerProjectiles.ts';
import { playerHitDamage } from '../core/combat/damage.ts';
import { phaseTicks } from '../core/combat/phases.ts';
import type { WeaponDef } from '../core/combat/types.ts';

// M10 balance checks: only numbers the spec states (00-README scaling, 02 §10.1, 03 §13, 06 §8.2). Nothing here tunes the game;
// a number that disagrees with the spec is written down in docs/SPEC-GAPS.md instead of being changed.
const bossHp = (id: string): number => ({ ...ENEMIES, ...GUARDIANS2, ...KINGDOM_ENEMIES, ...CASTLE_ENEMIES } as Record<string, { hp: number }>)[id].hp;
const stageOf = { great_boar: 1, stone_colossus: 2, spider_queen: 2, black_knight: 3, enemy_king: 4 } as const;
const scaledBossHp = (id: keyof typeof stageOf) => Math.round(bossHp(id) * STAGE_SCALING[stageOf[id]].bossHp);

describe('balance anchors (00-README, 06 §8.2)', () => {
  it('stage scaling: mobs x1.0 / 1.4 / 1.9 / 2.4, bosses x1.0 / 1.7 / 2.6 / 3.6', () => {
    expect([1, 2, 3, 4].map((s) => STAGE_SCALING[s as 1].mobHp)).toEqual([1.0, 1.4, 1.9, 2.4]);
    expect([1, 2, 3, 4].map((s) => STAGE_SCALING[s as 1].bossHp)).toEqual([1.0, 1.7, 2.6, 3.6]);
  });
  it('boss HP after scaling: Stone Colossus 1,530, Black Knight 3,120, Enemy King 3,960 (06 §8.2)', () => {
    expect(scaledBossHp('stone_colossus')).toBe(1530); expect(scaledBossHp('black_knight')).toBe(3120); expect(scaledBossHp('enemy_king')).toBe(3960);
  });
  it('grade multipliers F 0.8, C 1.0, B 1.25, A 1.6, S 2.0 give the 56 / 72 / 90 DPS of a B / A / S matched weapon on the 45 base', () => {
    expect(GRADE_MULT).toMatchObject({ F: 0.8, C: 1.0, B: 1.25, A: 1.6, S: 2.0 });
    expect(Math.round(45 * GRADE_MULT.B)).toBe(56); expect(Math.round(45 * GRADE_MULT.A)).toBe(72); expect(Math.round(45 * GRADE_MULT.S)).toBe(90);
  });
  it('the boss time floors at Rush 3 (x1.15 attack speed) are about 24 s, 38 s and 38 s (06 §8.2)', () => {
    const floor = (hp: number, dps: number) => hp / (dps * 1.15);
    expect(floor(scaledBossHp('stone_colossus'), 56)).toBeGreaterThan(23); expect(floor(scaledBossHp('stone_colossus'), 56)).toBeLessThan(25);
    expect(Math.round(floor(scaledBossHp('black_knight'), 72))).toBe(38); expect(Math.round(floor(scaledBossHp('enemy_king'), 90))).toBe(38);
  });
});

describe('weapon DPS (02 §10.1, checklist 3)', () => {
  const cycle = (w: WeaponDef) => w.combo.reduce((s, st) => s + phaseTicks(st.startup, 1) + phaseTicks(st.active, 1) + phaseTicks(st.recovery, 1), 0);
  const step = (st: WeaponDef['combo'][number]) => (st.hit ? [st.hit.damage] : (st.projectiles ?? []).map((p) => PLAYER_PROJECTILES[p.id]!.hit.damage))
    .reduce((s, base) => s + playerHitDamage({ base, grade: 'C', matched: true, isWeapon: true }).damage, 0);
  const dps = (w: WeaponDef) => w.combo.reduce((s, st) => s + step(st), 0) / (cycle(w) / TICK_RATE);
  it('every weapon except the Shield has a C-grade matched DPS between 43 and 47 (the Spell Tome counts its ring)', () => {
    // The Spell Tome's direct hits are about 25 DPS; its ring adds 20 matched against a target inside it (02 §10.1).
    const total = (id: string, w: WeaponDef) => dps(w) + (id === 'spell_tome' ? 20 : 0);
    const outside = Object.entries(WEAPONS).filter(([id, w]) => id !== 'shield' && w && (total(id, w) < 43 || total(id, w) > 47)).map(([id, w]) => `${id} ${total(id, w!).toFixed(1)}`);
    expect(outside).toEqual([]);
  });
});

describe('ability damage index (03 §13)', () => {
  const index = [1.0, 1.35, 1.75, 2.2, 2.75];
  it('single-hit ability damage grows about x1.0 / 1.35 / 1.75 / 2.2 / 2.75 over Lv1..Lv5', () => {
    const off: string[] = [];
    for (const [id, def] of Object.entries(ABILITIES)) {
      if (id === 'shoulder_charge') continue;          // SPEC-GAP 42: its table reaches x2.0 / x2.48 at Lv4 / Lv5 (Lv5 adds a stun)
      const rows = def!.levels as unknown as Record<string, number>[];
      if (typeof rows[0].damage !== 'number' || rows[0].damage <= 0) continue;
      rows.forEach((row, i) => { const ratio = row.damage / rows[0].damage; if (Math.abs(ratio - index[i]) > 0.15) off.push(`${id} Lv${i + 1} x${ratio.toFixed(2)}`); });
    }
    expect(off).toEqual([]);
  });
});
