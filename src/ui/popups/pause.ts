// The pause menu (07 §7.6): `dim` over the game, a 360 × 220 panel with the MENU / LOADOUT / CONTROLS tabs.
import Phaser from 'phaser';
import type { GameWorld } from '../../core/sim/gameWorld.ts';
import { formatTime } from '../../core/time.ts';
import { ABILITY_INFO } from '../../data/abilities.ts';
import { FONTS, itemIcon } from '../../data/animKeys.ts';
import { BONDS, CLASS_NAME, WEAPON_CLASSES } from '../../data/classes.ts';
import { PAUSE_UI as P } from '../../data/stageUi.ts';
import { ABILITY_BLURB, BOND_BLURB, CLASS_COLOR, CONTROLS_LIST, GRADE_COLOR, HUD_COLOR, HYBRID_BLURB, HYBRID_COLOR, UI_COLOR, WEAPON_BLURB, WEAPON_NAME } from '../../data/uiText.ts';
import { weaponDmg } from '../model/hudModel.ts';
import { PAUSE, type PauseModel } from '../model/pauseModel.ts';
import { box, SKIN } from '../skin.ts';
import { STAT_PICK_UI } from '../../data/statUi.ts';

export class PauseView {
  private scene: Phaser.Scene;
  private c: Phaser.GameObjects.Container;
  private key = '';

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.c = scene.add.container(0, 0).setScrollFactor(0).setDepth(STAT_PICK_UI.pauseDepth);
  }

  destroy(): void { this.c.destroy(); }

  private t(x: number, y: number, s: string, color: number = UI_COLOR.text, font: string = FONTS.small) {
    const o = this.scene.add.bitmapText(P.panel[0] + x, P.panel[1] + y, font, s).setTint(color);
    this.c.add(o);
    return o;
  }
  private img(x: number, y: number, frame: string, tint?: number) {
    const o = this.scene.add.image(P.panel[0] + x, P.panel[1] + y, 'ui', frame).setOrigin(0);
    if (tint !== undefined) o.setTint(tint);
    this.c.add(o);
    return o;
  }

  draw(m: PauseModel, w: GameWorld, info: string): void {
    const key = JSON.stringify([m.tab, m.cursor, m.label(m.cursor), info, w.combat.slots, w.abilities.slots]);
    if (key === this.key) return;
    this.key = key;
    this.c.removeAll(true);
    const { width, height } = this.scene.scale;
    const dim = this.scene.add.graphics();
    dim.fillStyle(0x000000, HUD_COLOR.dimAlpha).fillRect(0, 0, width, height);
    this.c.add(dim);
    const [px, py, pw, ph] = P.panel;
    for (const o of box(this.scene, SKIN.panel, px, py, pw, ph, SKIN.corner.panel)) this.c.add(o);
    // Tabs.
    const tabsW = PAUSE.tabs.length * P.tabW + (PAUSE.tabs.length - 1) * P.tabGap;
    PAUSE.tabs.forEach((tab, i) => {
      const x = (pw - tabsW) / 2 + i * (P.tabW + P.tabGap), on = tab === m.tab;
      for (const o of box(this.scene, on ? SKIN.tabOn : SKIN.tabOff, px + x, py + P.tabY, P.tabW, P.tabH, SKIN.corner.tab,
        { fill: on ? UI_COLOR.panelBorder : UI_COLOR.panel, edge: on ? UI_COLOR.highlight : UI_COLOR.panelBorder })) this.c.add(o);
      this.t(x + P.tabW / 2, P.tabY + 3, tab, on ? UI_COLOR.highlight : UI_COLOR.textDim).setOrigin(0.5, 0);
    });
    if (m.tab === 'MENU') this.menu(m, info);
    else if (m.tab === 'LOADOUT') this.loadout(w);
    else this.controls();
    this.t(pw / 2, P.hintY, '←→ Tabs   ↑↓ Select   [ENT] Confirm   [ESC] Resume', UI_COLOR.textDim).setOrigin(0.5, 0);
  }

  private menu(m: PauseModel, info: string): void {
    const pw = P.panel[2];
    this.t(pw / 2, P.titleY, 'PAUSED', UI_COLOR.text, FONTS.large).setOrigin(0.5, 0);
    this.t(pw / 2, P.infoY, info, UI_COLOR.textDim).setOrigin(0.5, 0);
    m.items.forEach((it, i) => {
      const sel = i === m.cursor, label = m.label(i);
      const color = it.disabled ? UI_COLOR.textOff : sel ? (label === PAUSE.quitArmed ? UI_COLOR.bad : UI_COLOR.highlight) : UI_COLOR.text;
      const y = P.itemsY + i * P.itemStep;
      this.t(pw / 2, y, label, color).setOrigin(0.5, 0);
      if (sel) this.t(pw / 2 - 60 - P.cursorDx, y, '▸', UI_COLOR.highlight);
    });
  }

  private loadout(w: GameWorld): void {
    const carried = w.classState.carriedClasses;
    const rows: { icon: string | null; name: string; nameColor: number; badge: string; line: string; tags?: string[] }[] = [];
    w.combat.slots.forEach((s, i) => {
      if (!s) { rows.push({ icon: null, name: `Weapon ${i + 1}: (empty)`, nameColor: UI_COLOR.textOff, badge: '', line: '' }); return; }
      const tags = WEAPON_CLASSES[s.weaponId], matched = tags.some((c) => carried.includes(c));
      rows.push({
        icon: itemIcon('weapon', s.weaponId), name: WEAPON_NAME(s.weaponId), nameColor: GRADE_COLOR[s.grade], badge: s.grade,
        line: `DMG ${weaponDmg(s.grade, matched)}${matched ? '  MATCH' : ''}  · ${WEAPON_BLURB[s.weaponId]}`, tags,
      });
    });
    w.abilities.slots.forEach((s, i) => {
      if (!s) { rows.push({ icon: null, name: `Ability ${i + 1}: (empty)`, nameColor: UI_COLOR.textOff, badge: '', line: '' }); return; }
      const info = ABILITY_INFO[s.id];
      rows.push({
        icon: itemIcon('ability', s.id), name: info.name, nameColor: info.cls ? CLASS_COLOR[info.cls] : UI_COLOR.textDim, badge: `Lv ${s.level}`,
        line: `${info.cls ? `${CLASS_NAME[info.cls]} ability` : 'Neutral · always on'}  · ${ABILITY_BLURB[s.id]}`,
      });
    });
    rows.forEach((r, i) => {
      const y = P.rowsY + i * P.rowStep;
      if (r.icon) this.img(P.pad, y, r.icon);
      const n = this.t(P.pad + 22, y, r.name, r.nameColor);
      if (r.badge) this.t(P.pad + 26 + n.width, y, r.badge, r.nameColor);
      let x = P.panel[2] - P.pad - 8 * (r.tags?.length ?? 0);
      for (const c of r.tags ?? []) { this.img(x, y + 1, `class_${c}`, carried.includes(c as never) ? CLASS_COLOR[c as keyof typeof CLASS_COLOR] : UI_COLOR.panelBorder); x += 8; }
      this.t(P.pad + 22, y + 10, r.line, UI_COLOR.textDim).setMaxWidth(P.panel[2] - 2 * P.pad - 22);
    });
    // The class block.
    const c = w.classState;
    const color = c.hybrid ? HYBRID_COLOR[c.hybrid] : c.displayClass ? CLASS_COLOR[c.displayClass] : UI_COLOR.textDim;
    this.t(P.pad, P.classY, c.displayName, color, FONTS.large);
    let line1: string, line2 = '';
    if (c.hybrid) line1 = `${c.displayName}: ${HYBRID_BLURB[c.hybrid]}`;
    else if (c.connection && c.bondName) { line1 = `${c.bondName}: ${BOND_BLURB[c.bondName] ?? ''}`; line2 = 'Use both abilities within 3 s for +50%'; }
    else if (c.displayClass) line1 = `Add a 2nd ${CLASS_NAME[c.displayClass]} ability for ${BONDS[c.displayClass].name}`;
    else line1 = 'Carry a class ability to get a class';
    this.t(P.pad, P.classY + 24, line1, c.connection ? UI_COLOR.highlight : UI_COLOR.text).setMaxWidth(P.panel[2] - 2 * P.pad);
    if (line2) this.t(P.pad, P.classY + 46, line2, UI_COLOR.textDim);
  }

  private controls(): void {
    const half = Math.ceil(CONTROLS_LIST.length / 2);
    CONTROLS_LIST.forEach(([action, keyName], i) => {
      const col = i < half ? 0 : 2, row = i % half;
      const y = P.controlsY + row * P.controlsStep;
      this.t(P.colX[col], y, action, UI_COLOR.textDim);
      this.t(P.colX[col + 1], y, keyName, UI_COLOR.text);
    });
  }

  /** The info line (07 §7.6): `Stage n · time · SEED x`. */
  static info(stage: number, runTicks: number, seed: string | null): string {
    return `Stage ${stage} · ${formatTime(runTicks)}${seed ? ` · SEED ${seed}` : ''}`;
  }
}
