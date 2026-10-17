// SFX player (08 §13.2, §15): plays what SfxMixer decides through Phaser's WebAudio sound manager.
// Every call is a no-op until the browser unlocks audio (a key press, click or touch).
import type Phaser from 'phaser';
import { SFX, SFX_RULES, sfxKey } from '../../data/sfx.ts';
import { SfxMixer, type SfxListener, type SfxRequest } from './sfxRules.ts';

export class SfxPlayer {
  private readonly scene: Phaser.Scene;
  private readonly mixer = new SfxMixer();
  private readonly playing = new Map<number, Phaser.Sound.BaseSound>();
  /** Every sound this player started (ids), for tests: window.__game.sfxLog(). */
  readonly log: string[] = [];
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  get locked(): boolean {
    return this.scene.sound.locked;
  }

  private duration(id: string, variant: number): number {
    const key = sfxKey(id, variant);
    const buf = this.scene.cache.audio.get(key) as AudioBuffer | undefined;
    return buf?.duration ?? 1;
  }

  play(reqs: SfxRequest[], tick: number, listener: SfxListener): void {
    if (!reqs.length) return;
    const now = performance.now() / 1000;
    for (const r of reqs) {
      const p = this.mixer.request(r, now, tick, listener, (id, v) => this.duration(id, v));
      if (!p) continue;
      this.log.push(p.id);
      if (this.locked) { this.mixer.release(p.handle); continue; }    // no backlog before unlock
      if (p.stop !== null) { this.playing.get(p.stop)?.stop(); this.playing.get(p.stop)?.destroy(); this.playing.delete(p.stop); }
      const key = sfxKey(p.id, p.variant);
      if (!this.scene.cache.audio.exists(key)) continue;
      const bus = SFX[p.id].bus ?? 'sfx';
      const s = this.scene.sound.add(key, { volume: p.volume * SFX_RULES.busTrim[bus], rate: p.rate, pan: p.pan });
      this.playing.set(p.handle, s);
      s.once('complete', () => { s.destroy(); this.playing.delete(p.handle); this.mixer.release(p.handle); });
      s.play();
    }
  }
}
