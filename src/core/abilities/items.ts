// Weapon and ability items on the ground, interacting, pickup and the swap choices (03 §7.1, 05 §5.7, 06 §11, 07 §6.2–6.3).
// Interactables (statues, boards) share the same targeting; their owners give the action.
import { canBuy, onBought } from '../loot/merchant.ts';
import { slot2Locked } from '../loot/lucky.ts';
import { onItemTaken } from '../loot/sources.ts';
import { resetLeech } from '../loot/perks.ts';
import type { InputState } from '../input.ts';
import { emptyButton } from '../input.ts';
import type { WeaponInstance } from '../combat/types.ts';
import { overlaps, type Rect } from '../combat/hitGroups.ts';
import { playerRect } from '../combat/resolve.ts';
import { isGrounded, moveY } from '../physics/collide.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { TICK } from '../tuning.ts';
import { abilityDef, abilityMoveRunning, castRt, cooldownTicks, maxCharges } from './abilitySystem.ts';
import type { AbilitySlot } from './types.ts';
import type { BlueprintId } from '../loot/blueprints.ts';

export const ITEM = { box: 16, gravity: 1500, maxFall: 400, interactW: 24, interactH: 32 } as const;

export interface GroundItem {
  id: number; x: number; y: number;          // feet (bottom center)
  vy: number; resting: boolean;
  weapon?: WeaponInstance; ability?: AbilitySlot;
  /** M4 armory stands: taking leaves a copy. */
  // SPEC-GAP: M4 armory stands never run out (test only)
  endless?: boolean;
  label?: string;
  /** A key (05 §6): collected by touch, not by interact. */
  key?: boolean;
  blueprint?: BlueprintId;
  fullShown?: boolean;
  /** Key-chest pair (05 §5.2): taking one item removes the other. */
  chestGroup?: number;
  /** A free loot stand's item (05 §5.1); the chest it came from. */
  stand?: boolean;
  fromChest?: number;
  /** A shop or merchant item: its price (05 §11); taking it pays. */
  price?: number;
  merchantSlot?: number;
  shopSlot?: number;
}

/** A placed interactable (statue, board...): 24 × 32 box with its bottom center on (x, y). */
export interface Interactable {
  id: number; x: number; y: number; kind: string; label: string;
  w?: number; h?: number;
  use(w: GameWorld): void;
}

const INTERACT_STATES = new Set(['ground', 'air', 'crawl', 'slide', 'dash', 'wallSlide', 'diveLand']);

export const itemRect = (it: GroundItem): Rect => it.shopSlot !== undefined || it.merchantSlot !== undefined
  ? { x: it.x - ITEM.interactW / 2, y: it.y - ITEM.interactH, w: ITEM.interactW, h: ITEM.interactH }
  : { x: it.x - ITEM.box / 2, y: it.y - ITEM.box, w: ITEM.box, h: ITEM.box };
const GROUND_OBJECTS = new Set(['ability_altar', 'merchant_altar', 'shop_flask', 'shop_refill', 'shop_key', 'shop_reroll', 'inn', 'class_statue', 'seed_board', 'unlocks_board', 'training_gate']);
const needsGround = (o: GroundItem | Interactable) => 'use' in o ? GROUND_OBJECTS.has(o.kind) : o.shopSlot !== undefined || o.merchantSlot !== undefined;
const villageState = (w: GameWorld) => w.body.state === 'ground' || w.body.state === 'crawl';
const objRect = (o: Interactable): Rect => {
  const w = o.w ?? ITEM.interactW, h = o.h ?? ITEM.interactH;
  return { x: o.x - w / 2, y: o.y - h, w, h };
};

/** Drops an item at a point (05 §5.7): inside a solid it moves straight up to the first free row (06 §11.2), then falls. */
export function dropItem(w: GameWorld, x: number, y: number, item: Pick<GroundItem, 'weapon' | 'ability' | 'endless' | 'label' | 'key' | 'blueprint' | 'chestGroup' | 'price' | 'stand' | 'fromChest' | 'merchantSlot' | 'shopSlot'>): GroundItem {
  let yy = y;
  while (yy > ITEM.box && w.grid.isSolidPx(Math.floor(x), yy - 1)) yy -= 1;
  const it: GroundItem = { id: w.newId(), x, y: yy, vy: 0, resting: false, ...item };
  w.groundItems.push(it);
  return it;
}

/** Each world tick: items fall to rest; dropped abilities keep recharging at rate 1.0 (03 §7.1). */
export function stepGroundItems(w: GameWorld): void {
  for (const it of w.groundItems) {
    const s = it.ability;
    if (s && abilityDef(s.id) && s.charges < maxCharges(s)) {
      s.rechargeLeft -= 1;
      if (s.rechargeLeft <= 0) { s.charges += 1; s.rechargeLeft = s.charges < maxCharges(s) ? cooldownTicks(s) : 0; }
    }
    if (it.resting) continue;
    const box = { x: it.x, y: it.y, w: ITEM.box, h: ITEM.box, remX: 0, remY: 0 };
    it.vy = Math.min(ITEM.maxFall, it.vy + ITEM.gravity * TICK);
    if (moveY(box, w.grid, it.vy * TICK, { dropping: false, preferDir: 0 }) !== 'free' || isGrounded(box, w.grid, it.vy)) { it.vy = 0; it.resting = isGrounded(box, w.grid, 0); }
    it.y = box.y;
  }
}

function closeChoices(w: GameWorld): void {
  w.abilities.swapChoice = null;
  w.weaponSwapChoice = null;
}

/** Puts the item's ability or weapon in `slot`; the old one drops at the feet with its state. */
function takeInto(w: GameWorld, it: GroundItem, slot: 0 | 1): void {
  if (needsGround(it) && !villageState(w)) return;
  if (!canBuy(w, it)) { w.events.push({ t: 'cantAfford' }); closeChoices(w); return; }
  const b = w.body;
  if (it.ability) {
    const old = w.abilities.slots[slot];
    w.abilities.slots[slot] = { ...it.ability };
    if (old) dropItem(w, b.x, b.y, { ability: old });
  } else if (it.weapon) {
    const old = w.combat.slots[slot];
    w.combat.slots[slot] = { ...it.weapon };
    w.combat.comboStep[slot] = 0;
    if (old) { resetLeech(old); dropItem(w, b.x, b.y, { weapon: old }); }
  }
  if (!it.endless) w.groundItems = w.groundItems.filter((x) => x !== it);
  onItemTaken(w, it);
  onBought(w, it);
  closeChoices(w);
  w.refreshClassState();                                       // 03 §4.4: the same tick
  w.events.push({ t: 'itemTaken', itemId: it.id, slot, kind: it.weapon ? 'weapon' : 'ability' });
}

/** 03 §7.1 / 05 §5.7: pick up an item (or open the swap choice). */
function pickUp(w: GameWorld, it: GroundItem): void {
  if (!canBuy(w, it)) { w.events.push({ t: 'cantAfford' }); return; }          // 05 §10.2 (merchant)
  if (it.ability) {
    if (castRt(w) || abilityMoveRunning(w)) return;          // refused during a cast or an ability move
    const same = w.abilities.slots.findIndex((s) => s?.id === it.ability!.id);
    if (same >= 0) { takeInto(w, it, same as 0 | 1); return; }
    const empty = w.abilities.slots.findIndex((s) => s === null);
    if (empty >= 0) { takeInto(w, it, empty as 0 | 1); return; }
    w.abilities.swapChoice = { itemId: String(it.id) };
  } else if (it.weapon) {
    if (w.combat.current || w.combat.charge) return;          // refused while attacking (02 §9.5)
    // Butterfingers (05 §7.3): an empty slot 2 counts as full and locked.
    const locked = slot2Locked(w);
    const empty = w.combat.slots.findIndex((s, i) => s === null && !(locked && i === 1));
    if (empty >= 0) { takeInto(w, it, empty as 0 | 1); return; }
    w.weaponSwapChoice = { itemId: it.id };
  }
}

/** The interact target (06 §11.1): overlapping ground items and objects, nearest center x, then lower id. */
export function interactTarget(w: GameWorld): GroundItem | Interactable | null {
  const pr = playerRect(w);
  const list: { o: GroundItem | Interactable; cx: number }[] = [];
  for (const it of w.groundItems) if (!it.key && !it.blueprint && overlaps(itemRect(it), pr)) list.push({ o: it, cx: it.x });
  for (const o of w.interactables) if ((o.kind !== 'shop_key' || w.shop?.keyInStock)
    && (o.kind !== 'minecart' || w.minecarts.some((c) => c.id === o.id && c.active && !c.started)) && overlaps(objRect(o), pr)) list.push({ o, cx: o.x });
  list.sort((a, b) => Math.abs(a.cx - w.body.x) - Math.abs(b.cx - w.body.x) || a.o.id - b.o.id);
  return list[0]?.o ?? null;
}

const isItem = (o: GroundItem | Interactable): o is GroundItem => !('use' in o);

/**
 * Step 3, before weapons: interact presses, and the open swap choice (its presses pick a slot and never act).
 * Returns the input with the presses the choice used removed.
 */
export function stepInteract(w: GameWorld, input: InputState): InputState {
  if (w.health.dead) { closeChoices(w); return input; }
  const pr = playerRect(w);
  const choiceId = w.weaponSwapChoice?.itemId ?? (w.abilities.swapChoice ? Number(w.abilities.swapChoice.itemId) : null);
  if (choiceId !== null) {
    const it = w.groundItems.find((x) => x.id === choiceId);
    if (!it || !overlaps(itemRect(it), pr) || input.interact.pressed) { closeChoices(w); return input; }
    const out = { ...input };
    if (w.weaponSwapChoice) {
      const pick = input.attack1.pressed ? 0 : input.attack2.pressed && !slot2Locked(w) ? 1 : null;
      out.attack1 = emptyButton(); out.attack2 = emptyButton();
      if (pick !== null) takeInto(w, it, pick);
    } else {
      const pick = input.ability1.pressed ? 0 : input.ability2.pressed ? 1 : null;
      out.ability1 = emptyButton(); out.ability2 = emptyButton();
      if (pick !== null) takeInto(w, it, pick);
    }
    return out;
  }
  if (!input.interact.pressed || !INTERACT_STATES.has(w.body.state)) return input;
  const t = interactTarget(w);
  if (!t) return input;
  if (needsGround(t) && !villageState(w)) return input;
  if (isItem(t)) pickUp(w, t);
  else t.use(w);
  return input;
}

/** The player took damage: an open swap choice closes (07 §6.2 rule 4). */
export function onHurtCloseChoice(w: GameWorld): void {
  closeChoices(w);
}

/** A class statue (06 §12.3): interacting opens the class pick for its class (07 §6.7); the scene equips the kit. */
export function classStatue(w: GameWorld, cls: import('./types.ts').ClassId, x: number, y: number): Interactable {
  return { id: w.newId(), x, y, kind: 'class_statue', label: cls, use: (ww) => { ww.events.push({ t: 'openClassPick', cls }); } };
}
