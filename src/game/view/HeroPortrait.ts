// The hero's look (09 §7) as a still idle portrait on screens: the class pick, the death screen and the run summary (M14).
import type Phaser from 'phaser';
import { OUTFIT_ATLAS } from '../../data/cosmetics.ts';
import { TRIM_TINT } from '../../data/art.ts';
import type { AnimDef } from './animClock.ts';
import { LookRig } from './LookRig.ts';
import { getLook } from './lookState.ts';

export class HeroPortrait {
  private readonly rig: LookRig;
  constructor(scene: Phaser.Scene, x: number, y: number, depth: number, trim: number = TRIM_TINT.none, scale = 2) {
    this.rig = new LookRig(scene, depth, { screen: true, scale });
    const look = getLook(), atlas = `player_${OUTFIT_ATLAS[look.outfit]}`;
    const idle = ((scene.cache.json.get('anims') ?? []) as AnimDef[]).find((a) => a.atlas === atlas && a.key === 'idle');
    this.rig.draw(look, { x, y, flip: false, alpha: 1, frame: idle?.frames[0] ?? 'idle_00', anim: 'idle', points: idle?.points?.[0], trims: [trim, trim], t: 0 });
  }
  destroy(): void { this.rig.destroy(); }
}
