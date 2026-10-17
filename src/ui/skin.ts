// The popup skin and HUD art from the `ui` atlas (07 §3.4), with 07 §1.1's stand-ins while a frame isn't drawn yet:
// a 9-slice panel falls back to a flat `panel` box with a 1 px border; any other frame to a `textDim` box with an `ink` border.
import Phaser from 'phaser';
import { UI_COLOR } from '../data/uiText.ts';

export const SKIN = {
  panel: 'panel_9', panelEdge: 'panel_9_edge', plate: 'hud_plate_9', tabOn: 'tab_on_9', tabOff: 'tab_off_9',
  button: 'button_9', buttonSel: 'button_9_sel', cursor: 'cursor', heart: 'hud_heart',
  corner: { panel: 8, plate: 8, tab: 4, button: 4 },
  panelAlpha: 0.9, plateAlpha: 0.75,
} as const;

export const hasFrame = (scene: Phaser.Scene, frame: string) => scene.textures.exists('ui') && scene.textures.get('ui').has(frame);

type Obj = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible & Phaser.GameObjects.Components.Depth
  & Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Transform;

/** A 9-slice box (panel, plate, tab, button), fixed to the screen. `edge` tints `panel_9_edge` over it (or the fallback border). */
export function box(scene: Phaser.Scene, frame: string, x: number, y: number, w: number, h: number, corner: number,
  opts: { edge?: number; alpha?: number; fill?: number } = {}): Obj[] {
  const out: Obj[] = [];
  if (hasFrame(scene, frame)) {
    out.push(scene.add.nineslice(x, y, 'ui', frame, w, h, corner, corner, corner, corner).setOrigin(0).setAlpha(opts.alpha ?? 1));
    if (opts.edge !== undefined && hasFrame(scene, SKIN.panelEdge)) {
      out.push(scene.add.nineslice(x, y, 'ui', SKIN.panelEdge, w, h, corner, corner, corner, corner).setOrigin(0).setTint(opts.edge));
    }
  } else {
    const g = scene.add.graphics();
    g.fillStyle(opts.fill ?? UI_COLOR.panel, opts.alpha ?? SKIN.panelAlpha).fillRect(x, y, w, h);
    g.lineStyle(1, opts.edge ?? UI_COLOR.panelBorder, 1).strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    out.push(g);
  }
  for (const o of out) o.setScrollFactor(0);
  return out;
}

/** A single `ui` frame, or its placeholder box (07 §1.1). */
export function icon(scene: Phaser.Scene, frame: string, x: number, y: number, size: [number, number]): Obj {
  if (hasFrame(scene, frame)) return scene.add.image(x, y, 'ui', frame).setOrigin(0).setScrollFactor(0);
  const g = scene.add.graphics().setScrollFactor(0);
  g.fillStyle(UI_COLOR.textDim, 1).fillRect(x, y, size[0], size[1]);
  g.lineStyle(1, UI_COLOR.ink, 1).strokeRect(x + 0.5, y + 0.5, size[0] - 1, size[1] - 1);
  return g;
}
