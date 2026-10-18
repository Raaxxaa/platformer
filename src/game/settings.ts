// Browser/Phaser settings application; the deterministic core never reads preferences.
import type Phaser from 'phaser';
import type { SettingsData } from '../core/save/schema.ts';
import { SAVE_RULES } from '../data/save.ts';
import { applyUiSettings } from '../ui/inputSettings.ts';
export function applySettings(scene: Pick<Phaser.Scene, 'sound'>, settings: SettingsData): void {
  applyUiSettings(settings); scene.sound.volume = settings.volume.master / SAVE_RULES.volumeMax;
}
