// Boss rush (06 §14.2): sets a freshly loaded stage world up for one fight and places the player inside its arena.
import { fillAbilities } from '../abilities/abilitySystem.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { bossRushFlasks, bossRushLoadout, type BossRushAttempt } from './bossRush.ts';

/** The fight's arena rectangle: the level's boss arena, or its side arena for the Dragon. */
export function bossRushArena(w: GameWorld, a: BossRushAttempt): { x: number; y: number; w: number; h: number } | null {
  const kind = a.fights[a.index].arena;
  const o = w.level?.objects.find((ob) => ob.type === 'arena' && ob.props.kind === kind);
  return o ? { x: o.x, y: o.y, w: o.w, h: o.h } : null;
}

/** Loadout, HP (carried, +50% between fights), full flasks and abilities; no gold or keys; then into the arena. */
export function setupBossRushFight(w: GameWorld, a: BossRushAttempt, maxHp: number): void {
  w.setLoadout(bossRushLoadout(a.cls, a.weapon));
  w.health.maxHp = maxHp; w.health.hp = Math.min(maxHp, a.hp);
  const n = bossRushFlasks(); w.flask = { charges: n, maxCharges: n, fillTenths: 0 };
  w.econ.goldTenths = 0; w.econ.keys = 0;
  fillAbilities(w);
  const r = bossRushArena(w, a);
  if (!r) return;
  // Stand on the floor a little inside the left edge: the first tick fully inside locks the arena (06 §9.1).
  const x = r.x + 48;
  let y = r.y + 16;
  while (y < r.y + r.h && !w.grid.isSolidPx(x, y)) y += 1;
  w.teleportPlayer(x, y);
}
