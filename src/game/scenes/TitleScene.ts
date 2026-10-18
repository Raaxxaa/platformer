// Two-step Title, Records and Settings (07 §7.3). Debug start URLs skip this scene.
import Phaser from 'phaser';
import { FRONT_UI as U } from '../../data/frontUi.ts';
import { GRADE_COLOR, UI_COLOR } from '../../data/uiText.ts';
import { UI_FRAME_SECONDS } from '../../data/stageUi.ts';
import { loadAssets } from '../assets/loadAssets.ts';
import { debugEnabled } from '../debug.ts';
import { gameSession } from '../session.ts';
import { saveStore } from '../save/storage.ts';
import { MenuScreens } from '../menuScreens.ts';
import { applySettings } from '../settings.ts';
import { getUiSettings, noteInputDevice, setKeyboardLayout } from '../../ui/inputSettings.ts';
import { activeHomePad, type HomePanelAction, type HomePanelPad } from '../../ui/home/homePanels.ts';
import { MenuSurface } from '../../ui/screens/records.ts';
import { TitleModel } from '../../ui/screens/front.ts';
export const TITLE_CHOICES = U.titleRows.map((label, i) => ({ label, level: i === 0 ? 'home' : i === 1 ? 'training_yard' : null }));
class TitleView extends MenuSurface {
  private readonly choose: (index: number) => void;
  readonly model = new TitleModel();
  private seconds = 0;
  private swallowGesture: string | null = null;
  constructor(scene: Phaser.Scene, choose: (index: number) => void) {
    super(scene); this.choose = choose; window.addEventListener('keydown', this.gestureKey, true); window.addEventListener('keyup', this.gestureUp, true); scene.input.on('pointerdown', this.gesturePointer); this.render();
  }
  protected allowKey(event: KeyboardEvent): boolean { return event.code !== this.swallowGesture; }
  private readonly gestureKey = (event: KeyboardEvent) => {
    if (this.enabled && !this.closed && this.model.step === 1 && !event.repeat) { event.preventDefault(); this.swallowGesture = event.code; noteInputDevice('keyboard'); this.model.gesture(); this.render(); }
  };
  private readonly gestureUp = (event: KeyboardEvent) => { if (event.code === this.swallowGesture) this.swallowGesture = null; };
  private readonly gesturePointer = () => { if (this.enabled && !this.closed && this.model.step === 1) { this.model.gesture(); this.render(); } };
  override update(seconds: number, pad: HomePanelPad | null = activeHomePad()): void {
    if (!this.enabled) return;
    this.seconds += Math.min(UI_FRAME_SECONDS, Math.max(0, seconds));
    if (this.model.step === 1 && pad?.buttons.some((button) => button.pressed)) { this.model.gesture(); this.input.blockHeldPad(pad); this.render(); return; }
    super.update(seconds, pad);
  }
  action(action: HomePanelAction): void { if (!this.enabled || this.closed) return; const result = this.model.action(action); if (result) this.choose(U.titleCommands.indexOf(result)); this.render(); }
  override destroy(): void { window.removeEventListener('keydown', this.gestureKey, true); window.removeEventListener('keyup', this.gestureUp, true); this.scene.input.off('pointerdown', this.gesturePointer); super.destroy(); }
  protected render(): void {
    const m = this.model, T = U.title, blink = Math.floor(this.seconds * T.blinkHz * 2) % 2 === 0;
    if (!this.beginDraw([m.step, m.cursor, blink, this.scene.sound.locked, saveStore().warning])) return;
    this.text(this.scene.scale.width / 2, T.titleY, 'RUSHBLADE', GRADE_COLOR.S, true).setScale(T.scale);
    if (m.step === 1) { if (blink) this.text(this.scene.scale.width / 2, T.promptY, 'Press any button'); }
    else U.titleRows.forEach((label, i) => {
      const x = (this.scene.scale.width - T.rowW) / 2, y = T.rowsY + i * T.rowStep;
      this.text(this.scene.scale.width / 2, y, `${m.cursor === i ? '▸ ' : ''}${label}`, m.cursor === i ? UI_COLOR.highlight : UI_COLOR.text);
      this.target(x, y, T.rowW, T.rowH, () => { m.cursor = i; }, () => this.action('confirm'));
    });
    this.text(T.version[0], T.version[1], 'v0.0.0', UI_COLOR.textOff, false, 'right');
    if (m.step === 2 && this.scene.sound.locked) this.text(this.scene.scale.width / 2, T.soundY, 'Press a key or click to enable sound', UI_COLOR.textDim);
    if (saveStore().readOnly || saveStore().warning) this.text(this.scene.scale.width / 2, T.warningY, saveStore().readOnly ? U.newer : saveStore().warning!, UI_COLOR.bad);
  }
}
export class TitleScene extends Phaser.Scene {
  private titleView!: TitleView;
  private screens!: MenuScreens;
  private fade!: Phaser.GameObjects.Graphics;
  private fadeLeft = 0;
  constructor() { super('Title'); }
  preload(): void { loadAssets(this); }
  create(): void {
    this.fadeLeft = 0; applySettings(this, saveStore().data.settings);
    const keyboard = (navigator as Navigator & { keyboard?: { getLayoutMap(): Promise<Map<string, string>> } }).keyboard;
    void keyboard?.getLayoutMap().then(setKeyboardLayout).catch(() => {});
    for (let i = 0; i < 3; i++) this.add.image(0, 0, `bg_plains_${i}`).setOrigin(0).setScrollFactor(0);
    this.titleView = new TitleView(this, (index) => this.choose(index));
    this.screens = new MenuScreens(this, () => { if (!this.screens.active) this.titleView.setEnabled(true); });
    this.fade = this.add.graphics().setScrollFactor(0).setDepth(U.fadeDepth).fillStyle(UI_COLOR.ink).fillRect(0, 0, this.scale.width, this.scale.height).setVisible(false);
    this.events.once('shutdown', () => { this.titleView.destroy(); this.screens.destroy(); });
    if (debugEnabled()) window.__game = { ready: true, title: true, titleCursor: () => this.titleView.model.cursor,
      titleChoose: (i: number) => this.choose(i), save: () => structuredClone(saveStore().data),
      screenState: () => this.screens.active ? this.screens.snapshot() : { screen: 'title', model: { step: this.titleView.model.step, cursor: this.titleView.model.cursor } },
      screenAction: (action: HomePanelAction) => { if (this.screens.active) this.screens.action(action); else this.titleView.action(action); },
      appliedSettings: () => structuredClone(getUiSettings()),
    } as never;
  }
  update(_time: number, delta: number): void {
    if (this.fadeLeft > 0) {
      this.fadeLeft = Math.max(0, this.fadeLeft - Math.min(UI_FRAME_SECONDS, delta / 1000)); this.fade.setVisible(true).setAlpha(1 - this.fadeLeft / U.title.fadeSeconds);
      if (this.fadeLeft === 0) this.scene.start('Village', { level: 'home', titleFade: true }); return;
    }
    this.screens.update(delta / 1000); if (!this.screens.active) this.titleView.update(delta / 1000);
  }
  /** Legacy debug entry points retain the Play / Yard indices. */
  choose(index: number): void {
    if (this.fadeLeft > 0 || index < 0 || index >= U.titleRows.length) return;
    this.titleView.model.step = 2; this.titleView.setEnabled(false);
    if (index === 2) { this.screens.openRecords(); return; }
    if (index === 3) { this.screens.openSettings(); return; }
    if (index === 1) { gameSession.trainingReturn = 'title'; this.scene.start('Stage', { level: 'training_yard' }); }
    else { this.fadeLeft = U.title.fadeSeconds; if (window.__game) window.__game.ready = false; }
  }
}
