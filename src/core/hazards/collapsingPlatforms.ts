import type { LevelObject } from '../level/loadLevel.ts';
import type { TileGrid } from '../level/tiles.ts';
import type { Bodies, SolidBody } from '../physics/bodies.ts';
import { isGrounded, type AABBBody } from '../physics/collide.ts';
import type { MinecartState } from '../player/minecart.ts';
import { setState, type MoveEvent, type PlayerBody } from '../player/body.ts';
import { TERRAIN, ticks } from '../tuning.ts';
export interface CollapsingPlatform {
  id: string;
  delayTicks: number;
  respawnTicks: number;
  remaining: number;
  state: 'ready' | 'shaking' | 'collapsed';
  visualTicks: number;
}
export function buildCollapsingPlatforms(objects: readonly LevelObject[]): CollapsingPlatform[] {
  return objects.filter((o) => o.type === 'collapsing_platform').map((o) => ({
    id: String(o.props.id ?? `${o.type}#${o.id}`), delayTicks: ticks(Number(o.props.collapseDelay ?? TERRAIN.COLLAPSE_DELAY)),
    respawnTicks: ticks(Number(o.props.respawnTime ?? TERRAIN.COLLAPSE_RESPAWN)), remaining: 0, state: 'ready', visualTicks: 0,
  }));
}
const supports = (s: SolidBody, b: AABBBody) => b.y === s.y && b.x + b.w / 2 > s.x && b.x - b.w / 2 < s.x + s.w;
const overlaps = (s: SolidBody, b: AABBBody) => b.x + b.w / 2 > s.x && b.x - b.w / 2 < s.x + s.w && b.y > s.y && b.y - b.h < s.y + s.h;
export function stepCollapsingPlatforms(platforms: CollapsingPlatform[], bodies: Bodies, grid: TileGrid, player: PlayerBody, carts: readonly MinecartState[], worldTimeScale: number, diveLanded: boolean): MoveEvent[] {
  const events: MoveEvent[] = [];
  for (const p of platforms) {
    const body = bodies.get(p.id);
    if (!body)
      continue;
    const supported = player.state !== 'dead' && player.cartId === null && supports(body, player) && player.grounded;
    const cartSupported = carts.some((c) => c.active && c.grounded && supports(body, c));
    if (p.state === 'collapsed') {
      p.visualTicks = Math.max(0, p.visualTicks - worldTimeScale);
      if (p.respawnTicks === 0)
        continue;
      p.remaining -= worldTimeScale;
      if (p.remaining <= 0 && !overlaps(body, player) && !carts.some((c) => c.active && overlaps(body, c))) {
        bodies.setActive(p.id, true);
        p.state = 'ready';
      }
      continue;
    }
    const dive = supported && diveLanded;
    if (p.state === 'ready' && (supported || cartSupported)) {
      p.state = 'shaking';
      p.remaining = p.delayTicks;
      events.push('platformShake');
      if (!dive)
        continue;
    }
    else if (p.state === 'shaking')
      p.remaining -= worldTimeScale;
    if (p.state === 'shaking' && (dive || p.remaining <= 0)) {
      p.state = 'collapsed';
      p.remaining = p.respawnTicks;
      p.visualTicks = TERRAIN.COLLAPSE_VISUAL_TICKS;
      bodies.setActive(p.id, false);
      events.push('platformCollapse');
      if (supported && !isGrounded(player, grid, 0)) {
        player.grounded = false;
        player.coyoteValid = true;
        player.lastGroundPt = player.pt;
        setState(player, 'air', 0);
      }
      for (const c of carts)
        if (c.active && supports(body, c)) {
          c.grounded = false;
          c.coyoteValid = true;
          c.lastGroundTick = c.tick;
        }
    }
  }
  return events;
}
