// Interact prompts over objects (07 §5.7) and the merchant altar line (§6.4). Pure; WorldScene draws it.
import type { Interactable } from '../../core/abilities/items.ts';
import { MERCHANT_LAYOUT } from '../../core/loot/merchant.ts';
import type { GameWorld } from '../../core/sim/gameWorld.ts';
import { ABILITY_INFO } from '../../data/abilities.ts';
import { CURSE_KILLS } from '../../data/loot.ts';
import { PRICES } from '../../data/economy.ts';
import { upgradePrice } from '../../core/loot/merchant.ts';
import { actionLabel } from '../inputSettings.ts';

export interface Prompt { l1: string; l2?: string; tone: 'text' | 'textDim' | 'textOff' | 'curse'; glyph: boolean }

export function interactPrompt(w: GameWorld, t: Interactable): Prompt | null {
  switch (t.kind) {
    case 'inn': return { l1: 'Choose road and sleep', l2: 'Restores all HP (not the flask)', tone: 'text', glyph: true };
    case 'ability_altar': {
      const s = w.abilities.slots[Number(t.label)];
      if (!s) return { l1: 'No ability', tone: 'textOff', glyph: false };
      const first = s.level >= MERCHANT_LAYOUT.maxLevel ? 'MAX' : `Upgrade ${ABILITY_INFO[s.id].name} Lv ${s.level} → ${s.level + 1} (${upgradePrice(w, s.level + 1)})`;
      return { l1: first, l2: `Hold [${actionLabel('interact')}]: sell for ${PRICES.sell[s.level as keyof typeof PRICES.sell]}`, tone: s.level >= MERCHANT_LAYOUT.maxLevel ? 'textDim' : 'text', glyph: true };
    }
    case 'shop_flask': return { l1: 'Flask +1 charge', tone: 'text', glyph: true };
    case 'shop_refill': return { l1: 'Refill flask', tone: 'text', glyph: true };
    case 'shop_key': return { l1: 'Buy a key', tone: 'text', glyph: true };
    case 'shop_reroll': return { l1: 'Reroll items', tone: 'text', glyph: true };
    case 'key_chest': {
      const pick = w.classState.hybrid === 'thief' && !w.abilities.lockpickUsedThisStage;
      if (pick) return { l1: 'Pick lock', tone: 'text', glyph: true };
      return w.econ.keys > 0 ? { l1: 'Open (1 key)', tone: 'text', glyph: true } : { l1: 'Locked', tone: 'textDim', glyph: false };
    }
    case 'cursed_chest': return { l1: 'Open', l2: `Cursed: one-hit death for ${CURSE_KILLS} kills`, tone: 'curse', glyph: true };
    case 'timed_chest': return { l1: 'Open', tone: 'text', glyph: true };
    case 'merchant_altar': {
      const s = w.abilities.slots[Number(t.label)];
      if (!s) return { l1: 'No ability', tone: 'textOff', glyph: false };
      if (s.level >= MERCHANT_LAYOUT.maxLevel) return { l1: 'MAX', tone: 'textDim', glyph: false };
      return { l1: `Upgrade ${ABILITY_INFO[s.id].name} Lv ${s.level} → ${s.level + 1} (${upgradePrice(w, s.level + 1)})`, tone: 'text', glyph: true };
    }
    default: return null;
  }
}

/** The one word on the touch Interact button for objects that have no prompt of their own (07 §8.6). */
const WORD: Record<string, string> = {
  class_statue: 'Choose', ability_altar: 'Upgrade', merchant_altar: 'Upgrade', shop_item: 'Buy', shop_flask: 'Buy', shop_refill: 'Buy', shop_key: 'Buy', shop_reroll: 'Reroll',
  inn: 'Sleep', seed_board: 'Seed', unlocks_board: 'Records', training_gate: 'Enter', checklist_board: 'Read', minecart: 'Ride', mirror_spot: 'Look',
};
export const interactWord = (kind: string): string => WORD[kind] ?? 'Use';
