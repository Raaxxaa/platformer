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
export const STAT_OFFER_COUNT = 3;
export const STAT_PICK_DEFAULT_INDEX = 1;

export type StatUpgradeId = 'vitality' | 'might' | 'quickstep' | 'focus' | 'bloodthirst' | 'precision'
  | 'frenzy' | 'iron_skin' | 'prospector' | 'light_feet' | 'haggler' | 'lucky_charm';
export interface StatUpgradeDef { id: StatUpgradeId; name: string; text: string; value: number; maxStacks: number }
/** 05 §13: table order is part of the seeded offer algorithm. Flask values are in tenths. */
export const STAT_UPGRADES: readonly StatUpgradeDef[] = [
  { id: 'vitality', name: 'Vitality', text: '+20 max HP. Heal by the HP gained.', value: 20, maxStacks: 3 },
  { id: 'might', name: 'Might', text: '+10% weapon and ability damage.', value: 0.10, maxStacks: 3 },
  { id: 'quickstep', name: 'Quickstep', text: '+8% movement speed.', value: 0.08, maxStacks: 3 },
  { id: 'focus', name: 'Focus', text: 'Abilities recharge 15% faster.', value: 0.15, maxStacks: 3 },
  { id: 'bloodthirst', name: 'Bloodthirst', text: '+2% flask fill per kill.', value: 20, maxStacks: 3 },
  { id: 'precision', name: 'Precision', text: '+8% critical hit chance.', value: 0.08, maxStacks: 3 },
  { id: 'frenzy', name: 'Frenzy', text: '+10% attack speed.', value: 0.10, maxStacks: 3 },
  { id: 'iron_skin', name: 'Iron Skin', text: 'Take 12% less damage.', value: 0.88, maxStacks: 3 },
  { id: 'prospector', name: 'Prospector', text: '+25% gold from kills.', value: 25, maxStacks: 3 },
  { id: 'light_feet', name: 'Light Feet', text: 'Dash cooldown is 20% shorter.', value: 0.80, maxStacks: 3 },
  { id: 'haggler', name: 'Haggler', text: 'Buy prices are 15% lower.', value: 0.85, maxStacks: 1 },
  { id: 'lucky_charm', name: 'Lucky Charm', text: 'Lucky Blocks give buffs 70% of the time.', value: 0.70, maxStacks: 1 },
];
