// Ghost samples (06 §14): 6 bytes each, little-endian, base64url without padding. Pure: no Phaser, no storage.
import { PLAYER_ANIM_KEYS } from '../../data/animKeys.ts';
import { GHOST } from '../../data/practice.ts';

export interface GhostSample { x: number; y: number; facing: 1 | -1; anim: string; frame: number }

const clamp = (v: number): number => Math.max(0, Math.min(GHOST.maxCoord, Math.round(v)));
const IDLE = Math.max(0, PLAYER_ANIM_KEYS.indexOf('idle'));

export function encodeGhost(samples: readonly GhostSample[]): string {
  const n = Math.min(samples.length, GHOST.maxSamples), bytes = new Uint8Array(n * GHOST.sampleBytes), view = new DataView(bytes.buffer);
  for (let i = 0; i < n; i++) {
    const s = samples[i], at = i * GHOST.sampleBytes, anim = PLAYER_ANIM_KEYS.indexOf(s.anim);
    view.setUint16(at, clamp(s.x), true); view.setUint16(at + 2, clamp(s.y), true);
    view.setUint8(at + 4, anim < 0 ? IDLE : anim);
    view.setUint8(at + 5, (Math.max(0, Math.min(127, s.frame)) & 0x7f) | (s.facing < 0 ? 0x80 : 0));
  }
  let bin = ''; for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Returns null for anything that is not a whole number of samples. */
export function decodeGhost(data: string): GhostSample[] | null {
  if (typeof data !== 'string' || !/^[A-Za-z0-9_-]*$/.test(data)) return null;
  let bin: string;
  try { bin = atob(data.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((data.length + 3) % 4)); } catch { return null; }
  if (bin.length % GHOST.sampleBytes !== 0 || bin.length / GHOST.sampleBytes > GHOST.maxSamples) return null;
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0)), view = new DataView(bytes.buffer), out: GhostSample[] = [];
  for (let at = 0; at < bytes.length; at += GHOST.sampleBytes) {
    const flags = view.getUint8(at + 5);
    out.push({ x: view.getUint16(at, true), y: view.getUint16(at + 2, true), anim: PLAYER_ANIM_KEYS[view.getUint8(at + 4)] ?? 'idle', frame: flags & 0x7f, facing: flags & 0x80 ? -1 : 1 });
  }
  return out;
}

/**
 * Collects one sample per `sampleTicks` stage ticks: sample i is the player as drawn when stageTicks = 2i. The view renders less
 * often than the sim ticks, so a render that skips ahead repeats the latest drawn state for the samples it passed. Stops at the cap.
 */
export class GhostRecorder {
  samples: GhostSample[] = [];
  /** Call each render with the current stage tick and the player as drawn. */
  record(stageTicks: number, s: GhostSample): void {
    const want = Math.min(GHOST.maxSamples, Math.floor(stageTicks / GHOST.sampleTicks) + 1);
    while (this.samples.length < want) this.samples.push({ ...s });
  }
  reset(): void { this.samples = []; }
}

/** The sample to draw at `stageTicks`, or null after the last one (the ghost disappears). */
export function ghostAt(samples: readonly GhostSample[], stageTicks: number): GhostSample | null {
  return samples[Math.floor(stageTicks / GHOST.sampleTicks)] ?? null;
}
