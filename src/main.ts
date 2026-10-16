import Phaser from 'phaser';
import { computeZoom, GAME_WIDTH, GAME_HEIGHT } from './game/zoom.ts';
import { MovementTestScene } from './game/scenes/MovementTestScene.ts';
import { CombatTestScene } from './game/scenes/CombatTestScene.ts';

// The combat test level by default; ?scene=movement opens the M1 movement level.
const movement = new URLSearchParams(window.location.search).get('scene') === 'movement';

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
  scene: movement ? [MovementTestScene] : [CombatTestScene],
});

// Whole-number zoom only (2×, 3×, …); the black page background shows as bars.
window.addEventListener('resize', () => {
  game.scale.setZoom(computeZoom(window.innerWidth, window.innerHeight));
});
