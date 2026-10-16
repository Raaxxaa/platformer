// Tile map queries for collision (01 §2.3, §13).
import { TILE_SIZE } from '../tuning.ts';
import { OVERLAY_ONEWAY, OVERLAY_SOLID, type Bodies } from '../physics/bodies.ts';

export type TileKind = 'empty' | 'solid' | 'oneway' | 'ice' | 'water'
  | 'spikeUp' | 'spikeDown' | 'spikeLeft' | 'spikeRight';

export class TileGrid {
  readonly w: number;
  readonly h: number;
  readonly widthPx: number;
  readonly heightPx: number;
  private readonly kinds: TileKind[];
  /** Active solid bodies read as tiles: a body cell is 'solid' or 'oneway' (01 §13). */
  bodies: Bodies | null = null;

  constructor(w: number, h: number, kinds: TileKind[]) {
    if (kinds.length !== w * h) throw new Error(`TileGrid: expected ${w * h} tiles, got ${kinds.length}`);
    this.w = w;
    this.h = h;
    this.widthPx = w * TILE_SIZE;
    this.heightPx = h * TILE_SIZE;
    this.kinds = kinds;
  }

  /** The tile's own kind, ignoring bodies (for drawing). */
  baseKindAt(tx: number, ty: number): TileKind {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return 'solid';
    return this.kinds[ty * this.w + tx];
  }

  /** Tile kind at tile coords; everything outside the map is solid (all four edges block, 01 §2.3). */
  kindAt(tx: number, ty: number): TileKind {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return 'solid';
    const k = this.kinds[ty * this.w + tx];
    if (this.bodies && k !== 'solid' && k !== 'ice') {
      const o = this.bodies.at(tx, ty);
      if (o === OVERLAY_SOLID) return 'solid';
      if (o === OVERLAY_ONEWAY) return 'oneway';
    }
    return k;
  }

  /** True if the tile is solid for collision (solid and ice tiles). */
  isSolidTile(tx: number, ty: number): boolean {
    const k = this.kindAt(tx, ty);
    return k === 'solid' || k === 'ice';
  }

  /** True if the pixel lies in a solid or ice tile. */
  isSolidPx(px: number, py: number): boolean {
    return this.isSolidTile(Math.floor(px / TILE_SIZE), Math.floor(py / TILE_SIZE));
  }

  /** True if the pixel lies on the top pixel row of a one-way tile. */
  isOneWayTopPx(px: number, py: number): boolean {
    if (py % TILE_SIZE !== 0) return false;
    return this.kindAt(Math.floor(px / TILE_SIZE), py / TILE_SIZE) === 'oneway';
  }
}
