// Which sounds a render frame plays (08 §13.3), from the ticks' events and state changes. Pure: no Phaser.
import { rushLevel } from '../../core/combat/rush.ts';
import type { EnemyState } from '../../core/enemies/enemy.ts';
import type { GameWorld } from '../../core/sim/gameWorld.ts';
import { TICK_RATE } from '../../core/tuning.ts';
import { ANIM } from '../../data/art.ts';
import { SFX } from '../../data/sfx.ts';
import { WEAPONS } from '../../data/weapons.ts';
import { LUCKY } from '../../data/loot.ts';
import type { TickEvent } from '../view/vfx.ts';
import type { SfxRequest } from './sfxRules.ts';

/** 08 §13.3 thresholds. */
export const SFX_TRIGGER = {
  hitLightStop: 0.05, hitHeavyStop: 0.075,   // hit sound by hit-stop seconds
  footstepFrames: [1, 5],                    // run frames that play a footstep
  rushSemitones: 3,                          // rush_up pitch per level
} as const;

const SIZE: Record<string, 's' | 'm' | 'l'> = { small: 's', medium: 'm', large: 'l', boss: 'l' };
const sizeOf = (e: EnemyState) => SIZE[e.def.size] ?? 'm';

/** The state the triggers compare against (per scene, reset with the world). */
/** Player projectile → its firing sound. */
const SHOT_SFX: Record<string, string> = { arrow: 'shot_bow', arrow_charged: 'shot_bow', bolt: 'shot_crossbow', staff_bolt: 'shot_staff', orb: 'shot_orb' };

export class SfxWatch {
  private aware = new Map<number, boolean>();
  private phase = new Map<number, string>();
  private stagger = new Map<number, boolean>();
  private frozen = new Map<number, boolean>();
  private intro = new Map<number, boolean>();
  private swingKey = '';
  private rush = 0;
  private sipped = false;
  private charges = -1;
  private runFrame = -1;
  private projectiles = new Set<number>();
  private hazardRocks = new Map<number, number>();
  private shots = new Set<number>();
  private hammer: 'none' | 'out' | 'back' = 'none';
  private charge: 'none' | 'charging' | 'full' = 'none';

  reset(): void {
    this.aware.clear(); this.phase.clear(); this.frozen.clear(); this.stagger.clear(); this.intro.clear();
    this.swingKey = ''; this.rush = 0; this.sipped = false; this.charges = -1; this.runFrame = -1; this.projectiles.clear();
    this.hazardRocks.clear();
  }

  /** Footsteps on run frames 1 and 5, from the player view's anim (checked each render). */
  footsteps(playerAnim: { key: string; frame: number }, w?: GameWorld): SfxRequest[] {
    const rf = playerAnim.key === 'run' ? playerAnim.frame : -1;
    const step = rf !== this.runFrame && (SFX_TRIGGER.footstepFrames as readonly number[]).includes(rf);
    this.runFrame = rf;
    const biome = w?.level?.biome ?? 'plains';
    const id = w?.body.inWater ? 'step_wet' : w?.body.onIce ? 'step_ice' : ['plains', 'swamps', 'village_home', 'village_crossroads'].includes(biome) ? 'step_soft' : 'step_hard';
    return step ? [{ id }] : [];
  }

  /** Called after every world tick with that tick's events, so no state change is missed between renders. */
  collect(w: GameWorld, events: TickEvent[]): SfxRequest[] {
    const out: SfxRequest[] = [];
    const b = w.body;
    for (const { e } of events) {
      switch (e.t) {
        case 'move': {
          const m: Partial<Record<string, string>> = {
            jump: 'jump', doubleJump: 'double_jump', wallJump: 'wall_jump', dashStart: 'dash', slideStart: 'slide',
            ledgeGrab: 'ledge_grab', dropThrough: 'drop_through', diveStart: 'dive_start', diveBounce: 'dive_bounce', spikeHit: 'spike_hit',
            enterWater: 'splash', exitWater: 'splash', cartJump: 'cart_jump', cartCrash: 'cart_crash', platformShake: 'platform_shake', platformCollapse: 'platform_collapse',
          };
          if (e.e === 'land' && b.landSpeed >= ANIM.LAND_MIN_VY) out.push({ id: 'land' });
          else if (e.e === 'diveLand') {
            const wid = w.combat.slots[w.dive?.slot ?? 0]?.weaponId;
            out.push({ id: wid && WEAPONS[wid]?.weight === 'heavy' ? 'dive_land_heavy' : 'dive_land' });
          } else if (m[e.e]) out.push({ id: m[e.e]! });
          break;
        }
        case 'hit': {
          if (e.chainFrom !== undefined) { out.push({ id: 'zap', x: w.enemies.find((x) => x.id === e.target)?.x }); break; }
          if (e.target === 'player') { out.push({ id: 'player_hurt' }); break; }
          const en = w.enemies.find((x) => x.id === e.target);
          const stop = (en?.hitStopTicks ?? 0) / TICK_RATE;
          const id = e.crit ? 'hit_crit' : e.heavy || stop >= SFX_TRIGGER.hitHeavyStop ? 'hit_heavy' : stop >= SFX_TRIGGER.hitLightStop ? 'hit_medium' : 'hit_light';
          out.push({ id });
          if (e.element && e.element !== 'lightning' && !e.dot) out.push({ id: `${e.element}_hit` });
          break;
        }
        case 'kill': {
          const en = w.enemies.find((x) => x.id === e.enemyId);
          if (en && !en.boss) out.push({ id: `enemy_death_${sizeOf(en)}`, x: en.x });
          break;
        }
        case 'enemyTelegraph': {
          const en = w.enemies.find((x) => x.id === e.enemyId);
          if (en && en.def.id === 'wild_boar' && e.attackId === 'charge') out.push({ id: 'vo_wild_boar', x: en.x });
          break;
        }
        case 'playerDied': out.push({ id: 'player_death' }); break;
        case 'drink': out.push({ id: 'flask_drink' }); break;
        case 'healRefused': if (e.reason === 'noCharge') out.push({ id: 'flask_empty' }); break;
        case 'arenaLocked': out.push({ id: 'door_slam' }); break;
        case 'arenaCleared': out.push({ id: 'door_open' }, { id: 'arena_clear' }); break;
        case 'timedDoorOpened': out.push({ id: 'timed_open' }, { id: 'door_open' }); break;
        case 'timedDoorMissed': out.push({ id: 'timed_missed' }); break;
        case 'bossDefeated': out.push({ id: 'boss_defeated' }); break;
        case 'split': if (e.deltaTicks !== null) out.push({ id: e.deltaTicks <= 0 ? 'split_faster' : 'split_slower' }); break;
        case 'abilityUsed': if (SFX[`ab_${e.id}`]) out.push({ id: `ab_${e.id}` }); break;
        case 'abilityLinked': out.push({ id: 'ab_link' }); break;
        case 'abilityFizzle': out.push({ id: 'ab_fizzle' }); break;
        case 'abilityNotReady': out.push({ id: 'ab_not_ready' }); break;
        case 'classChanged': out.push({ id: 'class_change' }); break;
        case 'classDiscovered': out.push({ id: 'class_discovered' }); break;
        case 'chestOpened': out.push({ id: e.kind === 'cursed' ? 'cursed_open' : 'chest_open' }, { id: 'item_pop' }); break;
        case 'chestLocked': out.push({ id: 'chest_locked' }); break;
        case 'keyTaken': out.push({ id: 'key_pickup' }); break;
        case 'blueprintFound': out.push({ id: 'blueprint' }); break;
        case 'keysFull': out.push({ id: 'keys_full' }); break;
        case 'goldChanged': if (e.reason === 'coin') out.push({ id: 'coin' }); break;
        case 'itemTaken': out.push({ id: e.kind === 'ability' ? 'pickup_ability' : 'pickup_weapon' }); break;
        case 'luckyBroken': out.push({ id: 'lucky_hit' }); break;
        case 'luckyResult': out.push({ id: e.id === 'jackpot' ? 'jackpot' : LUCKY.find((l) => l.id === e.id)?.kind === 'buff' ? 'lucky_buff' : 'lucky_debuff' }); break;
        case 'curseLifted': out.push({ id: 'curse_lifted' }); break;
        case 'purchase': out.push({ id: e.what.startsWith('upgrade:') ? 'upgrade' : 'purchase' }); break;
        case 'cantAfford': out.push({ id: 'cant_afford' }); break;
        case 'stationDone': out.push({ id: 'ui_confirm' }); break;                   // 06 §12.4
        default: if ((e as { t: string }).t === 'wallBroken') out.push({ id: 'wall_break' }); break;
      }
    }
    // Enemies: becoming aware (voice), an Act starting (swing), boss intro and break.
    for (const en of w.enemies) {
      if (en.dead) continue;
      const aware = en.aware;
      if (aware && this.aware.get(en.id) === false && SFX[`vo_${en.def.id}`]) out.push({ id: `vo_${en.def.id}`, x: en.x });
      this.aware.set(en.id, aware);
      const a = en.ai.attack;
      const ph = a ? `${a.def.id}:${a.phase}` : '';
      if (a && a.phase === 'act' && this.phase.get(en.id) !== ph && a.def.hit && !a.def.shots) out.push({ id: `enemy_swing_${sizeOf(en)}`, x: en.x });
      this.phase.set(en.id, ph);
      if (en.boss) {
        const intro = en.boss.introTicks > 0;
        if (intro && !this.intro.get(en.id) && SFX[`boss_roar_${en.def.id}`]) out.push({ id: `boss_roar_${en.def.id}` });
        this.intro.set(en.id, intro);
        const st = en.control?.type === 'stagger';
        if (st && !this.stagger.get(en.id)) out.push({ id: 'boss_break' });
        this.stagger.set(en.id, st);
      }
    }
    // Freeze starts and ends (shatter) on enemies (02 §6.3).
    for (const en of w.enemies) {
      const fz = !en.dead && !!en.status?.frozen;
      const was = this.frozen.get(en.id) ?? false;
      if (fz && !was) out.push({ id: 'freeze', x: en.x });
      if (!fz && was) out.push({ id: 'shatter', x: en.x });
      this.frozen.set(en.id, fz);
    }
    // Enemy projectiles: spawn sound (rocks whistle as they fall).
    const live = new Set<number>();
    for (const p of w.projectiles) {
      live.add(p.id);
      if (this.projectiles.has(p.id)) continue;
      const id = p.def.id === 'falling_rock' ? 'rock_whistle' : `proj_${p.def.id}`;
      if (SFX[id]) out.push({ id, x: p.x });
    }
    this.projectiles = live;
    const rocks = new Map(w.fallingRocks.rocks.map(r => [r.id, r.x]));
    for (const [id, x] of rocks) if (!this.hazardRocks.has(id)) out.push({ id: 'rock_whistle', x });
    for (const [id, x] of this.hazardRocks) if (!rocks.has(id)) out.push({ id: 'rock_shatter', x });
    this.hazardRocks = rocks;
    // Player shots, the thrown hammer, charging (ART5 sounds).
    const shotLive = new Set<number>();
    for (const p of w.playerProjectiles) {
      shotLive.add(p.id);
      if (this.shots.has(p.id)) continue;
      const id = SHOT_SFX[p.def.id];
      if (id) out.push({ id });
    }
    this.shots = shotLive;
    const h = w.hammer ? w.hammer.phase : 'none';
    if (h !== this.hammer) {
      if (h === 'out') out.push({ id: 'hammer_throw' });
      else if (h === 'back') out.push({ id: 'hammer_return' });
      else if (this.hammer !== 'none') out.push({ id: 'hammer_catch' });
      this.hammer = h;
    }
    const ch = w.combat.charge;
    const cs = !ch ? 'none' : ch.ticks >= ch.need ? 'full' : 'charging';
    if (cs !== this.charge) {
      if (cs === 'charging' && this.charge === 'none') out.push({ id: 'charge_loop' });
      if (cs === 'full') out.push({ id: 'charge_full' });
      this.charge = cs;
    }
    // Player: a melee step's active phase starts (by weapon weight).
    const cur = w.combat.current;
    const key = cur && cur.phase === 'active' ? `${cur.attackInstance}` : '';
    if (key && key !== this.swingKey) {
      const inst = w.combat.slots[cur!.slot];
      const weight = inst ? WEAPONS[inst.weaponId]?.weight : undefined;
      if (weight) out.push({ id: `swing_${weight}` });
    }
    this.swingKey = key;
    // Rush up / max / down.
    const lvl = rushLevel(w.rush);
    if (lvl > this.rush) out.push(lvl === 3 ? { id: 'rush_max' } : { id: 'rush_up', semitones: SFX_TRIGGER.rushSemitones * (lvl - 1) });
    else if (lvl < this.rush) out.push({ id: 'rush_down' });
    this.rush = lvl;
    // Flask: the sip point and charges gained.
    const sipped = !!w.drinking?.sipped;
    if (sipped && !this.sipped) out.push({ id: 'flask_sip' });
    this.sipped = sipped;
    if (this.charges >= 0 && w.flask.charges > this.charges && !w.drinking) out.push({ id: 'flask_charge' });
    this.charges = w.flask.charges;
    return out;
  }
}
