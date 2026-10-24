import Phaser from 'phaser';
import { computeZoom, GAME_WIDTH, GAME_HEIGHT, isTouchDevice } from './game/zoom.ts';
import { MovementTestScene } from './game/scenes/MovementTestScene.ts';
import { CombatTestScene } from './game/scenes/CombatTestScene.ts';
import { StageScene } from './game/scenes/StageScene.ts';
import { TitleScene } from './game/scenes/TitleScene.ts';
import { VillageScene } from './game/scenes/VillageScene.ts';
import { BootScene } from './game/scenes/BootScene.ts';
import { debugEnabled } from './game/debug.ts';
import { installPortraitGuard } from './ui/touch/portrait.ts';
import { saveStore } from './game/save/storage.ts';
import { applyUiSettings } from './ui/inputSettings.ts';
import { TouchOverlay } from './ui/touch/TouchOverlay.ts';
import { setTouchOverlay } from './ui/touch/touchInput.ts';

// The start screen by default; ?start=plains / ?start=training skip it. ?scene=combat opens the M2 combat test level,
// ?scene=movement the M1 movement level.
const q = new URLSearchParams(window.location.search);
const which = q.get('scene');
const scene = which === 'movement' ? MovementTestScene : which === 'combat' ? CombatTestScene : q.get('start') ? StageScene : BootScene;

const touchOverlay = new TouchOverlay();
touchOverlay.setLayoutSink((layout) => { saveStore().update((s) => { s.settings.touch.layout = layout; }); applyUiSettings(saveStore().data.settings); });
setTouchOverlay(touchOverlay);
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1d2030',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.NONE,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    zoom: computeZoom(window.innerWidth, window.innerHeight, isTouchDevice()),
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // The start screen is always registered so leaving the Training Yard or quitting can return to it.
  scene: scene === BootScene ? [BootScene, TitleScene, StageScene, VillageScene] : scene === StageScene ? [StageScene, TitleScene, VillageScene] : [scene],
});
installPortraitGuard(game);
declare global { interface Window { PHASER_GAME?: Phaser.Game } }
if (debugEnabled()) window.PHASER_GAME = game;

// Whole-number zoom only (2×, 3×, …); the black page background shows as bars.
window.addEventListener('resize', () => {
  game.scale.setZoom(computeZoom(window.innerWidth, window.innerHeight, isTouchDevice()));
});
