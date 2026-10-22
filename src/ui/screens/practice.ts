// Practice setup and result screens (07 §7.4, 06 §14). The models are pure; the views reuse the Records menu surface.
import type Phaser from 'phaser';
import type { ClassId } from '../../core/abilities/types.ts';
import type { WeaponId } from '../../core/combat/types.ts';
import { dragonAllowed, practiceKey, practiceLevels, practiceWeapons, type PracticeSetup } from '../../core/run/practice.ts';
import type { SaveData } from '../../core/save/schema.ts';
import { formatTime } from '../../core/time.ts';
import { CLASS_IDS, CLASS_NAME } from '../../data/classes.ts';
import { PRACTICE_DRAGON, PRACTICE_DRAGON_LABEL, PRACTICE_LAYOUT, PRACTICE_LAYOUT_LABEL, PRACTICE_LEVEL_NAME, PRACTICE_UI as P, VERSION_NAMES, type PracticeDragon, type PracticeLayoutMode, type PracticeLevelId } from '../../data/practice.ts';
import { LEVEL_PACKS } from '../../data/run.ts';
import { LAYOUT } from '../../data/levelRules.ts';
import { classicLayout, layoutCode } from '../../core/run/layout.ts';
import type { Picks } from '../../core/level/assemble.ts';
import { UI_FRAME_SECONDS } from '../../data/stageUi.ts';
import { UI_COLOR, WEAPON_NAME, CLASS_COLOR } from '../../data/uiText.ts';
import type { HomePanelAction } from '../home/homePanels.ts';
import { MenuSurface } from './records.ts';

type Row = (typeof P.rows)[number];
const SECTION_ROWS = ['s2', 's3', 's4', 's6', 's7'] as const;
const sectionOf = (r: Row): number | null => ((SECTION_ROWS as readonly string[]).includes(r) ? Number(r.slice(1)) : null);
export type PracticeSetupResult = 'start' | 'back' | null;

/** Rows from 07 §7.4. `seed` and `best` are read-only, so the cursor skips them; `dragon` is skipped for Stages 1 and 4. */
export class PracticeSetupModel {
  private readonly getSave: () => SaveData;
  levelIndex = 0; cls: ClassId = 'swordsman'; weaponIndex = 0; dragonIndex = 0; cursor: Row = 'stage';
  /** 06 §8.7 Layout: mode and the custom picks. */
  layoutMode: PracticeLayoutMode = 'random'; picks: Picks = classicLayout();
  constructor(getSave: () => SaveData, initial?: PracticeSetup | null) {
    this.getSave = getSave;
    const kit = initial ?? (getSave().lastKit ? { ...getSave().lastKit!, levelId: 'plains' as PracticeLevelId, dragon: 'off' as PracticeDragon } : null);
    if (kit) {
      this.levelIndex = Math.max(0, this.levels.indexOf(kit.levelId)); this.cls = kit.cls;
      this.weaponIndex = Math.max(0, this.weapons.indexOf(kit.weapon)); this.dragonIndex = Math.max(0, PRACTICE_DRAGON.indexOf(kit.dragon));
      const l = (kit as PracticeSetup).layout;
      if (l) { this.picks = [...l]; this.layoutMode = layoutCode(l) === layoutCode(classicLayout()) ? 'classic' : 'custom'; }
    }
  }
  get levels(): PracticeLevelId[] { return practiceLevels(this.getSave().progress.levelsReached); }
  get weapons(): WeaponId[] { return practiceWeapons(this.cls, this.getSave().unlocks.startWeapons); }
  get levelId(): PracticeLevelId { return this.levels[Math.min(this.levelIndex, this.levels.length - 1)]; }
  get weapon(): WeaponId { return this.weapons[Math.min(this.weaponIndex, this.weapons.length - 1)]; }
  get dragonEnabled(): boolean { return dragonAllowed(this.levelId); }
  get dragon(): PracticeDragon { return this.dragonEnabled ? PRACTICE_DRAGON[this.dragonIndex] : 'off'; }
  get layoutEnabled(): boolean { return LEVEL_PACKS.includes(this.levelId); }
  /** The chosen picks; null = Random (the attempt's seed picks). */
  get layout(): Picks | null {
    if (!this.layoutEnabled || this.layoutMode === 'random') return null;
    return this.layoutMode === 'classic' ? classicLayout() : [...this.picks];
  }
  get setup(): PracticeSetup { return { levelId: this.levelId, cls: this.cls, weapon: this.weapon, dragon: this.dragon, layout: this.layout }; }
  /** Rows shown now: the section rows only for a Custom layout. */
  get rows(): Row[] { return P.rows.filter((r) => sectionOf(r) === null || (this.layoutEnabled && this.layoutMode === 'custom')); }
  get seedText(): string { return this.getSave().typedSeed ?? 'Random'; }
  /** Best for the chosen layout; Random has no fixed layout, so no best is shown. */
  get best(): string {
    const l = this.layoutEnabled ? this.layout : classicLayout();
    if (!l) return '—';
    const t = this.getSave().practiceBests[practiceKey(this.levelId, this.cls, layoutCode(l))]; return t === undefined ? '—' : formatTime(t);
  }
  /** The label and value to draw for each row. */
  value(row: Row): string {
    switch (row) {
      case 'stage': return PRACTICE_LEVEL_NAME[this.levelId];
      case 'class': return CLASS_NAME[this.cls];
      case 'weapon': return WEAPON_NAME(this.weapon);
      case 'dragon': return this.dragonEnabled ? PRACTICE_DRAGON_LABEL[this.dragon] : '—';
      case 'layout': return this.layoutEnabled ? (this.layoutMode === 'custom' ? `Custom ${layoutCode(this.picks)}` : PRACTICE_LAYOUT_LABEL[this.layoutMode]) : '—';
      case 's2': case 's3': case 's4': case 's6': case 's7': {
        const n = sectionOf(row)!, v = this.picks[n - 1];
        return `v${v} ${VERSION_NAMES[this.levelId]?.[n]?.[v - 1] ?? ''}`.trim();
      }
      case 'seed': return this.seedText;
      case 'best': return this.best;
      default: return '';
    }
  }
  get selectable(): Row[] { return this.rows.filter((r) => r !== 'seed' && r !== 'best' && (r !== 'dragon' || this.dragonEnabled) && (r !== 'layout' || this.layoutEnabled)); }
  private cycle(row: Row, d: 1 | -1): void {
    const wrap = (i: number, n: number) => (i + d + n) % n;
    if (row === 'stage') this.levelIndex = wrap(this.levelIndex, this.levels.length);
    if (row === 'class') { this.cls = CLASS_IDS[wrap(CLASS_IDS.indexOf(this.cls), CLASS_IDS.length)]; this.weaponIndex = 0; }
    if (row === 'weapon') this.weaponIndex = wrap(this.weaponIndex, this.weapons.length);
    if (row === 'dragon') this.dragonIndex = wrap(this.dragonIndex, PRACTICE_DRAGON.length);
    if (row === 'layout') this.layoutMode = PRACTICE_LAYOUT[wrap(PRACTICE_LAYOUT.indexOf(this.layoutMode), PRACTICE_LAYOUT.length)];
    const n = sectionOf(row);
    if (n !== null) this.picks[n - 1] = wrap(this.picks[n - 1] - 1, LAYOUT.versions) + 1;
  }
  select(row: Row): void { if (this.selectable.includes(row)) this.cursor = row; }
  action(action: HomePanelAction): PracticeSetupResult {
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
    if (!list.includes(this.cursor) || !this.selectable.includes(this.cursor)) this.cursor = 'stage';
    return null;
  }
}

export class PracticeSetupView extends MenuSurface {
  readonly model: PracticeSetupModel;
  private readonly callbacks: { onStart(setup: PracticeSetup): void; onClose(): void };
  constructor(scene: Phaser.Scene, getSave: () => SaveData, initial: PracticeSetup | null, callbacks: { onStart(setup: PracticeSetup): void; onClose(): void }) {
    super(scene); this.model = new PracticeSetupModel(getSave, initial); this.callbacks = callbacks; this.render();
  }
  action(action: HomePanelAction): void {
    if (!this.enabled || this.closed) return;
    const result = this.model.action(action);
    if (result === 'start') { const setup = this.model.setup; this.destroy(); this.callbacks.onStart(setup); }
    else if (result === 'back') { this.destroy(); this.callbacks.onClose(); }
    else this.render();
  }
  protected render(): void {
    const m = this.model; if (!this.beginDraw([m.cursor, m.setup, m.seedText, m.best, m.layoutMode])) return;
    const mid = this.scene.scale.width / 2;
    const extra = (m.rows.length - (P.rows.length - SECTION_ROWS.length)) * P.rowStep;
    this.panel([P.panel[0], P.panel[1], P.panel[2], P.panel[3] + extra]); this.text(mid, P.titleY, 'PRACTICE', UI_COLOR.text, true);
    m.rows.forEach((row, i) => {
      const y = P.rowsY + i * P.rowStep, sel = m.cursor === row, readOnly = row === 'seed' || row === 'best' || (row === 'dragon' && !m.dragonEnabled) || (row === 'layout' && !m.layoutEnabled);
      const color = readOnly ? (row === 'dragon' || row === 'layout' ? UI_COLOR.textOff : UI_COLOR.textDim) : sel ? UI_COLOR.highlight : UI_COLOR.text;
      if (row === 'start' || row === 'back') {
        this.text(mid, y + 8, `${sel ? '▸ ' : ''}${row === 'start' ? 'Start' : 'Back'}`, color);
        this.target(mid - P.rowW / 2, y + 8, P.rowW, P.rowStep, () => m.select(row), () => this.action('confirm'));
        return;
      }
      this.text(P.labelX, y, `${sel ? '▸ ' : ''}${P.labels[row]}`, color, false, 'left');
      const value = m.value(row), arrows = sel && !readOnly;
      const t = this.text(P.valueX, y, arrows ? `< ${value} >` : value, row === 'class' && !readOnly ? CLASS_COLOR[m.cls] : color, false, 'right');
      if (row === 'class' && !arrows) t.setTint(CLASS_COLOR[m.cls]);
      if (!readOnly) this.target(P.labelX, y, P.rowW - 48, P.rowStep, () => m.select(row), () => this.action('right'));
    });
    this.hint(mid, P.hintY + extra, ['←→ Change   ↑↓ Select   ', { menu: 'confirm' }, ' Confirm   ', { menu: 'back' }, ' Back']);
  }
}

/** 07 §7.4 result screen: `Retry`, `Change setup`, `Title`; confirms are ignored for 0.5 s. */
export type PracticeResultCommand = (typeof P.result.commands)[number];
export class PracticeResultModel {
  cursor = 0; guardLeft: number = P.result.guardSeconds;
  get canConfirm(): boolean { return this.guardLeft <= Number.EPSILON; }
  advance(seconds: number): void { this.guardLeft = Math.max(0, this.guardLeft - Math.min(UI_FRAME_SECONDS, Math.max(0, seconds))); }
  action(action: HomePanelAction): PracticeResultCommand | null {
    if (action === 'up') this.cursor = Math.max(0, this.cursor - 1);
    if (action === 'down') this.cursor = Math.min(P.result.rows.length - 1, this.cursor + 1);
    return action === 'confirm' && this.canConfirm ? P.result.commands[this.cursor] : null;
  }
}
/** The line under the time: `★ NEW BEST` or `Best m:ss.cc`. */
export const practiceBestLine = (clear: { ticks: number; best: number | null; isNew: boolean }): { text: string; highlight: boolean } =>
  clear.isNew ? { text: '★ NEW BEST', highlight: true } : { text: `Best ${formatTime(clear.best ?? clear.ticks)}`, highlight: false };

export class PracticeResultView extends MenuSurface {
  readonly model = new PracticeResultModel();
  private readonly clear: { ticks: number; best: number | null; isNew: boolean };
  private readonly choose: (command: PracticeResultCommand) => void;
  constructor(scene: Phaser.Scene, clear: { ticks: number; best: number | null; isNew: boolean }, choose: (command: PracticeResultCommand) => void) {
    super(scene); this.clear = clear; this.choose = choose; this.render();
  }
  override update(seconds: number): void { this.model.advance(seconds); super.update(seconds); }
  action(action: HomePanelAction): void {
    if (!this.enabled || this.closed) return;
    const result = this.model.action(action); if (result) this.choose(result);
    this.render();
  }
  protected render(): void {
    const m = this.model, R = P.result; if (!this.beginDraw([m.cursor, m.canConfirm])) return;
    const mid = this.scene.scale.width / 2, line = practiceBestLine(this.clear);
    this.text(mid, R.titleY, 'STAGE CLEAR', UI_COLOR.text, true);
    this.text(mid, R.timeY, formatTime(this.clear.ticks), UI_COLOR.text, true);
    this.text(mid, R.bestY, line.text, line.highlight ? UI_COLOR.highlight : UI_COLOR.textDim);
    R.rows.forEach((label, i) => {
      const y = R.rowsY + i * R.rowStep;
      this.text(mid, y, `${m.cursor === i ? '▸ ' : ''}${label}`, m.cursor === i ? UI_COLOR.highlight : UI_COLOR.text);
      this.target(mid - R.rowW / 2, y, R.rowW, R.rowH, () => { m.cursor = i; }, () => this.action('confirm'));
    });
  }
}
