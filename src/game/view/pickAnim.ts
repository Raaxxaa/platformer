// Which anim and frame a character shows, from core state (08 §5.2, §6.1, §6.3, §7.1–7.4). Pure: no Phaser.
import type { MoveStateId } from '../../core/player/body.ts';
import { BOSS, MOVE, TICK_RATE } from '../../core/tuning.ts';
import { ANIM } from '../../data/art.ts';
import { weaponChargeKey, weaponChargedKey, weaponDiveKey, weaponStepKey, weaponThrowKey, WEAPON_ART, YARD_DUMMY_FRAMES, CAST_POSE, MOVE_POSE } from '../../data/animKeys.ts';
import { phaseFrame, timeFrame, type AnimDef } from './animClock.ts';

export type Lookup = (key: string) => AnimDef | undefined;

export interface PlayerAnimState {
  state: MoveStateId; stateTicks: number; vx: number; vy: number; facing: 1 | -1; landSpeed: number;
  dead: boolean;
  /** The current weapon step (phaseTicks counts from 1, like core). */
  attack: { weaponId: string; step: number; phase: 'startup' | 'active' | 'recovery'; phaseTicks: number; lens: Record<'startup' | 'active' | 'recovery', number>; kind?: 'combo' | 'charged' | 'throw' | 'lunge' | 'spin' } | null;
  /** A running ability cast (03 §7.6) and the ForcedMove owner tag, for ability poses (08 §6.2). */
  cast?: { id: string; phase: 'startup' | 'recovery'; t: number; len: number } | null;
  forcedOwner?: string | null;
  /** The weapon being charged (02 §9.4), for its `charge_<id>` pose. */
  charging?: string | null;
  /** Weapon whose dive layer draws during dive states. */
  diveWeapon: string | null;
  drinkTicks: number | null;
  ticksSinceDoubleJump: number;
  ticksSinceWallJump: number;
}

/** The weapon + smear layer for one frame (08 §4.2): the frame name lives in `weapon_<id>`. */
export interface WeaponLayer { atlas: string; frame: string; behind: boolean; smear: string | null }
export interface PlayerPick { key: string; frame: number; weapon: WeaponLayer | null }

const sec = (ticks: number) => ticks / TICK_RATE;
const n = (get: Lookup, k: string) => get(k)?.frames.length ?? 1;

/** Movement anim (08 §6.1). `viewT` is the view's own anim time; `runPhase` the run accumulator. */
function movement(s: PlayerAnimState, get: Lookup, runPhase: number): { key: string; frame: number } {
  const A = ANIM, st = sec(s.stateTicks);
  switch (s.state) {
    case 'minecart':return {key:'cart_ride',frame:timeFrame(get('cart_ride')!,st)};
    case 'dash': {
      const t = s.stateTicks - 1;
      return { key: 'dash', frame: t < A.DASH_FRAME_STARTS[0] ? 0 : t < A.DASH_FRAME_STARTS[1] ? 1 : 2 };
    }
    case 'wallSlide': return { key: 'wall_slide', frame: timeFrame(get('wall_slide')!, st) };
    case 'ledgeClimb': {
      const total = MOVE.LEDGE_CLIMB_UP_TICKS + MOVE.LEDGE_CLIMB_OVER_TICKS;
      return { key: 'ledge_climb', frame: Math.min(n(get, 'ledge_climb') - 1, Math.floor((s.stateTicks / total) * n(get, 'ledge_climb'))) };
    }
    case 'slide': return { key: 'slide', frame: s.stateTicks <= A.SLIDE_F0_TICKS ? 0 : 1 };
    case 'crawl': return { key: 'crawl', frame: Math.abs(s.vx) > A.CRAWL_MOVE_SPEED ? timeFrame(get('crawl')!, st) : 0 };
    case 'diveWindup': return { key: 'dive_windup', frame: phaseFrame(get('dive_windup')!, 'all', s.stateTicks, MOVE.DIVE_WINDUP_TICKS) };
    case 'diveFall': return { key: 'dive_fall', frame: timeFrame(get('dive_fall')!, st) };
    case 'diveLand': return { key: 'dive_land', frame: phaseFrame(get('dive_land')!, 'all', s.stateTicks, MOVE.DIVE_LAND_LAG_TICKS) };
    case 'air': {
      const dj = get('double_jump')!, wj = get('wall_jump')!;
      if (s.ticksSinceDoubleJump < (dj.frames.length / dj.fps!) * TICK_RATE) return { key: 'double_jump', frame: timeFrame(dj, sec(s.ticksSinceDoubleJump)) };
      if (s.ticksSinceWallJump < (wj.frames.length / wj.fps!) * TICK_RATE) return { key: 'wall_jump', frame: timeFrame(wj, sec(s.ticksSinceWallJump)) };
      if (s.vy < -A.AIR_APEX_VY) return { key: 'jump', frame: timeFrame(get('jump')!, st) };
      if (s.vy > A.AIR_APEX_VY) return { key: 'fall', frame: timeFrame(get('fall')!, st) };
      return { key: 'apex', frame: 0 };
    }
    case 'ground': {
      const land = get('land')!;
      if (s.landSpeed >= A.LAND_MIN_VY && Math.abs(s.vx) < A.RUN_MIN_SPEED && st < land.frames.length / land.fps!) return { key: 'land', frame: timeFrame(land, st) };
      if (Math.abs(s.vx) > A.SKID_SPEED && Math.sign(s.vx) !== s.facing) return { key: 'skid', frame: 0 };
      if (Math.abs(s.vx) > A.RUN_MIN_SPEED) return { key: 'run', frame: Math.floor(runPhase) % n(get, 'run') };
      return { key: 'idle', frame: timeFrame(get('idle')!, st) };
    }
    default: return { key: 'idle', frame: timeFrame(get('idle')!, st) };
  }
}

/** 08 §5.2: dead → hurt → weapon step → drink → movement. */
export function pickPlayerAnim(s: PlayerAnimState, get: Lookup, viewT: number, runPhase: number): PlayerPick {
  if (s.dead || s.state === 'dead') return { key: 'dead', frame: timeFrame(get('dead')!, viewT), weapon: null };
  if (s.state === 'hurt') return { key: 'hurt', frame: timeFrame(get('hurt')!, sec(s.stateTicks)), weapon: null };
  const a = s.attack;
  const art = a ? WEAPON_ART[a.weaponId] : undefined;
  if (a && art) {
    const key = a.kind === 'charged' && art.charged ? weaponChargedKey(a.weaponId)
      : a.kind === 'throw' && art.throw ? weaponThrowKey(a.weaponId)
      : a.kind === 'combo' || a.kind === undefined ? (a.step < art.steps ? weaponStepKey(a.weaponId, a.step) : null) : null;
    const def = key ? get(key) : undefined;
    if (key && def) {
      // Ranged anims have no `active` segment: hold the last startup frame through it.
      const hold = a.phase === 'active' && !def.segments?.some((g) => g.phase === 'active');
      const startup = def.segments?.find((g) => g.phase === 'startup');
      const frame = hold && startup ? startup.frames[startup.frames.length - 1] : phaseFrame(def, a.phase, a.phaseTicks - 1, a.lens[a.phase]);
      const smearOn = art.smear && a.kind !== 'throw' && (a.phase === 'active' || (a.phase === 'recovery' && a.phaseTicks <= ANIM.SMEAR_RECOVERY_TICKS));
      return { key, frame, weapon: { atlas: `weapon_${a.weaponId}`, frame: def.frames[frame], behind: !!def.weaponBehind?.includes(frame), smear: smearOn ? `${key}_smear` : null } };
    }
  }
  if (s.charging && WEAPON_ART[s.charging]?.charge) {
    const key = weaponChargeKey(s.charging), def = get(key);
    if (def) {
      const frame = timeFrame(def, viewT);
      return { key, frame, weapon: { atlas: `weapon_${s.charging}`, frame: def.frames[frame], behind: !!def.weaponBehind?.includes(frame), smear: null } };
    }
  }
  const pose = s.cast ? CAST_POSE[s.cast.id] : undefined;
  if (s.cast && pose && get(pose)) return { key: pose, frame: phaseFrame(get(pose)!, s.cast.phase, s.cast.t, s.cast.len), weapon: null };
  const mp = s.state === 'forced' && s.forcedOwner?.startsWith('ability:') ? MOVE_POSE[s.forcedOwner.slice('ability:'.length)] : undefined;
  if (mp && get(mp)) return { key: mp, frame: timeFrame(get(mp)!, sec(s.stateTicks)), weapon: null };
  if (s.drinkTicks !== null) {
    const t = sec(s.drinkTicks), e = ANIM.DRINK_FRAME_ENDS;
    return { key: 'drink', frame: t < e[0] ? 0 : t < e[1] ? 1 : t < e[2] ? 2 : 3, weapon: null };
  }
  const m = movement(s, get, runPhase);
  let weapon: WeaponLayer | null = null;
  if (m.key.startsWith('dive_') && s.diveWeapon && WEAPON_ART[s.diveWeapon]) {
    const wk = weaponDiveKey(s.diveWeapon, m.key.slice('dive_'.length) as 'windup' | 'fall' | 'land');
    const wd = get(wk);
    if (wd) weapon = { atlas: wd.atlas, frame: wd.frames[Math.min(m.frame, wd.frames.length - 1)], behind: false, smear: null };
  }
  return { ...m, weapon };
}

/** What an enemy view needs to know (a subset of EnemyState). */
export interface EnemyAnimState {
  dead: boolean; vx: number; vy: number; knockback: boolean;
  control: { type: 'stagger' | 'knockdown' | 'dazed' | 'stun' | 'pin' | 'launch' | 'pull' } | null;
  attack: { id: string; phase: string; t: number; len: number } | null;
  boss: { introTicks: number } | null;
  /** The boar's ledge skid (04 §3). */
  skidding?: boolean;
}

export interface EnemyPick { key: string; frame: number; alpha: number }

/** 08 §7.1–7.4. Keys are relative (`idle`, `atk_slash`); `get` resolves them for this enemy. */
export function pickEnemyAnim(e: EnemyAnimState, get: Lookup, t: number, runPhase: number): EnemyPick {
  const has = (k: string) => get(k) !== undefined;
  if (e.dead) {
    const def = get('death')!;
    const i = timeFrame(def, t);
    if (e.boss) return { key: 'death', frame: i, alpha: 1 };
    const last = def.frames.length - 1, fps = def.fps ?? 1;
    const fade = i < last ? 1 : Math.max(0, 1 - (t - last / fps) * fps);
    return { key: 'death', frame: i, alpha: fade };
  }
  const c = e.control;
  if (e.boss && e.boss.introTicks > 0 && has('intro')) {
    const k = get('intro')!.frames.length;
    return { key: 'intro', frame: Math.min(k - 1, Math.floor(((BOSS.INTRO_TICKS - e.boss.introTicks) / BOSS.INTRO_TICKS) * k)), alpha: 1 };
  }
  if (e.boss && c?.type === 'stagger' && has('break')) {
    const f = t < ANIM.BREAK_F0 ? 0 : 1 + (Math.floor((t - ANIM.BREAK_F0) * ANIM.BREAK_FPS) % 2);
    return { key: 'break', frame: f, alpha: 1 };
  }
  if (c?.type === 'knockdown' && has('knockdown')) return { key: 'knockdown', frame: t < ANIM.KNOCKDOWN_F0 ? 0 : 1, alpha: 1 };
  if (c?.type === 'dazed' && has('dazed')) return { key: 'dazed', frame: timeFrame(get('dazed')!, t), alpha: 1 };
  if (c) return { key: 'stagger', frame: timeFrame(get('stagger')!, t), alpha: 1 };
  if (e.knockback && has('hurt')) return { key: 'hurt', frame: 0, alpha: 1 };
  if (e.skidding && has('skid')) return { key: 'skid', frame: 0, alpha: 1 };
  const a = e.attack;
  if (a && has(`atk_${a.id}`)) return { key: `atk_${a.id}`, frame: phaseFrame(get(`atk_${a.id}`)!, a.phase, a.t, a.len, e.vy), alpha: 1 };
  if (Math.abs(e.vx) > 0.5 && has('walk')) return { key: 'walk', frame: Math.floor(runPhase) % get('walk')!.frames.length, alpha: 1 };
  return { key: 'idle', frame: timeFrame(get('idle')!, t), alpha: 1 };
}

/** What a Training Yard target's view needs (ART5 frames, no full anim set). Ticks are world ticks. */
export interface YardDummyState {
  dead: boolean; deathElapsed: number; sinceHit: number;
  attack: { phase: string; t: number; len: number } | null;
}
const YARD_FPS = { hit: 20, tele: 8, death: 10 } as const;

export function yardDummyFrame(id: keyof typeof YARD_DUMMY_FRAMES, s: YardDummyState): string {
  const at = (frames: readonly string[], ticks: number, fps: number, loop = false) => {
    const i = Math.floor((ticks / TICK_RATE) * fps);
    return frames[loop ? i % frames.length : Math.min(frames.length - 1, i)];
  };
  if (id === 'straw_target') {
    const F = YARD_DUMMY_FRAMES.straw_target;
    return s.dead ? at(F.death, s.deathElapsed, YARD_FPS.death) : F.idle[0];
  }
  const F = YARD_DUMMY_FRAMES.sparring_dummy;
  if (s.sinceHit < (F.hit.length / YARD_FPS.hit) * TICK_RATE) return at(F.hit, s.sinceHit, YARD_FPS.hit);
  if (s.attack?.phase === 'tele') return at(F.tele, s.attack.t, YARD_FPS.tele, true);
  if (s.attack?.phase === 'act') return F.swing[Math.min(F.swing.length - 1, Math.floor((s.attack.t / Math.max(1, s.attack.len)) * F.swing.length))];
  return F.idle[0];
}
