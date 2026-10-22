// Timer and split presentation (07 §4.11, §6.9). Record decisions stay in core/run/splits.
import type Phaser from 'phaser';
import type { GameWorld, WorldEvent } from '../../core/sim/gameWorld.ts';
import { formatDelta, formatTime } from '../../core/time.ts';
import { TICK_RATE } from '../../core/tuning.ts';
import { timedDoorTimeLeft } from '../../core/run/timedDoors.ts';
import { FONTS } from '../../data/animKeys.ts';
import { STAGE_UI as U, LOOT_HUD_UI as B, UI_FRAME_SECONDS } from '../../data/stageUi.ts';
import { UI_COLOR } from '../../data/uiText.ts';
import { VILLAGE_SHORT } from '../../data/villages.ts';
import { DEPTH } from '../../data/art.ts';

export type SplitEvent = Extract<WorldEvent, { t: 'split' }>;
export function splitAlertModel(e: SplitEvent) {
  return { title: `STAGE ${e.index} CLEAR`, time: formatTime(e.runTicks), delta: e.deltaTicks === null ? '' : formatDelta(e.deltaTicks),
    deltaColor: e.deltaTicks === null || e.deltaTicks === 0 ? UI_COLOR.text : e.deltaTicks < 0 ? UI_COLOR.good : UI_COLOR.bad,
    badge: e.bestSegment ? '★ BEST SEGMENT' : '' };
}
export class SplitAlerts {
  private queue: { event: SplitEvent; elapsed: number }[] = [];
  get current() { return this.queue[0] ?? null; }
  push(event: SplitEvent): void { this.queue.push({ event, elapsed: 0 }); }
  clear(): void { this.queue = []; }
  advance(seconds: number, paused: boolean): void {
    if (paused || !this.current) return;
    this.current.elapsed += seconds;
    while (this.current && this.current.elapsed >= U.splitSeconds) {
      const extra = this.current.elapsed - U.splitSeconds; this.queue.shift();
      if (this.current) this.current.elapsed += extra;
    }
  }
}
export function timerBlockModel(w: GameWorld, showTimer: boolean) {
  const visible = w.level?.kind !== 'training' && w.level?.id !== 'home' && w.run.phase !== 'homeVillage';
  const practice = !!w.opts.practiceSetup;
  let info = practice ? 'PRACTICE' : w.run.seeded ? `SEED ${w.run.seedText}` : '', infoBad = false;
  for (const door of w.timedDoors) {
    const body = w.bodies.list.find((b) => b.id === door.id);
    if (!body || w.run.timedDoors[door.id] !== 'pending' || Math.abs(body.x - w.body.x) > U.doorInfoRange) continue;
    const left = Math.max(0, timedDoorTimeLeft(w, door.id)); info = `DOOR ${formatTime(Math.round(left * TICK_RATE))}`; infoBad = left < U.doorInfoBadS; break;
  }
  // 07 §3: in practice the timer shows the practice time (stageTicks) and the segment line is hidden.
  return { time: formatTime(practice ? w.run.stageTicks : w.run.runTicks), segment: w.level?.kind === 'village' ? VILLAGE_SHORT[w.level.id] : `STAGE ${w.stage}  ${formatTime(w.run.stageTicks)}`,
    timeVisible: visible && showTimer, segmentVisible: visible && showTimer && !practice, infoVisible: visible, info, infoBad };
}

export class TimerBlock {
  readonly alerts = new SplitAlerts();
  private readonly time: Phaser.GameObjects.BitmapText;
  private readonly segment: Phaser.GameObjects.BitmapText;
  private readonly info: Phaser.GameObjects.BitmapText;
  private readonly title: Phaser.GameObjects.BitmapText;
  private readonly line: Phaser.GameObjects.BitmapText[];
  private lastTicks = 0;
  constructor(scene: Phaser.Scene) {
    const text = (x: number, y: number, large = false) => scene.add.bitmapText(x, y, large ? FONTS.large : FONTS.small, '').setScrollFactor(0).setDepth(DEPTH.hud);
    this.time = text(...U.timer, true).setOrigin(1, 0).setTint(UI_COLOR.text); this.segment = text(...U.segment).setOrigin(1, 0).setTint(UI_COLOR.textDim);
    this.info = text(...U.info).setOrigin(1, 0); this.title = text(...U.alert, true).setOrigin(0.5, 0).setMaxWidth(U.alertMaxWidth);
    this.line = [text(0, U.alertLineY), text(0, U.alertLineY), text(0, U.alertLineY)];
  }
  advance(seconds: number, paused: boolean): void { this.alerts.advance(Math.min(UI_FRAME_SECONDS, Math.max(0, seconds)), paused); }
  snapshot() {
    const a = this.alerts.current;
    return { time: this.time.text, segment: this.segment.text, info: this.info.text, timeVisible: this.time.visible,
      segmentVisible: this.segment.visible, infoVisible: this.info.visible,
      alert: a ? { ...splitAlertModel(a.event), event: { ...a.event }, elapsed: a.elapsed } : null };
  }
  draw(w: GameWorld, showTimer: boolean, hidden: boolean, events: readonly WorldEvent[]): void {
    if (w.run.runTicks < this.lastTicks) this.alerts.clear(); this.lastTicks = w.run.runTicks;
    for (const e of events) if (e.t === 'split') this.alerts.push(e);
    const m = timerBlockModel(w, showTimer);
    this.time.setText(m.time).setVisible(m.timeVisible && !hidden); this.segment.setText(m.segment).setVisible(m.segmentVisible && !hidden);
    this.info.setText(m.info).setTint(m.infoBad ? UI_COLOR.bad : UI_COLOR.text).setVisible(m.infoVisible && !hidden);
    const a = this.alerts.current;
    this.title.setVisible(!!a && !hidden); for (const t of this.line) t.setVisible(!!a && !hidden);
    if (!a) return;
    const split = splitAlertModel(a.event), alpha = Math.min(1, a.elapsed / B.bannerInS, (U.splitSeconds - a.elapsed) / B.bannerOutS);
    const lift = (1 - Math.min(1, a.elapsed / B.bannerInS)) * B.bannerDrop;
    this.title.setText(split.title).setTint(UI_COLOR.text).setAlpha(alpha).setY(U.alert[1] - lift);
    const values = [split.time, split.delta, split.badge], colors = [UI_COLOR.text, split.deltaColor, UI_COLOR.highlight];
    this.line.forEach((t, i) => t.setText(values[i]).setTint(colors[i]).setAlpha(alpha).setY(U.alertLineY - lift));
    const width = this.line.reduce((sum, t) => sum + (t.text ? t.width + U.alertGap : 0), -U.alertGap);
    let x = U.alert[0] - width / 2;
    for (const t of this.line) { t.setX(x); if (t.text) x += t.width + U.alertGap; }
  }
}
