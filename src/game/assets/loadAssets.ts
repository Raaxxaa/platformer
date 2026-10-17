// Preload for every stage asset (V1 Task 1): the atlases in animKeys, anims.json, tiles, backgrounds, fonts and sounds.
import type Phaser from 'phaser';
import { ATLASES, FONTS } from '../../data/animKeys.ts';
import { TILESET } from '../../data/art.ts';
import { SFX, sfxFiles, sfxKey } from '../../data/sfx.ts';

export const BIOME = 'plains';
/** The tileset as a spritesheet (same margin and spacing) for door and body sprites (08 §9.3). */
export const TILE_SHEET = `tiles_${BIOME}_sheet`;

export function loadAssets(scene: Phaser.Scene): void {
  const l = scene.load;
  l.json('anims', 'assets/anims.json');
  for (const a of ATLASES) l.atlas(a, `assets/atlases/${a}.png`, `assets/atlases/${a}.json`);
  l.atlas('ui', 'assets/ui/ui.png', 'assets/ui/ui.json');
  l.image(`tiles_${BIOME}`, `assets/tiles/tiles_${BIOME}.png`);
  l.spritesheet(TILE_SHEET, `assets/tiles/tiles_${BIOME}.png`, { frameWidth: TILESET.tile, frameHeight: TILESET.tile, margin: TILESET.margin, spacing: TILESET.spacing });
  for (let i = 0; i < 3; i++) l.image(`bg_${BIOME}_${i}`, `assets/bg/bg_${BIOME}_${i}.png`);
  for (const f of Object.values(FONTS)) l.bitmapFont(f, `assets/fonts/${f}.png`, `assets/fonts/${f}.xml`);
  for (const id of Object.keys(SFX)) sfxFiles(id).forEach((f, v) => l.audio(sfxKey(id, v), `assets/audio/sfx/${f}`));
}
