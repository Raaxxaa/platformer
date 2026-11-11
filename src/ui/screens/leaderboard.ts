// Title → Daily → Leaderboard (06 §14.3, M18): any of the last 30 days, top 50, assisted runs in their own list.
// Also the result-screen board: `#rank of N` and the top 10 with your row highlighted.
import type Phaser from 'phaser';
import type { BoardKind, BoardRow } from '../../core/run/leaderboard.ts';
import { formatTime } from '../../core/time.ts';
import { BOARD_UI as B, ONLINE } from '../../data/online.ts';
import { CLASS_NAME } from '../../data/classes.ts';
import { UI_COLOR, WEAPON_NAME } from '../../data/uiText.ts';
import type { HomePanelAction } from '../home/homePanels.ts';
import { MenuSurface } from './records.ts';
import type { ClassId } from '../../core/abilities/types.ts';

type Row = (typeof B.rows)[number];
export interface BoardDeps { days: string[]; weeks: { monday: string; label: string }[]; fetch(kind: BoardKind, day: string, assist: boolean): Promise<BoardRow[] | null>; name(): string | null; sending(): boolean;
  setName(): void; toggleSending(): void; onClose(): void }
const date = (day: string) => `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}`;

export class LeaderboardModel {
  cursor: Row = 'board'; dayIndex = 0; assist = false; kind: BoardKind = 'daily'; rows: BoardRow[] | null | 'loading' = 'loading';
  private readonly maxIndex: (k: BoardKind) => number;
  constructor(maxIndex: (k: BoardKind) => number = () => ONLINE.pastDays) { this.maxIndex = maxIndex; }
  action(a: HomePanelAction): 'reload' | 'name' | 'send' | 'back' | null {
    const list = B.rows, at = list.indexOf(this.cursor);
    if (a === 'back') return 'back';
    if (a === 'up') this.cursor = list[Math.max(0, at - 1)];
    if (a === 'down') this.cursor = list[Math.min(list.length - 1, at + 1)];
    if ((a === 'left' || a === 'right' || a === 'confirm') && this.cursor === 'board') { this.kind = this.kind === 'daily' ? 'weekly' : 'daily'; this.dayIndex = 0; return 'reload'; }
    if ((a === 'left' || a === 'right' || a === 'confirm') && this.cursor === 'list') { this.assist = !this.assist; return 'reload'; }
    if ((a === 'left' || a === 'right') && this.cursor === 'day') { this.dayIndex = Math.max(0, Math.min(this.maxIndex(this.kind), this.dayIndex + (a === 'left' ? 1 : -1))); return 'reload'; }
    if (a === 'confirm' && this.cursor === 'name') return 'name';
    if ((a === 'confirm' || a === 'left' || a === 'right') && this.cursor === 'send') return 'send';
    if (a === 'confirm' && this.cursor === 'back') return 'back';
    return null;
  }
}

export class LeaderboardView extends MenuSurface {
  readonly model: LeaderboardModel;
  private readonly deps: BoardDeps; private gen = 0;
  constructor(scene: Phaser.Scene, deps: BoardDeps) {
    super(scene); this.deps = deps; this.model = new LeaderboardModel((k) => (k === 'daily' ? deps.days.length : deps.weeks.length) - 1); this.load();
  }
  private keyAt(): string { return this.model.kind === 'daily' ? this.deps.days[this.model.dayIndex] : this.deps.weeks[this.model.dayIndex].monday; }
  private load(): void {
    const g = ++this.gen; this.model.rows = 'loading'; this.render();
    void this.deps.fetch(this.model.kind, this.keyAt(), this.model.assist).then((rows) => { if (g === this.gen && !this.closed) { this.model.rows = rows; this.render(); } });
  }
  action(action: HomePanelAction): void {
    if (!this.enabled || this.closed) return;
    const r = this.model.action(action);
    if (r === 'back') { this.destroy(); this.deps.onClose(); return; }
    if (r === 'reload') { this.load(); return; }
    if (r === 'name') this.deps.setName();
    if (r === 'send') this.deps.toggleSending();
    this.render();
  }
  protected render(): void {
    const m = this.model; if (!this.beginDraw([m.cursor, m.dayIndex, m.kind, m.assist, m.rows === 'loading' ? 0 : m.rows?.length ?? -1, this.deps.name(), this.deps.sending()])) return;
    const mid = this.scene.scale.width / 2;
    this.panel([...B.panel]); this.text(mid, B.titleY, 'DAILY LEADERBOARD', UI_COLOR.text, true);
    const labels: Record<Row, string> = { board: `Board < ${m.kind === 'daily' ? 'Daily Sprint' : 'Weekly Run'} >`,
      day: m.kind === 'daily' ? `Day < ${date(this.deps.days[m.dayIndex])} >` : `Week < ${this.deps.weeks[m.dayIndex].label} >`, list: `List < ${m.assist ? 'Assisted' : 'Normal'} >`,
      name: `Your name: ${this.deps.name() ?? '—'} (change)`, send: `Send my scores: ${this.deps.sending() ? 'On' : 'Off'}`, back: 'Back' };
    B.rows.forEach((row, i) => {
      const y = B.rowsY + i * B.rowStep, sel = m.cursor === row;
      this.text(mid, y, `${sel ? '▸ ' : ''}${labels[row]}`, sel ? UI_COLOR.highlight : UI_COLOR.text);
      this.target(mid - 160, y, 320, B.rowStep, () => { m.cursor = row; }, () => this.action('confirm'));
    });
    drawBoard(this, m.rows, this.deps.name(), B.listY, ONLINE.listTop, m.kind);
  }
}

/** The list: rank, name, kit, time; the player's row highlighted. */
export function drawBoard(s: MenuSurface, rows: BoardRow[] | null | 'loading', me: string | null, y0: number, limit: number, _kind: BoardKind = 'daily'): void {
  const t = (s as unknown as { text: MenuSurface['text'] }).text.bind(s);
  if (rows === 'loading') { t(320, y0, 'Loading…', UI_COLOR.textDim); return; }
  if (rows === null) { t(320, y0, ONLINE.unavailable, UI_COLOR.bad); return; }
  if (!rows.length) { t(320, y0, 'No scores yet', UI_COLOR.textDim); return; }
  rows.slice(0, Math.min(limit, B.listShown)).forEach((r, i) => {
    const y = y0 + i * B.listStep, c = r.name === me ? UI_COLOR.highlight : UI_COLOR.text;
    t(B.colRank, y, `#${i + 1}`, c, false, 'left'); t(B.colName, y, r.name, c, false, 'left');
    t(B.colKit, y, `${CLASS_NAME[r.class as ClassId] ?? r.class} (${WEAPON_NAME(r.weapon as never)})`, UI_COLOR.textDim, false, 'left');
    t(B.colTime, y, formatTime(r.ticks), c, false, 'right');
  });
}

/** The result-screen board (06 §14.3): `#rank of N` and the top 10. */
export class DailyStandingView extends MenuSurface {
  private readonly line: string; private readonly rows: BoardRow[] | null; private readonly me: string | null; private readonly onClose: () => void;
  constructor(scene: Phaser.Scene, line: string, rows: BoardRow[] | null, me: string | null, onClose: () => void) {
    super(scene); this.line = line; this.rows = rows; this.me = me; this.onClose = onClose; this.render();
  }
  action(a: HomePanelAction): void { if (this.enabled && !this.closed && (a === 'confirm' || a === 'back')) { this.destroy(); this.onClose(); } }
  protected render(): void {
    if (!this.beginDraw([this.line])) return;
    this.panel([...B.panel]); this.text(320, B.titleY, "TODAY'S LEADERBOARD", UI_COLOR.text, true);
    this.text(320, B.rowsY + 6, this.line, UI_COLOR.highlight);
    drawBoard(this, this.rows, this.me, B.rowsY + 30, ONLINE.resultTop);
    this.hint(320, B.hintY, [{ menu: 'confirm' }, ' Close']);
  }
}
