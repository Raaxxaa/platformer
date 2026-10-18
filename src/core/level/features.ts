import { TERRAIN } from '../tuning.ts';
import type { LevelObject } from './loadLevel.ts';
export interface GrapplePoint {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface DarkZone {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  lightRadius: number;
}
export interface Firefly {
  id: number;
  x: number;
  y: number;
  radius: number;
}
/** Visual data has no collision or gameplay effect. Task6 draws it (06 §13). */
export function buildLevelFeatures(objects: readonly LevelObject[]): {
  grapplePoints: GrapplePoint[];
  darkZones: DarkZone[];
  fireflies: Firefly[];
} {
  return {
    grapplePoints: objects.filter((o) => o.type === 'grapple_point').map((o) => ({ id: o.id, x: o.x, y: o.y, w: TERRAIN.GRAPPLE_SIZE, h: TERRAIN.GRAPPLE_SIZE })),
    darkZones: objects.filter((o) => o.type === 'dark_zone').map((o) => ({ id: o.id, x: o.x, y: o.y, w: o.w, h: o.h, lightRadius: Number(o.props.lightRadius ?? TERRAIN.DARK_LIGHT_RADIUS) })),
    fireflies: objects.filter((o) => o.type === 'firefly').map((o) => ({ id: o.id, x: o.x, y: o.y, radius: Number(o.props.radius ?? TERRAIN.FIREFLY_RADIUS) })),
  };
}
