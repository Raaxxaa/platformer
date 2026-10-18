import { describe, it, expect } from 'vitest';
import { SfxPlayer } from './sfx.ts';
import { arenaWorld } from '../../core/testkit/combatWorld.ts';
import { createMinecart } from '../../core/player/minecart.ts';

function scene(available = true) {
  const sounds: { rate: number; stopped: boolean; paused: boolean; play(): void; destroy(): void; stop(): void; setVolume(): void; setRate(n: number): void; pause(): void; resume(): void; once(): void }[] = [];
  return {
    sounds,
    value: { events: { once() {} }, cache: { audio: { get: () => ({ duration: 1 }), exists: () => available } }, sound: { locked: false, add: (_key: string, config: { rate: number }) => {
      const s = { rate: config.rate, stopped: false, paused: false, play() {}, destroy() { this.stopped = true; }, stop() { this.stopped = true; }, setVolume() {}, setRate(n: number) { this.rate = n; }, pause() { this.paused = true; }, resume() { this.paused = false; }, once() {} }; sounds.push(s); return s;
    } } } as never,
  };
}

describe('ART7 audio availability and cart loop', () => {
  it('does not start or log missing sound files', () => {
    const s = scene(false), p = new SfxPlayer(s.value), w = arenaWorld();
    p.play([{ id: 'splash' }], 1, { camCenterX: 0, playerX: 0 });
    w.minecarts.push(createMinecart(1, 100, 320, 1)); w.body.cartId = 1; w.body.state = 'minecart';
    p.updateCart(w);
    expect(s.sounds).toHaveLength(0);
    expect(p.log).toEqual([]);
  });
  it('keeps one loop, follows exact speed rate, pauses, then stops on exit', () => {
    const s = scene(), p = new SfxPlayer(s.value), w = arenaWorld();
    const c = createMinecart(1, 100, 320, 1); c.vx = 260; c.rider = true;
    w.minecarts.push(c); w.body.cartId = 1; w.body.state = 'minecart';
    p.updateCart(w); p.updateCart(w);
    expect(s.sounds).toHaveLength(1);
    expect(s.sounds[0].rate).toBeCloseTo(1.2);
    c.vx = 130; p.updateCart(w); expect(s.sounds[0].rate).toBe(1);
    w.run.phase = 'paused'; p.updateCart(w); expect(s.sounds[0].paused).toBe(true);
    w.run.phase = 'stage'; p.updateCart(w); expect(s.sounds[0].paused).toBe(false);
    w.body.cartId = null; w.body.state = 'air'; p.updateCart(w);
    expect(s.sounds[0].stopped).toBe(true);
  });
});
