// The ghost of your best practice attempt (06 §14): the player's body sprite only, alpha 0.4, just below the player.
// No collision, sound or interaction, and it never touches the core.
import Phaser from 'phaser';
import { ANCHOR, DEPTH } from '../../data/art.ts';
import { GHOST } from '../../data/practice.ts';
import type { AnimBank } from '../view/animBank.ts';
import { ghostAt, type GhostSample } from './codec.ts';

export class GhostView {
  private readonly scene: Phaser.Scene;
  private readonly bank: AnimBank;
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private outfit = '';
  samples: GhostSample[] | null = null;
  /** True when the ghost was drawn on the last update (tests read it). */
  shown = false;
  constructor(scene: Phaser.Scene, bank: AnimBank, outfit: string) { this.scene = scene; this.bank = bank; this.outfit = outfit; }
  load(samples: GhostSample[] | null): void { this.samples = samples && samples.length ? samples : null; if (!this.samples) this.hide(); }
  hide(): void { this.shown = false; this.sprite?.setVisible(false); }
  update(stageTicks: number, playing: boolean): void {
    const s = playing && this.samples ? ghostAt(this.samples, stageTicks) : null;
    if (!s) { this.hide(); return; }
    const def = this.bank.player(this.outfit)(s.anim) ?? this.bank.player(this.outfit)('idle');
    const frame = def?.frames[Math.min(s.frame, (def?.frames.length ?? 1) - 1)] ?? 'idle_00';
    const atlas = def && def.atlas.startsWith('player_') ? def.atlas : `player_${this.outfit}`;
    if (!this.scene.textures.exists(atlas) || !this.scene.textures.get(atlas).has(frame)) { this.hide(); return; }
    if (!this.sprite) this.sprite = this.scene.add.sprite(0, 0, atlas, frame).setDepth(DEPTH.player - 0.1).setAlpha(GHOST.alpha);
    this.sprite.setTexture(atlas, frame).setOrigin(0.5, (this.sprite.frame.height - ANCHOR.feetFromBottom) / this.sprite.frame.height)
      .setPosition(s.x, s.y).setFlipX(s.facing < 0).setVisible(true);
    this.shown = true;
  }
  destroy(): void { this.sprite?.destroy(); this.sprite = null; }
}
