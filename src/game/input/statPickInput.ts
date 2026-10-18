// Menus read devices directly (07 §7.1), independently of gameplay InputState.
import type { StatPickAction } from '../../ui/popups/statPickModel.ts';
import { STAT_PICK_UI as U } from '../../data/statUi.ts';
import { menuConfirmKey } from '../../ui/inputSettings.ts';

const KEY: Readonly<Record<string, StatPickAction>> = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Enter: 'confirm', Space: 'confirm', Escape: 'back', Backspace: 'back',
};
type Pad = { axes: readonly number[]; buttons: readonly { pressed: boolean }[] };
export class StatPickInput {
  private keys = new Set<string>();
  private pending: StatPickAction[] = [];
  private held = new Map<StatPickAction, number>();
  private releaseGate = false;
  key(code: string, down: boolean, repeat: boolean): boolean {
    const action = KEY[code] ?? (menuConfirmKey(code) ? 'confirm' : undefined);
    if (!action) return false;
    if (!down) this.keys.delete(code);
    else if (!repeat && !this.keys.has(code)) { this.keys.add(code); this.pending.push(action); }
    return true;
  }
  clear(): void { this.keys.clear(); this.pending = []; this.held.clear(); this.releaseGate = false; }
  blockUntilRelease(): void { this.clear(); this.releaseGate = true; }
  poll(seconds: number, pad?: Pad | null): StatPickAction[] {
    if (this.releaseGate) {
      this.pending = [];
      if (this.keys.size || pad?.buttons.some((b) => b.pressed) || Math.abs(pad?.axes[0] ?? 0) >= U.stick) return [];
      this.releaseGate = false;
      return [];
    }
    const out = this.pending.splice(0);
    const now = new Set<StatPickAction>([...this.keys].map((k) => KEY[k] ?? 'confirm'));
    const add = (a: StatPickAction) => { if (!now.has(a) && !this.held.has(a)) out.push(a); now.add(a); };
    if (pad) {
      if (pad.buttons[14]?.pressed || (pad.axes[0] ?? 0) <= -U.stick) add('left');
      if (pad.buttons[15]?.pressed || (pad.axes[0] ?? 0) >= U.stick) add('right');
      if (pad.buttons[0]?.pressed) add('confirm');
      if (pad.buttons[1]?.pressed) add('back');
    }
    for (const action of [...this.held.keys()]) if (!now.has(action)) this.held.delete(action);
    for (const action of now) {
      const before = this.held.get(action);
      if (before === undefined) this.held.set(action, U.repeatDelay);
      else if (action === 'left' || action === 'right') {
        let left = before - seconds;
        while (left <= Number.EPSILON) { out.push(action); left += U.repeatEvery; }
        this.held.set(action, left);
      }
    }
    return out;
  }
}
