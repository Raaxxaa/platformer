// Music player (08 §14.1, §15): a WebAudio step sequencer on Phaser's AudioContext. Note data is public/assets/music/<track>.json,
// instrument samples are public/assets/audio/inst/<id>.wav (both made by tools/audio). Every call does nothing until the
// browser unlocks audio (a key press, click or touch), and nothing is queued before that.
import type Phaser from 'phaser';
import type { GameWorld } from '../../core/sim/gameWorld.ts';
import { timeSlow } from '../../core/abilities/list/time_slow.ts';
import { rushLevel } from '../../core/combat/rush.ts';
import { SAVE_RULES } from '../../data/save.ts';
import { MUSIC_RULES, MUSIC_TRACKS, RushLayers, StepClock, isSting, type MusicLayer, type MusicSnapshot, type MusicTrackId } from '../../data/musicRules.ts';
import { getUiSettings } from '../../ui/inputSettings.ts';
import { MusicDirector, type MusicEvent } from './musicDirector.ts';

export const MUSIC_INSTRUMENTS = ['kick', 'snare', 'hat', 'hat_open', 'tom', 'bass', 'lead', 'pluck', 'pad', 'bell', 'strings', 'brass', 'arp'] as const;
export const musicKey = (id: string): string => `music_${id}`;
export const instKey = (id: string): string => `inst_${id}`;

interface TrackJson {
  id: string; bpm: number; bars: number; loopStartBar: number; loop?: boolean;
  channels: { inst: string; layer: MusicLayer; gain: number; pan: number; notes: [number, number, number, number][] }[];
}
interface InstMeta { id: string; rootMidi: number; release: number }
const LAYER_INDEX: Record<MusicLayer, number> = { base: 0, L1: 1, L2: 2, L3: 3 };

interface Voice {
  id: MusicTrackId; json: TrackJson; clock: StepClock; gain: GainNode; layers: GainNode[];
  byStep: Map<number, { inst: string; midi: number; len: number; vel: number; gain: number; pan: number; layer: number }[]>;
  endAt: number | null; sting: boolean; layerState: RushLayers; layerLevel: number;
}

export class MusicPlayer {
  private scene: Phaser.Scene | null = null;
  private ctx: AudioContext | null = null;
  private loopsDuck!: GainNode; private pauseGain!: GainNode; private bus!: GainNode; private filter!: BiquadFilterNode; private stingGain!: GainNode;
  private timer: ReturnType<typeof setInterval> | null = null;
  private instMeta = new Map<string, InstMeta>();
  private main: Voice | null = null;
  private old: Voice[] = [];
  private sting: Voice | null = null;
  private active: { src: AudioBufferSourceNode; gain: GainNode; start: number }[] = [];
  private readonly director = new MusicDirector();
  private events: MusicEvent[] = [];
  /** Tracks started, for tests (window.__game.musicLog()). */
  readonly log: string[] = [];

  /** Bind to a scene's sound manager. Called by every scene that shows music. */
  attach(scene: Phaser.Scene): void {
    this.scene = scene;
    const sm = scene.sound as Phaser.Sound.WebAudioSoundManager;
    if (!('context' in sm) || !sm.context) return;                       // no WebAudio: the game runs silent
    if (this.ctx !== sm.context) { this.teardown(); this.ctx = sm.context; this.buildGraph(sm); }
  }

  /** Called when a gameplay scene ends so the next scene starts its music from the top. */
  resetDirector(): void { this.director.reset(); }

  get locked(): boolean { return !this.scene || this.scene.sound.locked || !this.ctx; }
  get current(): string | null { return this.main?.id ?? null; }

  private buildGraph(sm: Phaser.Sound.WebAudioSoundManager): void {
    const c = this.ctx!;
    this.loopsDuck = c.createGain(); this.stingGain = c.createGain(); this.pauseGain = c.createGain(); this.bus = c.createGain();
    this.filter = c.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.frequency.value = MUSIC_RULES.normalCutoff;
    this.loopsDuck.connect(this.pauseGain); this.stingGain.connect(this.pauseGain);
    this.pauseGain.connect(this.filter); this.filter.connect(this.bus); this.bus.connect(sm.destination);
  }

  private teardown(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null; this.main = null; this.old = []; this.sting = null; this.active = []; this.director.reset();
  }

  private metaReady(): boolean {
    if (this.instMeta.size) return true;
    const list = this.scene?.cache.json.get('music_instruments') as InstMeta[] | undefined;
    if (!list) return false;
    for (const m of list) this.instMeta.set(m.id, m);
    return true;
  }

  private track(id: string): TrackJson | null {
    return (this.scene?.cache.json.get(musicKey(id)) as TrackJson | undefined) ?? null;
  }

  /** Per-frame hook for gameplay scenes. */
  update(scene: Phaser.Scene, snap: MusicSnapshot, paused: boolean, slow: boolean): void {
    this.attach(scene);
    if (this.locked) { this.events = []; return; }                       // before unlock nothing is queued
    const orders = this.director.update(snap, this.events, !!this.sting);
    this.events = [];
    this.applyOrders(orders.loop, orders.sting, orders.layers, orders.tempoMult);
    this.mix(paused, slow);
  }

  /** Per-frame hook for the title and menus: the `title` track. */
  updateMenu(scene: Phaser.Scene): void {
    this.attach(scene);
    if (this.locked) return;
    if (this.current !== 'title') this.startLoop('title', this.main ? MUSIC_RULES.fadeVillage : 0);
    this.mix(false, false);
  }

  note(e: MusicEvent): void { this.events.push(e); }

  private applyOrders(loop: { track: MusicTrackId | null; fade: number } | undefined, sting: MusicTrackId | undefined, layers: number, tempo: number): void {
    if (loop) { if (loop.track) this.startLoop(loop.track, loop.fade || (this.main ? MUSIC_RULES.fadeVillage : 0)); else this.fadeOutMain(loop.fade); }
    if (sting) this.startSting(sting);
    const m = this.main;
    if (m && this.ctx) {
      for (const r of m.layerState.update(this.ctx.currentTime, layers)) this.ramp(m.layers[r.layer], r.target, r.seconds);
      m.clock.setTempo(tempo);
    }
  }

  private ramp(g: GainNode, to: number, seconds: number): void {
    const t = this.ctx!.currentTime;
    g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(to, t + Math.max(0.001, seconds));
  }

  private makeVoice(id: MusicTrackId, out: AudioNode): Voice | null {
    const json = this.track(id);
    if (!json || !this.metaReady() || !this.ctx) return null;
    const c = this.ctx;
    const gain = c.createGain(); gain.connect(out);
    const layers = [0, 1, 2, 3].map((i) => { const g = c.createGain(); g.gain.value = i === 0 ? 1 : 0; g.connect(gain); return g; });
    const byStep: Voice['byStep'] = new Map();
    for (const ch of json.channels) for (const [step, midi, len, vel] of ch.notes) {
      const arr = byStep.get(step) ?? [];
      arr.push({ inst: ch.inst, midi, len, vel, gain: ch.gain, pan: ch.pan, layer: LAYER_INDEX[ch.layer] });
      byStep.set(step, arr);
    }
    const loop = json.loop !== false;
    return { id, json, gain, layers, byStep, clock: new StepClock(json.bpm, json.bars, json.loopStartBar, c.currentTime + 0.05, loop), endAt: null, sting: !loop, layerState: new RushLayers(), layerLevel: 0 };
  }

  private ensureTimer(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.pump(), MUSIC_RULES.scheduleInterval * 1000);
  }

  startLoop(id: MusicTrackId, fade: number): void {
    if (this.locked || !this.ctx || this.main?.id === id) return;
    const v = this.makeVoice(id, this.loopsDuck);
    if (!v) return;
    const t = this.ctx.currentTime;
    if (this.main) this.retire(this.main, fade);
    v.gain.gain.setValueAtTime(fade > 0 ? 0 : 1, t);
    if (fade > 0) v.gain.gain.linearRampToValueAtTime(1, t + fade);
    this.main = v; this.log.push(id); this.ensureTimer();
  }

  private retire(v: Voice, fade: number): void {
    const t = this.ctx!.currentTime;
    v.gain.gain.cancelScheduledValues(t); v.gain.gain.setValueAtTime(v.gain.gain.value, t);
    v.gain.gain.linearRampToValueAtTime(0, t + Math.max(0.01, fade));
    v.endAt = t + Math.max(0.01, fade) + 0.05;
    this.old.push(v);
  }

  private fadeOutMain(fade: number): void {
    if (!this.main || !this.ctx) return;
    this.retire(this.main, fade); this.main = null;
  }

  private startSting(id: MusicTrackId): void {
    if (!isSting(id) || this.locked || !this.ctx) return;
    const v = this.makeVoice(id, this.stingGain);
    if (!v) return;
    const t = this.ctx.currentTime;
    if (this.sting) this.retire(this.sting, 0.05);
    v.gain.gain.setValueAtTime(1, t);
    this.sting = v; this.log.push(id); this.ensureTimer();
    // Stingers duck the music bus by x0.5 (attack 0.05 s, release 0.3 s after the sound ends).
    const len = v.json.bars * MUSIC_RULES.stepsPerBar * 60 / v.json.bpm / 4;
    const d = this.loopsDuck.gain; d.cancelScheduledValues(t); d.setValueAtTime(d.value, t);
    d.linearRampToValueAtTime(MUSIC_RULES.duckFactor, t + MUSIC_RULES.duckAttack);
    d.setValueAtTime(MUSIC_RULES.duckFactor, t + len + 0.6);
    d.linearRampToValueAtTime(1, t + len + 0.6 + MUSIC_RULES.duckRelease);
  }

  private mix(paused: boolean, slow: boolean): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const vol = getUiSettings().volume.music / SAVE_RULES.volumeMax;
    this.bus.gain.setTargetAtTime(MUSIC_RULES.busTrim * vol, t, 0.05);
    this.pauseGain.gain.setTargetAtTime(paused ? MUSIC_RULES.pauseFactor : 1, t, 0.05);
    this.filter.frequency.setTargetAtTime(slow ? MUSIC_RULES.slowCutoff : MUSIC_RULES.normalCutoff, t, 0.05);
  }

  private pump(): void {
    const c = this.ctx;
    if (!c) return;
    const now = c.currentTime;
    for (const v of [this.main, this.sting, ...this.old]) if (v) this.schedule(v, now);
    this.old = this.old.filter((v) => { const done = v.endAt !== null && now > v.endAt; if (done) v.gain.disconnect(); return !done; });
    if (this.sting && this.sting.endAt === null && this.sting.clock.step >= this.sting.json.bars * MUSIC_RULES.stepsPerBar) {
      this.sting.endAt = this.sting.clock.time + 1.5;                     // let the tail ring out
    }
    if (this.sting?.endAt !== null && this.sting && now > this.sting.endAt!) { this.sting.gain.disconnect(); this.sting = null; }
  }

  private schedule(v: Voice, now: number): void {
    const ahead = now + MUSIC_RULES.lookAhead;
    while (v.clock.time < ahead) {
      const s = v.clock.next();
      if (!s) return;
      if (s.time < now - 0.25) continue;                                  // the tab slept: skip, do not burst
      const notes = v.byStep.get(s.step);
      if (!notes) continue;
      const stepLen = 60 / (v.json.bpm * v.clock.tempo) / 4;
      for (const n of notes) this.play(v, n, s.time, stepLen);
    }
  }

  private play(v: Voice, n: { inst: string; midi: number; len: number; vel: number; gain: number; layer: number }, when: number, stepLen: number): void {
    const c = this.ctx!;
    const buf = this.scene?.cache.audio.get(instKey(n.inst)) as AudioBuffer | undefined;
    const meta = this.instMeta.get(n.inst);
    if (!buf || !meta) return;
    if (this.active.length >= MUSIC_RULES.maxVoices) {
      const o = this.active.shift()!;
      o.gain.gain.cancelScheduledValues(when); o.gain.gain.setTargetAtTime(0, when, 0.01); o.src.stop(when + 0.05);
    }
    const src = c.createBufferSource(); src.buffer = buf;
    src.playbackRate.value = 2 ** ((n.midi - meta.rootMidi) / 12);
    const g = c.createGain();
    const peak = n.vel * n.gain, dur = n.len * stepLen;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(peak, when + MUSIC_RULES.attack);
    g.gain.setValueAtTime(peak, when + Math.max(MUSIC_RULES.attack, dur));
    g.gain.linearRampToValueAtTime(0, when + Math.max(MUSIC_RULES.attack, dur) + meta.release);
    src.connect(g); g.connect(v.layers[n.layer]);
    src.start(when); src.stop(when + Math.max(MUSIC_RULES.attack, dur) + meta.release + 0.02);
    const rec = { src, gain: g, start: when };
    this.active.push(rec);
    src.onended = () => { const i = this.active.indexOf(rec); if (i >= 0) this.active.splice(i, 1); g.disconnect(); };
  }
}

export const music = new MusicPlayer();

/** What the music needs to know about the world this frame (read-only; no rules here). */
export function musicSnapshot(w: GameWorld): MusicSnapshot {
  let boss: MusicSnapshot['boss'] = null;
  for (const e of w.enemies) {
    if (!e.boss || e.dead || !e.def.boss) continue;
    if (e.dragon ? !e.dragon.awake || e.dragon.passive : !w.run.arenas[e.boss.arenaId]?.locked) continue;
    boss = { id: e.def.id, phase: e.boss.phase, enraged: e.boss.enraged };
    break;
  }
  const level = w.level;
  return {
    levelId: level?.id ?? 'plains', levelKind: level?.kind ?? 'stage', boss,
    rush: Math.min(3, Math.max(0, rushLevel(w.rush))) as 0 | 1 | 2 | 3,
    dead: w.phase !== 'stage' || w.run.phase === 'dead', runComplete: w.run.phase === 'runComplete',
  };
}

export const isSlow = (w: GameWorld): boolean => timeSlow(w) !== undefined;
export { MUSIC_TRACKS };
