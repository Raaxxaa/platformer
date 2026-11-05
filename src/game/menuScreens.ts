import { getTouchOverlay } from '../ui/touch/touchInput.ts';
// Shared Records/Settings/portable save navigation. Each caller keeps its own return screen.
import type Phaser from 'phaser';
import { RecordsView } from '../ui/screens/records.ts';
import { SettingsView } from '../ui/screens/settings.ts';
import { PracticeSetupView } from '../ui/screens/practice.ts';
import { BossRushSetupView, type BossRushSetup } from '../ui/screens/bossRush.ts';
import type { PracticeSetup } from '../core/run/practice.ts';
import { SaveCodeView, type SaveCodeMode } from '../ui/screens/saveCode.ts';
import type { HomePanelAction } from '../ui/home/homePanels.ts';
import { saveStore } from './save/storage.ts';
import { applySettings } from './settings.ts';
import { SFX_RULES, sfxKey } from '../data/sfx.ts';
import { SAVE_RULES } from '../data/save.ts';
import { HudEditorView } from '../ui/screens/hudEditor.ts';
import { resolveHud } from '../ui/model/hudLayout.ts';
import { setHudDraft } from '../ui/hud/hudPreview.ts';
import { isTouchDevice } from './zoom.ts';
export class MenuScreens {
  private readonly scene: Phaser.Scene;
  private readonly closed: () => void;
  private readonly focused: (on: boolean) => void;
  private readonly imported: () => void;
  private records: RecordsView | null = null;
  private settings: SettingsView | null = null;
  private code: SaveCodeView | null = null;
  private practice: PracticeSetupView | null = null;
  private bossRush: BossRushSetupView | null = null;
  private hud: HudEditorView | null = null;
  constructor(scene: Phaser.Scene, closed: () => void, focused: (on: boolean) => void = () => {}, imported: () => void = () => {}) {
    this.scene = scene; this.closed = closed; this.focused = focused; this.imported = imported;
    scene.events.once('shutdown', () => this.destroy());
  }
  get active(): boolean { return !!(this.records || this.settings || this.code || this.practice || this.hud || this.bossRush); }
  snapshot() {
    if (this.bossRush) { const m = this.bossRush.model; return { screen: 'bossRush', model: { cursor: m.cursor, setup: { ...m.setup }, best: m.best } }; }
    if (this.practice) { const m = this.practice.model; return { screen: 'practice', model: { cursor: m.cursor, setup: { ...m.setup }, levels: m.levels, best: m.best, seed: m.seedText, selectable: m.selectable } }; }
    if (this.code) { const m = this.code.model; return { screen: m.mode, model: { stage: m.stage, cursor: m.cursor, error: m.error, confirming: m.confirming, notice: m.notice } }; }
    if (this.settings) { const m = this.settings.model; return { screen: 'settings', model: { cursor: m.cursor, rows: [...m.rows], controlsOpen: m.controlsOpen } }; }
    if (this.hud) { const m = this.hud.model; return { screen: 'hudLayout', model: { group: m.group, layout: structuredClone(m.layout), problems: m.problems } }; }
    if (this.records) { const m = this.records.model; return { screen: 'records', model: { tab: m.tab, cell: m.cell, footer: m.footer, look: m.look } }; }
    return { screen: null, model: null };
  }
  action(action: HomePanelAction): void { (this.code ?? this.settings ?? this.records ?? this.practice ?? this.bossRush ?? this.hud)?.action(action); }
  update(seconds: number): void { (this.code ?? this.settings ?? this.records ?? this.practice ?? this.bossRush ?? this.hud)?.update(seconds); }
  openPractice(initial: PracticeSetup | null, onStart: (setup: PracticeSetup) => void): void {
    this.destroy(); this.practice = new PracticeSetupView(this.scene, () => saveStore().data, initial, { onStart: (setup) => { this.practice = null; onStart(setup); }, onClose: () => { this.practice = null; this.closed(); } });
  }
  openBossRush(initial: BossRushSetup | null, onStart: (setup: BossRushSetup) => void): void {
    this.destroy(); this.bossRush = new BossRushSetupView(this.scene, () => saveStore().data, initial, { onStart: (setup) => { this.bossRush = null; onStart(setup); }, onClose: () => { this.bossRush = null; this.closed(); } });
  }
  openRecords(): void {
    this.destroy(); this.records = new RecordsView(this.scene, () => saveStore().data, { onClose: () => { this.records = null; this.closed(); } });
  }
  openSettings(): void {
    this.destroy(); this.settings = new SettingsView(this.scene, () => saveStore().data.settings, {
      onChange: (settings) => {
        const oldSfx = saveStore().data.settings.volume.sfx;
        saveStore().update((s) => { s.settings = structuredClone(settings); }); applySettings(this.scene, settings);
        if (oldSfx !== settings.volume.sfx && !this.scene.sound.locked && this.scene.cache.audio.exists(sfxKey('ui_move', 0)))
          this.scene.sound.play(sfxKey('ui_move', 0), { volume: settings.volume.sfx / SAVE_RULES.volumeMax * SFX_RULES.busTrim.ui });
      },
      onExport: () => this.openCode('export'), onImport: () => this.openCode('import'),
      onFullscreen: () => { if (this.scene.scale.isFullscreen) this.scene.scale.stopFullscreen(); else this.scene.scale.startFullscreen(); },
      onClose: () => { this.settings = null; this.closed(); },
      // Edit layout: the touch overlay's editor takes the screen, then the settings come back (07 §8.6).
      onEditHud: () => {
        this.settings = null;
        const touch = isTouchDevice(), start = resolveHud(saveStore().data.settings.hud, touch);
        setHudDraft(start);
        this.hud = new HudEditorView(this.scene, start, touch, (l) => setHudDraft(l), (saved) => {
          setHudDraft(null); this.hud = null;
          if (saved) { saveStore().update((s) => { s.settings.hud = saved; }); applySettings(this.scene, saveStore().data.settings); }
          this.openSettings();
        });
      },
      onEditLayout: () => { this.settings = null; const o = getTouchOverlay(); if (o) o.startEditing(() => this.openSettings()); else this.openSettings(); },
    });
  }
  private openCode(mode: SaveCodeMode): void {
    this.settings?.setEnabled(false);
    this.code = new SaveCodeView(this.scene, mode, {
      exportCode: saveStore().exportCode(), preview: (code) => saveStore().previewImport(code),
      confirm: (data) => { const ok = saveStore().replace(data); if (ok) { applySettings(this.scene, saveStore().data.settings); this.imported(); } return ok; },
      onFocus: this.focused,
      onClose: () => { this.code = null; this.settings?.setEnabled(true); this.closed(); },
    });
  }
  destroy(): void { this.code?.destroy(); this.records?.destroy(); this.settings?.destroy(); this.practice?.destroy(); this.bossRush?.destroy(); this.bossRush = null; this.hud?.destroy(); this.hud = null; setHudDraft(null); this.code = null; this.records = null; this.settings = null; this.practice = null; }
}
