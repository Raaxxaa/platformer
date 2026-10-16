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
}

# 04 §3: attack boxes (dx, dy, w, h) from the feet, facing right. None = projectile (no melee box).
ATTACK_BOX = {
    'wolf': {'lunge_bite': (14, -8, 22, 14), 'snap': (16, -8, 20, 14)},
    'bandit': {'slash': (20, -14, 32, 24), 'lunge_stab': (18, -14, 28, 10)},
    'bandit_archer': {'arrow': None, 'kick': (14, -12, 18, 16)},
    'wild_boar': {'charge': (14, -10, 24, 18), 'tusk_jab': (14, -10, 22, 18)},
    'bandit_brute': {'club_swing': (26, -20, 44, 36), 'overhead_smash': (30, -12, 40, 24)},
    # 04 §10.1 (Rockfall uses falling_rock projectiles, no melee box)
    'great_boar': {'charge': (28, -20, 40, 36), 'tusk_toss': (36, -24, 48, 48), 'stomp_quake': (0, -8, 96, 16)},
}
