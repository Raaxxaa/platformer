"""ART8 sound recipes (08 §13.3): Stage 3-4 enemy voices and shots, the Black Knight, the Enemy King and the Dragon, the
new weapons, shield and ability sounds, hazards. Same shape as sfx_defs.SFX: id -> (variant count, recipe, description)."""
import os
import zlib

from .sfx_defs import L, nz, bp, tone
from .synth import render, variant, write_wav


def clank(delay=0.0, level=1.0, f=1800):
    return [nz(0.08, hp=(f, f), lp=(7000, 4000), level=0.7 * level, delay=delay),
            L('sq', f * 1.3, f * 1.25, 0.002, 0.03, 0.12, duty=0.5, level=0.25 * level, delay=delay, lp=(6000, 3000))]


SFX34 = {
    # ---- voices (armored enemies clank, mages hum, the hound barks, the gargoyle cracks)
    'vo_soldier': (2, clank() + [L('sq', 200, 240, 0.01, 0.06, 0.1, duty=0.3, lp=(500, 1800), delay=0.06)], 'Soldier notices you: armor clank + grunt'),
    'vo_crossbowman': (2, clank(0, 0.6, 2400) + [tone('sin', 900, 700, 0.1, level=0.3, delay=0.1)], 'Crossbowman notices you: gear clink + click'),
    'vo_war_hound': (2, [L('saw', 190, 120, 0.005, 0.07, 0.08, lp=(1400, 800), crush=6),
                         L('saw', 210, 130, 0.005, 0.06, 0.08, lp=(1400, 800), delay=0.18, level=0.8, crush=6),
                         nz(0.1, lp=(1500, 600), level=0.3)], 'War Hound notices you: sharp bark'),
    'vo_battle_mage': (2, [L('sin', 262, 262, 0.08, 0.25, 0.25, vib=(0.5, 6)), L('sin', 392, 392, 0.08, 0.25, 0.25, level=0.5),
                           tone('sin', 90, 140, 0.4, level=0.3)], 'Battle Mage notices you: fiery hum'),
    'vo_knight': (2, clank(0, 1.0, 1200) + clank(0.12, 0.8, 1000) + [L('saw', 100, 90, 0.02, 0.15, 0.2, lp=(600, 350), delay=0.05)],
                  'Knight notices you: heavy plate clank + low grunt'),
    'vo_royal_guard': (2, clank(0, 0.8, 2000) + [tone('sin', 500, 520, 0.1, level=0.25, delay=0.05), tone('sin', 750, 780, 0.1, level=0.2, delay=0.05)],
                       'Royal Guard notices you: halberd rattle + bright ring'),
    'vo_gargoyle': (2, [nz(0.25, hp=(800, 800), lp=(5000, 1500), level=0.9), tone('sin', 70, 40, 0.3, level=0.7),
                        nz(0.04, hp=(2500, 2500), lp=(8000, 4000), level=0.5, delay=0.08)], 'Gargoyle wakes: stone cracking'),
    'vo_castle_mage': (2, [L('sin', 330, 330, 0.08, 0.25, 0.25, vib=(0.4, 7)), L('sin', 495, 495, 0.08, 0.25, 0.25, level=0.4),
                           L('sin', 660, 640, 0.1, 0.2, 0.2, level=0.2, delay=0.1)], 'Castle Mage notices you: cool chord hum'),
    'vo_living_armor': (2, clank(0, 1.0, 900) + clank(0.1, 0.8, 1300) + clank(0.2, 0.6, 1600) + [tone('sin', 120, 70, 0.35, level=0.4, delay=0.05)],
                        'Living Armor collapses or rises: cascading clanks'),
    'vo_royal_executioner': (2, [L('saw', 70, 55, 0.04, 0.3, 0.3, vib=(0.6, 6), lp=(500, 250), crush=5), nz(0.15, lp=(700, 300), level=0.5)] +
                             clank(0.2, 0.9, 1100), 'Royal Executioner notices you: heavy breath + chain clank'),
    # ---- enemy shots
    'proj_enemy_bolt': (2, [tone('sq', 700, 300, 0.07, level=0.5, duty=0.3), bp(0.1, 1500, 3000, level=0.5)], 'Crossbow bolt: sharp thwack'),
    'proj_fireball': (2, [nz(0.4, lp=(2500, 700), level=0.8), tone('saw', 180, 90, 0.35, level=0.4, lp=(1200, 500))], 'Fireball: roaring whoosh'),
    'proj_dark_wave': (2, [L('saw', 90, 60, 0.05, 0.3, 0.3, lp=(900, 300), vib=(0.5, 6)), nz(0.4, lp=(900, 200), level=0.5)], 'Dark wave: low rolling wave'),
    'proj_arcane_bolt': (2, [tone('sin', 900, 1200, 0.1, level=0.6), tone('sin', 1350, 1800, 0.1, level=0.3, delay=0.02)], 'Arcane bolt: bright zip'),
    'proj_royal_orb': (2, [L('sin', 440, 330, 0.02, 0.25, 0.2, vib=(0.6, 12)), L('sin', 660, 495, 0.02, 0.25, 0.2, vib=(0.6, 12), level=0.4)], 'Royal orb: slow golden hum'),
    'proj_falling_sword': (2, [tone('sin', 2400, 700, 0.3, level=0.5), bp(0.3, 2500, 900, level=0.4)], 'Falling sword: whistling drop'),
    'proj_fire_rain': (2, [bp(0.35, 1200, 400, level=0.7), nz(0.2, lp=(2000, 600), level=0.4)], 'Fire rain: falling fire'),
    # ---- bosses
    'boss_roar_black_knight': (1, [L('saw', 82, 50, 0.1, 0.5, 0.6, vib=(0.7, 5), lp=(800, 260), crush=5), L('saw', 164, 100, 0.12, 0.45, 0.5, lp=(900, 300), level=0.5),
                                   nz(1.0, lp=(1500, 300), level=0.4)] + clank(0.5, 1.0, 900) + clank(0.8, 0.8, 1300),
                              'Black Knight intro: low armored growl and a clank'),
    'boss_roar_enemy_king': (1, [L('saw', 110, 70, 0.1, 0.6, 0.6, vib=(0.6, 4), lp=(1400, 400), crush=6), L('saw', 220, 140, 0.12, 0.5, 0.5, lp=(1600, 500), level=0.6),
                                 L('sin', 330, 330, 0.3, 0.5, 0.5, vib=(0.3, 5), level=0.4), L('sin', 495, 495, 0.3, 0.5, 0.5, level=0.3),
                                 nz(0.5, lp=(2000, 400), level=0.4)], 'Enemy King intro: a regal roar over a minor chord'),
    'dragon_roar': (1, [L('saw', 140, 55, 0.08, 0.5, 0.7, vib=(1.0, 7), lp=(1600, 300), crush=5), L('saw', 280, 100, 0.1, 0.5, 0.6, vib=(1.2, 9), lp=(2000, 400), level=0.6),
                        nz(1.2, lp=(3500, 500), hp=(300, 300), level=0.6)], 'Dragon roar: 1.5 s sweeping roar'),
    'breath_red': (1, [nz(1.0, lp=(2500, 900), level=0.9), tone('saw', 120, 90, 1.0, level=0.3, lp=(700, 400))], 'Red breath: fire roar loop'),
    'breath_white': (1, [nz(1.0, hp=(1500, 1500), lp=(9000, 5000), level=0.8), tone('sin', 2600, 2300, 1.0, level=0.15, vib=(0.3, 9))], 'White breath: icy hiss loop'),
    'breath_storm': (1, [nz(1.0, hp=(900, 900), lp=(7000, 4000), level=0.6, crush=5), L('sq', 2000, 1800, 0.01, 0.9, 0.05, duty=0.1, vib=(2.0, 30), lp=(4000, 3000), level=0.2)], 'Storm breath: crackling zap loop'),
    'breath_green': (1, [nz(1.0, hp=(1200, 1200), lp=(5000, 3000), level=0.7), tone('sin', 400, 330, 1.0, level=0.2, vib=(0.8, 11))], 'Green breath: hissing gas loop'),
    'wing_flap': (2, [bp(0.35, 200, 500, level=0.9), tone('sin', 70, 45, 0.3, level=0.6)], 'Dragon wing flap: heavy whump'),
    'dragon_warning': (1, [L('saw', 70, 55, 0.2, 0.7, 0.6, vib=(0.8, 3), lp=(500, 250), level=0.8), nz(1.2, lp=(1800, 400), hp=(300, 300), level=0.35)], 'Dragon warning: distant roar + wind'),
    # ---- hazards
    'cannon_fuse': (2, [nz(0.5, hp=(2500, 3500), lp=(8000, 6000), level=0.5), L('sq', 3000, 3800, 0.02, 0.4, 0.1, duty=0.1, lp=(5000, 5000), level=0.12)], 'Cannon fuse: sizzling hiss'),
    'cannon_fire': (2, [nz(0.4, lp=(900, 120), level=1.0), tone('sin', 80, 30, 0.35, level=0.9), nz(0.06, hp=(2500, 2500), lp=(7000, 3000), level=0.4)], 'Cannon fire: boom'),
    'blade_swoosh': (2, [bp(0.28, 800, 300, level=0.9), tone('sin', 150, 90, 0.2, level=0.3)], 'Swinging blade: low whoosh'),
    'platform_shake': (1, [L('sq', 80, 80, 0.02, 0.22, 0.05, duty=0.5, vib=(1.0, 26), lp=(500, 500), level=0.7), nz(0.25, lp=(700, 300), level=0.3)], 'Platform shake: low rattle'),
    'tele_unblockable': (1, [L('saw', 110, 105, 0.03, 0.2, 0.07, lp=(900, 600), level=0.9)], 'Unblockable telegraph: low horn'),
    'step_hard': (4, [nz(0.03, hp=(3500, 3500), lp=(7000, 4000), level=0.7), tone('sin', 700, 650, 0.03, level=0.2)], 'Footstep on stone: hard tick'),
    # ---- weapons
    'shot_cannon': (2, [nz(0.3, lp=(800, 150), level=1.0), tone('sin', 70, 35, 0.3, level=0.9)], 'Hand Cannon: boom'),
    'throw_javelin': (2, [bp(0.18, 600, 2200, level=0.8)], 'Javelin throw: whoosh'),
    'throw_knives': (2, [bp(0.06, 1500, 3500, level=0.7), bp(0.06, 1500, 3500, level=0.6, delay=0.06), bp(0.06, 1500, 3500, level=0.5, delay=0.12)], 'Throwing Knives: three quick whooshes'),
    'shot_wand': (2, [tone('sq', 1000, 700, 0.05, level=0.6, duty=0.25)], 'Wand shot: tiny zip'),
    'tome_blast': (2, [nz(0.15, hp=(1800, 1800), lp=(7000, 3000), level=0.6), tone('sin', 500, 900, 0.12, level=0.4)], 'Spell Tome blast: burst'),
    'rune_ring': (2, [tone('sin', 800, 1200, 0.25, level=0.4)] + [tone('sin', f, f, 0.12, level=0.3, delay=d) for f, d in ((1046, 0.05), (1319, 0.12), (1568, 0.19), (2093, 0.26))], 'Rune Ring: shimmering arpeggio'),
    'hit_guarded': (2, [tone('sq', 1500, 1500, 0.12, level=0.5, duty=0.5), tone('sq', 2250, 2250, 0.12, level=0.3, delay=0.0, duty=0.5)], 'Guarded hit: metal ring'),
    'block': (2, clank(0, 0.9, 1000), 'Shield block: dull clank'),
    'parry': (2, [tone('sin', 3000, 3000, 0.25, level=0.5), tone('sin', 4500, 4500, 0.2, level=0.25), bp(0.25, 500, 3000, level=0.5)], 'Parry: bright ring + whoosh'),
    'shield_raise': (2, [nz(0.1, lp=(2500, 800), level=0.4), tone('sin', 1800, 2000, 0.04, level=0.3, delay=0.08)], 'Shield raised: cloth + clink'),
    # ---- the 8 abilities M9 added (+ their extra events)
    'ab_blade_flurry': (1, [tone('sin', 2400, 3200, 0.1, level=0.4)] + [bp(0.05, 2500, 1500, level=0.6, delay=d) for d in (0.0, 0.05, 0.1, 0.15, 0.2)], 'Blade Flurry: rapid shings'),
    'ab_riposte': (1, [bp(0.2, 400, 1500, level=0.5)] + clank(0.05, 0.8, 1500), 'Riposte: stance + clang'),
    'ab_riposte_counter': (1, [bp(0.22, 1500, 700, level=0.8)] + clank(0.05, 1.0, 1400), 'Riposte counter: heavy slash + clang'),
    'ab_rage': (1, [L('saw', 70, 130, 0.1, 0.4, 0.3, lp=(900, 1200), crush=6), nz(0.4, lp=(1200, 3000), level=0.4)], 'Rage: distorted growl'),
    'ab_boulder_toss': (1, [nz(0.25, lp=(1500, 300), level=0.7), tone('sin', 120, 60, 0.2, level=0.6), bp(0.25, 500, 1400, level=0.5, delay=0.15)], 'Boulder Toss: rock rip + throw'),
    'boulder_break': (1, [nz(0.3, lp=(2500, 400), level=0.9), tone('sin', 90, 40, 0.3, level=0.5)], 'Boulder breaks: rock crack'),
    'ab_turret': (1, [tone('sq', 200, 120, 0.1, level=0.7, duty=0.5), nz(0.08, lp=(2000, 800), level=0.4)], 'Turret placed: clunk'),
    'turret_fire': (2, [tone('sq', 900, 500, 0.06, level=0.4, duty=0.25), nz(0.04, hp=(2000, 2000), level=0.3)], 'Turret fires: bolt twang'),
    'ab_grapple_arrow': (1, [bp(0.15, 800, 2500, level=0.6), tone('sin', 400, 1400, 0.2, level=0.3, delay=0.1)], 'Grapple Arrow: rope shot + zip'),
    'ab_frost_burst': (1, [nz(0.3, hp=(2000, 2000), lp=(9000, 4000), level=0.8), tone('sin', 2200, 600, 0.25, level=0.4)], 'Frost Burst: icy burst'),
    'ab_time_slow': (1, [L('sin', 1200, 300, 0.02, 0.4, 0.3, level=0.8), L('sin', 600, 150, 0.02, 0.4, 0.3, level=0.4)], 'Time Slow: warp down'),
    'time_slow_end': (1, [L('sin', 300, 1200, 0.02, 0.3, 0.3, level=0.8)], 'Time Slow ends: tape-stop in reverse'),
}


def files_for(sid):
    n = SFX34[sid][0]
    return [f'{sid}.wav'] if n == 1 else [f'{sid}_{k}.wav' for k in range(1, n + 1)]


def render_all():
    out = {}
    for sid, (n, recipe, _desc) in SFX34.items():
        base_seed = zlib.crc32(sid.encode())
        for k, name in enumerate(files_for(sid)):
            if k == 0:
                rec, seed = recipe, base_seed
            else:
                rec, s2 = variant(recipe, k)
                seed = base_seed ^ s2
            out[name] = render(rec, seed)
    return out


def build(out_dir):
    os.makedirs(out_dir, exist_ok=True)
    paths = []
    for name, x in render_all().items():
        p = os.path.join(out_dir, name)
        write_wav(p, x)
        paths.append(p)
    return paths
