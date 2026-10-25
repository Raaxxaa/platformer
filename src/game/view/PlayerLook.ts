// The hero's look on screen (09 §7). Pure parts: which layers draw and in what order, hat rules, tints, atlas names, cape frames.
// The drawing itself is `LookRig.ts`, which uses the ART10 layer atlases (`public/assets/look.json`).
import {
  BASE_HAIR, OUTFIT_HEADWEAR, type Look,
} from '../../data/cosmetics.ts';
import { CLOTH_TINTS, COSMETIC_ART, HAIR_TINTS, ORC_SKIN_TINTS, SKIN_TINTS } from '../../data/lookArt.ts';

export type LayerKind = 'back' | 'skin' | 'outfitA' | 'outfitB' | 'fixed' | 'face' | 'trimA' | 'trimB' | 'beard' | 'hair' | 'headwear' | 'extra' | 'head' | 'weapon';
export interface Layer { kind: LayerKind; /** hair only: draw the "under a hat" variant */ underHat?: boolean }

/** Outfits whose headwear or hood replaces the top of the hair (ART10 SPEC-GAP 10). */
const HAT_OUTFITS = new Set(['plate', 'robe', 'ranger']);

/** Back to front (09 §7). Headwear is the outfit's own helmet/hat (plate, robe), hidden by a `head` accessory. */
export function lookLayers(l: Look): Layer[] {
  const out: Layer[] = [];
  if (l.back) out.push({ kind: 'back' });
  out.push({ kind: 'skin' }, { kind: 'outfitA' }, { kind: 'outfitB' }, { kind: 'fixed' }, { kind: 'face' }, { kind: 'trimA' }, { kind: 'trimB' });
  const builtIn = OUTFIT_HEADWEAR[l.outfit] && !l.head, underHat = !!l.head || HAT_OUTFITS.has(l.outfit);
  if (l.beard > 0) out.push({ kind: 'beard' });
  if (l.hair > 0) out.push({ kind: 'hair', underHat });
  if (builtIn) out.push({ kind: 'headwear' });
  if (l.extra) out.push({ kind: 'extra' });
  if (l.head) out.push({ kind: 'head' });
  out.push({ kind: 'weapon' });
  return out;
}

const norm = (id: string): string => id.replace(/-/g, '_');
const FACE_NAMES = ['calm', 'fierce', 'cheerful', 'tired'] as const;
const HAIR_NAMES = ['bald', 'short', 'spiky', 'long_tied', 'braid', 'mohawk', 'curly', 'top_knot'] as const;
const BEARD_NAMES = ['none', 'stubble', 'short', 'long', 'braided'] as const;

/** The multiply tints (ART10: use `look.json` → `tint`). */
export const skinTint = (l: Look): number => (l.race === 'orc' ? ORC_SKIN_TINTS : SKIN_TINTS)[l.skin]?.tint ?? SKIN_TINTS[0].tint;
export const hairTint = (id: string): number => (HAIR_TINTS[norm(id)] ?? HAIR_TINTS[BASE_HAIR[1].id]).tint;
export const clothTint = (id: string): number => (CLOTH_TINTS[norm(id)] ?? CLOTH_TINTS.slate).tint;

/** Atlas name per layer (ART10 SPEC-GAP 9). `null` means the layer has no art for this look. */
export function layerAtlas(kind: LayerKind, l: Look, underHat: boolean): string | null {
  switch (kind) {
    case 'skin': return `player_skin_${l.race}`;
    case 'outfitA': return `player_outfitA_${l.outfit}`;
    case 'outfitB': return `player_outfitB_${l.outfit}`;
    case 'fixed': return `player_fixed_${l.race}_${l.outfit}`;
    case 'face': return `player_face_${FACE_NAMES[l.face] ?? 'calm'}`;
    case 'trimA': case 'trimB': return `player_${l.outfit}_trim`;
    case 'beard': return l.beard > 0 ? `player_beard_${BEARD_NAMES[l.beard]}` : null;
    case 'hair': return l.hair > 0 ? `player_hair_${HAIR_NAMES[l.hair]}${underHat ? '_hat' : ''}` : null;
    case 'headwear': return OUTFIT_HEADWEAR[l.outfit] ? `player_headwear_${l.outfit}` : null;
    default: return null;
  }
}

/** The multiply tint of a layer, or `null` for full-color art (fixed, face, plate helmet). */
export function layerTint(kind: LayerKind, l: Look): number | null {
  switch (kind) {
    case 'skin': return skinTint(l);
    case 'outfitA': return clothTint(l.colorA);
    case 'outfitB': return clothTint(l.colorB);
    case 'beard': case 'hair': return hairTint(l.hairColor);
    case 'headwear': return l.outfit === 'robe' ? clothTint(l.colorB) : null;
    default: return null;
  }
}

/** 09 §7: capes have a few frames; pick by what the body is doing. */
export function capeFrame(anim: string): 'idle' | 'run' | 'air' {
  if (anim === 'run' || anim === 'skid') return 'run';
  if (['jump', 'apex', 'fall', 'double_jump', 'wall_jump', 'dive_fall', 'dive_windup', 'wall_slide', 'ledge_climb'].includes(anim)) return 'air';
  return 'idle';
}

/** The frame name of an accessory in the `cosmetics` atlas (`<id>_NN`; ART10 SPEC-GAP 15). `t` is seconds, for the 2-frame bob. */
export function accessoryFrame(id: string, anim: string, t: number): string {
  const art = COSMETIC_ART[id.replace(/-/g, '_')];
  if (!art) return `${id}_00`;
  const n = art.slot === 'back' ? ({ idle: 0, run: 1, air: 2 } as const)[capeFrame(anim)] : art.frames > 1 ? Math.floor(t * 2) % art.frames : 0;
  return `${id}_${String(n).padStart(2, '0')}`;
}
