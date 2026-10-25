import { describe, expect, it } from 'vitest';
import { DEFAULT_LOOK, type Look } from '../../data/cosmetics.ts';
import { accessoryFrame, capeFrame, clothTint, hairTint, layerAtlas, layerTint, lookLayers, skinTint } from './PlayerLook.ts';

const look = (over: Partial<Look> = {}): Look => ({ ...DEFAULT_LOOK, ...over });
const kinds = (l: Look) => lookLayers(l).map((x) => x.kind);

describe('the player layers (09 §7, checklist 7)', () => {
  it('draws back to front: back accessory, skin, outfit A, outfit B, fixed, trims, beard, hair, headwear, extra, head, weapon', () => {
    expect(kinds(look({ back: 'cape_gold', extra: 'acc_wild_boar', head: 'acc_wolf', outfit: 'plate', beard: 2 }))).toEqual(
      ['back', 'skin', 'outfitA', 'outfitB', 'fixed', 'face', 'trimA', 'trimB', 'beard', 'hair', 'extra', 'head', 'weapon']);
    expect(kinds(look({ outfit: 'plate' }))).toEqual(['skin', 'outfitA', 'outfitB', 'fixed', 'face', 'trimA', 'trimB', 'hair', 'headwear', 'weapon']);
  });
  it('a head accessory hides the plate helmet (or the robe hat) and puts the hair under a hat', () => {
    const bare = lookLayers(look({ outfit: 'plate' })), hat = lookLayers(look({ outfit: 'plate', head: 'acc_wolf' }));
    expect(bare.find((l) => l.kind === 'headwear')).toBeDefined(); expect(bare.find((l) => l.kind === 'hair')!.underHat).toBe(true);
    expect(hat.find((l) => l.kind === 'headwear')).toBeUndefined(); expect(hat.find((l) => l.kind === 'hair')!.underHat).toBe(true);
    expect(lookLayers(look({ outfit: 'leather' })).find((l) => l.kind === 'hair')!.underHat).toBe(false);
    expect(lookLayers(look({ outfit: 'ranger' })).find((l) => l.kind === 'hair')!.underHat).toBe(true);
    expect(lookLayers(look({ outfit: 'leather', head: 'hat_straw' })).find((l) => l.kind === 'hair')!.underHat).toBe(true);
    expect(lookLayers(look({ outfit: 'robe' })).some((l) => l.kind === 'headwear')).toBe(true);
    expect(lookLayers(look({ outfit: 'robe', head: 'hat_tophat' })).some((l) => l.kind === 'headwear')).toBe(false);
  });
  it('no beard or hair layer for "None" / "Bald"', () => {
    expect(kinds(look({ beard: 0, hair: 0 }))).not.toContain('beard'); expect(kinds(look({ beard: 0, hair: 0 }))).not.toContain('hair');
    expect(kinds(look({ beard: 2 }))).toContain('beard');
  });
  it('tints come from the art (look.json): skin by race tone, hair and cloth by id, shop dyes included', () => {
    expect(skinTint(look({ race: 'human', skin: 1 }))).toBe(0xf3c8a1); expect(skinTint(look({ race: 'orc', skin: 3 }))).toBe(0x9aa0a6);
    expect(hairTint('blond')).toBe(0xffd058); expect(hairTint('fire-red')).toBe(0xff471d); expect(clothTint('crimson')).not.toBe(clothTint('slate'));
    expect(hairTint('nope')).toBe(hairTint('brown'));
  });
  it('picks the layer atlases and which are tinted', () => {
    const l = look({ race: 'dwarf', outfit: 'robe', face: 2, hair: 3, beard: 3 });
    expect(layerAtlas('skin', l, false)).toBe('player_skin_dwarf'); expect(layerAtlas('fixed', l, false)).toBe('player_fixed_dwarf_robe');
    expect(layerAtlas('face', l, false)).toBe('player_face_cheerful'); expect(layerAtlas('hair', l, true)).toBe('player_hair_long_tied_hat');
    expect(layerAtlas('beard', l, false)).toBe('player_beard_long'); expect(layerAtlas('trimA', l, false)).toBe('player_robe_trim');
    expect(layerAtlas('hair', look({ hair: 0 }), false)).toBeNull();
    expect(layerTint('fixed', l)).toBeNull(); expect(layerTint('headwear', l)).toBe(clothTint(l.colorB)); expect(layerTint('headwear', look({ outfit: 'plate' }))).toBeNull();
  });
  it('accessory frames: capes by anim, floating extras bob', () => {
    expect(accessoryFrame('cape_gold', 'run', 0)).toBe('cape_gold_01'); expect(accessoryFrame('cape_gold', 'jump', 0)).toBe('cape_gold_02');
    expect(accessoryFrame('acc_wisp', 'idle', 0)).toBe('acc_wisp_00'); expect(accessoryFrame('acc_wisp', 'idle', 0.5)).toBe('acc_wisp_01');
    expect(accessoryFrame('acc_wolf', 'idle', 3)).toBe('acc_wolf_00');
  });
  it('capes use the idle, run or air frame by what the body is doing', () => {
    expect(capeFrame('idle')).toBe('idle'); expect(capeFrame('run')).toBe('run'); expect(capeFrame('skid')).toBe('run');
    for (const a of ['jump', 'apex', 'fall', 'double_jump', 'wall_jump', 'dive_fall']) expect(capeFrame(a)).toBe('air');
    expect(capeFrame('atk_greatsword_1')).toBe('idle');
  });
});
