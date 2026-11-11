import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { signParts } from './signParts.ts';

// Training Yard signs are written with keyboard keys in the level file. On a phone or a controller, and after
// rebinding, the keys must become the player's own buttons (review 2026-11).
const level = JSON.parse(readFileSync('public/levels/training_yard.json', 'utf8')) as { layers?: { objects?: { type?: string; properties?: { name: string; value: unknown }[] }[] }[] };
const signs = (level.layers ?? []).flatMap((l) => l.objects ?? []).filter((o) => o.type === 'hint')
  .map((o) => String(o.properties?.find((p) => p.name === 'text')?.value ?? '')).filter(Boolean);

describe('Training Yard signs name the player\'s own buttons', () => {
  it('turns key names into action glyphs', () => {
    expect(signParts('A / D — move.   Space — jump')).toEqual([{ action: 'left' }, ' / ', { action: 'right' }, ' — move.   ', { action: 'jump' }, ' — jump']);
    expect(signParts('S + Shift — slide. Keep holding S to crawl')).toEqual([{ action: 'down' }, ' + ', { action: 'dash' }, ' — slide. Keep holding ', { action: 'down' }, ' to crawl']);
    expect(signParts('E — pick up. K — attack with weapon 2')).toEqual([{ action: 'interact' }, ' — pick up. ', { action: 'attack2' }, ' — attack with weapon 2']);
    expect(signParts('U / I — abilities. Use both within 3 s to link them')).toEqual([{ action: 'ability1' }, ' / ', { action: 'ability2' }, ' — abilities. Use both within 3 s to link them']);
    expect(signParts('↑ + Attack — launch, then jump and keep hitting')).toEqual([{ action: 'up' }, ' + ', { action: 'attack1' }, ' — launch, then jump and keep hitting']);
    expect(signParts('Q — drink the flask')).toEqual([{ action: 'heal' }, ' — drink the flask']);
  });
  it('leaves plain sentences alone', () => {
    expect(signParts('Hold toward a ledge to grab it')).toEqual(['Hold toward a ledge to grab it']);
    expect(signParts('Jump on a wall — wall jump. Climb out the top')).toEqual(['Jump on a wall — wall jump. Climb out the top']);
    expect(signParts('Choose a class at a statue first')).toEqual(['Choose a class at a statue first']);
  });
  it('no sign in the real level keeps a bare keyboard key', () => {
    expect(signs.length).toBeGreaterThanOrEqual(19);
    for (const sign of signs) {
      const words = signParts(sign).filter((p): p is string => typeof p === 'string').join(' ');
      expect(words, sign).not.toMatch(/\b(Space|Shift|[ADSJKEQUI])\b|↑/);
    }
  });
});
