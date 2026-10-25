// The wardrobe (09 §6): pure model. Rows cycle through options the player owns; Undo goes back to the saved look;
// Confirm hands the draft to the caller to save. Random takes the random source from the caller (UI layer only).
import { clothColors, hairColors, ownedFor } from '../../core/cosmetics/look.ts';
import {
  BEARDS, FACES, HAIR_STYLES, OUTFITS, OUTFIT_NAME, RACES, RACE_DEFAULT_BEARD, RACE_NAME, SKINS, cosmeticName,
  type AccessorySlot, type CosmeticId, type Look, type OutfitId, type RaceId,
} from '../../data/cosmetics.ts';
import type { HomePanelAction } from '../home/homePanels.ts';

export type WardrobeTab = 'body' | 'clothes' | 'accessories' | 'collection';
export const WARDROBE_TABS: readonly WardrobeTab[] = ['body', 'clothes', 'accessories', 'collection'];
export const TAB_LABEL: Record<WardrobeTab, string> = { body: 'Body', clothes: 'Clothes', accessories: 'Accessories', collection: 'Collection' };
export type WardrobeRow = 'race' | 'skin' | 'face' | 'hair' | 'hairColor' | 'beard' | 'outfit' | 'colorA' | 'colorB' | 'head' | 'back' | 'extra';
export const TAB_ROWS: Record<WardrobeTab, readonly WardrobeRow[]> = {
  body: ['race', 'skin', 'face', 'hair', 'hairColor', 'beard'], clothes: ['outfit', 'colorA', 'colorB'], accessories: ['head', 'back', 'extra'], collection: [],
};
export const ROW_LABEL: Record<WardrobeRow, string> = {
  race: 'Race', skin: 'Skin', face: 'Face', hair: 'Hair', hairColor: 'Hair color', beard: 'Beard', outfit: 'Outfit', colorA: 'Color A', colorB: 'Color B', head: 'Head', back: 'Back', extra: 'Extra',
};
export const PREVIEW_ANIMS = ['idle', 'run', 'jump', 'attack'] as const;
export type PreviewAnim = (typeof PREVIEW_ANIMS)[number];
export const FOOTER = ['Random', 'Undo changes', 'Confirm'] as const;
export const COLLECTION_COLS = 10;
export type Zone = 'tabs' | 'rows' | 'anim' | 'footer';
export type WardrobeResult = { type: 'confirm'; look: Look } | { type: 'close' } | null;

const slotKey = (r: WardrobeRow): r is AccessorySlot => r === 'head' || r === 'back' || r === 'extra';

export class WardrobeModel {
  tab: WardrobeTab = 'body';
  zone: Zone = 'rows';
  row = 0;
  cell = 0;
  anim: PreviewAnim = 'idle';
  footer = 2;
  look: Look;
  readonly intro: boolean;
  private readonly saved: Look;
  private readonly owned: readonly CosmeticId[];
  private readonly rng: () => number;
  constructor(saved: Look, owned: readonly CosmeticId[], opts: { intro?: boolean; rng?: () => number } = {}) {
    this.saved = { ...saved }; this.look = { ...saved }; this.owned = owned; this.intro = !!opts.intro; this.rng = opts.rng ?? Math.random;
    if (this.intro) this.zone = 'footer';
  }
  get rows(): readonly WardrobeRow[] { return TAB_ROWS[this.tab]; }
  get changed(): boolean { return JSON.stringify(this.look) !== JSON.stringify(this.saved); }

  /** The options of a row, in cycle order. Locked colors and items are not here. */
  options(r: WardrobeRow): { id: string | null; name: string; hex?: number }[] {
    const l = this.look;
    switch (r) {
      case 'race': return RACES.map((id) => ({ id, name: RACE_NAME[id] }));
      case 'skin': return SKINS[l.race].map((s, i) => ({ id: String(i), name: s.name, hex: s.hex }));
      case 'face': return FACES.map((name, i) => ({ id: String(i), name }));
      case 'hair': return HAIR_STYLES.map((name, i) => ({ id: String(i), name }));
      case 'beard': return BEARDS.map((name, i) => ({ id: String(i), name }));
      case 'hairColor': return hairColors(this.owned).map((c) => ({ id: c.id, name: c.name, hex: c.hex }));
      case 'outfit': return OUTFITS.map((id) => ({ id, name: OUTFIT_NAME[id] }));
      case 'colorA': case 'colorB': return clothColors(this.owned).map((c) => ({ id: c.id, name: c.name, hex: c.hex }));
      default: return [{ id: null, name: 'None' }, ...ownedFor(r, this.owned).map((id) => ({ id, name: cosmeticName(id) }))];
    }
  }
  private value(r: WardrobeRow): string | null {
    const v = this.look[r]; return v === null ? null : String(v);
  }
  index(r: WardrobeRow): number { const o = this.options(r), v = this.value(r); return Math.max(0, o.findIndex((x) => x.id === v)); }
  current(r: WardrobeRow) { return this.options(r)[this.index(r)]; }
  /** Moves a row by `dir` options (wrapping) and applies the choice. */
  cycle(r: WardrobeRow, dir: 1 | -1): void {
    const o = this.options(r), next = o[(this.index(r) + dir + o.length) % o.length];
    this.set(r, next.id);
  }
  private set(r: WardrobeRow, id: string | null): void {
    const l = this.look;
    if (slotKey(r)) { l[r] = id; return; }
    if (r === 'race') {
      l.race = id as RaceId; l.skin = Math.min(l.skin, SKINS[l.race].length - 1); l.beard = RACE_DEFAULT_BEARD[l.race];
    } else if (r === 'outfit') l.outfit = id as OutfitId;
    else if (r === 'hairColor' || r === 'colorA' || r === 'colorB') l[r] = id as string;
    else l[r] = Number(id);
  }

  setTab(t: WardrobeTab): void { this.tab = t; this.row = 0; this.cell = 0; }
  /** Random owned options (09 §6). */
  randomize(): void {
    const pick = <T>(list: readonly T[]): T => list[Math.floor(this.rng() * list.length)];
    const l = this.look;
    l.race = pick(RACES); l.skin = Math.floor(this.rng() * SKINS[l.race].length); l.face = Math.floor(this.rng() * FACES.length);
    l.hair = Math.floor(this.rng() * HAIR_STYLES.length); l.beard = Math.floor(this.rng() * BEARDS.length);
    l.hairColor = pick(hairColors(this.owned)).id; l.outfit = pick(OUTFITS);
    l.colorA = pick(clothColors(this.owned)).id; l.colorB = pick(clothColors(this.owned)).id;
    for (const s of ['head', 'back', 'extra'] as const) l[s] = pick([null, ...ownedFor(s, this.owned)]);
  }
  undo(): void { this.look = { ...this.saved }; }

  /** The collection grid position as a movable cursor (the view draws it). */
  private moveCell(dx: number, dy: number, total: number): void {
    const next = this.cell + dx + dy * COLLECTION_COLS;
    if (dy !== 0 && (next < 0)) { this.zone = 'tabs'; return; }
    if (dy > 0 && next >= total) { this.zone = 'footer'; return; }
    this.cell = Math.max(0, Math.min(total - 1, next));
  }

  action(a: HomePanelAction, collectionTotal = 59): WardrobeResult {
    if (a === 'back') return { type: 'close' };
    if (typeof a === 'object' || a === 'backspace') return null;
    const dir = a === 'left' ? -1 : a === 'right' ? 1 : 0;
    if (this.zone === 'tabs') {
      if (dir) this.setTab(WARDROBE_TABS[(WARDROBE_TABS.indexOf(this.tab) + dir + WARDROBE_TABS.length) % WARDROBE_TABS.length]);
      if (a === 'down' || a === 'confirm') this.zone = this.tab === 'collection' || this.rows.length ? 'rows' : 'footer';
      return null;
    }
    if (this.zone === 'rows') {
      if (this.tab === 'collection') {
        if (a === 'left' || a === 'right') this.moveCell(dir, 0, collectionTotal);
        else if (a === 'up' || a === 'down') this.moveCell(0, a === 'up' ? -1 : 1, collectionTotal);
        return null;
      }
      if (dir) this.cycle(this.rows[this.row], dir as 1 | -1);
      else if (a === 'confirm') this.cycle(this.rows[this.row], 1);
      else if (a === 'up') { if (this.row === 0) this.zone = 'tabs'; else this.row--; }
      else if (a === 'down') { if (this.row === this.rows.length - 1) this.zone = 'anim'; else this.row++; }
      return null;
    }
    if (this.zone === 'anim') {
      if (dir) this.anim = PREVIEW_ANIMS[(PREVIEW_ANIMS.indexOf(this.anim) + dir + PREVIEW_ANIMS.length) % PREVIEW_ANIMS.length];
      else if (a === 'up') this.zone = 'rows';
      else if (a === 'down') this.zone = 'footer';
      return null;
    }
    if (dir) this.footer = Math.max(0, Math.min(FOOTER.length - 1, this.footer + dir));
    else if (a === 'up') this.zone = this.tab === 'collection' ? 'rows' : 'anim';
    else if (a === 'confirm') {
      if (this.footer === 0) this.randomize();
      else if (this.footer === 1) this.undo();
      else return { type: 'confirm', look: { ...this.look } };
    }
    return null;
  }
}
