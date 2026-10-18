// Village shop policy (05 §10, 06 §12.2). Prices/caps stay in economy.ts and tuning.ts.
import { ticks } from '../core/tuning.ts';
export const SHOP_RULES = {
  defaultVillageIndex: 1, slots: 3, abilityChance: 0.40, keyChance: 0.50,
  altarHoldTicks: ticks(0.75), altarRingStartTicks: ticks(0.10),
  altarStates: ['ground', 'crawl'],
} as const;
