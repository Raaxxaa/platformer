// Tiled 1.10 JSON → LevelData (06 §13.2–13.6) and the world parts the core builds from it.
import { TileGrid, type TileKind } from './tiles.ts';
import { TILE_SIZE } from '../tuning.ts';
import type { EnemyId, EnemySpawn } from '../enemies/types.ts';

export type LevelId = 'plains' | 'mountains' | 'swamps' | 'kingdom' | 'castle' | 'home' | 'crossroads' | 'border' | 'rebel_camp' | 'training_yard';

export interface LevelObject {
  id: number; type: string; x: number; y: number; w: number; h: number;
  points?: { x: number; y: number }[];
  props: Record<string, string | number | boolean>;
}

export interface LevelData {
  id: LevelId; kind: 'stage' | 'village' | 'training'; stage: 0 | 1 | 2 | 3 | 4;
  biome: string; widthTiles: number; heightTiles: number;
  tiles: Uint8Array;           // TileKind index (= gid) per cell, row-major
  objects: LevelObject[];      // ascending id
}

/** gid → TileKind (06 §13.3). */
export const GID_KINDS: readonly TileKind[] = ['empty', 'solid', 'oneway', 'ice', 'water', 'spikeUp', 'spikeDown', 'spikeLeft', 'spikeRight'];
const FLIP_BITS = 0xf0000000;

type Json = Record<string, unknown>;
const asObj = (v: unknown, what: string): Json => {
  if (typeof v !== 'object' || v === null) throw new Error(`loadLevel: ${what} is not an object`);
  return v as Json;
};

function propsOf(list: unknown): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!Array.isArray(list)) return out;
  for (const p of list) {
    const o = asObj(p, 'property');
    out[String(o.name)] = o.value as string | number | boolean;
  }
  return out;
}

export function loadLevel(json: unknown): LevelData {
  const map = asObj(json, 'map');
  const W = Number(map.width), H = Number(map.height);
  const mp = propsOf(map.properties);
  const layers = (map.layers ?? []) as Json[];
  const coll = layers.find((l) => l.name === 'collision');
  if (!coll) throw new Error('loadLevel: no collision layer');
  const data = coll.data as number[];
  if (data.length !== W * H) throw new Error(`loadLevel: collision has ${data.length} cells, expected ${W * H}`);
  const tiles = new Uint8Array(W * H);
  data.forEach((g, i) => {
    if ((g & FLIP_BITS) !== 0 || g < 0) throw new Error(`loadLevel: flip bits on collision cell ${i}`);
    if (g >= GID_KINDS.length) throw new Error(`loadLevel: unknown gid ${g} at cell ${i}`);
    tiles[i] = g;
  });
  const objects: LevelObject[] = [];
  for (const l of layers) {
    if (l.type !== 'objectgroup') continue;
    for (const raw of (l.objects ?? []) as Json[]) {
      const o: LevelObject = {
        id: Number(raw.id), type: String(raw.type), x: Number(raw.x), y: Number(raw.y),
        w: Number(raw.width ?? 0), h: Number(raw.height ?? 0), props: propsOf(raw.properties),
      };
      if (Array.isArray(raw.polyline)) o.points = (raw.polyline as Json[]).map((p) => ({ x: o.x + Number(p.x), y: o.y + Number(p.y) }));
      const isRect = !raw.point && !raw.polyline;
      if (isRect && [o.x, o.y, o.w, o.h].some((v) => v % TILE_SIZE !== 0)) {
        throw new Error(`loadLevel: ${o.type} #${o.id} is not tile-aligned`);
      }
      objects.push(o);
    }
  }
  objects.sort((a, b) => a.id - b.id);
  return {
    id: String(mp.levelId) as LevelId, kind: mp.kind === 'village' ? 'village' : mp.kind === 'training' ? 'training' : 'stage', stage: Number(mp.stage ?? 0) as LevelData['stage'],
    biome: String(mp.biome ?? mp.levelId), widthTiles: W, heightTiles: H, tiles, objects,
  };
}

export function kindAt(d: LevelData, tx: number, ty: number): TileKind {
  if (tx < 0 || ty < 0 || tx >= d.widthTiles || ty >= d.heightTiles) return 'solid';
  return GID_KINDS[d.tiles[ty * d.widthTiles + tx]];
}

export function levelGrid(d: LevelData): TileGrid {
  return new TileGrid(d.widthTiles, d.heightTiles, Array.from(d.tiles, (g) => GID_KINDS[g]));
}

/** A solid body's definition from the level (01 §13, 06 §9). */
export interface SolidBodyDef {
  id: string; objectId: number; type: string;
  x: number; y: number; w: number; h: number;
  oneWay: boolean; grabbable: boolean; noTeleport: boolean; active: boolean;
  arena?: string; role?: string;
}

const BODY_TYPES = new Set(['arena_door', 'timed_door', 'cracked_wall', 'blink_block', 'collapsing_platform']);

/** Enemy spawns from `enemy` objects (wave spawns included; `wave` and `arena` tell them apart). */
export interface LevelEnemySpawn extends EnemySpawn { objectId: number; wave: number; arena: string }

export function buildWorldParts(d: LevelData): { grid: TileGrid; bodies: SolidBodyDef[]; spawns: LevelEnemySpawn[]; objects: LevelObject[] } {
  const bodies: SolidBodyDef[] = [];
  const spawns: LevelEnemySpawn[] = [];
  for (const o of d.objects) {
    if (BODY_TYPES.has(o.type)) {
      const role = o.props.role as string | undefined;
      // Combat-arena doors and boss entry doors start open; boss exit doors and timed doors start closed (06 §9).
      const active = o.type === 'arena_door' ? role === 'exit' : true;
      bodies.push({
        id: String(o.props.id ?? `${o.type}#${o.id}`), objectId: o.id, type: o.type, x: o.x, y: o.y, w: o.w, h: o.h,
        oneWay: o.props.oneWay === true, grabbable: o.type === 'cracked_wall' || o.type === 'collapsing_platform',
        noTeleport: o.type === 'arena_door' || o.type === 'timed_door' || o.type === 'blink_block',
        active, arena: o.props.arena as string | undefined, role,
      });
    } else if (o.type === 'enemy') {
      spawns.push({
        enemy: String(o.props.enemy) as EnemyId, x: o.x, y: o.y, facing: Number(o.props.facing ?? 1) >= 0 ? 1 : -1,
        patrol: Number(o.props.patrol ?? 0), group: String(o.props.group ?? '') || undefined,
        objectId: o.id, wave: Number(o.props.wave ?? 0), arena: String(o.props.arena ?? ''),
      });
    }
  }
  return { grid: levelGrid(d), bodies, spawns, objects: d.objects };
}
