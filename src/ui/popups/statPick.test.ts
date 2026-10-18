import { afterEach, describe, expect, it } from 'vitest';
import type Phaser from 'phaser';
import { StatPickView } from './statPick.ts';
import { StatPickModel } from './statPickModel.ts';
import { ItemCardPopup } from './itemCard.ts';
import { itemCard } from '../model/itemCard.ts';
import { applyUiSettings, noteInputDevice } from '../inputSettings.ts';
import { defaultSettings } from '../../data/save.ts';
import { arenaWorld } from '../../core/testkit/combatWorld.ts';
import { newWeapon } from '../../core/abilities/runtime.ts';
import { dropItem } from '../../core/abilities/items.ts';

afterEach(() => { applyUiSettings(defaultSettings()); noteInputDevice('keyboard'); });
const surface = () => {
  const nodes: Record<string, any>[] = [];
  const create = (kind: string, args: any[]) => {
    const n: Record<string, any> = { kind, args, x: args[0], y: args[1], width: typeof args[3] === 'string' ? args[3].length * 6 : 16, height: 10 };
    for (const method of ['setScrollFactor', 'setDepth', 'setOrigin', 'setVisible', 'setAlpha', 'setTint', 'setX', 'setPosition', 'setDisplaySize', 'setInteractive', 'setMaxWidth', 'setCenterAlign', 'fillStyle', 'lineStyle', 'fillRect', 'strokeRect', 'fillCircle', 'fillRoundedRect', 'strokeRoundedRect']) n[method] = () => n;
    n.add = () => n; n.addAt = () => n; n.on = () => n; n.destroy = () => {}; n.removeAll = () => {}; nodes.push(n); return n;
  };
  return { nodes, scene: { textures: { exists: () => true, get: () => ({ has: () => true }) }, cameras: { main: { scrollX: 0, scrollY: 0 } }, scale: { width: 640, height: 360 },
    add: Object.fromEntries(['container', 'graphics', 'bitmapText', 'rectangle', 'nineslice', 'image'].map((kind) => [kind, (...args: any[]) => create(kind, args)])),
  } as unknown as Phaser.Scene };
};
describe('popup prompt artwork', () => {
  it('redraws stat confirm when forced style changes and uses a real PlayStation cross', () => {
    const s = surface(), view = new StatPickView(s.scene, () => {}, () => {}), model = new StatPickModel();
    view.draw(model, ['vitality', 'might', 'focus'], {}); const settings = defaultSettings(); settings.promptStyle = 'playstation'; applyUiSettings(settings);
    view.draw(model, ['vitality', 'might', 'focus'], {});
    expect(s.nodes.some((node) => node.kind === 'image' && node.args[3] === 'prompt_ps_cross')).toBe(true);
    expect(s.nodes.some((node) => node.kind === 'bitmapText' && String(node.args[3]).includes('✕'))).toBe(false);
  });
  it('draws current item action prompts as actual PS square/circle artwork, not font symbols', () => {
    const settings = defaultSettings(); settings.promptStyle = 'playstation'; applyUiSettings(settings);
    const s = surface(), w = arenaWorld(); w.setLoadout({ weapons: [newWeapon('greatsword'), newWeapon('war_maul')], abilities: [null, null] });
    const item = dropItem(w, 300, 320, { weapon: newWeapon('katana') }); new ItemCardPopup(s.scene).update(item, itemCard(w, item), 100);
    expect(s.nodes.some((node) => node.kind === 'image' && node.args[3] === 'prompt_ps_square')).toBe(true);
    expect(s.nodes.some((node) => node.kind === 'image' && node.args[3] === 'prompt_ps_circle')).toBe(true);
    expect(s.nodes.some((node) => node.kind === 'bitmapText' && /[□○]/.test(String(node.args[3])))).toBe(false);
  });
});
