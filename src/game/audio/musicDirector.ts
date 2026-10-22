// Decides what the music player should do each frame (08 §14.4). Pure logic, no Phaser and no WebAudio, so it is unit tested.
import { bossLayerLevel, chooseLoop, isStageTrack, MUSIC_RULES, type MusicSnapshot, type MusicTrackId } from '../../data/musicRules.ts';

export type MusicEvent =
  | { t: 'bossDefeated'; bossId: string }
  | { t: 'playerDied' } | { t: 'runCompleted' } | { t: 'enterVillage' } | { t: 'stageStarted' } | { t: 'loadLevel' };

export interface MusicOrders {
  /** Present when the looping track changes (null = silence). */
  loop?: { track: MusicTrackId | null; fade: number };
  /** A stinger to start now. */
  sting?: MusicTrackId;
  /** Layer level wanted on the current loop: stage tracks 0-3 (Rush), boss tracks 0-2. */
  layers: number;
  tempoMult: number;
}

export class MusicDirector {
  private loop: MusicTrackId | null | undefined;
  private silent: null | { why: 'boss' | 'death' | 'complete'; levelId: string } = null;
  private resumeAfterSting = false;

  /** Forget everything (a new scene: the next update starts its music from the top). */
  reset(): void { this.loop = undefined; this.silent = null; this.resumeAfterSting = false; }

  update(s: MusicSnapshot, events: readonly MusicEvent[], stingPlaying: boolean): MusicOrders {
    const orders: MusicOrders = { layers: 0, tempoMult: 1 };
    let fadeOverride: number | null = null;
    for (const e of events) {
      if (e.t === 'enterVillage' || e.t === 'stageStarted' || e.t === 'loadLevel') { this.silent = null; this.resumeAfterSting = false; }
      else if (e.t === 'playerDied') { this.silent = { why: 'death', levelId: s.levelId }; orders.sting = 'sting_death'; fadeOverride = MUSIC_RULES.fadeDeath; }
      else if (e.t === 'runCompleted') { this.silent = { why: 'complete', levelId: s.levelId }; orders.sting = 'sting_complete'; fadeOverride = MUSIC_RULES.fadeVictory; }
      else if (e.t === 'bossDefeated') {
        fadeOverride = MUSIC_RULES.fadeVictory;
        this.silent = { why: 'boss', levelId: s.levelId };
        if (e.bossId !== 'enemy_king') orders.sting = 'sting_victory';      // the Enemy King gets sting_complete from runCompleted only
        if (e.bossId === 'dragon') this.resumeAfterSting = true;            // Dragon: sting, then the stage track again
      }
    }
    if (this.silent && (this.silent.levelId !== s.levelId || (this.silent.why === 'death' && !s.dead))) this.silent = null;
    if (this.resumeAfterSting && !stingPlaying && !orders.sting) { this.silent = null; this.resumeAfterSting = false; }

    let want: MusicTrackId | null = this.silent ? null : chooseLoop(s);
    if (this.silent?.why === 'complete' && !stingPlaying && !orders.sting) want = 'title';   // the run summary plays `title` after the fanfare
    if (want !== this.loop) {
      const fade = fadeOverride ?? (want === 'village' ? MUSIC_RULES.fadeVillage : want?.startsWith('boss') ? MUSIC_RULES.fadeBoss : MUSIC_RULES.fadeOut);
      orders.loop = { track: want, fade: this.loop === undefined ? 0 : fade };
      this.loop = want;
    }
    if (want && isStageTrack(want)) { orders.layers = s.rush; orders.tempoMult = MUSIC_RULES.rushTempo[s.rush]; }
    else if (want && s.boss) orders.layers = bossLayerLevel(want, s.boss.phase, s.boss.enraged);
    return orders;
  }
}
