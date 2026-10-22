import { describe, expect, it } from 'vitest';
import { decodeGhost, encodeGhost, ghostAt, GhostRecorder, type GhostSample } from './codec.ts';
import { loadGhost, saveGhost, type GhostStorage } from './store.ts';
import { GHOST } from '../../data/practice.ts';
import { PLAYER_ANIM_KEYS } from '../../data/animKeys.ts';

const sample = (i: number): GhostSample => ({ x: 100 + i, y: 200 + i, facing: i % 2 ? -1 : 1, anim: i % 3 ? 'run' : 'idle', frame: i % 8 });
const memory = (): GhostStorage & { map: Map<string, string> } => { const map = new Map<string, string>(); return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => { map.set(k, v); } }; };

describe('ghost codec (06 §14)', () => {
  it('has unique anim keys that include idle and attack keys', () => {
    expect(new Set(PLAYER_ANIM_KEYS).size).toBe(PLAYER_ANIM_KEYS.length); expect(PLAYER_ANIM_KEYS).toContain('idle'); expect(PLAYER_ANIM_KEYS).toContain('atk_greatsword_1');
    expect(PLAYER_ANIM_KEYS.length).toBeLessThan(256);
  });
  it('round-trips samples at 6 bytes each, base64url without padding', () => {
    const list = Array.from({ length: 50 }, (_, i) => sample(i)), text = encodeGhost(list);
    expect(text).toMatch(/^[A-Za-z0-9_-]+$/); expect(text.length).toBe(Math.ceil((50 * 6 * 4) / 3));
    expect(decodeGhost(text)).toEqual(list);
  });
  it('rounds and clamps coordinates and keeps the facing bit', () => {
    const [s] = decodeGhost(encodeGhost([{ x: -5, y: 70000.4, facing: -1, anim: 'run', frame: 3 }]))!;
    expect(s).toEqual({ x: 0, y: 65535, facing: -1, anim: 'run', frame: 3 });
  });
  it('rejects broken data and caps the length', () => {
    expect(decodeGhost('!!')).toBeNull(); expect(decodeGhost('AAAA')).toBeNull();
    expect(encodeGhost(Array.from({ length: GHOST.maxSamples + 5 }, (_, i) => sample(i))).length).toBe(Math.ceil((GHOST.maxSamples * 6 * 4) / 3));
  });
  it('records every second tick, once, and stops at the cap', () => {
    const r = new GhostRecorder();
    for (let t = 0; t < 10; t++) { r.record(t, sample(t)); r.record(t, sample(t)); }
    expect(r.samples.map((s) => s.x)).toEqual([100, 102, 104, 106, 108]);
    r.record(40, sample(1)); expect(r.samples).toHaveLength(21); expect(r.samples[10].x).toBe(101);
    r.record(2 * GHOST.maxSamples + 50, sample(2)); expect(r.samples).toHaveLength(GHOST.maxSamples); r.reset(); expect(r.samples).toEqual([]);
  });
  it('plays sample floor(stageTicks / 2) and disappears after the last', () => {
    const list = [sample(0), sample(1), sample(2)];
    expect(ghostAt(list, 0)).toBe(list[0]); expect(ghostAt(list, 3)).toBe(list[1]); expect(ghostAt(list, 5)).toBe(list[2]); expect(ghostAt(list, 6)).toBeNull();
  });
});

describe('ghost storage (06 §14)', () => {
  it('stores under rushblade.ghosts as { v: 1, ghosts } and loads only when ticks equal the practice best', () => {
    const st = memory(), list = [sample(0), sample(1)];
    expect(saveGhost('plains|tank', 900, list, st)).toBe(true);
    expect(JSON.parse(st.map.get('rushblade.ghosts')!)).toMatchObject({ v: 1, ghosts: { 'plains|tank': { ticks: 900 } } });
    expect(loadGhost('plains|tank', 900, st)).toEqual(list);
    expect(loadGhost('plains|tank', 800, st)).toBeNull(); expect(loadGhost('plains|tank', undefined, st)).toBeNull(); expect(loadGhost('castle|tank', 900, st)).toBeNull();
  });
  it('replaces the old ghost and keeps the others', () => {
    const st = memory(); saveGhost('plains|tank', 900, [sample(0)], st); saveGhost('plains|archer', 700, [sample(1)], st); saveGhost('plains|tank', 800, [sample(2)], st);
    expect(loadGhost('plains|tank', 900, st)).toBeNull(); expect(loadGhost('plains|tank', 800, st)).toEqual([sample(2)]); expect(loadGhost('plains|archer', 700, st)).toEqual([sample(1)]);
  });
  it('treats bad JSON and throwing storage as no ghost', () => {
    const st = memory(); st.map.set('rushblade.ghosts', '{nope'); expect(loadGhost('plains|tank', 1, st)).toBeNull(); expect(saveGhost('plains|tank', 1, [sample(0)], st)).toBe(true);
    const bad: GhostStorage = { getItem: () => { throw Error('x'); }, setItem: () => { throw Error('x'); } };
    expect(loadGhost('plains|tank', 1, bad)).toBeNull(); expect(saveGhost('plains|tank', 1, [], bad)).toBe(false); expect(saveGhost('a', 1, [], null)).toBe(false);
  });
});
