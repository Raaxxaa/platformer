// Solid bodies (01 §13, §13.9): doors, timed doors, cracked walls, blink blocks, collapsing platforms.
// All level bodies are tile-aligned, so active bodies are kept as a per-tile overlay the grid reads.
import { TILE_SIZE } from '../tuning.ts';

export interface SolidBody {
  id: string; x: number; y: number; w: number; h: number;
  oneWay: boolean; surface: 'normal' | 'ice'; grabbable: boolean; noTeleport: boolean; active: boolean;
}

/** Overlay values per cell. */
export const OVERLAY_NONE = 0, OVERLAY_SOLID = 1, OVERLAY_ONEWAY = 2;

export class Bodies {
  readonly list: SolidBody[] = [];
  readonly overlay: Uint8Array;
  private readonly wTiles: number;
  private readonly hTiles: number;

  constructor(wTiles: number, hTiles: number) {
    this.wTiles = wTiles;
    this.hTiles = hTiles;
    this.overlay = new Uint8Array(wTiles * hTiles);
  }

  add(b: SolidBody): void {
    if ([b.x, b.y, b.w, b.h].some((v) => v % TILE_SIZE !== 0)) throw new Error(`body ${b.id} is not tile-aligned`);
    this.list.push(b);
    this.rebuild();
  }

  get(id: string): SolidBody | undefined {
    return this.list.find((b) => b.id === id);
  }

  setActive(id: string, on: boolean): SolidBody | undefined {
    const b = this.get(id);
    if (!b || b.active === on) return b;
    b.active = on;
    this.rebuild();
    return b;
  }

  /** Overlay kind of a cell (0 none, 1 solid, 2 one-way). */
  at(tx: number, ty: number): number {
    if (tx < 0 || ty < 0 || tx >= this.wTiles || ty >= this.hTiles) return OVERLAY_NONE;
    return this.overlay[ty * this.wTiles + tx];
  }

  solidAt(px: number, py: number): boolean {
    return this.at(Math.floor(px / TILE_SIZE), Math.floor(py / TILE_SIZE)) === OVERLAY_SOLID;
  }

  oneWayTopAt(px: number, py: number): boolean {
    return py % TILE_SIZE === 0 && this.at(Math.floor(px / TILE_SIZE), py / TILE_SIZE) === OVERLAY_ONEWAY;
  }

  private rebuild(): void {
    this.overlay.fill(OVERLAY_NONE);
    for (const b of this.list) {
      if (!b.active) continue;
      const v = b.oneWay ? OVERLAY_ONEWAY : OVERLAY_SOLID;
      for (let ty = b.y / TILE_SIZE; ty < (b.y + b.h) / TILE_SIZE; ty++)
        for (let tx = b.x / TILE_SIZE; tx < (b.x + b.w) / TILE_SIZE; tx++) {
          const i = ty * this.wTiles + tx;
          if (tx >= 0 && ty >= 0 && tx < this.wTiles && ty < this.hTiles && this.overlay[i] !== OVERLAY_SOLID) this.overlay[i] = v;
        }
    }
  }
}
