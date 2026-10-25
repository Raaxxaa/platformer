// The hero drawn as ART10's layers at one position (09 §7): skin, cloth A/B, fixed, face, trims, beard, hair, headwear,
// and the three accessory slots. Used by the player in the world and by the wardrobe preview.
import Phaser from 'phaser';
import { DEPTH } from '../../data/art.ts';
import type { Look } from '../../data/cosmetics.ts';
import { COSMETIC_ART } from '../../data/lookArt.ts';
import { accessoryFrame, layerAtlas, layerTint, lookLayers, type LayerKind } from './PlayerLook.ts';

export interface RigDraw {
  x: number; y: number; flip: boolean; alpha: number;
  /** The player frame name (`idle_00`) and anim key, for the layers and the cape. */
  frame: string; anim: string;
  /** Attachment points of this frame (anims.json `points`), frame pixels. */
  points?: Partial<Record<'head' | 'back' | 'neck' | 'shoulder', readonly [number, number]>>;
  trims: readonly [number, number];
  /** Seconds, for the floating extras' bob. */
  t: number;
  /** A solid color over every layer (the hit flash), or null. */
  flash?: number | null;
}

const BODY: readonly LayerKind[] = ['skin', 'outfitA', 'outfitB', 'fixed', 'face', 'trimA', 'trimB', 'beard', 'hair', 'headwear'];
const ACC: readonly LayerKind[] = ['back', 'extra', 'head'];
/** Depth offsets from the player's depth, back to front (the weapon sits at ±0.5 around them). */
const Z: Record<string, number> = { back: -0.1, skin: 0, outfitA: 0.01, outfitB: 0.02, fixed: 0.03, face: 0.04, trimA: 0.05, trimB: 0.06, beard: 0.07, hair: 0.08, headwear: 0.09, extra: 0.1, head: 0.11 };
const FEET = 46 / 48;

export class LookRig {
  private readonly scene: Phaser.Scene;
  private readonly sprites = new Map<LayerKind, Phaser.GameObjects.Sprite>();
  constructor(scene: Phaser.Scene, depth: number = DEPTH.player, opts: { screen?: boolean; scale?: number } = {}) {
    this.scene = scene;
    for (const k of [...BODY, ...ACC]) {
      const s = scene.add.sprite(0, 0, '__DEFAULT').setVisible(false).setDepth(depth + Z[k]);
      if (opts.screen) s.setScrollFactor(0);
      if (opts.scale) s.setScale(opts.scale);
      this.sprites.set(k, s);
    }
    this.scale = opts.scale ?? 1;
  }
  private readonly scale: number;

  private has(atlas: string, frame: string): boolean { return this.scene.textures.exists(atlas) && this.scene.textures.get(atlas).has(frame); }
  private show(k: LayerKind, atlas: string | null, frame: string, d: RigDraw, tint: number | null): Phaser.GameObjects.Sprite | null {
    const s = this.sprites.get(k)!;
    if (!atlas || !this.has(atlas, frame)) { s.setVisible(false); return null; }
    s.setTexture(atlas, frame).setVisible(true).setAlpha(d.alpha);
    if (d.flash != null) s.setTint(d.flash).setTintMode(Phaser.TintModes.FILL);
    else if (tint !== null) s.setTint(tint).setTintMode(Phaser.TintModes.MULTIPLY);
    else s.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    return s;
  }

  draw(l: Look, d: RigDraw): void {
    const wanted = new Map(lookLayers(l).map((x) => [x.kind, x]));
    for (const k of BODY) {
      const want = wanted.get(k);
      if (!want) { this.sprites.get(k)!.setVisible(false); continue; }
      const trim = k === 'trimA' || k === 'trimB';
      const frame = trim ? `${k === 'trimA' ? 'a' : 'b'}/${d.frame}` : d.frame;
      const tint = trim ? d.trims[k === 'trimA' ? 0 : 1] : layerTint(k, l);
      const s = this.show(k, layerAtlas(k, l, !!want.underHat), frame, d, tint);
      if (s) s.setOrigin(0.5, FEET).setPosition(d.x, d.y).setFlipX(d.flip);
    }
    const f = d.flip ? -1 : 1, k = this.scale;
    for (const slot of ACC) {
      const id = slot === 'back' ? l.back : slot === 'extra' ? l.extra : l.head, s = this.sprites.get(slot)!;
      const art = id ? COSMETIC_ART[id.replace(/-/g, '_')] : null;
      if (!id || !art) { s.setVisible(false); continue; }
      const p = d.points?.[art.point] ?? d.points?.head ?? [24, 20];
      const bob = art.slot === 'extra' && art.frames > 1 ? Math.floor(d.t * 2) % 2 : 0;
      const shown = this.show(slot, 'cosmetics', accessoryFrame(id, d.anim, d.t), d, null);
      if (shown) shown.setOrigin(0.5, 0.5).setPosition(d.x + f * (p[0] - 24) * k, d.y + (p[1] - 46 + bob) * k).setFlipX(d.flip);
    }
  }

  setVisible(on: boolean): void { if (!on) for (const s of this.sprites.values()) s.setVisible(false); }
  destroy(): void { for (const s of this.sprites.values()) s.destroy(); this.sprites.clear(); }
}
