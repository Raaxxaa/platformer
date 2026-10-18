import { afterEach, describe, expect, it } from 'vitest';
import type Phaser from 'phaser';
import { actionPrompt, menuPrompt, PromptGlyph } from './abilityHud.ts';
import { applyUiSettings, noteInputDevice } from '../inputSettings.ts';
import { defaultSettings } from '../../data/save.ts';

afterEach(() => { applyUiSettings(defaultSettings()); noteInputDevice('keyboard'); });
function surface() {
  const nodes: Record<string, any>[] = [], create = (kind: string, args: any[]) => {
    const n: Record<string, any> = { kind, args, visible: true, calls: [] };
    for (const method of ['setOrigin', 'setScrollFactor', 'setDepth', 'setTint', 'setDisplaySize', 'setPosition', 'fillStyle', 'lineStyle', 'fillRect', 'strokeRect', 'fillRoundedRect', 'strokeRoundedRect', 'fillCircle', 'strokeCircle', 'lineBetween', 'strokeTriangle']) n[method] = (...args: any[]) => { n.calls.push([method, ...args]); return n; };
    n.add = () => n; n.removeAll = () => n; n.destroy = () => {}; n.setVisible = (on: boolean) => { n.visible = on; return n; }; nodes.push(n); return n;
  };
  const scene = { textures: { exists: () => true, get: () => ({ has: () => true }) }, add: Object.fromEntries(['container', 'graphics', 'image', 'bitmapText'].map((kind) => [kind, (...args: any[]) => create(kind, args)])) } as unknown as Phaser.Scene;
  return { scene, nodes };
}
describe('live HUD action prompts (07 §8.4)', () => {
  it('uses imported current keys instead of fixed J/K/U/I', () => {
    const settings = defaultSettings(); settings.bindings.keyboard.attack1 = ['KeyZ', null]; settings.bindings.keyboard.ability1 = ['KeyC', null]; applyUiSettings(settings);
    expect(actionPrompt('attack1')).toMatchObject({ style: 'keyboard', label: 'Z', button: null });
    expect(actionPrompt('ability1').label).toBe('C');
  });
  it('honors forced Xbox/PlayStation and current pad bindings, independent of the last device', () => {
    const settings = defaultSettings(); settings.promptStyle = 'xbox'; settings.bindings.gamepad.ability1 = 4; applyUiSettings(settings); noteInputDevice('keyboard');
    expect(actionPrompt('ability1')).toEqual({ style: 'xbox', label: 'LB', button: 4 }); expect(menuPrompt('confirm')).toEqual({ style: 'xbox', label: 'A', button: 0 });
    settings.promptStyle = 'playstation'; applyUiSettings(settings); expect(actionPrompt('attack1')).toEqual({ style: 'playstation', label: '□', button: 2 });
    expect(menuPrompt('back')).toEqual({ style: 'playstation', label: '○', button: 1 });
  });
  it('uses atlas PlayStation face symbols rather than absent bitmap-font characters', () => {
    const { scene, nodes } = surface(); new PromptGlyph(scene, 100, 200, { style: 'playstation', label: '□', button: 2 });
    expect(nodes.some((n) => n.kind === 'image' && n.args[3] === 'prompt_ps_square')).toBe(true);
    expect(nodes.some((n) => n.kind === 'bitmapText' && n.args[3] === '□')).toBe(false);
  });
  it('draws Xbox colored circles and keyboard boxes with current labels', () => {
    const { scene, nodes } = surface(); const xbox = new PromptGlyph(scene, 100, 200, { style: 'xbox', label: 'X', button: 2 });
    expect(nodes.some((n) => n.calls.some((call: any[]) => call[0] === 'fillCircle'))).toBe(true);
    xbox.update({ style: 'keyboard', label: 'SHF', button: null });
    expect(nodes.some((n) => n.kind === 'bitmapText' && n.args[3] === 'SHF')).toBe(true);
    expect(nodes.some((n) => n.calls.some((call: any[]) => call[0] === 'strokeRect'))).toBe(true);
  });
});
