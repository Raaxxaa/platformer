// Player projectiles (02 §10.4). All are kind `shot`. M4 has the Bow, Crossbow and Staff ones.
import type { ProjectileDef, ProjectileId } from '../core/combat/types.ts';

const shot = (damage: number, kb: [number, number], poise: number, hitStop: number, extra: { charged?: boolean } = {}) =>
  ({ damage, kb, poise, hitStop, kind: 'shot' as const, ...extra });

export const PLAYER_PROJECTILES: Partial<Record<ProjectileId, ProjectileDef>> = {
  arrow: { id: 'arrow', speed: 600, range: 320, w: 12, h: 4, gravity: 0, pierce: 0, onWall: 'vanish', hit: shot(12, [80, -10], 8, 0.025) },
  arrow_charged: { id: 'arrow_charged', speed: 800, range: 480, w: 16, h: 4, gravity: 0, pierce: Infinity, onWall: 'vanish', hit: shot(32, [160, -20], 25, 0.05, { charged: true }) },
  bolt: { id: 'bolt', speed: 720, range: 400, w: 14, h: 4, gravity: 0, pierce: 0, onWall: 'vanish', hit: shot(29, [280, -40], 30, 0.05) },
  staff_bolt: { id: 'staff_bolt', speed: 480, range: 280, w: 8, h: 8, gravity: 0, pierce: 0, onWall: 'vanish', hit: shot(13, [60, -10], 8, 0.025) },
  // SPEC-GAP: 02 §10.4 does not say whether the cannonball is `heavy`; it is not (the crossbow bolt is not either).
  cannonball: { id: 'cannonball', speed: 520, range: 360, w: 10, h: 10, gravity: 0, pierce: 0, onWall: 'explode', explodeOnEnemy: true, blast: { w: 56, h: 56 }, hit: shot(30, [260, -120], 35, 0.075) },
  // `lifetime` is seconds; the javelin sticks into a wall it hits flying sideways (02 §10.5), else vanishes.
  javelin: { id: 'javelin', speed: 560, range: Infinity, lifetime: 1.5, w: 20, h: 4, gravity: 300, pierce: 1, onWall: 'stick', hit: shot(25, [200, -40], 30, 0.05) },
  knife: { id: 'knife', speed: 640, range: 240, w: 8, h: 4, gravity: 0, pierce: 0, onWall: 'vanish', hit: shot(5, [40, 0], 4, 0.025) },
  wand_shot: { id: 'wand_shot', speed: 420, range: 240, w: 6, h: 6, gravity: 0, pierce: 0, onWall: 'vanish', hit: shot(10, [40, 0], 5, 0.025), homing: { radius: 96, turnRate: 180 } },
  // S-grade signature shots (02 §13). SPEC-GAP: the spec gives no knockback for these; they push a little along their path.
  skewer: { id: 'skewer', speed: 640, range: 160, w: 32, h: 8, gravity: 0, pierce: Infinity, onWall: 'vanish', hit: shot(18, [120, -20], 15, 0.05) },
  soul: { id: 'soul', speed: 300, range: Infinity, lifetime: 2.0, w: 10, h: 10, gravity: 0, pierce: 0, onWall: 'vanish', hit: shot(20, [80, -20], 10, 0.05), homing: { radius: 160, turnRate: 360 } },
  // The shield's reflected shot (02 §12): speed is set when it is reflected (1.5× the enemy shot's).
  reflected: { id: 'reflected', speed: 0, range: 320, w: 8, h: 8, gravity: 0, pierce: 0, onWall: 'vanish', hit: shot(24, [120, -20], 20, 0.05) },
  orb: { id: 'orb', speed: 300, range: 320, w: 14, h: 14, gravity: 0, pierce: 0, onWall: 'explode', explodeOnEnemy: true, blast: { w: 80, h: 80 }, hit: shot(40, [220, -120], 40, 0.075, { charged: true }) },
};

/** 02 §9.8 spawn point from the feet, facing right. */
export const PROJECTILE_SPAWN = { dx: 12, dy: -18 } as const;
