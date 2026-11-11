// Title → Daily (06 §14.1, M18): today's daily, a past day or any seed (the seed challenge), the leaderboard.
import type Phaser from 'phaser';
import { dailyDay, dailyKit, dailySeed, dailyTwist, pastDays } from '../../core/run/daily.ts';
import { sprintPick, STAGE_TITLE, weekOf, weeklySeed } from '../../core/run/sprint.ts';
import type { SaveData } from '../../core/save/schema.ts';
import { formatTime } from '../../core/time.ts';
import { CLASS_NAME } from '../../data/classes.ts';
import { DAILY_MENU_UI as D, TWIST_NAME, TWIST_TEXT } from '../../data/twists.ts';
import { UI_COLOR, WEAPON_NAME } from '../../data/uiText.ts';
import type { HomePanelAction } from '../home/homePanels.ts';
import { MenuSurface } from './records.ts';

type Row = (typeof D.rows)[number];
export type DailyChoice = { kind: 'today' } | { kind: 'weekly' } | { kind: 'challenge'; seed: string; format: 'sprint' | 'weekly' } | { kind: 'leaderboard' }
  | { kind: 'askSeed'; format: 'sprint' | 'weekly' } | { kind: 'back' };
const date = (day: string) => `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}`;

export class DailyMenuModel {
  cursor: Row = 'today'; pastIndex = 0;
  readonly today: string; readonly past: string[]; readonly week: { monday: string; label: string };
  private readonly getSave: () => SaveData; private readonly online: boolean;
  constructor(getSave: () => SaveData, now: Date, online: boolean) {
    this.getSave = getSave; this.today = dailyDay(now); this.past = pastDays(now); this.week = weekOf(now); this.online = online;
  }
  get rows(): Row[] { return D.rows.filter((r) => r !== 'leaderboard' || this.online); }
  get typedSeed(): string | null { return this.getSave().typedSeed; }
  kitLine(seed: string): string { const k = dailyKit(seed); return `${TWIST_NAME[dailyTwist(seed)]} · ${CLASS_NAME[k.cls]} (${WEAPON_NAME(k.weapon)})`; }
  sprintLine(seed: string): string { const p = sprintPick(seed); return `${STAGE_TITLE[p.stage]} · ${TWIST_NAME[p.twist]} · ${CLASS_NAME[p.cls]} (${WEAPON_NAME(p.weapon)})`; }
  label(row: Row): string {
    const save = this.getSave(), best = (t: number | null | undefined) => (t != null ? ` · best ${formatTime(t)}` : '');
    if (row === 'today') return `Daily Sprint ${date(this.today)} · ${this.sprintLine(dailySeed(this.today))}${best(save.daily[this.today]?.bestTicks)}`;
    if (row === 'weekly') return `Weekly Run ${this.week.label} · ${this.kitLine(weeklySeed(this.week.monday))}${best(save.weekly[this.week.monday]?.bestTicks)}`;
    if (row === 'past') { const d = this.past[this.pastIndex], b = save.seedBests.find((x) => x.seed === dailySeed(d)); return `Past day < ${date(d)} > · ${this.sprintLine(dailySeed(d))}${best(b?.ticks)}`; }
    if (row === 'seed') return 'Any seed — Sprint…';
    if (row === 'seedWeekly') return 'Any seed — full run…';
    if (row === 'leaderboard') return 'Leaderboard';
    return 'Back';
  }
  get twistText(): string {
    const seed = this.cursor === 'weekly' ? weeklySeed(this.week.monday) : dailySeed(this.cursor === 'past' ? this.past[this.pastIndex] : this.today);
    return TWIST_TEXT[this.cursor === 'weekly' ? dailyTwist(seed) : sprintPick(seed).twist];
  }
  action(a: HomePanelAction): DailyChoice | null {
    const list = this.rows, at = Math.max(0, list.indexOf(this.cursor));
    if (a === 'back') return { kind: 'back' };
    if (a === 'up') this.cursor = list[Math.max(0, at - 1)];
    if (a === 'down') this.cursor = list[Math.min(list.length - 1, at + 1)];
    if ((a === 'left' || a === 'right') && this.cursor === 'past') this.pastIndex = Math.max(0, Math.min(this.past.length - 1, this.pastIndex + (a === 'right' ? -1 : 1)));
    if (a !== 'confirm') return null;
    if (this.cursor === 'today') return { kind: 'today' };
    if (this.cursor === 'weekly') return { kind: 'weekly' };
    if (this.cursor === 'past') return { kind: 'challenge', seed: dailySeed(this.past[this.pastIndex]), format: 'sprint' };
    if (this.cursor === 'seed' || this.cursor === 'seedWeekly') return { kind: 'askSeed', format: this.cursor === 'seed' ? 'sprint' : 'weekly' };
    if (this.cursor === 'leaderboard') return { kind: 'leaderboard' };
    return { kind: 'back' };
  }
}

export class DailyMenuView extends MenuSurface {
  readonly model: DailyMenuModel;
  private readonly onChoice: (c: DailyChoice) => void;
  constructor(scene: Phaser.Scene, getSave: () => SaveData, online: boolean, onChoice: (c: DailyChoice) => void) {
    super(scene); this.model = new DailyMenuModel(getSave, new Date(), online); this.onChoice = onChoice; this.render();
  }
  action(action: HomePanelAction): void {
    if (!this.enabled || this.closed) return;
    const c = this.model.action(action);
    if (c && c.kind !== 'askSeed') { this.destroy(); this.onChoice(c); return; }
    if (c) this.onChoice(c);
    this.render();
  }
  protected render(): void {
    const m = this.model; if (!this.beginDraw([m.cursor, m.pastIndex, m.typedSeed])) return;
    const mid = this.scene.scale.width / 2;
    this.panel([...D.panel]); this.text(mid, D.titleY, 'DAILY', UI_COLOR.text, true);
    this.text(mid, D.twistY, m.twistText, UI_COLOR.textDim);
    m.rows.forEach((row, i) => {
      const y = D.rowsY + i * D.rowStep, sel = m.cursor === row;
      this.text(mid, y, `${sel ? '▸ ' : ''}${m.label(row)}`, sel ? UI_COLOR.highlight : UI_COLOR.text);
      this.target(mid - D.rowW / 2, y, D.rowW, D.rowStep, () => { m.cursor = row; }, () => this.action('confirm'));
    });
    this.hint(mid, D.hintY, ['←→ Day   ↑↓ Select   ', { menu: 'confirm' }, ' Play   ', { menu: 'back' }, ' Back']);
  }
}
