// What the touch buttons show right now (07 §8.6): weapon and ability icons, cooldown shades, flask charges and the
// Interact word. Read from the same models the HUD uses, never from core internals.
import { interactTarget } from '../../core/abilities/items.ts';
import type { GameWorld } from '../../core/sim/gameWorld.ts';
import { itemIcon } from '../../data/animKeys.ts';
import { GRADE_COLOR } from '../../data/uiText.ts';
import { abilitySlotViews, cooldownShade } from '../hud/abilityHudModel.ts';
import { itemCard } from '../model/itemCard.ts';
import { interactPrompt } from '../model/prompt.ts';

export interface TouchSlotView { icon: string | null; dim: boolean; ring: number | null; shade: number; seconds: number; charges: number; maxCharges: number }
export interface TouchHudView { attack1: TouchSlotView; attack2: TouchSlotView; ability1: TouchSlotView; ability2: TouchSlotView; heal: number; interact: string | null }

const empty = (): TouchSlotView => ({ icon: null, dim: true, ring: null, shade: 0, seconds: 0, charges: 0, maxCharges: 0 });
const ICON_SIZE = 16;

export function touchHudView(w: GameWorld): TouchHudView {
  const weapon = (i: 0 | 1): TouchSlotView => {
    const s = w.combat.slots[i];
    return s ? { ...empty(), icon: itemIcon('weapon', s.weaponId), dim: false, ring: GRADE_COLOR[s.grade] } : empty();
  };
  const ab = abilitySlotViews(w);
  const ability = (i: 0 | 1): TouchSlotView => {
    const v = ab[i];
    if (!v) return empty();
    const sh = cooldownShade(v);
    return { icon: itemIcon('ability', v.id), dim: false, ring: null, shade: sh ? sh.h / ICON_SIZE : 0, seconds: sh?.seconds ?? 0, charges: v.charges, maxCharges: v.maxCharges };
  };
  const t = interactTarget(w);
  let interact: string | null = null;
  if (t && !w.health.dead) {
    if ('use' in t) interact = interactPrompt(w, t)?.glyph ? interactPrompt(w, t)!.l1.split(' ')[0] : null;
    else interact = itemCard(w, t).bottom.replace(/^\[E\]\s*/, '').split(' ')[0];
  }
  return { attack1: weapon(0), attack2: weapon(1), ability1: ability(0), ability2: ability(1), heal: w.flask.charges, interact };
}
