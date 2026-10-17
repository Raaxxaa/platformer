// Sound effect table (08 §13.2–13.3). `variants` 0 = one file `<id>.wav`; n = `<id>_1.wav` … `<id>_n.wav`.
export interface SfxDef { vol: number; variants: number; maxVoices?: number; bus?: 'sfx' | 'ui'; world?: boolean }

/** 08 §13.2 playback rules. */
export const SFX_RULES = {
  maxVoicesDefault: 3, maxVoicesHit: 4, maxVoicesStep: 1, maxVoicesUi: 1,
  minGap: 0.03,               // seconds between two plays of one id
  pitchJitter: 0.03,          // ±3%
  pitchSalt: 7,
  panRange: 320, panScale: 0.5,   // pan = clamp((x − camCenterX) / 320, −1, 1) × 0.5
  fadeStart: 320, fadeLen: 320,   // world volume × clamp(1 − (d − 320) / 320, 0, 1)
  maxVoices: 32,
  busTrim: { sfx: 0.85, ui: 0.60 },   // 08 §15
} as const;

const S = SFX_RULES;
const hit = (variants: number): SfxDef => ({ vol: 0.65, variants, maxVoices: S.maxVoicesHit });
const ui: SfxDef = { vol: 0.5, variants: 0, maxVoices: S.maxVoicesUi, bus: 'ui' };
const W = { world: true } as const;

export const SFX: Record<string, SfxDef> = {
  jump: { vol: 0.45, variants: 2 }, double_jump: { vol: 0.45, variants: 2 }, wall_jump: { vol: 0.45, variants: 2 },
  land: { vol: 0.45, variants: 3 },
  step_soft: { vol: 0.22, variants: 4, maxVoices: S.maxVoicesStep },
  dash: { vol: 0.5, variants: 2 }, slide: { vol: 0.5, variants: 2 }, ledge_grab: { vol: 0.5, variants: 2 }, drop_through: { vol: 0.5, variants: 2 },
  dive_start: { vol: 0.6, variants: 0 }, dive_land: { vol: 0.6, variants: 0 }, dive_land_heavy: { vol: 0.6, variants: 0 }, dive_bounce: { vol: 0.6, variants: 0 },
  spike_hit: { vol: 0.45, variants: 2 },
  swing_light: { vol: 0.5, variants: 3 }, swing_medium: { vol: 0.5, variants: 3 }, swing_heavy: { vol: 0.5, variants: 3 },
  hit_light: hit(3), hit_medium: hit(3), hit_heavy: hit(3), hit_crit: hit(3),
  explosion_s: { vol: 0.75, variants: 2, ...W }, explosion_l: { vol: 0.75, variants: 2, ...W },
  charge_loop: { vol: 0.4, variants: 0 }, charge_full: { vol: 0.4, variants: 0 },
  player_hurt: { vol: 0.8, variants: 2 }, player_death: { vol: 0.8, variants: 2 },
  flask_drink: { vol: 0.5, variants: 0 }, flask_sip: { vol: 0.5, variants: 0 }, flask_empty: { vol: 0.5, variants: 0 },
  flask_tick: { vol: 0.25, variants: 0 }, flask_charge: { vol: 0.5, variants: 0 },
  rush_up: { vol: 0.45, variants: 0 }, rush_max: { vol: 0.45, variants: 0 }, rush_down: { vol: 0.45, variants: 0 },
  enemy_swing_s: { vol: 0.45, variants: 3, ...W }, enemy_swing_m: { vol: 0.45, variants: 3, ...W }, enemy_swing_l: { vol: 0.45, variants: 3, ...W },
  vo_wolf: { vol: 0.4, variants: 2, ...W }, vo_bandit: { vol: 0.4, variants: 2, ...W }, vo_bandit_archer: { vol: 0.4, variants: 2, ...W },
  vo_wild_boar: { vol: 0.4, variants: 2, ...W }, vo_bandit_brute: { vol: 0.4, variants: 2, ...W },
  enemy_death_s: { vol: 0.55, variants: 2, ...W }, enemy_death_m: { vol: 0.55, variants: 2, ...W }, enemy_death_l: { vol: 0.55, variants: 2, ...W },
  proj_enemy_arrow: { vol: 0.45, variants: 2, ...W }, proj_brute_wave: { vol: 0.45, variants: 2, ...W }, proj_shockwave: { vol: 0.45, variants: 2, ...W },
  rock_shatter: { vol: 0.45, variants: 2, ...W }, rock_whistle: { vol: 0.5, variants: 2, ...W },
  boss_roar_great_boar: { vol: 0.8, variants: 0 }, boss_break: { vol: 0.8, variants: 0 }, boss_defeated: { vol: 0.8, variants: 0 },
  door_slam: { vol: 0.6, variants: 0 }, door_open: { vol: 0.6, variants: 0 }, timed_open: { vol: 0.6, variants: 0 },
  timed_missed: { vol: 0.6, variants: 0 }, arena_clear: { vol: 0.6, variants: 0 },
  lucky_hit: { vol: 0.7, variants: 0 }, lucky_buff: { vol: 0.7, variants: 0 }, lucky_debuff: { vol: 0.7, variants: 0 }, jackpot: { vol: 0.7, variants: 0 },
  chest_open: { vol: 0.6, variants: 0 }, chest_locked: { vol: 0.6, variants: 0 }, cursed_open: { vol: 0.6, variants: 0 }, curse_lifted: { vol: 0.6, variants: 0 },
  key_pickup: { vol: 0.5, variants: 2 }, keys_full: { vol: 0.5, variants: 2 }, coin: { vol: 0.5, variants: 2 }, item_pop: { vol: 0.5, variants: 2 },
  pickup_weapon: { vol: 0.5, variants: 2 }, pickup_ability: { vol: 0.5, variants: 2 }, blueprint: { vol: 0.5, variants: 2 },
  purchase: { vol: 0.6, variants: 0 }, cant_afford: { vol: 0.6, variants: 0 }, upgrade: { vol: 0.6, variants: 0 }, sell: { vol: 0.6, variants: 0 }, reroll: { vol: 0.6, variants: 0 },
  split_faster: { vol: 0.6, variants: 0 }, split_slower: { vol: 0.6, variants: 0 }, pb: { vol: 0.6, variants: 0 }, sleep: { vol: 0.6, variants: 0 }, restart: { vol: 0.6, variants: 0 },
  // ART5 Task 6: class, ability and weapon sounds (08 §13.3).
  ab_blade_dash: { vol: 0.6, variants: 0 }, ab_whirlwind: { vol: 0.6, variants: 0 }, ab_shockwave: { vol: 0.6, variants: 0 },
  ab_shoulder_charge: { vol: 0.6, variants: 0 }, ab_arrow_rain: { vol: 0.6, variants: 0 }, ab_hunters_mark: { vol: 0.6, variants: 0 },
  ab_thunder_strike: { vol: 0.6, variants: 0 }, ab_blink: { vol: 0.6, variants: 0 },
  ab_link: { vol: 0.6, variants: 0 }, ab_fizzle: { vol: 0.6, variants: 0 }, ab_not_ready: { vol: 0.5, variants: 0 },
  class_change: { vol: 0.5, variants: 0 }, class_discovered: { vol: 0.6, variants: 0 }, wall_break: { vol: 0.7, variants: 0, ...W },
  hammer_throw: { vol: 0.55, variants: 0 }, hammer_return: { vol: 0.5, variants: 0 }, hammer_catch: { vol: 0.5, variants: 0 },
  shot_bow: { vol: 0.5, variants: 2 }, shot_crossbow: { vol: 0.5, variants: 2 }, shot_staff: { vol: 0.5, variants: 2 }, shot_orb: { vol: 0.55, variants: 2 },
  zap: { vol: 0.45, variants: 2, ...W },
  ui_move: ui, ui_confirm: ui, ui_back: ui, ui_error: ui, ui_open: ui, ui_close: ui, ui_toggle: ui,
};

/** File names (without folder) for one id. */
export function sfxFiles(id: string): string[] {
  const n = SFX[id].variants;
  return n === 0 ? [`${id}.wav`] : Array.from({ length: n }, (_, i) => `${id}_${i + 1}.wav`);
}
/** Phaser cache key of variant `v` (0-based). */
export const sfxKey = (id: string, v: number) => `sfx_${id}_${v}`;
