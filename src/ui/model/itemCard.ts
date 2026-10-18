// The item card's text (07 §6.1): what you get and what each slot choice would do. Pure; itemCard view draws it.
import type { GroundItem } from '../../core/abilities/items.ts';
import type { AbilityId, ClassId } from '../../core/abilities/types.ts';
import { computeClassState } from '../../core/classes/classState.ts';
import type { Grade, WeaponId } from '../../core/combat/types.ts';
import type { GameWorld } from '../../core/sim/gameWorld.ts';
import { ABILITY_INFO } from '../../data/abilities.ts';
import { CLASS_NAME, WEAPON_CLASSES } from '../../data/classes.ts';
import { ABILITY_BLURB, WEAPON_BLURB, WEAPON_NAME } from '../../data/uiText.ts';
import { itemName } from '../../core/loot/roll.ts';
import { ELEMENT_WORD, PERKS } from '../../data/loot.ts';
import { cardDelta, weaponDmg, type ClassColorKeyLike } from './hudModel.ts';
import { actionLabel } from '../inputSettings.ts';
import type { ActionId } from '../../core/save/schema.ts';

export interface CardAfter { name: string; color: ClassColorKeyLike; bond: string | null }
export interface CardOption { text: string; action?: ActionId; delta?: { text: string; tone: 'good' | 'bad' | 'dim' }; after?: CardAfter | null }
export interface ItemCardView {
  kind: 'weapon' | 'ability'; id: string; name: string; badge: string;
  /** Border and name color: a grade letter, or a class key ('neutral' for Vampire). */
  grade: Grade | null; cls: ClassId | 'neutral' | null;
  row2: string; blurb: string;
  dmg: { value: number; matched: boolean } | null; tags: ClassId[]; litTags: ClassId[];
  options: CardOption[]; bottom: string;
  bottomAction?: ActionId;
  /** `bad` for `Owned` (07 §6.1). */
  bottomTone?: 'bad';
}

const glyph = (action: ActionId) => `[${actionLabel(action)}]`;

function afterOf(w: GameWorld, abilities: (AbilityId | null)[]): CardAfter | null {
  const now = w.classState;
  const c = computeClassState(abilities, w.combat.slots.map((s) => s?.weaponId ?? null));
  if (c.displayName === now.displayName && c.bondName === now.bondName) return null;
  return { name: c.displayName, color: c.hybrid ?? c.displayClass ?? 'none', bond: c.connection ? c.bondName : null };
}
const afterText = (a: CardAfter | null) => (a ? `→ ${a.name}` : '(no change)');

export function itemCard(w: GameWorld, it: GroundItem): ItemCardView {
  const v = baseCard(w, it);
  // Shop and merchant items (07 §6.1, §6.4): `[E] Buy` + price, `Owned` for a carried ability.
  if (it.price !== undefined) {
    if (it.ability && w.abilities.slots.some((s) => s?.id === it.ability!.id)) return { ...v, bottom: 'Owned', bottomTone: 'bad', bottomAction: undefined };
    return { ...v, bottom: `${glyph('interact')} Buy ${it.price}` };
  }
  return v;
}

function baseCard(w: GameWorld, it: GroundItem): ItemCardView {
  const choiceOpen = (w.weaponSwapChoice?.itemId === it.id) || (w.abilities.swapChoice?.itemId === String(it.id));
  const swapBottom = `${glyph('interact')} ${choiceOpen ? 'Cancel' : 'Swap'}`;
  if (it.weapon) {
    const wi = it.weapon, carried = w.classState.carriedClasses;
    const tags = WEAPON_CLASSES[wi.weaponId];
    const matched = tags.some((c) => carried.includes(c));
    const dmg = weaponDmg(wi.grade, matched);
    const full = w.combat.slots.every((s) => s !== null);
    const options: CardOption[] = full ? w.combat.slots.map((s, i) => {
      const sd = weaponDmg(s!.grade, WEAPON_CLASSES[s!.weaponId].some((c) => carried.includes(c)));
      const action = i === 0 ? 'attack1' : 'attack2';
      return { text: `${glyph(action)} ${WEAPON_NAME(s!.weaponId)} ${s!.grade}  DMG ${sd}`, action, delta: cardDelta(dmg, sd) };
    }) : [];
    return {
      kind: 'weapon', id: wi.weaponId, name: itemName(wi), badge: wi.grade, grade: wi.grade, cls: null,
      row2: [WEAPON_NAME(wi.weaponId), wi.element && ELEMENT_WORD[wi.element], wi.perk && PERKS.find((p) => p.id === wi.perk)?.name].filter(Boolean).join(' · '), blurb: WEAPON_BLURB[wi.weaponId as WeaponId] ?? '',
      dmg: { value: dmg, matched }, tags, litTags: tags.filter((c) => carried.includes(c)),
      options, bottom: full ? swapBottom : `${glyph('interact')} Take`, bottomAction: 'interact',
    };
  }
  const ab = it.ability!, info = ABILITY_INFO[ab.id];
  const slots = w.abilities.slots.map((s) => s?.id ?? null);
  const same = slots.indexOf(ab.id);
  const empty = slots.indexOf(null);
  let options: CardOption[], bottom: string;
  if (same >= 0) {
    options = [{ text: `Replaces your Lv ${w.abilities.slots[same]!.level} copy` }];
    bottom = `${glyph('interact')} Swap`;
  } else if (empty >= 0) {
    const after = afterOf(w, slots.map((s, i) => (i === empty ? ab.id : s)));
    options = [{ text: afterText(after), after }];
    bottom = `${glyph('interact')} Take`;
  } else {
    options = w.abilities.slots.map((s, i) => {
      const after = afterOf(w, slots.map((x, k) => (k === i ? ab.id : x)));
      const action = i === 0 ? 'ability1' : 'ability2';
      return { text: `${glyph(action)} ${ABILITY_INFO[s!.id].name} Lv ${s!.level} ${afterText(after)}`, action, after };
    });
    bottom = swapBottom;
  }
  return {
    kind: 'ability', id: ab.id, name: info.name, badge: `Lv ${ab.level}`, grade: null, cls: info.cls ?? 'neutral',
    row2: info.cls ? `${CLASS_NAME[info.cls]} ability` : 'Neutral · always on', blurb: ABILITY_BLURB[ab.id],
    dmg: null, tags: [], litTags: [], options, bottom, bottomAction: 'interact',
  };
}
