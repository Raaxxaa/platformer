"""Hurtboxes and attack boxes copied from 01 §2.2 and 04 §3. Read only by the art tools."""

PLAYER_HURTBOX = (12, 28)            # 01 §2.2, w × h, feet at the bottom center

# 04 §3: w × h hurtboxes
HURTBOX = {
    'wolf': (28, 16),
    'bandit': (14, 28),
    'bandit_archer': (14, 28),
    'wild_boar': (30, 20),
    'bandit_brute': (24, 40),
    'great_boar': (64, 40),          # 04 §9.1
    # 04 §4 (Stage 2)
    'bat_swarm': (24, 16), 'goblin_miner': (12, 20), 'rock_golem': (26, 32), 'ram': (26, 22),
    'goblin_shaman': (14, 24),
    'stone_colossus': (56, 72),     # 04 §9
    'bog_zombie': (14, 28), 'giant_spider': (26, 16), 'wisp': (14, 14), 'swamp_witch': (14, 28),
    'treant': (30, 52), 'spider_queen': (64, 36), 'spiderling': (12, 8),
}

# 04 §3: attack boxes (dx, dy, w, h) from the feet, facing right. None = projectile (no melee box).
ATTACK_BOX = {
    'wolf': {'lunge_bite': (14, -8, 22, 14), 'snap': (16, -8, 20, 14)},
    'bandit': {'slash': (20, -14, 32, 24), 'lunge_stab': (18, -14, 28, 10)},
    'bandit_archer': {'arrow': None, 'kick': (14, -12, 18, 16)},
    'wild_boar': {'charge': (14, -10, 24, 18), 'tusk_jab': (14, -10, 22, 18)},
    'bandit_brute': {'club_swing': (26, -20, 44, 36), 'overhead_smash': (30, -12, 40, 24)},
    # 04 §4 (Stage 2). Bomb Toss and Hex Bolt are projectiles; Stone Spikes is an area effect drawn by VFX (08 §4.1)
    'bat_swarm': {'dive_bite': (0, -8, 20, 14)},
    'goblin_miner': {'bomb_toss': None, 'pick_swing': (14, -10, 20, 18)},
    'rock_golem': {'fist_slam': (24, -10, 36, 20), 'shoulder_ram': (16, -16, 24, 30)},
    'ram': {'headbutt': (16, -11, 22, 20), 'leap_butt': (16, -11, 22, 20)},
    'goblin_shaman': {'stone_ward': None, 'hex_bolt': None, 'stone_spikes': (36, -12, 64, 24)},
    # 04 §10.2 (Rock Rain uses falling_rock projectiles; Leap Slam's 2 shockwaves are projectiles)
    'stone_colossus': {'fist_slam': (44, -16, 56, 32), 'shoulder_ram': (30, -36, 32, 64),
                       'leap_slam': (0, -12, 120, 24), 'rock_rain': None},
    # 04 §4 Stage 3 (Swamps). Wisp Detonate (explosion_l) and Treant Root Snare (at marker) are skipped by 08 §4.1
    'bog_zombie': {'rise_swipe': (0, -14, 24, 28), 'claw': (18, -16, 28, 24), 'grab_lunge': (20, -16, 24, 20)},
    'giant_spider': {'drop': (0, -8, 24, 16), 'bite': (16, -8, 20, 14), 'pounce': (12, -8, 22, 14)},
    'wisp': {'detonate': None},
    'swamp_witch': {'poison_potion': None, 'claw': (14, -14, 20, 20), 'hex_hop': None},
    'treant': {'root_snare': None, 'branch_slam': (34, -20, 52, 40)},
    # 04 §10.3 (Venom Spit shoots venom_glob; Brood spawns Spiderlings) and the Spiderling's Bite
    'spider_queen': {'ceiling_drop': (0, -12, 96, 24), 'fang_strike': (40, -14, 48, 28),
                     'pounce': (24, -12, 48, 28), 'venom_spit': None, 'brood': None},
    'spiderling': {'bite': (10, -5, 14, 10)},
    # 04 §10.1 (Rockfall uses falling_rock projectiles, no melee box)
    'great_boar': {'charge': (28, -20, 40, 36), 'tusk_toss': (36, -24, 48, 48), 'stomp_quake': (0, -8, 96, 16)},
}


# ART8: Stage 3-4 (04 §6, §7, §9, §11-§13; copied from src/data/kingdom.ts, castle.ts, dragon.ts)
HURTBOX.update({'soldier': (14, 28), 'crossbowman': (14, 28), 'war_hound': (28, 18), 'battle_mage': (14, 28),
                'knight': (18, 36), 'black_knight': (22, 44), 'royal_guard': (14, 30), 'gargoyle': (20, 22),
                'castle_mage': (14, 28), 'living_armor': (16, 30), 'royal_executioner': (22, 40),
                'enemy_king': (24, 48), 'dragon': (72, 48)})
_SLASH = (30, -22, 52, 40)
ATTACK_BOX.update({
    'soldier': {'sword_thrust': (24, -16, 36, 12), 'shield_bash': (14, -14, 18, 26)},
    'crossbowman': {'bolt': None, 'kick': (14, -12, 18, 16)},
    'war_hound': {'leap_bite': (14, -9, 22, 14), 'snap': (16, -9, 20, 14)},
    'battle_mage': {'fireball': None, 'flame_burst': (0, -20, 64, 40)},
    'knight': {'sword_combo': (26, -18, 44, 30), 'charging_thrust': (22, -18, 36, 14)},
    'black_knight': {'triple_slash': _SLASH, 'lunge_thrust': (26, -22, 44, 14), 'shield_bash': (18, -22, 24, 40),
                     'dark_wave': None, 'leap_slam': (0, -14, 96, 28)},
    'royal_guard': {'halberd_thrust': (46, -18, 72, 10), 'halberd_sweep': (24, -16, 64, 32)},
    'gargoyle': {'swoop': (0, -11, 24, 20)},
    'castle_mage': {'ward': None, 'arcane_bolts': None},
    'living_armor': {'sword_slash': (22, -16, 36, 28), 'overhead_chop': (24, -14, 32, 28)},
    'royal_executioner': {'overhead_chop': (32, -20, 48, 40), 'whirling_axe': (0, -20, 80, 40), 'leap_chop': (0, -20, 64, 40)},
    'enemy_king': {'crown_cleave': (34, -24, 60, 44), 'royal_thrust': (30, -22, 52, 14), 'scepter_orbs': None,
                   'scepter_orbs_wide': None, 'royal_decree': None, 'shockwave_slam': (0, -14, 96, 28), 'blade_rain': None,
                   'throne_beam': None},
    'dragon': {'breath': None, 'claw_swipe': (52, -20, 72, 40), 'tail_sweep': (-60, -12, 104, 24), 'wing_gust': None,
               'color_special': None, 'dive_bomb': (0, -16, 128, 32), 'strafing_breath': None},
})
