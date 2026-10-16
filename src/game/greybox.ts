// Shared grey-box colors (placeholders where art doesn't exist yet).
import type { MoveStateId } from '../core/player/body.ts';

export const COLOR = {
  hurtbox: 0x00ff00,
} as const;
export const NOSE = 3;    // px, marks the facing side

export const STATE_COLOR: Record<MoveStateId, number> = {
  ground: 0xe8e8f0, air: 0x9ad0ff, dash: 0xffd84a, slide: 0xffd84a, wallSlide: 0x7affb0, ledgeClimb: 0xff9a3c,
  diveWindup: 0xff5a5a, diveFall: 0xff5a5a, diveLand: 0xff5a5a, crawl: 0xc08aff,
  hurt: 0xe8e8f0, forced: 0xe8e8f0, minecart: 0xe8e8f0, dead: 0xe8e8f0,
};
