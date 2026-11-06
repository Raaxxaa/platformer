// Boss rush setup and result screens (06 §14.2). Models are pure; the views reuse the menu surface.
import type Phaser from 'phaser';
import type { ClassId } from '../../core/abilities/types.ts';
import type { WeaponId } from '../../core/combat/types.ts';
import { bossRushKey, bossRushTicks, type BossRushAttempt, type BossRushDragon } from '../../core/run/bossRush.ts';
import { practiceWeapons } from '../../core/run/practice.ts';
import type { SaveData } from '../../core/save/schema.ts';
import { formatTime } from '../../core/time.ts';
import { BOSS_RUSH_UI as B } from '../../data/bossRush.ts';
import { CLASS_IDS, CLASS_NAME } from '../../data/classes.ts';
import { UI_FRAME_SECONDS } from '../../data/stageUi.ts';
import { CLASS_COLOR, UI_COLOR, WEAPON_NAME } from '../../data/uiText.ts';
import type { HomePanelAction } from '../home/homePanels.ts';
import { MenuSurface } from './records.ts';

type Row = (typeof B.rows)[number];
export interface BossRushSetup { cls: ClassId; weapon: WeaponId; dragon: BossRushDragon }

export class BossRushSetupModel {
  private readonly getSave: () => SaveData;
  cls: ClassId = 'swordsman'; weaponIndex = 0; dragonIndex = 0; cursor: Row = 'class';
  constructor(getSave: () => SaveData, initial?: BossRushSetup | null) {
    this.getSave = getSave;
    const kit = initial ?? getSave().lastKit;
    if (kit) { this.cls = kit.cls; this.weaponIndex = Math.max(0, this.weapons.indexOf(kit.weapon)); }
    if (initial) this.dragonIndex = Math.max(0, B.dragons.indexOf(initial.dragon));
  }
  get weapons(): WeaponId[] { return practiceWeapons(this.cls, this.getSave().unlocks.startWeapons); }
  get weapon(): WeaponId { return this.weapons[Math.min(this.weaponIndex, this.weapons.length - 1)]; }
  get dragon(): BossRushDragon { return B.dragons[this.dragonIndex]; }
  get setup(): BossRushSetup { return { cls: this.cls, weapon: this.weapon, dragon: this.dragon }; }
  get best(): string { const b = this.getSave().bossRushBests[bossRushKey(this.cls, this.dragon !== 'off')]; return b ? formatTime(b.ticks) : '—'; }
  value(row: Row): string {
    if (row === 'class') return CLASS_NAME[this.cls];
    if (row === 'weapon') return WEAPON_NAME(this.weapon);
    if (row === 'dragon') return B.dragonLabel[this.dragon];
    if (row === 'best') return this.best;
    return '';
  }
  get selectable(): Row[] { return B.rows.filter((r) => r !== 'best'); }
  private cycle(row: Row, d: 1 | -1): void {
    const wrap = (i: number, n: number) => (i + d + n) % n;
    if (row === 'class') { this.cls = CLASS_IDS[wrap(CLASS_IDS.indexOf(this.cls), CLASS_IDS.length)]; this.weaponIndex = 0; }
    if (row === 'weapon') this.weaponIndex = wrap(this.weaponIndex, this.weapons.length);
    if (row === 'dragon') this.dragonIndex = wrap(this.dragonIndex, B.dragons.length);
  }
  select(row: Row): void { if (this.selectable.includes(row)) this.cursor = row; }
  action(action: HomePanelAction): 'start' | 'back' | null {
    if (action === 'back') return 'back';
    const list = this.selectable, at = Math.max(0, list.indexOf(this.cursor));
    if (action === 'up') this.cursor = list[Math.max(0, at - 1)];
    else if (action === 'down') this.cursor = list[Math.min(list.length - 1, at + 1)];
    else if (action === 'left' || action === 'right') this.cycle(this.cursor, action === 'left' ? -1 : 1);
    else if (action === 'confirm') {
      if (this.cursor === 'start') return 'start';
      if (this.cursor === 'back') return 'back';
      this.cycle(this.cursor, 1);
    }
    return null;
  }
}

export class BossRushSetupView extends MenuSurface {
  readonly model: BossRushSetupModel;
  private readonly callbacks: { onStart(setup: BossRushSetup): void; onClose(): void };
  constructor(scene: Phaser.Scene, getSave: () => SaveData, initial: BossRushSetup | null, callbacks: { onStart(setup: BossRushSetup): void; onClose(): void }) {
    super(scene); this.model = new BossRushSetupModel(getSave, initial); this.callbacks = callbacks; this.render();
  }
  action(action: HomePanelAction): void {
    if (!this.enabled || this.closed) return;
    const result = this.model.action(action);
    if (result === 'start') { const setup = this.model.setup; this.destroy(); this.callbacks.onStart(setup); }
    else if (result === 'back') { this.destroy(); this.callbacks.onClose(); }
    else this.render();
  }
  protected render(): void {
    const m = this.model; if (!this.beginDraw([m.cursor, m.setup, m.best])) return;
    const mid = this.scene.scale.width / 2;
    this.panel([...B.panel]); this.text(mid, B.titleY, 'BOSS RUSH', UI_COLOR.text, true);
    B.rows.forEach((row, i) => {
      const y = B.rowsY + i * B.rowStep, sel = m.cursor === row, readOnly = row === 'best';
      const color = readOnly ? UI_COLOR.textDim : sel ? UI_COLOR.highlight : UI_COLOR.text;
      if (row === 'start' || row === 'back') {
        this.text(mid, y + 8, `${sel ? '▸ ' : ''}${row === 'start' ? 'Start' : 'Back'}`, color);
        this.target(mid - B.rowW / 2, y + 8, B.rowW, B.rowStep, () => m.select(row), () => this.action('confirm'));
        return;
      }
      this.text(B.labelX, y, `${sel ? '▸ ' : ''}${B.labels[row]}`, color, false, 'left');
      const value = m.value(row), arrows = sel && !readOnly;
      const t = this.text(B.valueX, y, arrows ? `< ${value} >` : value, color, false, 'right');
      if (row === 'class') t.setTint(CLASS_COLOR[m.cls]);
      if (!readOnly) this.target(B.labelX, y, B.rowW - 48, B.rowStep, () => m.select(row), () => this.action('right'));
    });
    this.hint(mid, B.hintY, ['←→ Change   ↑↓ Select   ', { menu: 'confirm' }, ' Confirm   ', { menu: 'back' }, ' Back']);
  }
}

export type BossRushResultCommand = (typeof B.result.commands)[number];
/** The result lines: one per fight reached, with its split. */
export function bossRushResultLines(a: BossRushAttempt): string[] {
  return a.fights.map((f, i) => `${B.bossName[f.boss] ?? f.boss}  ${a.splits[i] !== undefined ? formatTime(a.splits[i]) : i === a.index ? 'fell here' : '—'}`);
}
export class BossRushResultModel {
  cursor = 0; guardLeft: number = B.result.guardSeconds;
  get canConfirm(): boolean { return this.guardLeft <= Number.EPSILON; }
  advance(seconds: number): void { this.guardLeft = Math.max(0, this.guardLeft - Math.min(UI_FRAME_SECONDS, Math.max(0, seconds))); }
  action(action: HomePanelAction): BossRushResultCommand | null {
    if (action === 'up') this.cursor = Math.max(0, this.cursor - 1);
    if (action === 'down') this.cursor = Math.min(B.result.rows.length - 1, this.cursor + 1);
    return action === 'confirm' && this.canConfirm ? B.result.commands[this.cursor] : null;
  }
}
export class BossRushResultView extends MenuSurface {
  readonly model = new BossRushResultModel();
  private readonly attempt: BossRushAttempt; private readonly isNew: boolean;
  private readonly choose: (command: BossRushResultCommand) => void;
  constructor(scene: Phaser.Scene, attempt: BossRushAttempt, isNew: boolean, choose: (command: BossRushResultCommand) => void) {
    super(scene); this.attempt = attempt; this.isNew = isNew; this.choose = choose; this.render();
  }
  override update(seconds: number): void { this.model.advance(seconds); super.update(seconds); }
  action(action: HomePanelAction): void {
    if (!this.enabled || this.closed) return;
    const result = this.model.action(action); if (result) this.choose(result);
    this.render();
  }
  protected render(): void {
    const m = this.model, R = B.result, a = this.attempt; if (!this.beginDraw([m.cursor, m.canConfirm])) return;
    const mid = this.scene.scale.width / 2, done = a.index >= a.fights.length;
    this.text(mid, R.titleY, done ? 'BOSS RUSH CLEAR' : 'BOSS RUSH OVER', done ? UI_COLOR.highlight : UI_COLOR.bad, true);
    this.text(mid, R.timeY, `${formatTime(bossRushTicks(a))}${this.isNew ? '  ★ NEW BEST' : ''}${a.assist ? '  ASSIST' : ''}`, UI_COLOR.text);
    bossRushResultLines(a).forEach((line, i) => this.text(mid, R.linesY + i * R.lineH, line, i < a.index ? UI_COLOR.text : UI_COLOR.textDim));
    R.rows.forEach((label, i) => {
      const y = R.rowsY + i * R.rowStep;
      this.text(mid, y, `${m.cursor === i ? '▸ ' : ''}${label}`, m.cursor === i ? UI_COLOR.highlight : UI_COLOR.text);
      this.target(mid - R.rowW / 2, y, R.rowW, R.rowH, () => { m.cursor = i; }, () => this.action('confirm'));
    });
  }
}
