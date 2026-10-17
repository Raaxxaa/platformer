// Pause menu state (07 §7.6): tabs MENU / LOADOUT / CONTROLS, the item cursor, the two-step quit. Pure.
export type PauseTab = 'MENU' | 'LOADOUT' | 'CONTROLS';
export type PauseAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back';
export type PauseResult = 'resume' | 'restart' | 'quit' | null;
interface Item { id: 'resume' | 'restart' | 'settings' | 'quit'; label: string; disabled?: boolean }

export const PAUSE = { tabs: ['MENU', 'LOADOUT', 'CONTROLS'] as PauseTab[], quitConfirmMs: 2000, quitArmed: 'Quit? Confirm again' } as const;

export class PauseModel {
  tabIndex = 0;
  cursor = 0;
  private armedUntil = -Infinity;
  private readonly base: Item[];

  constructor(place: 'run' | 'training') {
    // SPEC-GAP: no Settings screen or Home Village yet: Settings is shown disabled and quitting goes to the start screen.
    this.base = place === 'run'
      ? [{ id: 'resume', label: 'Resume' }, { id: 'restart', label: 'Restart run' }, { id: 'settings', label: 'Settings', disabled: true }, { id: 'quit', label: 'Quit to title' }]
      : [{ id: 'resume', label: 'Resume' }, { id: 'settings', label: 'Settings', disabled: true }, { id: 'quit', label: 'Leave Training Yard' }];
  }

  get tab(): PauseTab { return PAUSE.tabs[this.tabIndex]; }
  get items(): Item[] { return this.base; }
  get selected(): Item {
    const it = this.base[this.cursor];
    return it.id === 'quit' && this.armed ? { ...it, label: PAUSE.quitArmed } : it;
  }
  private armedNow = 0;
  private get armed(): boolean { return this.armedNow < this.armedUntil; }

  private move(d: 1 | -1): void {
    for (let i = this.cursor + d; i >= 0 && i < this.base.length; i += d) if (!this.base[i].disabled) { this.cursor = i; return; }
  }

  input(a: PauseAction, nowMs: number): PauseResult {
    this.armedNow = nowMs;
    if (a === 'back') return 'resume';
    if (a === 'left') this.tabIndex = Math.max(0, this.tabIndex - 1);
    if (a === 'right') this.tabIndex = Math.min(PAUSE.tabs.length - 1, this.tabIndex + 1);
    if (this.tab !== 'MENU') return null;
    if (a === 'up') this.move(-1);
    if (a === 'down') this.move(1);
    if (a !== 'confirm') return null;
    const it = this.base[this.cursor];
    if (it.id === 'quit') {
      if (this.armed) return 'quit';
      this.armedUntil = nowMs + PAUSE.quitConfirmMs;
      return null;
    }
    return it.id === 'settings' ? null : it.id;
  }

  /** Call each frame so the armed quit label reverts after 2.0 s. */
  tick(nowMs: number): void { this.armedNow = nowMs; }
  /** The label to draw for item i. */
  label(i: number): string { return i === this.cursor ? this.selected.label : this.base[i].label; }
  quitArmed(): boolean { return this.armed; }
}
