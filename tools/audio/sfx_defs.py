"""Stage 1 sound recipes (08 §13.3). Each entry: id -> (variant count, recipe, description)."""
import os
import zlib

from .synth import Layer as L, render, variant, write_wav

MS = 0.001


def nz(dur, lp=None, hp=None, attack=0.002, level=1.0, delay=0.0, rate=None, crush=None):
    """Noise burst with a fast attack and a decay over `dur` seconds."""
    return L('nz', rate, rate, attack, dur * 0.15, dur * 0.85 - attack, lp=lp, hp=hp, level=level, delay=delay,
             crush=crush)


def bp(dur, f0, f1, level=1.0, delay=0.0):
    """Band-passed noise sweep (low-pass above, high-pass below the center)."""
    return L('nz', None, None, 0.004, dur * 0.2, dur * 0.8 - 0.004, lp=(f0 * 1.6, f1 * 1.6),
             hp=(f0 / 1.6, f1 / 1.6), level=level, delay=delay)


def tone(wave, f0, f1, dur, attack=0.002, level=1.0, delay=0.0, **kw):
    return L(wave, f0, f1, attack, dur * 0.25, dur * 0.75 - attack, level=level, delay=delay, **kw)


def swing(f0, f1, dur, low=None, level=1.0):
    r = [bp(dur, f0, f1, level)]
    if low:
        r.append(tone('sin', low, low * 0.8, dur, level=0.5 * level))
    return r


SFX = {
    # ---- enemy voices (each clearly different)
    'vo_wolf': (2, [L('saw', 95, 82, 0.03, 0.25, 0.25, vib=(1.2, 22), lp=(700, 450), crush=6),
                    nz(0.5, lp=(500, 300), level=0.5)], 'Wolf notices you: low rattling growl'),
    'vo_bandit': (2, [L('sq', 190, 230, 0.01, 0.08, 0.14, duty=0.3, lp=(500, 2200)),
                      L('sq', 230, 170, 0.005, 0.05, 0.1, duty=0.3, lp=(1800, 700), delay=0.2, level=0.7)],
                  'Bandit notices you: grunted "hey!"'),
    'vo_bandit_archer': (2, [L('sin', 1700, 2300, 0.01, 0.08, 0.08, vib=(0.4, 14)),
                             L('sin', 2300, 1900, 0.005, 0.05, 0.07, delay=0.18, level=0.8)],
                         'Bandit Archer notices you: two-note whistle'),
    'vo_wild_boar': (2, [L('saw', 620, 980, 0.01, 0.12, 0.2, vib=(1.0, 18), lp=(3200, 1800)),
                         nz(0.2, hp=(2000, 2000), lp=(5000, 5000), level=0.12)], 'Wild Boar notices you / charges: squeal'),
    'vo_bandit_brute': (2, [L('saw', 75, 56, 0.05, 0.35, 0.4, vib=(0.6, 7), lp=(900, 400), crush=5),
                            L('sq', 112, 84, 0.05, 0.3, 0.4, duty=0.4, lp=(700, 300), level=0.5),
                            nz(0.7, lp=(600, 250), level=0.4)], 'Bandit Brute notices you: deep roar'),
    # ---- Great Boar
    'boss_roar_great_boar': (1, [L('saw', 520, 760, 0.02, 0.25, 0.25, vib=(1.4, 16), lp=(3000, 1500), crush=6),
                                 L('saw', 150, 88, 0.08, 0.55, 0.55, vib=(0.8, 9), lp=(2600, 450), crush=5),
                                 L('sq', 75, 60, 0.1, 0.5, 0.5, duty=0.35, lp=(800, 300), level=0.6),
                                 nz(1.2, lp=(1200, 300), level=0.5)],
                             'Great Boar intro: 1.2 s distorted squeal-roar'),
    'boss_break': (1, [tone('sin', 85, 35, 0.6, level=1.0), nz(0.5, lp=(900, 200), level=0.8),
                       nz(0.12, hp=(2500, 2500), lp=(6000, 4000), level=0.3, delay=0.03)], 'Boss Break: big thud + crack'),
    'boss_defeated': (1, [nz(0.8, lp=(1400, 200)), tone('sin', 60, 30, 0.7, level=0.8),
                          L('sq', 523, 523, 0.02, 0.5, 0.6, duty=0.5, lp=(3000, 1500), delay=0.45, level=0.35),
                          L('sq', 659, 659, 0.02, 0.5, 0.6, duty=0.5, lp=(3000, 1500), delay=0.45, level=0.3),
                          L('sq', 784, 784, 0.02, 0.5, 0.6, duty=0.5, lp=(3000, 1500), delay=0.45, level=0.3)],
                      'Boss defeated: explosion + major chord'),
    # ---- enemy swings and deaths (lower than the player's swings)
    'enemy_swing_s': (3, swing(1900, 900, 0.09), 'Small enemy swing'),
    'enemy_swing_m': (3, swing(1300, 520, 0.14), 'Medium enemy swing'),
    'enemy_swing_l': (3, swing(750, 220, 0.24, low=65), 'Large enemy swing'),
    'enemy_death_s': (2, [tone('sq', 700, 220, 0.05, duty=0.3, level=0.6), tone('sin', 140, 60, 0.18, delay=0.03),
                          nz(0.12, lp=(1500, 400), level=0.4)], 'Small enemy dies: pop + thud'),
    'enemy_death_m': (2, [tone('sq', 520, 160, 0.07, duty=0.3, level=0.6), tone('sin', 110, 45, 0.28, delay=0.04),
                          nz(0.2, lp=(1200, 300), level=0.5)], 'Medium enemy dies: pop + thud'),
    'enemy_death_l': (2, [tone('sq', 360, 110, 0.1, duty=0.3, level=0.6), tone('sin', 80, 32, 0.45, delay=0.05),
                          nz(0.4, lp=(900, 200), level=0.6)], 'Large enemy dies: pop + heavy thud'),
    # ---- projectiles and impacts
    'proj_enemy_arrow': (2, [tone('tri', 420, 200, 0.12), bp(0.16, 2600, 1400, level=0.5)], 'Enemy arrow: twang'),
    'proj_brute_wave': (2, [nz(0.45, lp=(450, 200)), tone('sin', 62, 48, 0.45, level=0.7),
                            nz(0.3, rate=60, lp=(1500, 600), level=0.4)], 'Brute ground wave: rumble'),
    'proj_shockwave': (2, [nz(0.4, lp=(700, 250)), tone('sin', 85, 50, 0.4, level=0.8)], 'Boss shockwave: thump-rumble'),
    'rock_shatter': (2, [nz(0.28, hp=(900, 1500), lp=(6000, 3500)), nz(0.15, lp=(600, 300), level=0.6),
                         tone('sq', 1500, 900, 0.03, duty=0.2, level=0.3, delay=0.02)], 'Falling rock shatters'),
    'rock_whistle': (2, [L('sin', 2200, 700, 0.05, 0.4, 0.35, vib=(0.3, 9)),
                         nz(0.8, hp=(2500, 1200), level=0.15)], 'Falling rock whistle'),
    # ---- player hits and swings
    'hit_light': (3, [nz(0.05, lp=(4000, 1500)), tone('sq', 180, 90, 0.06, duty=0.5, level=0.6)], 'Light hit'),
    'hit_medium': (3, [nz(0.08, lp=(3500, 1200)), tone('sq', 140, 60, 0.09, duty=0.5, level=0.7)], 'Medium hit'),
    'hit_heavy': (3, [nz(0.14, lp=(1500, 500)), tone('sin', 70, 40, 0.16)], 'Heavy hit'),
    'hit_crit': (3, [nz(0.08, lp=(3500, 1200)), tone('sq', 140, 60, 0.09, duty=0.5, level=0.7),
                     tone('sq', 1200, 1800, 0.08, duty=0.25, level=0.45, delay=0.02)], 'Critical hit: hit + ping'),
    'swing_light': (3, swing(2500, 1200, 0.09), 'Light weapon swing'),
    'swing_medium': (3, swing(1800, 700, 0.14), 'Medium weapon swing'),
    'swing_heavy': (3, swing(1000, 300, 0.22, low=80), 'Heavy weapon swing'),
    'player_hurt': (2, [tone('sq', 400, 150, 0.15, duty=0.4), nz(0.12, lp=(2500, 800), level=0.5)], 'Player hurt'),
    'player_death': (2, [L('sq', 660, 660, 0.005, 0.5, 0.4, duty=0.5, arp=[(0.15, -3), (0.3, -4), (0.45, -5)],
                           lp=(2500, 800), level=0.6), nz(0.9, lp=(1200, 200), level=0.5)], 'Player death: falling notes'),
    # ---- movement
    'jump': (2, [tone('sq', 280, 520, 0.08, duty=0.25)], 'Jump'),
    'double_jump': (2, [tone('sq', 420, 900, 0.09, duty=0.25), nz(0.06, hp=(4000, 4000), level=0.5)], 'Double jump'),
    'wall_jump': (2, [nz(0.012, hp=(3000, 3000)), tone('sq', 300, 600, 0.07, duty=0.25, delay=0.01)], 'Wall jump'),
    'land': (3, [nz(0.06, lp=(600, 400))], 'Land'),
    'dash': (2, [nz(0.14, hp=(1500, 400), lp=(6000, 3000))], 'Dash'),
    'slide': (2, [nz(0.25, lp=(1200, 500), attack=0.01)], 'Slide'),
    'dive_start': (1, [tone('sq', 900, 300, 0.15, duty=0.3)], 'Dive start'),
    'dive_land': (1, [nz(0.2, lp=(400, 250)), tone('sin', 90, 40, 0.2)], 'Dive landing'),
    'dive_land_heavy': (1, [nz(0.35, lp=(400, 200)), tone('sin', 90, 35, 0.35)], 'Heavy dive landing'),
    'dive_bounce': (1, [tone('sin', 300, 700, 0.12)], 'Dive bounce'),
    'step_soft': (4, [nz(0.025, lp=(800, 600))], 'Footstep on grass'),
    # ---- flask
    'flask_drink': (1, [tone('sin', 300, 200, 0.13, attack=0.01), tone('sin', 300, 200, 0.13, attack=0.01, delay=0.16),
                        nz(0.28, lp=(500, 300), level=0.2)], 'Flask: gulp gulp'),
    'flask_sip': (1, [L('sq', 1047, 1047, 0.002, 0.1, 0.05, duty=0.5, arp=[(0.05, 4), (0.1, 7)], lp=(4000, 3000))],
                  'Flask heal point: C6 E6 G6'),
    'flask_empty': (1, [tone('sq', 900, 700, 0.03, duty=0.2), tone('saw', 90, 80, 0.18, delay=0.03, lp=(600, 400))],
                    'Flask empty: tok + low buzz'),
    'flask_tick': (1, [tone('sin', 3000, 3000, 0.02)], 'Flask fills a little'),
    'flask_charge': (1, [tone('sin', 1568, 1568, 0.5, level=0.7), tone('sin', 2352, 2352, 0.35, level=0.35),
                         tone('sin', 3136, 3136, 0.2, level=0.15)], 'Flask charge gained: bell'),
    # ---- doors and arena
    'door_slam': (1, [nz(0.3, lp=(1500, 300)), tone('sin', 70, 40, 0.3),
                      tone('sq', 220, 200, 0.08, duty=0.3, level=0.4, delay=0.01)], 'Arena door slams'),
    'door_open': (1, [nz(0.55, rate=45, hp=(1500, 1500), lp=(5000, 3000), attack=0.02),
                      tone('sq', 110, 130, 0.5, duty=0.2, level=0.2, lp=(500, 500))], 'Door opens: chain rattle'),
    'arena_clear': (1, [L('sq', 523, 523, 0.005, 0.45, 0.25, duty=0.5, arp=[(0.12, 4), (0.24, 7), (0.36, 12)],
                          lp=(4000, 2500))], 'Arena cleared: short fanfare'),
    'timed_open': (1, [tone('sin', 1319, 1319, 0.3), tone('sin', 1760, 1760, 0.35, delay=0.1)], 'Timed door opens: chime'),
    'timed_missed': (1, [L('sq', 140, 140, 0.005, 0.3, 0.1, duty=0.5, lp=(800, 800))], 'Timed door missed: buzzer'),
}


def note(f, dur, wave='sq', delay=0.0, level=1.0, duty=0.5, lp=(4000, 2500)):
    return L(wave, f, f, 0.003, dur * 0.4, dur * 0.6, duty=duty, lp=lp if wave in ('sq', 'saw') else None,
             delay=delay, level=level)


def arp(freqs, step, wave='sq', level=1.0, last=None, delay=0.0):
    out = [note(f, step * 1.3, wave, delay + i * step, level) for i, f in enumerate(freqs)]
    if last:
        out[-1] = note(freqs[-1], last, wave, delay + (len(freqs) - 1) * step, level)
    return out


C5, D5, E5, F5, G5, A5, B5, C6, E6, G6 = 523.25, 587.33, 659.25, 698.46, 783.99, 880.0, 987.77, 1046.5, 1318.5, 1568.0
A4, C4, E4, G4 = 440.0, 261.63, 329.63, 392.0

SFX.update({
    # ---- ART4: movement extras
    'ledge_grab': (2, [nz(0.04, lp=(3000, 1500)), tone('sq', 300, 260, 0.03, duty=0.3, level=0.4)], 'Ledge grab'),
    'drop_through': (2, [nz(0.06, lp=(1500, 600), attack=0.01)], 'Drop through a platform'),
    'spike_hit': (2, [tone('sq', 400, 150, 0.15, duty=0.4), nz(0.12, lp=(2500, 800), level=0.5),
                      tone('sq', 2000, 2000, 0.02, duty=0.3, level=0.5)], 'Hit by spikes'),
    # ---- Rush
    'rush_up': (1, arp([C5, E5, G5], 0.06), 'Rush level up'),
    'rush_max': (1, [bp(0.25, 2000, 800, level=0.6)] + [note(f, 0.5, 'sq', 0.08, 0.35) for f in (C5, E5, G5, C6)],
                 'Rush level 3: whoosh + major chord'),
    'rush_down': (1, arp([G5, D5], 0.09), 'Rush level down'),
    # ---- charge, blasts
    'charge_loop': (1, [note(400 * (900 / 400) ** (k / 3), 0.06, 'sq', k * 0.12, 0.6, 0.25) for k in range(4)],
                    'Charging (loops): rising blips'),
    'charge_full': (1, [tone('sin', 1600, 1600, 0.45), tone('sin', 2400, 2400, 0.3, level=0.4)], 'Charge full: ding'),
    'explosion_s': (2, [nz(0.4, lp=(1200, 200)), tone('sin', 60, 30, 0.4)], 'Small explosion'),
    'explosion_l': (2, [nz(0.7, lp=(1200, 200)), tone('sin', 60, 30, 0.7)], 'Large explosion'),
    # ---- Lucky Blocks
    'lucky_hit': (1, [tone('sq', 330, 220, 0.08, duty=0.5, lp=(1800, 800)), nz(0.05, lp=(1200, 600), level=0.5)],
                  'Lucky Block bonk'),
    'lucky_buff': (1, arp([C5, E5, G5, C6], 0.07, last=0.25), 'Lucky buff: major arp up'),
    'lucky_debuff': (1, arp([E5, C5, A4], 0.1, last=0.3), 'Lucky debuff: minor fall'),
    'jackpot': (1, arp([C5, E5, G5, C6, E6, G6], 0.08) + [note(f, 0.9, 'sq', 0.5, 0.35) for f in (C5, E5, G5, C6)],
                'Jackpot: long fanfare'),
    # ---- chests and curses
    'chest_open': (1, [L('saw', 180, 140, 0.05, 0.15, 0.15, vib=(1.5, 12), lp=(1200, 900), level=0.5),
                       note(2093, 0.15, 'sin', 0.3, 0.6), note(2637, 0.2, 'sin', 0.36, 0.5)], 'Chest opens: creak + clink'),
    'chest_locked': (1, [tone('sq', 160, 120, 0.1, duty=0.3, lp=(900, 500)), nz(0.06, lp=(800, 400), level=0.6)],
                     'Chest locked: clunk'),
    'cursed_open': (1, [note(f, 0.8, 'saw', 0, 0.3) for f in (A4 / 2, C5 / 2, 311.1 / 2)] +
                    [nz(0.8, hp=(3000, 3000), lp=(6000, 5000), attack=0.2, level=0.25)], 'Cursed chest: dark chord + whisper'),
    'curse_lifted': (1, [tone('sin', 1568, 1568, 0.5, level=0.7), tone('sin', 2093, 2093, 0.5, delay=0.08, level=0.5),
                         tone('sin', 2637, 2637, 0.5, delay=0.16, level=0.4)], 'Curse lifted: bright chime'),
    # ---- pickups
    'key_pickup': (2, [note(f, 0.06, 'sin', i * 0.05, 0.8) for i, f in enumerate((1568, 2093, 1760, 2349))],
                   'Key: jingle'),
    'keys_full': (2, [note(880, 0.06, 'sq', 0, 0.6, 0.25), note(880, 0.06, 'sq', 0.09, 0.6, 0.25)], 'Keys full: double blip'),
    'coin': (2, [tone('sin', 1975, 1975, 0.12), tone('sin', 2637, 2637, 0.1, delay=0.03, level=0.5)], 'Coin: ting'),
    'item_pop': (2, [tone('sin', 400, 900, 0.07)], 'Item pops out'),
    'pickup_weapon': (2, [tone('sq', 600, 500, 0.05, duty=0.3, lp=(3000, 1500)), nz(0.08, hp=(2000, 2000), level=0.4),
                          tone('sin', 1500, 1500, 0.15, delay=0.02, level=0.5)], 'Pick up a weapon: clank'),
    'pickup_ability': (2, arp([E5, G5, B5, E6], 0.05, 'sin', last=0.3), 'Pick up an ability: magic chime'),
    'blueprint': (2, arp([G4, C5, E5, G5], 0.09, last=0.4) + [note(C6, 0.4, 'sin', 0.36, 0.4)], 'Blueprint found: fanfare'),
    # ---- shop
    'purchase': (1, [nz(0.05, hp=(3000, 3000), level=0.5), note(1568, 0.12, 'sin', 0.04), note(2093, 0.25, 'sin', 0.1)],
                 'Purchase: cha-ching'),
    'cant_afford': (1, [L('sq', 110, 110, 0.005, 0.18, 0.05, duty=0.5, lp=(700, 700))], "Can't afford: buzz"),
    'upgrade': (1, arp([C5, E5, G5, C6, E6], 0.06, last=0.25), 'Upgrade: level-up arp'),
    'sell': (1, [note(f, 0.06, 'sin', i * 0.05, 0.7) for i, f in enumerate((2093, 1760, 2349, 1976))], 'Sell: coins'),
    'reroll': (1, [nz(0.04, lp=(3000, 2000), delay=k * 0.05, level=0.6) for k in range(5)], 'Reroll: shuffle'),
    # ---- run
    'split_faster': (1, arp([C5, G5], 0.09, last=0.2), 'Split ahead of your best'),
    'split_slower': (1, arp([G5, C5], 0.09, last=0.2), 'Split behind your best'),
    'pb': (1, arp([C5, E5, G5, C6], 0.1) + [note(f, 0.7, 'sq', 0.4, 0.35) for f in (C5, E5, G5, C6)], 'Personal best!'),
    'sleep': (1, arp([E5, C5, G4], 0.3, 'tri', last=0.6), 'Sleep: lullaby'),
    'restart': (1, [L('nz', None, None, 0.25, 0.02, 0.02, hp=(400, 1200), lp=(1200, 3500))], 'Restart: reverse whoosh'),
    # ---- menus (bus ui)
    'ui_move': (1, [tone('sq', 2000, 2000, 0.015, duty=0.25, lp=(5000, 5000))], 'Menu: move'),
    'ui_confirm': (1, [tone('sq', 600, 900, 0.07, duty=0.25)], 'Menu: confirm'),
    'ui_back': (1, [tone('sq', 600, 400, 0.07, duty=0.25)], 'Menu: back'),
    'ui_error': (1, [L('sq', 140, 140, 0.005, 0.1, 0.05, duty=0.5, lp=(900, 900))], 'Menu: error buzz'),
    'ui_open': (1, [tone('sin', 400, 800, 0.06)], 'Popup opens'),
    'ui_close': (1, [tone('sin', 800, 400, 0.06)], 'Popup closes'),
    'ui_toggle': (1, [nz(0.012, hp=(2000, 2000), lp=(5000, 5000)), tone('sq', 1200, 1200, 0.01, duty=0.3, level=0.5)], 'Menu: toggle'),
})


def files_for(sid):
    n = SFX[sid][0]
    return [f'{sid}.wav'] if n == 1 else [f'{sid}_{k}.wav' for k in range(1, n + 1)]


def render_all():
    """{filename: samples} for every sound and variant."""
    out = {}
    for sid, (n, recipe, _desc) in SFX.items():
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
