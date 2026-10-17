// The class pick (07 §6.7): which class and weapon is highlighted, from menu presses. Pure; the view draws it.
import type { InputState } from '../../core/input.ts';
import type { ClassId } from '../../core/abilities/types.ts';
import type { WeaponId } from '../../core/combat/types.ts';
import { STARTING_KITS } from '../../data/classes.ts';

export interface Kit { cls: ClassId; weapon: WeaponId }

export class ClassPickModel {
  readonly classes: ClassId[];
  ci = 0;
  wi = 0;
  private prevY = 0;
  private prevX = 0;
  constructor(classes: ClassId[], equipped: Kit | null) {
    this.classes = classes;
    const i = equipped ? classes.indexOf(equipped.cls) : -1;
    if (i >= 0) { this.ci = i; this.wi = Math.max(0, STARTING_KITS[equipped!.cls].weapons.indexOf(equipped!.weapon)); }
  }
  get cls(): ClassId { return this.classes[this.ci]; }
  get weapons(): WeaponId[] { return STARTING_KITS[this.cls].weapons; }
  get kit(): Kit { return { cls: this.cls, weapon: this.weapons[this.wi] }; }

  /** One frame of input: arrows move, confirm (jump, interact, attack 1) picks, back (pause, dash) closes. */
  step(input: InputState): 'confirm' | 'close' | null {
    const y = input.moveY, x = input.moveX;
    if (y !== 0 && y !== this.prevY) this.wi = (this.wi + y + this.weapons.length) % this.weapons.length;
    if (x !== 0 && x !== this.prevX && this.classes.length > 1) { this.ci = (this.ci + x + this.classes.length) % this.classes.length; this.wi = 0; }
    this.prevY = y; this.prevX = x;
    if (input.jump.pressed || input.interact.pressed || input.attack1.pressed) return 'confirm';
    if (input.pause.pressed || input.dash.pressed) return 'close';
    return null;
  }
}

/** `?kit=archer:bow` → a valid starting kit, or null. */
export function parseKit(s: string | null): Kit | null {
  if (!s) return null;
  const [cls, weapon] = s.split(':') as [ClassId, WeaponId];
  return STARTING_KITS[cls]?.weapons.includes(weapon) ? { cls, weapon } : null;
}
