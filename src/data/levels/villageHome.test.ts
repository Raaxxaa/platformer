import { describe, expect, it } from 'vitest';
import homeJson from '../../../public/levels/village_home.json';
import { loadLevel, kindAt } from '../../core/level/loadLevel.ts';
import { validateLevel } from '../../core/level/validateLevel.ts';
import { VILLAGE } from '../villages.ts';
describe('Home Village layout (06 §12.1, §12.3)', () => {
  const home = loadLevel(homeJson);
  it('has exact dimensions, floor, statues, mirror, dummy, boards and gates', () => {
    expect(validateLevel(home)).toEqual([]);
    expect([home.widthTiles, home.heightTiles]).toEqual([VILLAGE.width, VILLAGE.height]);
    for (let x = 0; x < home.widthTiles; x++) expect(kindAt(home, x, VILLAGE.floor)).toBe('solid');
    expect(home.objects.filter((o) => o.type === 'class_statue').map((o) => Math.floor(o.x / 16))).toEqual([9, 13, 17, 21]);
    for (const [type, x] of [['mirror_spot', 25], ['enemy', 28], ['unlocks_board', 34], ['seed_board', 37]] as const) expect(Math.floor(home.objects.find((o) => o.type === type)!.x / 16)).toBe(x);
    expect(home.objects.find((o) => o.type === 'exit')).toMatchObject({ x: 45 * 16, y: 16 * 16, w: 2 * 16, h: 4 * 16 });
    expect(home.objects.find((o) => o.type === 'training_gate')).toMatchObject({ x: 16, y: 16 * 16, w: 2 * 16, h: 4 * 16 });
  });
});
