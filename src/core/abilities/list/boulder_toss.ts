// Boulder Toss (03 §9.4): a lobbed boulder that breaks on its first enemy or terrain; Lv5 shatters into 4 shards.
import type { HitGroup } from '../../combat/hitGroups.ts';
import type { GameWorld } from '../../sim/gameWorld.ts';
import { TICK, ticks } from '../../tuning.ts';
import { ABILITY } from '../../../data/abilities.ts';
import { registerAbility } from '../abilitySystem.ts';
import type { AbilityEntity } from '../entities.ts';
import { abilityHit, addAbilityGroup, newInstance } from '../helpers.ts';

const A = ABILITY.boulderToss;

export interface LobEntity extends AbilityEntity {
  kind: 'boulder' | 'boulder_shard'; x: number; y: number; vx: number; vy: number; size: number; left: number;
  /** The enemy it hit, if any. */
  hitId: number | null;
}

export function lobs(w: GameWorld, kind: LobEntity['kind']): LobEntity[] {
  return w.abilityEntities.filter((e): e is LobEntity => e.kind === kind);
}

/** Is any corner, edge midpoint or the center of the box inside a solid tile? (One-way platforms are not tiles: it passes them.) */
function blocked(w: GameWorld, cx: number, cy: number, size: number): boolean {
  const h = size / 2;
  for (const dx of [-h, 0, h - 1]) for (const dy of [-h, 0, h - 1]) {
    if (w.grid.isSolidPx(Math.floor(cx + dx), Math.floor(cy + dy))) return true;
  }
  return false;
}

/** One lobbed thing: moves under gravity, owns one hit group, breaks on its first enemy, terrain or timeout. */
function spawnLob(w: GameWorld, kind: LobEntity['kind'], x: number, y: number, vx: number, vy: number, size: number, lifeS: number,
  group: HitGroup, onBreak: (ww: GameWorld, e: LobEntity) => void): void {
  const e: LobEntity = {
    id: w.newId(), kind, x, y, vx, vy, size, left: ticks(lifeS), hitId: null,
    step: (ww) => {
      if (e.hitId !== null) { onBreak(ww, e); return false; }                // broke on an enemy during the last hit step
      e.vy += A.gravity * TICK;
      const nx = e.x + e.vx * TICK, ny = e.y + e.vy * TICK;
      if (blocked(ww, nx, ny, size)) { group.active = false; onBreak(ww, e); return false; }   // terrain: breaks at the last free spot
      e.x = nx; e.y = ny;
      group.rect = { x: e.x - size / 2, y: e.y - size / 2, w: size, h: size };
      e.left -= 1;
      if (e.left <= 0) { group.active = false; return false; }              // timeout: no shards
      return true;
    },
    view: () => ({ x: e.x, y: e.y, size }),
  };
  group.onHit = (_ww, g, en) => { e.hitId = en.id; g.active = false; };
  w.abilityEntities.push(e);
}

registerAbility('boulder_toss', {
  effect(w, c) {
    const b = w.body, f = b.facing, size = c.row.sizePx as number, shards = c.row.shards as number;
    const x = b.x + A.spawn.dx * f, y = b.y + A.spawn.dy;
    const g = addAbilityGroup(w, c, abilityHit(c, 'boulder', c.row.damage as number), { x: x - size / 2, y: y - size / 2, w: size, h: size }, newInstance(w), { dir: f });
    spawnLob(w, 'boulder', x, y, f * A.vx, A.vy, size, A.lifeS, g, (ww, e) => {
      for (let k = 0; k < shards; k++) {
        const [vx, vy] = A.shardV[k];
        const sg = addAbilityGroup(ww, c, abilityHit(c, 'shard', A.shardDamage), { x: e.x - A.shardSize / 2, y: e.y - A.shardSize / 2, w: A.shardSize, h: A.shardSize }, newInstance(ww), { dir: vx < 0 ? -1 : 1 });
        if (e.hitId !== null) sg.lastHitTick.set(e.hitId, ww.tick);        // shards never hit the enemy the boulder hit
        spawnLob(ww, 'boulder_shard', e.x, e.y, vx, vy, A.shardSize, A.shardLifeS, sg, () => undefined);
      }
    });
  },
});
