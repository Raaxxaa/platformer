// Gold and prices from 05 §9, §11, §12.
export const PRICES = {
  weapon: { F: 40, C: 80, B: 160, A: 320, S: 640 }, abilityBuy: 120,
  upgradeTo: { 2: 100, 3: 175, 4: 275, 5: 400 } as Record<number, number>, sell: { 1: 60, 2: 110, 3: 200, 4: 335, 5: 535 },
  flaskUpgrade: 300, flaskRefill: 250, key: 150, rerollBase: 50, rerollStep: 50,
  merchantMarkupPct: 125, hagglerPct: 85,
} as const;
export const CHEST_GOLD = { key: 40, timed: 80, cursed: 100 } as const;
/** §9.1, §9.3, §9.4, §6, §12. */
export const GOLD = {
  maxShown: 9999, rushPct: [100, 110, 120, 130], greedyPct: 50, prospectorPct: 25,
  leakyPct: 0.10, leakyMin: 5, coinsMax: 8, coinSplit: 5, coinVx: 150, coinVy: -260, coinGravity: 1500,
  coinCollectS: 0.40, coinLifeS: 5.0, coinBlinkS: 1.0, coinGrow: 8,
} as const;
export const KEYS_MAX = 3;
export const MERCHANT_CHANCE = 0.40;
