import { describe, it, expect } from 'vitest';
import { SnapshotBuilder } from './snapshot.ts';

describe('SnapshotBuilder', () => {
  it('latches a press+release between ticks', () => {
    const b = new SnapshotBuilder(); b.down('jump', 'kb'); b.up('jump', 'kb');
    const s = b.build(); expect(s.jump).toEqual({ held: false, pressed: true, released: true });
    expect(b.build().jump.pressed).toBe(false);          // only one tick
  });
  it('pressed is true for exactly one tick while held', () => {
    const b = new SnapshotBuilder(); b.down('dash', 'kb');
    expect(b.build().dash).toMatchObject({ held: true, pressed: true });
    expect(b.build().dash).toMatchObject({ held: true, pressed: false });
  });
  it('released is latched for one tick', () => {
    const b = new SnapshotBuilder(); b.down('attack1', 'pad'); b.build(); b.up('attack1', 'pad');
    expect(b.build().attack1).toEqual({ held: false, pressed: false, released: true });
    expect(b.build().attack1.released).toBe(false);
  });
  it('merges keyboard and gamepad', () => {
    const b = new SnapshotBuilder(); b.down('jump', 'kb'); b.down('jump', 'pad'); b.up('jump', 'kb');
    expect(b.build().jump.held).toBe(true);
  });
  it('a second device pressing a held button is not a new press', () => {
    const b = new SnapshotBuilder(); b.down('jump', 'kb'); b.build(); b.down('jump', 'pad');
    expect(b.build().jump.pressed).toBe(false);
  });
  it('last pressed direction wins and falls back on release', () => {
    const b = new SnapshotBuilder(); b.down('left', 'kb'); b.down('right', 'kb');
    expect(b.build().moveX).toBe(1);
    b.up('right', 'kb'); expect(b.build().moveX).toBe(-1);
  });
  it('last pressed wins for up and down too, across devices', () => {
    const b = new SnapshotBuilder(); b.down('down', 'pad'); b.down('up', 'kb');
    expect(b.build().moveY).toBe(-1);
    b.up('up', 'kb'); expect(b.build().moveY).toBe(1);
  });
  it('stick thresholds: 0.30 horizontal, 0.60 down', () => {
    const b = new SnapshotBuilder();
    b.setStick(0.29, 0); expect(b.build().moveX).toBe(0);
    b.setStick(0.30, 0); expect(b.build().moveX).toBe(1);
    b.setStick(0, 0.59); expect(b.build().moveY).toBe(0);
    b.setStick(0, 0.60); expect(b.build().moveY).toBe(1);
    b.setStick(-0.5, -0.7); const s = b.build(); expect([s.moveX, s.moveY]).toEqual([-1, -1]);
  });
  it('the stick crossing a threshold counts as a press for last-pressed-wins', () => {
    const b = new SnapshotBuilder(); b.down('right', 'kb'); b.setStick(-0.8, 0);
    expect(b.build().moveX).toBe(-1);
    b.setStick(0, 0); expect(b.build().moveX).toBe(1);
  });
  it('releaseAll clears every held button and direction (window blur)', () => {
    const b = new SnapshotBuilder(); b.down('right', 'kb'); b.down('jump', 'pad'); b.releaseAll();
    const s = b.build(); expect(s.moveX).toBe(0); expect(s.jump.held).toBe(false);
  });
  it('builds every InputState button', () => {
    const s = new SnapshotBuilder().build();
    for (const k of ['jump', 'dash', 'attack1', 'attack2', 'ability1', 'ability2', 'heal', 'interact', 'restart', 'pause'] as const) {
      expect(s[k]).toEqual({ held: false, pressed: false, released: false });
    }
    expect([s.moveX, s.moveY]).toEqual([0, 0]);
  });
});

describe('touch as a third source (07 §8.6)', () => {
  it('a tap shorter than a tick still registers, and keyboard + touch held together release only when both let go', () => {
    const b = new SnapshotBuilder();
    b.down('jump', 'touch'); b.up('jump', 'touch');
    const s = b.build(); expect(s.jump).toEqual({ held: false, pressed: true, released: true });
    b.down('dash', 'kb'); b.down('dash', 'touch'); b.build();
    b.up('dash', 'kb'); expect(b.build().dash).toMatchObject({ held: true, released: false });
    b.up('dash', 'touch'); expect(b.build().dash).toMatchObject({ held: false, released: true });
  });
  it('touch directions merge with the keyboard (latest press wins)', () => {
    const b = new SnapshotBuilder();
    b.down('left', 'kb'); b.down('right', 'touch'); expect(b.build().moveX).toBe(1);
    b.up('right', 'touch'); expect(b.build().moveX).toBe(-1);
  });
  it('dash then jump 0.1 s later, by two fingers hopping buttons, are two separate presses (dash-jump)', () => {
    const b = new SnapshotBuilder();
    b.down('dash', 'touch'); expect(b.build().dash.pressed).toBe(true); b.up('dash', 'touch'); b.build();
    for (let i = 0; i < 12; i++) b.build();
    b.down('jump', 'touch'); const j = b.build(); expect(j.jump.pressed).toBe(true);
  });
});
