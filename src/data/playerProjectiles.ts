// Player projectiles (02 §10.4). All are kind `shot`. M4 has the Bow, Crossbow and Staff ones.
import type { ProjectileDef, ProjectileId } from '../core/combat/types.ts';

const shot = (damage: number, kb: [number, number], poise: number, hitStop: number, extra: { charged?: boolean } = {}) =>
  ({ damage, kb, poise, hitStop, kind: 'shot' as const, ...extra });

export const PLAYER_PROJECTILES: Partial<Record<ProjectileId, ProjectileDef>> = {
  arrow: { id: 'arrow', speed: 600, range: 320, w: 12, h: 4, gravity: 0, pierce: 0, onWall: 'vanish', hit: shot(12, [80, -10], 8, 0.025) },
  arrow_charged: { id: 'arrow_charged', speed: 800, range: 480, w: 16, h: 4, gravity: 0, pierce: Infinity, onWall: 'vanish', hit: shot(32, [160, -20], 25, 0.05, { charged: true }) },
  bolt: { id: 'bolt', speed: 720, range: 400, w: 14, h: 4, gravity: 0, pierce: 0, onWall: 'vanish', hit: shot(29, [280, -40], 30, 0.05) },
  staff_bolt: { id: 'staff_bolt', speed: 480, range: 280, w: 8, h: 8, gravity: 0, pierce: 0, onWall: 'vanish', hit: shot(13, [60, -10], 8, 0.025) },
  orb: { id: 'orb', speed: 300, range: 320, w: 14, h: 14, gravity: 0, pierce: 0, onWall: 'explode', explodeOnEnemy: true, blast: { w: 80, h: 80 }, hit: shot(40, [220, -120], 40, 0.075, { charged: true }) },
};

/** 02 §9.8 spawn point from the feet, facing right. */
export const PROJECTILE_SPAWN = { dx: 12, dy: -18 } as const;
