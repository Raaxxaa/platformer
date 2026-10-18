// Death details over the frozen world (07 §7.10).
import type Phaser from 'phaser';
import { formatTime } from '../../core/time.ts';
import { FRONT_UI as U } from '../../data/frontUi.ts';
import { UI_COLOR } from '../../data/uiText.ts';
import type { HomePanelAction } from '../home/homePanels.ts';
import { MenuSurface } from './records.ts';
import { DeathModel, deathCause } from './front.ts';
import { SAVE_RULES } from '../../data/save.ts';
export interface DeathDetails { stage: number; levelId: string; section: number; runTicks: number; cause: string; seed: string }
export class DeathView extends MenuSurface {
  private readonly details: DeathDetails;
  private readonly choose: (result: typeof U.deathCommands[number]) => void;
  readonly model = new DeathModel();
  constructor(scene: Phaser.Scene, details: DeathDetails, choose: (result: typeof U.deathCommands[number]) => void) { super(scene); this.details = details; this.choose = choose; this.render(); }
  override update(seconds: number): void { this.model.advance(seconds); super.update(seconds); }
  action(action: HomePanelAction): void { if (!this.enabled || this.closed) return; const result = this.model.action(action); if (result) this.choose(result); this.render(); }
  protected render(): void {
    const m = this.model, D = U.death; if (!this.beginDraw([m.cursor, m.canConfirm])) return;
    this.text(this.scene.scale.width / 2, D.titleY, 'YOU DIED', UI_COLOR.bad, true);
    const d = this.details, biome = U.biomes[d.levelId as keyof typeof U.biomes] ?? d.levelId;
    [`Stage ${d.stage} · ${biome} · Section ${d.section} of ${SAVE_RULES.maxSection}`, formatTime(d.runTicks), deathCause(d.cause), `Seed ${d.seed}`].forEach((line, i) => this.text(this.scene.scale.width / 2, D.infoY + i * D.lineH, line, UI_COLOR.textDim));
    U.deathRows.forEach((label, i) => {
      const x = (this.scene.scale.width - D.rowW) / 2, y = D.rowsY + i * D.rowStep;
      this.text(this.scene.scale.width / 2, y, `${m.cursor === i ? '▸ ' : ''}${label}`, m.cursor === i ? UI_COLOR.highlight : UI_COLOR.text);
      this.target(x, y, D.rowW, D.rowH, () => { m.cursor = i; }, () => this.action('confirm'));
    });
  }
}
