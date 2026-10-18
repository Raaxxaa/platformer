// Preload for every stage asset (V1 Task 1): the atlases in animKeys, anims.json, tiles, backgrounds, fonts and sounds.
import type Phaser from 'phaser';
import { FONTS } from '../../data/animKeys.ts';
import { TILESET } from '../../data/art.ts';
import { SFX, sfxFiles, sfxKey } from '../../data/sfx.ts';
import { assetPlan } from './assetPlan.ts';
declare const __ASSET_FILES__: readonly string[];

export const BIOME = 'plains';
/** The tileset as a spritesheet (same margin and spacing) for door and body sprites (08 §9.3). */
export const TILE_SHEET = `tiles_${BIOME}_sheet`;

export function loadAssets(scene: Phaser.Scene): void {
  const l = scene.load;
  const plan = assetPlan(__ASSET_FILES__);
  l.json('anims', 'assets/anims.json');
  for (const a of plan.atlases) l.atlas(a, `assets/atlases/${a}.png`, `assets/atlases/${a}.json`);
  l.atlas('ui', 'assets/ui/ui.png', 'assets/ui/ui.json');
  for (const biome of plan.tiles) {
    l.image(`tiles_${biome}`, `assets/tiles/tiles_${biome}.png`);
    l.spritesheet(`tiles_${biome}_sheet`, `assets/tiles/tiles_${biome}.png`, {
      frameWidth: TILESET.tile, frameHeight: TILESET.tile, margin: TILESET.margin, spacing: TILESET.spacing,
    });
  }
  for (const background of plan.backgrounds) for (let i = 0; i < 3; i++) l.image(`bg_${background}_${i}`, `assets/bg/bg_${background}_${i}.png`);
  for (const f of Object.values(FONTS)) l.bitmapFont(f, `assets/fonts/${f}.png`, `assets/fonts/${f}.xml`);
  for (const id of Object.keys(SFX)) sfxFiles(id).forEach((f, v) => {
    if (plan.audio.includes(f)) l.audio(sfxKey(id, v), `assets/audio/sfx/${f}`);
  });
}
