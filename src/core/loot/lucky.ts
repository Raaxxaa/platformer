// Lucky Blocks (05 §7) and curses (05 §8): the roll, every buff and debuff, timers, Ambush packs, the curse counter.
import { dropItem } from '../abilities/items.ts';
import { overlaps, type Rect } from '../combat/hitGroups.ts';
import { isGrounded } from '../physics/collide.ts';
import type { EnemyId } from '../enemies/types.ts';
import { enemyRect } from '../enemies/enemy.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { ENEMY } from '../tuning.ts';
import { AMBUSH, AMBUSH_PACKS, FIXED_ODDS, LUCKY, LUCKY_BUFF_CHANCE, LUCKY_FX, type LuckyDef, type LuckyId } from '../../data/loot.ts';
import { ENEMIES } from '../../data/enemies.ts';
import { addPlayerStatSource } from './perks.ts';
import { pick, sourceRng, type Rng } from './pick.ts';
import { rollWeapon } from './roll.ts';
import { statCount } from '../economy/stats.ts';

export interface LuckyBlock { objectId: number; x: number; y: number; broken: boolean }
/** Lucky Block box: 16 × 16 centred on its point (08 sprite size). */
export const LUCKY_SIZE = 16;
export const luckyRect = (b: LuckyBlock): Rect => ({ x: b.x - LUCKY_SIZE / 2, y: b.y - LUCKY_SIZE / 2, w: LUCKY_SIZE, h: LUCKY_SIZE });

const DEF = Object.fromEntries(LUCKY.map((l) => [l.id, l])) as Record<LuckyId, LuckyDef>;
export const hasBuff = (w: GameWorld, id: LuckyId) => w.econ.buffs.includes(id);
export const hasDebuff = (w: GameWorld, id: LuckyId) => w.econ.debuffs.some((d) => d.id === id);

/** §7.1: draw 1 buff or debuff, draw 2 among the eligible entries (active buffs are not eligible; Jackpot always is). */
export function rollLucky(rng: Rng, activeBuffs: readonly LuckyId[], luckyCharm: boolean): LuckyDef {
  const buff = rng() < (luckyCharm ? LUCKY_BUFF_CHANCE.luckyCharm : LUCKY_BUFF_CHANCE.base);
  const pool = LUCKY.filter((l) => (buff ? l.kind === 'buff' && (l.id === 'jackpot' || !activeBuffs.includes(l.id)) : l.kind === 'debuff'));
  return pick(pool.map((l) => [l, l.weight] as const), rng);
}

/** Starts an effect on this tick. (x, y) is the block (Jackpot pops out there). */
export function applyLucky(w: GameWorld, id: LuckyId, x: number, y: number, objectId = 0): void {
  const d = DEF[id];
  w.events.push({ t: 'luckyResult', id });
  if (id === 'jackpot') {
    const rng = sourceRng(w.runSeed, 'loot', w.level?.id ?? 'test', objectId);
    dropItem(w, x, y, { weapon: rollWeapon(rng, FIXED_ODDS.jackpot, w.classState.carriedClasses) });
    return;
  }
  if (id === 'ambush') { spawnAmbush(w); return; }
  if (d.kind === 'buff') {
    if (!w.econ.buffs.includes(id)) w.econ.buffs.push(id);
    if (id === 'overdrive') { w.rush.floor = LUCKY_FX.overdriveFloor; w.rush.value = Math.max(w.rush.value, LUCKY_FX.overdriveFloor); }
    return;
  }
  const ticksLeft = d.duration as number;
  const cur = w.econ.debuffs.find((x) => x.id === id);
  if (cur) cur.ticksLeft = ticksLeft;                        // re-rolled: back to 45.0 s, keeps its place
  else w.econ.debuffs.push({ id, ticksLeft });
}

/** Each stage tick (hit-stop included): debuff timers. */
export function stepLucky(w: GameWorld): void {
  for (const d of w.econ.debuffs) d.ticksLeft -= 1;
  w.econ.debuffs = w.econ.debuffs.filter((d) => d.ticksLeft > 0);
}

/** §7.5: the biome's pack around the player, aware, with the 0.5 s spawn-in. */
function spawnAmbush(w: GameWorld): void {
  const pack = AMBUSH_PACKS[w.level?.id ?? 'plains'] ?? AMBUSH_PACKS.plains;
  const b = w.body, cam = w.camera.target;
  pack.forEach((id: EnemyId, i: number) => {
    const def = ENEMIES[id];
    if (!def) return;
    const place = (dx: number): number | null => {
      const x = Math.min(cam.x + cam.w - AMBUSH.inset, Math.max(cam.x + AMBUSH.inset, b.x + dx));
      for (let y = b.y - AMBUSH.above; y <= b.y + AMBUSH.below; y++) {
        const box = { x, y, w: def.hurtbox.w, h: def.hurtbox.h, remX: 0, remY: 0 };
        const free = !w.grid.isSolidPx(Math.floor(x), y - 1) && !w.grid.isSolidPx(Math.floor(x - def.hurtbox.w / 2), y - def.hurtbox.h)
          && !w.grid.isSolidPx(Math.floor(x + def.hurtbox.w / 2 - 1), y - def.hurtbox.h);
        if (free && isGrounded(box, w.grid, 0)) return y;
      }
      return null;
    };
    let dx: number = AMBUSH.dx[i], y = place(dx);
    if (y === null) { dx = -dx; y = place(dx); }
    if (y === null) return;
    const x = Math.min(cam.x + cam.w - AMBUSH.inset, Math.max(cam.x + AMBUSH.inset, b.x + dx));
    const e = w.spawnExtra({ enemy: id, x, y, facing: x > b.x ? -1 : 1 });
    e.spawnInTicks = ENEMY.SPAWN_IN_TICKS;
    e.aware = true;
  });
}

/** A Lucky Block breaks on a weapon direct hit (dives and the thrown hammer included), once (05 §7.1). */
export function breakLucky(w: GameWorld, b: LuckyBlock): void {
  if (b.broken) return;
  b.broken = true;
  const rng = sourceRng(w.runSeed, 'lucky', w.level?.id ?? 'test', b.objectId);
  const r = rollLucky(rng, w.econ.buffs, statCount(w, 'lucky_charm') > 0);
  w.run.stats.luckyBlocksBroken += 1;
  w.events.push({ t: 'luckyBroken', objectId: b.objectId });
  applyLucky(w, r.id, b.x, b.y, b.objectId);
}

/** Step 7a (after enemies): player weapon groups that touch an unbroken block break it, in ascending object id. */
export function hitLuckyBlocks(w: GameWorld): void {
  if (!w.luckyBlocks.length) return;
  for (const b of [...w.luckyBlocks].sort((a, c) => a.objectId - c.objectId)) {
    if (b.broken) continue;
    const r = luckyRect(b);
    if (w.hitGroups.some((g) => g.owner === 'player' && g.active && g.ability === undefined && g.slot !== undefined && overlaps(g.rect, r))) breakLucky(w, b);
  }
}

/** 05 §8: a player kill lowers the curse counter; at 0 it lifts. */
export function onCurseKill(w: GameWorld): void {
  const c = w.econ.curse;
  if (!c) return;
  c.killsLeft -= 1;
  if (c.killsLeft <= 0) { w.econ.curse = null; w.events.push({ t: 'curseLifted' }); }
}

/** Butterfingers: slot 2 is locked (05 §7.3). */
export const slot2Locked = (w: GameWorld) => hasDebuff(w, 'butterfingers');

/** Second Wind (05 §7.2): HP to half max, 2.0 s invulnerable instead of the hurt i-frames; used up. */
export function trySecondWind(w: GameWorld): boolean {
  if (!hasBuff(w, 'second_wind')) return false;
  w.econ.buffs = w.econ.buffs.filter((b) => b !== 'second_wind');
  w.health.hp = Math.round(LUCKY_FX.secondWindHpFrac * w.health.maxHp);
  return true;
}

addPlayerStatSource({
  speed: (w) => (hasBuff(w, 'swift') ? LUCKY_FX.swiftSpeed : 0) + (hasDebuff(w, 'heavy') ? LUCKY_FX.heavySpeed : 0),
  incoming: (w) => (hasDebuff(w, 'glass_bones') ? LUCKY_FX.glassBonesMult : 1),
  dashMult: (w) => (hasDebuff(w, 'jammed') ? LUCKY_FX.jammedDashMult : 1),
});
void enemyRect;
