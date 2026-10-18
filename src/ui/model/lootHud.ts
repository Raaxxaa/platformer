// Loot HUD text (07 §4.7 effects row, §6.8 banners, §6.10 toasts, §9.3 lines). Pure; the HUD views draw it.
import type { EconomyState } from '../../core/economy/gold.ts';
import type { WorldEvent } from '../../core/sim/gameWorld.ts';
import { TICK_RATE } from '../../core/tuning.ts';
import { LUCKY, type CurseId, type LuckyId } from '../../data/loot.ts';
import { CURSE_LINE, LUCKY_LINE, LOOT_HUD } from '../../data/uiText.ts';

export type LootTone = 'good' | 'bad' | 'curse' | 'S' | 'text' | 'textDim' | 'highlight';
export interface EffectBox { icon: string; label: string; tone: 'good' | 'bad' | 'curse'; blink: boolean }

export const debuffLabel = (ticksLeft: number) => String(Math.ceil(ticksLeft / TICK_RATE));

/** §4.7: the curse first, then debuffs in first-applied order, then buffs in the order gained. */
export function effectsRow(e: EconomyState): EffectBox[] {
  const out: EffectBox[] = [];
  if (e.curse) out.push({ icon: `effect_curse_${e.curse.id}`, label: String(e.curse.killsLeft), tone: 'curse', blink: false });
  for (const d of e.debuffs) out.push({ icon: `effect_${d.id}`, label: debuffLabel(d.ticksLeft), tone: 'bad', blink: d.ticksLeft <= LOOT_HUD.debuffBlinkS * TICK_RATE });
  for (const b of e.buffs) if (b !== 'jackpot' && b !== 'ambush') out.push({ icon: `effect_${b}`, label: '', tone: 'good', blink: false });
  return out;
}

export interface Banner { l1: string; l2: string; tone: LootTone; s: number }
const kindOf = (id: LuckyId) => LUCKY.find((l) => l.id === id)!;

/** §6.8 loot banners. */
export function bannerFor(ev: WorldEvent): Banner | null {
  const S = LOOT_HUD.bannerS;
  if (ev.t === 'enterVillage' && ev.villageId !== 'home') return { l1: ({ crossroads: 'CROSSROADS VILLAGE', border: 'BORDER VILLAGE', rebel_camp: 'REBEL CAMP' } as Record<string, string>)[ev.villageId] ?? ev.villageId.toUpperCase(), l2: 'Shop, then sleep at the inn', tone: 'text', s: S.village };
  if (ev.t === 'luckyResult') {
    const d = kindOf(ev.id);
    if (ev.id === 'jackpot') return { l1: 'JACKPOT!', l2: LUCKY_LINE.jackpot, tone: 'S', s: S.lucky };
    return { l1: d.name.toUpperCase(), l2: LUCKY_LINE[ev.id], tone: d.kind === 'buff' ? 'good' : 'bad', s: S.lucky };
  }
  if (ev.t === 'curseApplied') return { l1: 'CURSED', l2: CURSE_LINE[ev.id as CurseId] ?? '', tone: 'curse', s: S.curse };
  if (ev.t === 'curseLifted') return { l1: 'CURSE LIFTED', l2: '', tone: 'good', s: S.lifted };
  return null;
}

export interface Toast { text: string; tone: LootTone; s: number }
/** §6.10 loot toasts. */
export function toastFor(ev: WorldEvent): Toast | null {
  const S = LOOT_HUD.toastS;
  if (ev.t === 'keysFull') return { text: 'Keys full (3)', tone: 'textDim', s: S.keysFull };
  if (ev.t === 'lockpickUsed') return { text: 'Lockpick used', tone: 'text', s: S.lockpick };
  if (ev.t === 'purchase') return { text: `−${ev.price}`, tone: 'textDim', s: S.purchase };
  return null;
}
