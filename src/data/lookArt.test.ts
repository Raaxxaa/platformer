import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CLOTH_TINTS, COSMETIC_ART, HAIR_TINTS, ORC_SKIN_TINTS, SKIN_TINTS } from './lookArt.ts';
import { ALL_COSMETIC_IDS } from './cosmetics.ts';

// `src/data/lookArt.ts` is generated from the art's look.json (scripts/gen_look_art.py); this fails when they drift apart.
const L = JSON.parse(readFileSync('public/assets/look.json', 'utf8'));
const hx = (s: string) => parseInt(s.slice(1), 16);
describe('lookArt matches the art', () => {
  it('has every tint and every accessory of look.json', () => {
    expect(SKIN_TINTS.map((t) => t.tint)).toEqual(L.colors.skin.map((c: { tint: string }) => hx(c.tint)));
    expect(ORC_SKIN_TINTS).toHaveLength(L.colors.skinOrc.length);
    for (const c of [...L.colors.hair, ...L.colors.hairShop]) expect(HAIR_TINTS[c.id].tint).toBe(hx(c.tint));
    for (const c of [...L.colors.dye, ...L.colors.dyeShop]) expect(CLOTH_TINTS[c.id].tint).toBe(hx(c.tint));
    expect(Object.keys(COSMETIC_ART).sort()).toEqual(Object.keys(L.cosmetics).sort());
  });
  it('every cosmetic id the game knows that is worn has art', () => {
    for (const id of ALL_COSMETIC_IDS) if (!/^(dye|hair)_/.test(id)) expect(COSMETIC_ART[id.replace(/-/g, '_')], id).toBeDefined();
  });
});
