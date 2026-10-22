// Every atlas, anim key and frame name the view code asks for (08 §4–§11, ART2/ART4). `animKeys.test.ts`
// checks each one against public/assets/anims.json and the atlas files, so a missing name fails a test, not the game.

/** Atlases loaded for a stage (08 §12.5). `trim` atlases hold `a/<frame>` and `b/<frame>`. */
export const ATLASES = [
  'player_swordsman', 'player_swordsman_trim', 'player_tank', 'player_tank_trim', 'player_archer', 'player_archer_trim',
  'player_wizard', 'player_wizard_trim', 'weapon_greatsword', 'weapon_war_maul', 'weapon_katana', 'weapon_iron_fists',
  'weapon_storm_hammer', 'weapon_bow', 'weapon_crossbow', 'weapon_staff',
  'weapon_twin_daggers', 'weapon_spear', 'weapon_scythe', 'weapon_giant_axe', 'weapon_flail', 'weapon_shield', 'weapon_hand_cannon',
  'weapon_javelin', 'weapon_throwing_knives', 'weapon_wand', 'weapon_spell_tome',
  'enemies_plains', 'enemies_extra', 'boss_great_boar', 'projectiles', 'vfx', 'objects', 'items', 'npcs',
] as const;
export type AtlasKey = (typeof ATLASES)[number];

/** 08 §6.1 player body anims in `player_<outfit>` (plus the weapon steps below). */
export const PLAYER_ANIMS = [
  'idle', 'run', 'skid', 'jump', 'apex', 'fall', 'double_jump', 'wall_jump', 'land', 'dash', 'wall_slide',
  'ledge_climb', 'slide', 'crawl', 'dive_windup', 'dive_fall', 'dive_land', 'hurt', 'dead', 'drink',
] as const;
export type PlayerAnim = (typeof PLAYER_ANIMS)[number];

/** 08 §6.3: weapons with art and their combo step count. Body keys `atk_<id>_<n>`, weapon frames of the same name. */
export const WEAPON_ART: Record<string, { steps: number; smear: boolean; charged?: boolean; charge?: boolean; throw?: boolean; lunge?: boolean; spin?: boolean; shield?: boolean; keys?: string[] }> = {
  greatsword: { steps: 3, smear: true },
  war_maul: { steps: 2, smear: true },
  // ART5: `atk_<id>_charged` / `charge_<id>` for charge weapons, `atk_storm_hammer_throw`; ranged weapons have no smear.
  katana: { steps: 3, smear: true, charged: true, charge: true },
  iron_fists: { steps: 4, smear: true },
  storm_hammer: { steps: 2, smear: true, throw: true },
  bow: { steps: 1, smear: false, charged: true, charge: true },
  crossbow: { steps: 1, smear: false },
  staff: { steps: 1, smear: false, charged: true, charge: true },
  // ART8: the 11 weapons M9 added. `lunge` / `spin` are the Spear and Giant Axe specials; the Shield's only step is the bash.
  twin_daggers: { steps: 4, smear: true },
  spear: { steps: 3, smear: true, lunge: true },
  scythe: { steps: 3, smear: true },
  giant_axe: { steps: 2, smear: true, spin: true },
  flail: { steps: 2, smear: true, charged: true, charge: true },
  shield: { steps: 1, smear: true, shield: true, keys: ['atk_shield_bash'] },
  hand_cannon: { steps: 1, smear: false },
  javelin: { steps: 1, smear: false },
  throwing_knives: { steps: 1, smear: false },
  wand: { steps: 1, smear: false },
  spell_tome: { steps: 3, smear: false },
};
export const DIVE_PARTS = ['windup', 'fall', 'land'] as const;
export const weaponStepKey = (weaponId: string, step: number) => `atk_${weaponId}_${step + 1}`;
export const weaponChargedKey = (weaponId: string) => `atk_${weaponId}_charged`;
export const weaponThrowKey = (weaponId: string) => `atk_${weaponId}_throw`;
export const weaponChargeKey = (weaponId: string) => `charge_${weaponId}`;
export const weaponDiveKey = (weaponId: string, part: (typeof DIVE_PARTS)[number]) => `dive_${weaponId}_${part}`;

/** 08 §7.1–7.3: the anims each Stage 1 enemy uses (keys `<id>_<anim>` in `enemies_plains`). */
export const ENEMY_ANIMS: Record<string, readonly string[]> = {
  wolf: ['idle', 'walk', 'hurt', 'stagger', 'knockdown', 'death', 'atk_snap', 'atk_lunge_bite'],
  bandit: ['idle', 'walk', 'hurt', 'stagger', 'knockdown', 'death', 'atk_slash', 'atk_lunge_stab'],
  bandit_archer: ['idle', 'walk', 'hurt', 'stagger', 'knockdown', 'death', 'atk_arrow', 'atk_kick'],
  wild_boar: ['idle', 'walk', 'hurt', 'stagger', 'knockdown', 'dazed', 'skid', 'death', 'atk_charge', 'atk_tusk_jab'],
  bandit_brute: ['idle', 'walk', 'hurt', 'stagger', 'knockdown', 'death', 'atk_club_swing', 'atk_overhead_smash'],
};

/** 08 §7.4: boss anims (unprefixed keys in `boss_<id>`). */
export const BOSS_ANIMS: Record<string, readonly string[]> = {
  great_boar: ['idle', 'walk', 'intro', 'hurt', 'stagger', 'dazed', 'break', 'transition', 'death', 'atk_charge', 'atk_stomp_quake', 'atk_tusk_toss'],
};

/** The Training Dummy has frames but no anims.json entry (ART4): `<name>_NN` in `enemies_extra`. */
export const DUMMY_FRAMES = { idle: ['training_dummy_idle_00'], hit: ['training_dummy_hit_00', 'training_dummy_hit_01', 'training_dummy_hit_02'] } as const;

/** ART5 Training Yard targets: frames `<id>_<anim>_NN` in `enemies_extra` (no full enemy anim set). */
export const YARD_DUMMY_FRAMES = {
  sparring_dummy: {
    idle: ['sparring_dummy_idle_00'], tele: ['sparring_dummy_tele_00', 'sparring_dummy_tele_01'],
    swing: ['sparring_dummy_atk_practice_swing_00', 'sparring_dummy_atk_practice_swing_01', 'sparring_dummy_atk_practice_swing_02'],
    hit: ['sparring_dummy_hit_00', 'sparring_dummy_hit_01', 'sparring_dummy_hit_02'],
  },
  straw_target: {
    idle: ['straw_target_idle_00'], death: ['straw_target_death_00', 'straw_target_death_01', 'straw_target_death_02', 'straw_target_death_03'],
  },
} as const;

/** 08 §6.2 ability poses that have art (ART5): cast abilities by id, and ability moves by their ForcedMove owner. */
export const CAST_POSE: Record<string, string> = { shockwave: 'cast_slam', arrow_rain: 'cast_up', thunder_strike: 'cast_up' };
export const MOVE_POSE: Record<string, string> = { blade_dash: 'dash' };

/** Enemy projectile anims in `projectiles`. */
export const PROJECTILE_ANIMS = ['enemy_arrow', 'brute_wave', 'shockwave', 'falling_rock', 'falling_rock_shatter',
  'cannonball', 'javelin', 'javelin_platform', 'knife', 'wand_shot', 'rune', 'skewer', 'soul', 'reflected',
  'enemy_bolt', 'fireball', 'dark_wave', 'arcane_bolt', 'royal_orb', 'falling_sword', 'fire_rain', 'fire_pool'] as const;

/** 08 §11 VFX used in Stage 1 (anims in `vfx`). */
export const VFX_ANIMS = [
  'hit_spark', 'hit_heavy', 'crit_spark', 'stun_stars', 'dust_land', 'dust_jump', 'muzzle', 'ring_djump', 'dust_walljump',
  'dust_wall', 'dust_slide', 'dive_trail', 'dive_impact', 'dive_impact_heavy', 'dive_bounce', 'spike_spark', 'flask_orb',
  'heal', 'rush_up', 'dash_refund', 'spawn_in', 'debris',
] as const;
export type VfxAnim = (typeof VFX_ANIMS)[number];

/** Static frames in `objects` (ART4): doors are a cap, mid pieces and a bottom; the timed door's cap shows its lamp. */
export const OBJECT_FRAMES = {
  arenaDoor: { cap: 'arena_door_cap_00', mid: 'arena_door_mid_00', bottom: 'arena_door_bottom_00' },
  timedDoor: {
    cap: { pending: 'timed_door_cap_pending_00', open: 'timed_door_cap_open_00', missed: 'timed_door_cap_missed_00' },
    mid: 'timed_door_mid_00', bottom: 'timed_door_bottom_00',
  },
  guideArrow: ['guide_arrow_00', 'guide_arrow_01', 'guide_arrow_02', 'guide_arrow_03', 'guide_arrow_04', 'guide_arrow_05', 'guide_arrow_06', 'guide_arrow_07'],
} as const;

/** Bitmap fonts (BMFont XML) in public/assets/fonts. */
export const FONTS = { small: 'rb_small', smallPlain: 'rb_small_plain', large: 'rb_large' } as const;

/** Training Yard objects (06 §12.3–12.4): statues and stands in `objects`; the checklist board reuses the village board. */
export const YARD_FRAMES = {
  statue: (cls: string) => `class_statue_${cls}_00`,
  stand: 'loot_stand_00',
  board: 'unlocks_board_00',
  sign: 'station_sign_00', flagTodo: 'station_flag_grey_00', flagDone: 'station_flag_green_00',
} as const;
/** An item's icon (in `ui`) and the glow behind it on the ground (in `items`). */
export const itemIcon = (kind: 'weapon' | 'ability', id: string) => `icon_${kind}_${id}`;
export const itemGlow = (kind: 'weapon' | 'ability', id: string) => `glow_${kind}_${id}`;

/**
 * Every body anim key a player sprite can show, in a fixed order. A ghost sample stores the position in this list (06 §14),
 * so only ever append to it. Keys that do not exist for an outfit fall back to `idle` when drawn.
 */
export const PLAYER_ANIM_KEYS: readonly string[] = [
  ...PLAYER_ANIMS, 'cart_ride', ...Object.values(CAST_POSE).filter((v, i, a) => a.indexOf(v) === i),
  ...Object.entries(WEAPON_ART).flatMap(([id, a]) => [
    ...Array.from({ length: a.steps }, (_, i) => weaponStepKey(id, i)),
    ...(a.charged ? [weaponChargedKey(id)] : []), ...(a.charge ? [weaponChargeKey(id)] : []), ...(a.throw ? [weaponThrowKey(id)] : []),
    ...(a.keys ?? []), ...DIVE_PARTS.map((part) => weaponDiveKey(id, part)),
  ]),
];
