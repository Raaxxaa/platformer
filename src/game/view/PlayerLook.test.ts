import { describe, expect, it } from 'vitest';
import { DEFAULT_LOOK, type Look } from '../../data/cosmetics.ts';
import { capeFrame, clothHex, hairHex, lookLayers, skinHex } from './PlayerLook.ts';

const look = (over: Partial<Look> = {}): Look => ({ ...DEFAULT_LOOK, ...over });
const kinds = (l: Look) => lookLayers(l).map((x) => x.kind);

describe('the player layers (09 §7, checklist 7)', () => {
  it('draws back to front: back accessory, skin, outfit A, outfit B, fixed, trims, beard, hair, headwear, extra, head, weapon', () => {
    expect(kinds(look({ back: 'cape_gold', extra: 'acc_wild_boar', head: 'acc_wolf', outfit: 'plate', beard: 2 }))).toEqual(
      ['back', 'skin', 'outfitA', 'outfitB', 'fixed', 'trimA', 'trimB', 'beard', 'hair', 'extra', 'head', 'weapon']);
    expect(kinds(look({ outfit: 'plate' }))).toEqual(['skin', 'outfitA', 'outfitB', 'fixed', 'trimA', 'trimB', 'hair', 'headwear', 'weapon']);
  });
  it('a head accessory hides the plate helmet (or the robe hat) and puts the hair under a hat', () => {
    const bare = lookLayers(look({ outfit: 'plate' })), hat = lookLayers(look({ outfit: 'plate', head: 'acc_wolf' }));
    expect(bare.find((l) => l.kind === 'headwear')).toBeDefined(); expect(bare.find((l) => l.kind === 'hair')!.underHat).toBe(true);
    expect(hat.find((l) => l.kind === 'headwear')).toBeUndefined(); expect(hat.find((l) => l.kind === 'hair')!.underHat).toBe(true);
    expect(lookLayers(look({ outfit: 'leather' })).find((l) => l.kind === 'hair')!.underHat).toBe(false);
    expect(lookLayers(look({ outfit: 'leather', head: 'hat_straw' })).find((l) => l.kind === 'hair')!.underHat).toBe(true);
    expect(lookLayers(look({ outfit: 'robe' })).some((l) => l.kind === 'headwear')).toBe(true);
    expect(lookLayers(look({ outfit: 'robe', head: 'hat_tophat' })).some((l) => l.kind === 'headwear')).toBe(false);
  });
  it('no beard or hair layer for "None" / "Bald"', () => {
    expect(kinds(look({ beard: 0, hair: 0 }))).not.toContain('beard'); expect(kinds(look({ beard: 0, hair: 0 }))).not.toContain('hair');
    expect(kinds(look({ beard: 2 }))).toContain('beard');
  });
  it('colors: skin by race tone, hair and cloth by id (base and shop dyes)', () => {
    expect(skinHex(look({ race: 'human', skin: 1 }))).toBe(0xe8bb94); expect(skinHex(look({ race: 'orc', skin: 3 }))).toBe(0x8d949a);
    expect(hairHex('blond')).toBe(0xd8b25a); expect(hairHex('pink')).toBe(0xe06aa0); expect(clothHex('maroon')).toBe(0x7e2a34); expect(clothHex('crimson')).toBe(0xc0182a);
    expect(hairHex('nope')).toBe(hairHex('brown'));
  });
  it('capes use the idle, run or air frame by what the body is doing', () => {
    expect(capeFrame('idle')).toBe('idle'); expect(capeFrame('run')).toBe('run'); expect(capeFrame('skid')).toBe('run');
    for (const a of ['jump', 'apex', 'fall', 'double_jump', 'wall_jump', 'dive_fall']) expect(capeFrame(a)).toBe('air');
    expect(capeFrame('atk_greatsword_1')).toBe('idle');
  });
});
