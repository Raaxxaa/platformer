import Phaser from 'phaser';

class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.add.rectangle(0, 312, 640, 48, 0x4a4f63).setOrigin(0, 0);
    (window as unknown as { __game: unknown }).__game = { ready: true };
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 640,
  height: 360,
  backgroundColor: '#1d2030',
  pixelArt: true,
  roundPixels: true,
  scene: [BootScene],
});
