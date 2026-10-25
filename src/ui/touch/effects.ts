// Effects level (M12 Task 5): `Low` is the default on touch devices (07 §8.6). Gameplay is identical; only looks change.
import type { TouchSettings } from '../../core/save/schema.ts';
export type EffectsLevel = 'high' | 'low';
export const effectsLevel = (t: Pick<TouchSettings, 'effects'>, touchDevice: boolean): EffectsLevel => t.effects ?? (touchDevice ? 'low' : 'high');
/** Low-effects caps: half the particles (VFX pool 128, ambient ≤ 12), the darkness texture at half resolution, no screen-wide flashes. */
export const LOW_EFFECTS = { vfxPool: 128, vfxPoolHigh: 256, ambientMax: 12, darknessScale: 0.5, screenFlashes: false } as const;
