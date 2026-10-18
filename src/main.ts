import Phaser from 'phaser';
import { computeZoom, GAME_WIDTH, GAME_HEIGHT } from './game/zoom.ts';
import { MovementTestScene } from './game/scenes/MovementTestScene.ts';
import { CombatTestScene } from './game/scenes/CombatTestScene.ts';
import { StageScene } from './game/scenes/StageScene.ts';
import { TitleScene } from './game/scenes/TitleScene.ts';
import { VillageScene } from './game/scenes/VillageScene.ts';

// The start screen by default; ?start=plains / ?start=training skip it. ?scene=combat opens the M2 combat test level,
// ?scene=movement the M1 movement level.
const q = new URLSearchParams(window.location.search);
const which = q.get('scene');
const scene = which === 'movement' ? MovementTestScene : which === 'combat' ? CombatTestScene : q.get('start') ? StageScene : TitleScene;

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
    zoom: computeZoom(window.innerWidth, window.innerHeight),
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // The start screen is always registered so leaving the Training Yard or quitting can return to it.
  scene: scene === TitleScene ? [TitleScene, StageScene, VillageScene] : scene === StageScene ? [StageScene, TitleScene, VillageScene] : [scene],
});

// Whole-number zoom only (2×, 3×, …); the black page background shows as bars.
window.addEventListener('resize', () => {
  game.scale.setZoom(computeZoom(window.innerWidth, window.innerHeight));
});
