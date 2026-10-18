// Gold (05 §9): integer tenths, kill gold, Leaky Pockets coins. Keys are in keys.ts.
import type { CurseId, LuckyId } from '../../data/loot.ts';
import { GOLD, type StatUpgradeId } from '../../data/economy.ts';
import { playerRect } from '../combat/resolve.ts';
import { overlaps } from '../combat/hitGroups.ts';
import { moveX, moveY } from '../physics/collide.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { TICK, ticks } from '../tuning.ts';

export interface EconomyState {
  goldTenths: number; keys: number;
  buffs: LuckyId[];
  debuffs: { id: LuckyId; ticksLeft: number }[];
  curse: { id: CurseId; killsLeft: number } | null;
  secondWindUsed: boolean;
  statStacks: Partial<Record<StatUpgradeId, number>>;
}
export const newEconomy = (): EconomyState => ({ goldTenths: 0, keys: 0, buffs: [], debuffs: [], curse: null, secondWindUsed: false, statStacks: {} });

export interface Coin { id: number; x: number; y: number; vx: number; vy: number; value: number; born: number; resting: boolean }
export const COIN_SIZE = 6;

/** §9.1: shown gold = floor(tenths / 10), at most 9999 (the rest is lost). */
export function addGoldTenths(w: GameWorld, tenths: number, reason: string): void {
  if (tenths === 0) return;
  const before = w.econ.goldTenths;
  w.econ.goldTenths = Math.max(0, Math.min(GOLD.maxShown * 10 + 9, w.econ.goldTenths + tenths));
  w.run.goldEarnedTenths += Math.max(0, w.econ.goldTenths - before);
  w.run.stats.goldEarned = Math.floor(w.run.goldEarnedTenths / 10);
  w.events.push({ t: 'goldChanged', tenths, reason });
}

/** §9.3: floor((gold × 10 × rushPct × gt × bonusPct + 5000) / 10000). */
export function killGoldTenths(o: { gold: number; rushLevel: number; goldenTouch: boolean; prospector: number; greedy: boolean }): number {
  const rushPct = GOLD.rushPct[o.rushLevel];
  const gt = o.goldenTouch ? 2 : 1;
  const bonusPct = 100 + GOLD.prospectorPct * o.prospector + (o.greedy ? GOLD.greedyPct : 0);
  return Math.floor((o.gold * 10 * rushPct * gt * bonusPct + 5000) / 10000);
}

/** §9.4: lost = min(shown, max(5, floor(shown × 0.10))) as up to 8 coins from the player's center. */
export function dropLeakyCoins(w: GameWorld): void {
  const shown = w.gold;
  const lost = Math.min(shown, Math.max(GOLD.leakyMin, Math.floor(shown * GOLD.leakyPct)));
  if (lost <= 0) return;
  addGoldTenths(w, -lost * 10, 'leaky');
  const n = Math.min(GOLD.coinsMax, Math.ceil(lost / GOLD.coinSplit));
  const b = w.body;
  for (let i = 0; i < n; i++) {
    const value = Math.floor(lost / n) + (i < lost % n ? 1 : 0);
    const vx = n === 1 ? 0 : -GOLD.coinVx + (2 * GOLD.coinVx * i) / (n - 1);
    w.coins.push({ id: w.newId(), x: b.x, y: b.y - b.h / 2, vx, vy: GOLD.coinVy, value, born: w.tick, resting: false });
  }
}

/** Coins fall, stop on floors, are collected after 0.40 s by the hurtbox grown 8 px, and vanish at 5.0 s. */
export function stepCoins(w: GameWorld): void {
  const pr = playerRect(w), g = GOLD.coinGrow;
  const grown = { x: pr.x - g, y: pr.y - g, w: pr.w + 2 * g, h: pr.h + 2 * g };
  w.coins = w.coins.filter((c) => {
    const age = w.tick - c.born;
    if (age >= ticks(GOLD.coinLifeS)) return false;
    if (!c.resting) {
      const box = { x: c.x, y: c.y, w: COIN_SIZE, h: COIN_SIZE, remX: 0, remY: 0 };
      c.vy = Math.min(400, c.vy + GOLD.coinGravity * TICK);
      if (c.vx !== 0 && moveX(box, w.grid, c.vx * TICK, false) === 'wall') c.vx = 0;
      if (moveY(box, w.grid, c.vy * TICK, { dropping: false, preferDir: 0 }) === 'landed') { c.vx = 0; c.vy = 0; c.resting = true; }
      c.x = box.x; c.y = box.y;
    }
    const r = { x: c.x - COIN_SIZE / 2, y: c.y - COIN_SIZE, w: COIN_SIZE, h: COIN_SIZE };
    if (age >= ticks(GOLD.coinCollectS) && overlaps(r, grown)) { addGoldTenths(w, c.value * 10, 'coin'); return false; }
    return true;
  });
}
