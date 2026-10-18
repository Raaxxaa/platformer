// Pure Boot, Title and Death menu state (07 §7).
import { UI_FRAME_SECONDS } from '../../data/stageUi.ts';
import { FRONT_UI as U } from '../../data/frontUi.ts';
import type { HomePanelAction } from '../home/homePanels.ts';
export class TitleModel {
  step: 1 | 2 = 1; cursor = 0;
  gesture(): void { this.step = 2; this.cursor = 0; }
  action(action: HomePanelAction): typeof U.titleCommands[number] | null {
    if (this.step === 1) { this.gesture(); return null; }
    if (action === 'back') { this.step = 1; return null; }
    if (action === 'up') this.cursor = Math.max(0, this.cursor - 1);
    if (action === 'down') this.cursor = Math.min(U.titleRows.length - 1, this.cursor + 1);
    return action === 'confirm' ? U.titleCommands[this.cursor] : null;
  }
}
export class DeathModel {
  cursor = 0; guardLeft: number = U.death.guardSeconds;
  get canConfirm(): boolean { return this.guardLeft <= Number.EPSILON; }
  advance(seconds: number): void { this.guardLeft = Math.max(0, this.guardLeft - Math.min(UI_FRAME_SECONDS, Math.max(0, seconds))); }
  action(action: HomePanelAction): typeof U.deathCommands[number] | null {
    if (action === 'up') this.cursor = Math.max(0, this.cursor - 1);
    if (action === 'down') this.cursor = Math.min(U.deathRows.length - 1, this.cursor + 1);
    return action === 'confirm' && this.canConfirm ? U.deathCommands[this.cursor] : null;
  }
}
export function deathCause(cause: string): string {
  return U.causes[cause as keyof typeof U.causes] ?? `Killed by ${cause === 'wisp' ? "Will-o'-Wisp" : cause.split('_').map((word) => word[0].toUpperCase() + word.slice(1)).join(' ')}`;
}
export const loadingPercent = (progress: number): number => Math.floor(Math.max(0, Math.min(1, progress)) * U.boot.percent);
