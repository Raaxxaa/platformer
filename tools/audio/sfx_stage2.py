"""Stage 2 sound recipes (08 §13.3): enemy voices, projectile sounds, boss roars, minecart, water and ice steps.
Same shape as sfx_defs.SFX: id -> (variant count, recipe, description)."""
import os
import zlib

from .sfx_defs import L, nz, bp, tone
from .synth import render, variant, write_wav

SFX2 = {
    # ---- voices of the 10 new enemies (+ the Spiderling), each clearly different from the others
    'vo_bat_swarm': (2, [L('sq', 2600, 4200, 0.005, 0.1, 0.18, duty=0.2, vib=(1.5, 30), lp=(6000, 3000)),
                         L('sq', 3100, 2200, 0.005, 0.06, 0.12, duty=0.2, delay=0.16, level=0.7, lp=(6000, 3000))],
                     'Bat Swarm notices you: shrill screech'),
    'vo_goblin_miner': (2, [L('sq', 330, 520, 0.01, 0.05, 0.06, duty=0.25, lp=(2500, 1500)),
                            L('sq', 360, 560, 0.01, 0.05, 0.06, duty=0.25, delay=0.1, lp=(2500, 1500), level=0.9),
                            L('sq', 390, 600, 0.01, 0.05, 0.06, duty=0.25, delay=0.2, lp=(2500, 1500), level=0.8)],
                        'Goblin Miner notices you: quick cackle "heh heh heh"'),
    'vo_rock_golem': (2, [L('saw', 70, 52, 0.05, 0.3, 0.4, vib=(0.5, 5), lp=(500, 250), crush=5),
                          nz(0.7, lp=(450, 200), rate=900, level=0.7)], 'Rock Golem notices you: grinding stones'),
    'vo_ram': (2, [L('saw', 330, 300, 0.02, 0.2, 0.25, vib=(2.5, 14), lp=(2200, 1100)),
                   L('saw', 340, 260, 0.02, 0.1, 0.2, vib=(3.0, 16), delay=0.26, lp=(2000, 900), level=0.8)],
                'Ram notices you: bleat "baaa"'),
    'vo_goblin_shaman': (2, [L('sin', 220, 220, 0.08, 0.3, 0.3, vib=(0.4, 6)),
                             L('sin', 330, 330, 0.08, 0.3, 0.3, vib=(0.4, 7), level=0.6),
                             L('tri', 110, 124, 0.1, 0.3, 0.3, level=0.5, lp=(900, 900))],
                         'Goblin Shaman notices you: low humming chant'),
    'vo_bog_zombie': (2, [L('saw', 120, 70, 0.08, 0.3, 0.4, vib=(1.0, 6), lp=(700, 300), crush=6),
                          nz(0.6, lp=(600, 250), level=0.45)], 'Bog Zombie notices you: wet groan'),
    'vo_giant_spider': (2, [nz(0.45, hp=(3000, 5000), lp=(9000, 7000), level=0.9),
                            L('sq', 5200, 4600, 0.02, 0.15, 0.2, duty=0.1, lp=(8000, 6000), level=0.2)],
                        'Giant Spider notices you: hiss'),
    'vo_wisp': (2, [L('sin', 400, 1400, 0.2, 0.3, 0.2, vib=(0.6, 9)),
                    L('sin', 800, 2800, 0.2, 0.3, 0.2, level=0.35)], 'Wisp swells: rising whine'),
    'vo_swamp_witch': (2, [L('sq', 420, 640, 0.01, 0.06, 0.08, duty=0.3, vib=(1.0, 20), lp=(3000, 1800)),
                           L('sq', 500, 760, 0.01, 0.06, 0.08, duty=0.3, vib=(1.0, 20), delay=0.12, lp=(3000, 1800)),
                           L('sq', 580, 880, 0.01, 0.08, 0.12, duty=0.3, vib=(1.2, 20), delay=0.24, lp=(3000, 1800)),
                           L('sq', 430, 330, 0.01, 0.05, 0.12, duty=0.3, delay=0.4, lp=(2600, 1400), level=0.8)],
                       'Swamp Witch notices you: high cackle'),
    'vo_treant': (2, [L('saw', 62, 80, 0.15, 0.3, 0.4, vib=(0.8, 4), lp=(600, 300), crush=5),
                      bp(0.8, 300, 160, level=0.7)], 'Treant notices you: groaning wood creak'),
    'vo_spiderling': (2, [nz(0.2, hp=(4000, 6000), lp=(9500, 8000), level=0.8),
                          L('sq', 5800, 5200, 0.01, 0.06, 0.08, duty=0.1, lp=(8000, 7000), level=0.15)],
                      'Spiderling notices you: tiny hiss'),
    # ---- projectiles
    'proj_bomb': (2, [bp(0.25, 700, 1800, level=0.6), tone('sin', 200, 320, 0.18, level=0.4)],
                  'Goblin bomb tossed: whoosh'),
    'bomb_fuse': (2, [nz(0.5, hp=(2500, 3500), lp=(8000, 6000), rate=None, level=0.5),
                      L('sq', 2800, 3600, 0.02, 0.4, 0.1, duty=0.1, lp=(5000, 5000), level=0.12)],
                  'Bomb fuse: sizzling hiss'),
    'proj_hex_bolt': (2, [L('sin', 520, 380, 0.01, 0.12, 0.18, vib=(0.8, 18)),
                          L('sin', 780, 570, 0.01, 0.1, 0.15, level=0.4), nz(0.15, hp=(2000, 2000), level=0.15)],
                      'Hex bolt: magic hum'),
    'proj_potion': (2, [bp(0.22, 900, 2400, level=0.5), tone('sin', 700, 500, 0.1, level=0.3)],
                    'Witch potion thrown: whoosh'),
    'proj_potion_hit': (2, [nz(0.2, hp=(1500, 2500), lp=(8000, 4000)),
                            tone('sin', 400, 900, 0.12, level=0.3, delay=0.02),
                            tone('sin', 520, 780, 0.1, level=0.25, delay=0.08)], 'Potion shatters: glass + splash'),
    'proj_venom_glob': (2, [tone('sin', 260, 120, 0.14, level=0.8), nz(0.12, lp=(1500, 700), level=0.4),
                            tone('sin', 380, 280, 0.08, level=0.3, delay=0.08)], 'Spider Queen spit: wet "ptoo"'),
    # ---- bosses
    'boss_roar_stone_colossus': (1, [L('saw', 58, 40, 0.15, 0.6, 0.6, vib=(0.6, 5), lp=(900, 300), crush=5),
                                     L('saw', 117, 80, 0.2, 0.5, 0.5, vib=(0.5, 7), lp=(1100, 350), level=0.6),
                                     nz(1.4, lp=(700, 200), level=0.7),
                                     nz(0.4, lp=(2500, 600), level=0.4, delay=0.2)],
                                 'Stone Colossus intro: 1.4 s grinding, rumbling roar'),
    'boss_roar_spider_queen': (1, [nz(1.0, hp=(2500, 4500), lp=(9500, 6000), level=0.7),
                                   L('saw', 880, 420, 0.1, 0.5, 0.5, vib=(1.5, 14), lp=(3500, 1500), crush=6),
                                   L('saw', 220, 110, 0.15, 0.6, 0.6, vib=(1.0, 8), lp=(1800, 500), level=0.7),
                                   L('sq', 4600, 3600, 0.1, 0.5, 0.4, duty=0.1, lp=(7000, 5000), level=0.15)],
                               'Spider Queen intro: 1.3 s hissing shriek'),
    # ---- minecart, water and ice
    'cart_roll': (1, [nz(0.6, lp=(300, 300), level=0.7),
                      L('sq', 60, 60, 0.02, 0.45, 0.1, duty=0.5, lp=(400, 400), level=0.6),
                      L('sq', 120, 120, 0.02, 0.45, 0.1, duty=0.2, lp=(600, 600), level=0.2)],
                  'Minecart rolling: rumble loop'),
    'cart_jump': (1, [L('sq', 200, 400, 0.01, 0.08, 0.12, duty=0.5, lp=(2500, 1500)), nz(0.1, lp=(900, 400), level=0.3)],
                  'Minecart jump: rising clack'),
    'cart_crash': (1, [nz(0.4, lp=(1500, 200)), tone('sin', 90, 40, 0.4, level=0.9)] +
                   [nz(0.04, hp=(1500, 1500), lp=(5000, 3000), level=0.5, delay=d) for d in (0.05, 0.14, 0.26)],
                   'Minecart crash: boom + wood clacks'),
    'splash': (2, [bp(0.2, 1000, 3000, level=0.9)] +
               [tone('sin', f, f * 1.4, 0.06, level=0.35, delay=d) for f, d in ((650, 0.02), (800, 0.08), (900, 0.14))],
               'Splash: water burst + droplet blips'),
    'step_wet': (4, [bp(0.05, 600, 2200, level=0.8), tone('sin', 700, 900, 0.03, level=0.3, delay=0.01)],
                 'Footstep in water: wet slap'),
    'step_ice': (4, [nz(0.02, hp=(4000, 4000), lp=(9000, 7000)), tone('sin', 2400, 2300, 0.02, level=0.2)],
                 'Footstep on ice: hard tick'),
}


def files_for(sid):
    n = SFX2[sid][0]
    return [f'{sid}.wav'] if n == 1 else [f'{sid}_{k}.wav' for k in range(1, n + 1)]


def render_all():
    out = {}
    for sid, (n, recipe, _desc) in SFX2.items():
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
