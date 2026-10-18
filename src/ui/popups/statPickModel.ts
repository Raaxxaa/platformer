import { STAT_PICK_UI as U } from '../../data/statUi.ts';

export type StatPickAction = 'left' | 'right' | 'confirm' | 'back';
/** Pure popup input; the core also checks the confirm guard and applies a choice once. */
export class StatPickModel {
  cursor: number = U.defaultCursor;
  private elapsed = 0;
  private picked = false;
  advance(seconds: number): void { this.elapsed += Math.max(0, seconds); }
  select(index: number): void { if (!this.picked) this.cursor = Math.max(0, Math.min(U.cardXs.length - 1, index)); }
  accept(): void { this.picked = true; }
  input(action: StatPickAction): number | null {
    if (this.picked) return null;
    if (action === 'left') this.select(this.cursor - 1);
    if (action === 'right') this.select(this.cursor + 1);
    if (action !== 'confirm' || this.elapsed + Number.EPSILON < U.confirmSeconds) return null;
    return this.cursor;
  }
}
