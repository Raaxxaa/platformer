// The class pick (07 §6.7): which class and weapon is highlighted, from menu presses. Pure; the view draws it.
import type { InputState } from '../../core/input.ts';
import type { ClassId } from '../../core/abilities/types.ts';
import type { WeaponId } from '../../core/combat/types.ts';
import { STARTING_KITS } from '../../data/classes.ts';
import { THIRD_START_WEAPON } from '../../data/save.ts';

export interface Kit { cls: ClassId; weapon: WeaponId }

export class ClassPickModel {
  readonly classes: ClassId[];
  ci = 0;
  wi = 0;
  private prevY = 0;
  private prevX = 0;
  /** `unlocked` is `save.unlocks.startWeapons`: the third starting weapon joins the list once the King was beaten (05 §14.3). */
  private readonly unlocked: Partial<Record<ClassId, WeaponId[]>>;
  constructor(classes: ClassId[], equipped: Kit | null, unlocked: Partial<Record<ClassId, WeaponId[]>> = {}) {
    this.unlocked = unlocked;
    this.classes = classes;
    const i = equipped ? classes.indexOf(equipped.cls) : -1;
    if (i >= 0) { this.ci = i; this.wi = Math.max(0, this.weaponsOf(equipped!.cls).indexOf(equipped!.weapon)); }
  }
  private weaponsOf(cls: ClassId): WeaponId[] {
    const third = THIRD_START_WEAPON[cls];
    return this.unlocked[cls]?.includes(third) ? [...STARTING_KITS[cls].weapons, third] : STARTING_KITS[cls].weapons;
  }
  get cls(): ClassId { return this.classes[this.ci]; }
  get weapons(): WeaponId[] { return this.weaponsOf(this.cls); }
  get kit(): Kit { return { cls: this.cls, weapon: this.weapons[this.wi] }; }

  action(action: 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back'): 'confirm' | 'close' | null {
    if (action === 'up') this.wi = Math.max(0, this.wi - 1);
    if (action === 'down') this.wi = Math.min(this.weapons.length - 1, this.wi + 1);
    if ((action === 'left' || action === 'right') && this.classes.length > 1) {
      this.ci = Math.max(0, Math.min(this.classes.length - 1, this.ci + (action === 'left' ? -1 : 1))); this.wi = 0;
    }
    return action === 'confirm' ? 'confirm' : action === 'back' ? 'close' : null;
  }

  /** One frame of input: arrows move, confirm (jump, interact, attack 1) picks, back (pause, dash) closes. */
  step(input: InputState): 'confirm' | 'close' | null {
    const y = input.moveY, x = input.moveX;
    if (y !== 0 && y !== this.prevY) this.action(y < 0 ? 'up' : 'down');
    if (x !== 0 && x !== this.prevX) this.action(x < 0 ? 'left' : 'right');
    this.prevY = y; this.prevX = x;
    if (input.jump.pressed || input.interact.pressed) return 'confirm';
    if (input.pause.pressed) return 'close';
    return null;
  }
}

/** `?kit=archer:bow` → a valid starting kit, or null. */
export function parseKit(s: string | null): Kit | null {
  if (!s) return null;
  const [cls, weapon] = s.split(':') as [ClassId, WeaponId];
  if (!STARTING_KITS[cls]) return null;
  return STARTING_KITS[cls].weapons.includes(weapon) || weapon === THIRD_START_WEAPON[cls] ? { cls, weapon } : null;
}
