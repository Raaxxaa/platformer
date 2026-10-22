// Music rules (08 §14.1, §14.3, §14.4, §15). Pure numbers and functions; the WebAudio player is src/game/audio/music.ts.
export const MUSIC_TRACKS = [
  'title', 'village', 'plains', 'mountains', 'swamps', 'kingdom', 'castle',
  'boss_guardian', 'boss_black_knight', 'boss_king', 'boss_dragon',
  'sting_victory', 'sting_death', 'sting_complete',
] as const;
export type MusicTrackId = typeof MUSIC_TRACKS[number];
export type MusicLayer = 'base' | 'L1' | 'L2' | 'L3';

export const MUSIC_RULES = {
  busTrim: 0.55,                         // 08 §15: master -> music (trim 0.55)
  scheduleInterval: 0.025, lookAhead: 0.10,
  /** SPEC-GAP: 08 §14.1 says max 24 voices; with the long release tails of drums, bells and plucks the pads were cut, so 32. */
  maxVoices: 32,
  attack: 0.005,
  stepsPerBar: 16,
  rushTempo: [1.0, 1.02, 1.04, 1.06] as const,
  rushOnSeconds: 0.5, rushOffDelay: 1.0, rushOffSeconds: 1.5,
  fadeOut: 1.0, fadeBoss: 1.0, fadeVictory: 0.5, fadeDeath: 0.2, fadeVillage: 1.0,
  pauseFactor: 0.35, slowCutoff: 900, normalCutoff: 20000, duckFactor: 0.5, duckAttack: 0.05, duckRelease: 0.3,
} as const;

/** The boss each boss track belongs to (08 §14.3). */
export const BOSS_TRACK: Record<string, MusicTrackId> = {
  great_boar: 'boss_guardian', stone_colossus: 'boss_guardian', spider_queen: 'boss_guardian',
  black_knight: 'boss_black_knight', enemy_king: 'boss_king', dragon: 'boss_dragon',
};

const STAGE_TRACKS: Record<string, MusicTrackId> = { plains: 'plains', mountains: 'mountains', swamps: 'swamps', kingdom: 'kingdom', castle: 'castle' };

/** What is going on, as the Phaser layer reads it from the world each frame. */
export interface MusicSnapshot {
  levelId: string;                       // 'plains' ... 'castle', 'home', 'crossroads', 'border', 'rebel_camp', 'training_yard'
  levelKind: 'stage' | 'village' | 'training';
  /** The boss of a locked arena (or the awake Dragon): its enemy id and 1-based phase. Null outside a boss fight. */
  boss: { id: string; phase: number; enraged: boolean } | null;
  rush: 0 | 1 | 2 | 3;
  dead: boolean;
  runComplete: boolean;
}

/** The looping track that should play now, or null for silence. */
export function chooseLoop(s: MusicSnapshot): MusicTrackId | null {
  if (s.dead || s.runComplete) return null;
  if (s.boss && BOSS_TRACK[s.boss.id]) return BOSS_TRACK[s.boss.id];
  if (s.levelKind !== 'stage') return 'village';        // all 4 villages, the Home Village and the Training Yard
  return STAGE_TRACKS[s.levelId] ?? 'plains';
}

/** Which layers a track plays right now (08 §14.4). Stage tracks follow Rush, boss tracks follow their phase, others only base. */
export function bossLayerLevel(track: MusicTrackId, phase: number, enraged: boolean): number {
  switch (track) {
    case 'boss_guardian': case 'boss_dragon': return phase >= 2 || enraged ? 1 : 0;
    case 'boss_black_knight': return phase >= 2 ? 1 : 0;
    case 'boss_king': return phase >= 3 ? 2 : phase >= 2 ? 1 : 0;
    default: return 0;
  }
}
export const isStageTrack = (t: MusicTrackId): boolean => t === 'plains' || t === 'mountains' || t === 'swamps' || t === 'kingdom' || t === 'castle';
export const isSting = (t: string): boolean => t.startsWith('sting_');

/** Step length in seconds: 16th notes (08 §14.1). */
export function stepSeconds(bpm: number, tempoMult: number): number {
  return 60 / (bpm * tempoMult) / 4;
}

/** The step clock of one playing track. A tempo change waits for the next bar line. */
export class StepClock {
  step = 0;                              // index of the next step to schedule, from track start
  time: number;                          // AudioContext time of that step
  private mult = 1;
  private pending: number | null = null;
  readonly bpm: number; readonly bars: number; readonly loopStartBar: number; readonly loop: boolean;
  constructor(bpm: number, bars: number, loopStartBar: number, startTime: number, loop = true) {
    this.bpm = bpm; this.bars = bars; this.loopStartBar = loopStartBar; this.loop = loop;
    this.time = startTime;
  }
  setTempo(mult: number): void { this.pending = mult; }
  get tempo(): number { return this.mult; }
  /** Returns the step to schedule now and moves on; null when a non-looping track has ended. */
  next(): { step: number; time: number; bar: number; barStart: boolean } | null {
    const total = this.bars * MUSIC_RULES.stepsPerBar;
    if (this.step >= total) {
      if (!this.loop) return null;
      this.step = (this.loopStartBar - 1) * MUSIC_RULES.stepsPerBar;
    }
    if (this.step % MUSIC_RULES.stepsPerBar === 0 && this.pending !== null) { this.mult = this.pending; this.pending = null; }
    const out = { step: this.step, time: this.time, bar: Math.floor(this.step / MUSIC_RULES.stepsPerBar), barStart: this.step % MUSIC_RULES.stepsPerBar === 0 };
    this.time += stepSeconds(this.bpm, this.mult);
    this.step++;
    return out;
  }
}

/** Rush layers (08 §14.4): L(n) on at Rush >= n; on = 0 -> 1 over 0.5 s; off only after Rush stayed lower for 1.0 s, then 1 -> 0 over 1.5 s. */
export interface LayerRamp { layer: 1 | 2 | 3; target: 0 | 1; seconds: number }
export class RushLayers {
  private target: [0 | 1, 0 | 1, 0 | 1] = [0, 0, 0];
  private lowerSince: [number | null, number | null, number | null] = [null, null, null];
  update(now: number, rush: number): LayerRamp[] {
    const out: LayerRamp[] = [];
    for (let i = 0; i < 3; i++) {
      const layer = (i + 1) as 1 | 2 | 3;
      if (rush >= layer) {
        this.lowerSince[i] = null;
        if (this.target[i] !== 1) { this.target[i] = 1; out.push({ layer, target: 1, seconds: MUSIC_RULES.rushOnSeconds }); }
      } else if (this.target[i] === 1) {
        this.lowerSince[i] ??= now;
        if (now - this.lowerSince[i]! >= MUSIC_RULES.rushOffDelay) { this.target[i] = 0; this.lowerSince[i] = null; out.push({ layer, target: 0, seconds: MUSIC_RULES.rushOffSeconds }); }
      }
    }
    return out;
  }
  reset(): void { this.target = [0, 0, 0]; this.lowerSince = [null, null, null]; }
}
