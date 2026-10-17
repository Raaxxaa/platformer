// SFX playback rules (08 §13.2): per-id voices and gap, round-robin variants, pitch jitter, pan and distance,
// 32 voices max. Pure: no Phaser and no audio; `sfx.ts` plays what this decides.
import { hash2 } from '../../core/level/autotile.ts';
import { SFX, SFX_RULES, type SfxDef } from '../../data/sfx.ts';

export interface SfxRequest {
  id: string;
  /** World sounds (enemies, hazards): the source x. Player and UI sounds leave it out (centered). */
  x?: number;
  /** Extra pitch in semitones (Rush up). */
  semitones?: number;
}
export interface SfxListener { camCenterX: number; playerX: number }
export interface SfxPlay { handle: number; id: string; variant: number; volume: number; pan: number; rate: number; stop: number | null }

interface Voice { handle: number; id: string; volume: number; world: boolean; end: number }

const idHash = (id: string) => { let h = 0; for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0; return h; };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function maxVoicesOf(d: SfxDef): number {
  return d.maxVoices ?? SFX_RULES.maxVoicesDefault;
}

/** Pan for a world sound at x: clamp((x − camCenterX) / 320, −1, 1) × 0.5. */
export function panFor(x: number, camCenterX: number): number {
  const R = SFX_RULES;
  return clamp((x - camCenterX) / R.panRange, -1, 1) * R.panScale;
}
/** Distance falloff by horizontal distance to the player: clamp(1 − (d − 320) / 320, 0, 1). */
export function falloff(d: number): number {
  const R = SFX_RULES;
  return clamp(1 - (d - R.fadeStart) / R.fadeLen, 0, 1);
}
/** Pitch jitter ±3% from hash2(tick, idHash, 7). */
export function jitterRate(tick: number, id: string): number {
  const R = SFX_RULES;
  return 1 + (((hash2(tick, idHash(id), R.pitchSalt) % 2001) / 1000) - 1) * R.pitchJitter;
}

export class SfxMixer {
  private voices: Voice[] = [];
  private lastPlay = new Map<string, number>();
  private roundRobin = new Map<string, number>();
  private nextHandle = 1;

  /** Decide one play at time `now` (s). `duration` (s) is how long the chosen file lasts. Null = dropped. */
  request(r: SfxRequest, now: number, tick: number, listener: SfxListener, duration: (id: string, variant: number) => number): SfxPlay | null {
    const def = SFX[r.id];
    if (!def) return null;
    this.voices = this.voices.filter((v) => v.end > now);
    const last = this.lastPlay.get(r.id);
    if (last !== undefined && now - last < SFX_RULES.minGap) return null;
    if (this.voices.filter((v) => v.id === r.id).length >= maxVoicesOf(def)) return null;
    let volume = def.vol, pan = 0;
    const world = r.x !== undefined;
    if (world) {
      volume *= falloff(Math.abs(r.x! - listener.playerX));
      pan = panFor(r.x!, listener.camCenterX);
      if (volume <= 0) return null;
    }
    let stop: number | null = null;
    if (this.voices.length >= SFX_RULES.maxVoices) {
      const worldVoices = this.voices.filter((v) => v.world).sort((a, b) => a.volume - b.volume);
      if (!worldVoices.length) return null;
      stop = worldVoices[0].handle;
      this.voices = this.voices.filter((v) => v.handle !== stop);
    }
    const n = Math.max(1, def.variants);
    const variant = (this.roundRobin.get(r.id) ?? 0) % n;
    this.roundRobin.set(r.id, variant + 1);
    const rate = jitterRate(tick, r.id) * Math.pow(2, (r.semitones ?? 0) / 12);
    const handle = this.nextHandle++;
    this.voices.push({ handle, id: r.id, volume, world, end: now + duration(r.id, variant) / rate });
    this.lastPlay.set(r.id, now);
    return { handle, id: r.id, variant, volume, pan, rate, stop };
  }

  /** A voice ended early (stopped elsewhere). */
  release(handle: number): void {
    this.voices = this.voices.filter((v) => v.handle !== handle);
  }

  get active(): number {
    return this.voices.length;
  }
}
