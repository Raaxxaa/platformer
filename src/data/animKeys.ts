// Every atlas, anim key and frame name the view code asks for (08 §4–§11, ART2/ART4). `animKeys.test.ts`
// checks each one against public/assets/anims.json and the atlas files, so a missing name fails a test, not the game.

/** Atlases loaded for a stage (08 §12.5). `trim` atlases hold `a/<frame>` and `b/<frame>`. */
export const ATLASES = [
  'player_swordsman', 'player_swordsman_trim', 'player_tank', 'player_tank_trim', 'player_archer', 'player_archer_trim',
  'player_wizard', 'player_wizard_trim', 'weapon_greatsword', 'weapon_war_maul', 'weapon_katana', 'weapon_iron_fists',
  'weapon_storm_hammer', 'weapon_bow', 'weapon_crossbow', 'weapon_staff',
  'enemies_plains', 'enemies_extra', 'boss_great_boar', 'projectiles', 'vfx', 'objects', 'items',
] as const;
export type AtlasKey = (typeof ATLASES)[number];

/** 08 §6.1 player body anims in `player_<outfit>` (plus the weapon steps below). */
export const PLAYER_ANIMS = [
  'idle', 'run', 'skid', 'jump', 'apex', 'fall', 'double_jump', 'wall_jump', 'land', 'dash', 'wall_slide',
  'ledge_climb', 'slide', 'crawl', 'dive_windup', 'dive_fall', 'dive_land', 'hurt', 'dead', 'drink',
] as const;
export type PlayerAnim = (typeof PLAYER_ANIMS)[number];

/** 08 §6.3: weapons with art and their combo step count. Body keys `atk_<id>_<n>`, weapon frames of the same name. */
export const WEAPON_ART: Record<string, { steps: number; smear: boolean; charged?: boolean; charge?: boolean; throw?: boolean }> = {
  greatsword: { steps: 3, smear: true },
  war_maul: { steps: 2, smear: true },
  // ART5: `atk_<id>_charged` / `charge_<id>` for charge weapons, `atk_storm_hammer_throw`; ranged weapons have no smear.
  katana: { steps: 3, smear: true, charged: true, charge: true },
  iron_fists: { steps: 4, smear: true },
  storm_hammer: { steps: 2, smear: true, throw: true },
  bow: { steps: 1, smear: false, charged: true, charge: true },
  crossbow: { steps: 1, smear: false },
  staff: { steps: 1, smear: false, charged: true, charge: true },
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

/** Enemy projectile anims in `projectiles`. */
export const PROJECTILE_ANIMS = ['enemy_arrow', 'brute_wave', 'shockwave', 'falling_rock', 'falling_rock_shatter'] as const;

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
} as const;
/** An item's icon (in `ui`) and the glow behind it on the ground (in `items`). */
export const itemIcon = (kind: 'weapon' | 'ability', id: string) => `icon_${kind}_${id}`;
export const itemGlow = (kind: 'weapon' | 'ability', id: string) => `glow_${kind}_${id}`;
