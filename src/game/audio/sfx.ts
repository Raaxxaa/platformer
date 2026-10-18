// SFX player (08 §13.2, §15): plays what SfxMixer decides through Phaser's WebAudio sound manager.
// Every call is a no-op until the browser unlocks audio (a key press, click or touch).
import type Phaser from 'phaser';
import { SFX, SFX_RULES, sfxKey } from '../../data/sfx.ts';
import { SfxMixer, type SfxListener, type SfxRequest } from './sfxRules.ts';
import { getUiSettings } from '../../ui/inputSettings.ts';
import { SAVE_RULES } from '../../data/save.ts';
import type { GameWorld } from '../../core/sim/gameWorld.ts';
import { TERRAIN } from '../../core/tuning.ts';

export class SfxPlayer {
  private readonly scene: Phaser.Scene;
  private readonly mixer = new SfxMixer();
  private readonly playing = new Map<number, Phaser.Sound.BaseSound>();
  private readonly baseVolumes = new Map<number, number>();
  private cartLoop: { sound: Phaser.Sound.WebAudioSound; handle: number; paused: boolean } | null = null;
  /** Every sound this player started (ids), for tests: window.__game.sfxLog(). */
  readonly log: string[] = [];
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    scene.events.once('shutdown', () => {
      this.stopCart();
      for (const [handle, sound] of this.playing) { sound.stop(); sound.destroy(); this.mixer.release(handle); }
      this.playing.clear(); this.baseVolumes.clear();
    });
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
    const gain = getUiSettings().volume.sfx / SAVE_RULES.volumeMax;
    for (const [handle, sound] of this.playing) if ('setVolume' in sound) (sound as Phaser.Sound.WebAudioSound).setVolume(this.baseVolumes.get(handle)! * gain);
    if (!reqs.length) return;
    const now = performance.now() / 1000;
    for (const r of reqs) {
      const p = this.mixer.request(r, now, tick, listener, (id, v) => this.duration(id, v));
      if (!p) continue;
      if (this.locked) { this.mixer.release(p.handle); continue; }    // no backlog before unlock
      if (p.stop !== null) { this.playing.get(p.stop)?.stop(); this.playing.get(p.stop)?.destroy(); this.playing.delete(p.stop); this.baseVolumes.delete(p.stop); }
      const key = sfxKey(p.id, p.variant);
      if (!this.scene.cache.audio.exists(key)) { this.mixer.release(p.handle); continue; }
      this.log.push(p.id);
      const bus = SFX[p.id].bus ?? 'sfx';
      const baseVolume = p.volume * SFX_RULES.busTrim[bus];
      const s = this.scene.sound.add(key, { volume: baseVolume * gain, rate: p.rate, pan: p.pan });
      this.playing.set(p.handle, s);
      this.baseVolumes.set(p.handle, baseVolume);
      s.once('complete', () => { s.destroy(); this.playing.delete(p.handle); this.baseVolumes.delete(p.handle); this.mixer.release(p.handle); });
      s.play();
    }
  }

  /** A missing ART7 loop remains silent; one real loop follows the occupied cart until exit. */
  updateCart(w: GameWorld): void {
    const cart = w.minecarts.find(c => c.id === w.body.cartId && c.active);
    if (!cart || w.health.dead || w.body.state !== 'minecart') { this.stopCart(); return; }
    const paused = w.run.phase === 'paused';
    if (!this.cartLoop && !paused && !this.locked && this.scene.cache.audio.exists(sfxKey('cart_roll', 0))) {
      const p = this.mixer.request({ id: 'cart_roll' }, performance.now() / 1000, w.tick, { playerX: w.body.x, camCenterX: w.body.x }, () => Infinity);
      if (!p) return;
      const sound = this.scene.sound.add(sfxKey('cart_roll', 0), { loop: true, rate: SFX_RULES.cartRateBase }) as Phaser.Sound.WebAudioSound;
      this.cartLoop = { sound, handle: p.handle, paused: false };
      this.log.push('cart_roll'); sound.play();
    }
    const loop = this.cartLoop;
    if (!loop) return;
    loop.sound.setRate(SFX_RULES.cartRateBase + SFX_RULES.cartRateSpeed * Math.abs(cart.vx) / TERRAIN.CART_MAX);
    loop.sound.setVolume(SFX.cart_roll.vol * SFX_RULES.busTrim.sfx * getUiSettings().volume.sfx / SAVE_RULES.volumeMax);
    if (paused && !loop.paused) loop.sound.pause();
    if (!paused && loop.paused) loop.sound.resume();
    loop.paused = paused;
  }

  private stopCart(): void {
    if (!this.cartLoop) return;
    this.cartLoop.sound.stop(); this.cartLoop.sound.destroy(); this.mixer.release(this.cartLoop.handle); this.cartLoop = null;
  }
}
