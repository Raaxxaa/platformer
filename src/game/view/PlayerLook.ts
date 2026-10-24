// The hero's look on screen (09 §7). Pure parts: which layers draw and in what order, hat rules, tint colors, cape frames.
// The drawing parts use PLACEHOLDER shapes (small colored boxes on the class-outfit sprite) until ART10 Part B delivers the
// layered player art; swapping the art in changes `drawLook` only.
import type Phaser from 'phaser';
import {
  BASE_CLOTH, BASE_HAIR, OUTFIT_HEADWEAR, SHOP_BY_ID, SKINS, cosmeticHex, type Look,
} from '../../data/cosmetics.ts';

export type LayerKind = 'back' | 'skin' | 'outfitA' | 'outfitB' | 'fixed' | 'trimA' | 'trimB' | 'beard' | 'hair' | 'headwear' | 'extra' | 'head' | 'weapon';
export interface Layer { kind: LayerKind; /** hair only: draw the "under a hat" variant */ underHat?: boolean }

/** Back to front (09 §7). Headwear is the outfit's own hat/helmet, hidden by a `head` accessory; hair goes under any hat. */
export function lookLayers(l: Look): Layer[] {
  const out: Layer[] = [];
  if (l.back) out.push({ kind: 'back' });
  out.push({ kind: 'skin' }, { kind: 'outfitA' }, { kind: 'outfitB' }, { kind: 'fixed' }, { kind: 'trimA' }, { kind: 'trimB' });
  const builtIn = OUTFIT_HEADWEAR[l.outfit] && !l.head, underHat = !!l.head || builtIn;
  if (l.beard > 0) out.push({ kind: 'beard' });
  if (l.hair > 0) out.push({ kind: 'hair', underHat });
  if (builtIn) out.push({ kind: 'headwear' });
  if (l.extra) out.push({ kind: 'extra' });
  if (l.head) out.push({ kind: 'head' });
  out.push({ kind: 'weapon' });
  return out;
}

export const skinHex = (l: Look): number => SKINS[l.race][l.skin]?.hex ?? SKINS.human[0].hex;
const SHOP_HAIR = new Map([...SHOP_BY_ID.values()].filter((s) => s.kind === 'hair').map((s) => [s.id.slice(5), s.hex]));
const SHOP_CLOTH = new Map([...SHOP_BY_ID.values()].filter((s) => s.kind === 'dye').map((s) => [s.id.slice(4), s.hex]));
export const hairHex = (id: string): number => BASE_HAIR.find((c) => c.id === id)?.hex ?? SHOP_HAIR.get(id) ?? BASE_HAIR[1].hex;
export const clothHex = (id: string): number => BASE_CLOTH.find((c) => c.id === id)?.hex ?? SHOP_CLOTH.get(id) ?? BASE_CLOTH[0].hex;

/** 09 §7: capes have a few frames; pick by what the body is doing. */
export function capeFrame(anim: string): 'idle' | 'run' | 'air' {
  if (anim === 'run' || anim === 'skid') return 'run';
  if (['jump', 'apex', 'fall', 'double_jump', 'wall_jump', 'dive_fall', 'dive_windup', 'wall_slide'].includes(anim)) return 'air';
  return 'idle';
}

// ------------------------------------------------------------------------------------------ placeholder drawing
export interface LookDraw { x: number; y: number; flip: boolean; alpha: number; scale?: number; anim?: string }
/** Placeholder anchor offsets from the feet (px, facing right); ART10's per-frame anchors replace these. */
const A = { head: [0, -31], back: [-6, -22], face: [1, -28], chest: [0, -20], belt: [0, -14], extra: [5, -18] } as const;

/** Draws the look as small colored boxes over the outfit sprite: `back` into `behind`, everything else into `front`. */
export function drawLook(behind: Phaser.GameObjects.Graphics, front: Phaser.GameObjects.Graphics, l: Look, d: LookDraw): void {
  behind.clear(); front.clear();
  const k = d.scale ?? 1, f = d.flip ? -1 : 1;
  const px = (ax: number) => d.x + f * ax * k;
  const box = (g: Phaser.GameObjects.Graphics, color: number, ax: number, ay: number, w: number, h: number) =>
    g.fillStyle(color, d.alpha).fillRect(Math.round(f > 0 ? px(ax) : px(ax) - w * k), Math.round(d.y + ay * k), Math.ceil(w * k), Math.ceil(h * k));
  const layers = lookLayers(l);
  for (const layer of layers) {
    switch (layer.kind) {
      case 'back': box(behind, cosmeticHex(l.back!), A.back[0] - 2, A.back[1], 6, 14); break;
      case 'skin': box(front, skinHex(l), A.face[0], A.face[1], 3, 3); if (l.race === 'elf') { box(front, skinHex(l), -4, A.face[1] - 2, 1, 3); box(front, skinHex(l), 4, A.face[1] - 2, 1, 3); }
        if (l.race === 'orc') { box(front, 0xeeeae0, 2, A.face[1] + 3, 1, 2); box(front, 0xeeeae0, 4, A.face[1] + 3, 1, 2); } break;
      case 'outfitA': box(front, clothHex(l.colorA), A.chest[0] - 3, A.chest[1], 6, 4); break;
      case 'outfitB': box(front, clothHex(l.colorB), A.belt[0] - 3, A.belt[1], 6, 2); break;
      case 'beard': box(front, hairHex(l.hairColor), 0, A.face[1] + 3, 5, l.beard >= 3 || l.race === 'dwarf' ? 5 : 2); break;
      case 'hair': box(front, hairHex(l.hairColor), -3, A.head[1] - 2, 7, layer.underHat ? 2 : 3); break;
      case 'headwear': box(front, l.outfit === 'plate' ? 0x9aa0b4 : 0x4a2a6a, -4, A.head[1] - 4, 9, 3); break;
      case 'extra': box(front, cosmeticHex(l.extra!), A.extra[0], A.extra[1], 4, 4); break;
      case 'head': box(front, cosmeticHex(l.head!), -4, A.head[1] - 5, 9, 4); break;
      default: break;                        // fixed, trims and the weapon are the existing sprites
    }
  }
}
