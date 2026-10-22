"""ART9: every track of 08 §14.3 as note data. `build_all()` returns {track_id: exported dict}.
Layer plan (stage tracks): base = drums + bass + harmony, L1 = 16th hats and fills, L2 = arpeggio (or bell), L3 = lead melody.
Boss tracks: base = everything, L1/L2 = extra intensity for later phases."""
from .lib import SPB, Track, deg, melody_period, triad

# ---------------------------------------------------------------- stage and boss tracks (one generator, per-track configs)
BASS = {
    'drive': 'x.xox.xox.xox.xo',      # eighth-note pulse with octave jumps
    'steady': 'x.x.x.x.x.x.x.x.',
    'march': 'x..x..x.x..x..x.',
    'low': 'X.....x.X...x...',
    'gallop': 'x.xxx.xxx.xxx.xx',
    'chug': 'xxxxxxxxxxxxxxxx',
}

CFG = {
    'plains': dict(bpm=132, tonic=33, scale='minor', bars=32, prog=[0, 5, 2, 6, 0, 5, 3, 4],
                   kick='x...x...x...x..x', snare='....x.......x...', bass='drive', harmony='pad'),
    'mountains': dict(bpm=126, tonic=40, scale='minor', bars=32, prog=[0, 6, 5, 6, 0, 2, 5, 6],
                      kick='x.....x.x.......', snare='....x.......x..x', bass='steady', harmony='pluck'),
    'swamps': dict(bpm=112, tonic=36, scale='minor', bars=32, prog=[0, 3, 5, 4, 0, 3, 6, 4],
                   kick='x.......x.x.....', snare='....x.......x...', bass='low', harmony='strings', toms='..o...o...x.o...'),
    'kingdom': dict(bpm=138, tonic=43, scale='minor', bars=32, prog=[0, 0, 3, 4, 0, 5, 3, 4],
                    kick='x.......x.......', snare='x.xxx.x.x.xxx.xx', bass='march', harmony='brass', march=True),
    'castle': dict(bpm=144, tonic=38, scale='harm', bars=32, prog=[0, 3, 4, 0, 5, 3, 4, 0],
                   kick='x...x...x...x...', snare='....x.......x.x.', bass='drive', harmony='strings', bell=True),
    'boss_guardian': dict(bpm=150, tonic=40, scale='minor', bars=16, prog=[0, 0, 5, 6, 0, 0, 3, 4], boss=1,
                          kick='x..xx..xx..xx.x.', snare='....x.......x...', bass='gallop', harmony='strings', toms='.o..............'),
    'boss_black_knight': dict(bpm=156, tonic=36, scale='minor', bars=32, prog=[0, 5, 3, 4, 0, 5, 6, 4], boss=1,
                              kick='x..xx..xx..xx..x', snare='....x..x....x...', bass='gallop', harmony='brass', march=True),
    'boss_king': dict(bpm=160, tonic=38, scale='minor', bars=32, prog=[0, 5, 2, 6, 3, 4, 0, 4], boss=2,
                      kick='x.x.x.x.x.x.x.x.', snare='....x.......x...', bass='chug', harmony='strings', bell=True),
    'boss_dragon': dict(bpm=164, tonic=42, scale='minor', bars=16, prog=[0, 5, 6, 4, 0, 5, 3, 4], boss=1,
                        kick='x.x.x.xxx.x.x.xx', snare='....x.......x..x', bass='chug', harmony='brass', toms='..............oo'),
}


def _bass_notes(t, cfg, bar, root, pat):
    for i, c in enumerate(BASS[pat]):
        if c in 'xX':
            t.note('bass', bar, i, root, 2 if c == 'X' else 1, 0.85 if i % 4 == 0 else 0.65)
        elif c == 'o':
            t.note('bass', bar, i, root + 12, 1, 0.55)


def stage_or_boss(tid, cfg):
    boss = cfg.get('boss', 0)
    t = Track(tid, cfg['bpm'], cfg['bars'])
    tonic, scale, prog = cfg['tonic'], cfg['scale'], cfg['prog']
    t.ch('kick', 'kick', 'base', 0.9)
    t.ch('snare', 'snare', 'base', 0.7)
    t.ch('bass', 'bass', 'base', 0.8)
    harmony = cfg['harmony']
    t.ch('harm', {'pad': 'pad', 'pluck': 'pluck', 'strings': 'strings', 'brass': 'brass'}[harmony], 'base', 0.45 if harmony != 'pluck' else 0.6)
    if cfg.get('toms'):
        t.ch('tom', 'tom', 'base', 0.7)
    if boss:
        t.ch('stab', 'brass' if harmony != 'brass' else 'strings', 'base', 0.35)
        t.ch('lead', 'lead', 'base', 0.45)
        t.ch('hat', 'hat', 'L1', 0.35)
        t.ch('hato', 'hat_open', 'L1', 0.3)
        t.ch('arp', 'arp', 'L1', 0.3)
        t.ch('kick2', 'kick', 'L1', 0.5)
        if boss >= 2:
            t.ch('lead2', 'lead', 'L2', 0.3)
            t.ch('bellhi', 'bell', 'L2', 0.4)
            t.ch('roll', 'tom', 'L2', 0.5)
    else:
        t.ch('hat', 'hat', 'L1', 0.35)
        t.ch('hato', 'hat_open', 'L1', 0.3)
        t.ch('fill', 'snare', 'L1', 0.55)
        t.ch('arp', 'arp' if not cfg.get('bell') else 'bell', 'L2', 0.3 if not cfg.get('bell') else 0.4)
        t.ch('lead', 'lead', 'L3', 0.45)
    # melody: one 8-bar period per 8 bars, a fresh one for the third period of 32-bar tracks, then the first again
    periods = [melody_period(t.rng, prog), melody_period(t.rng, prog)]
    for bar in range(cfg['bars']):
        d = prog[bar % 8]
        root = deg(tonic, scale, d)
        chord = triad(tonic + 24, scale, d)
        section_b = (bar // 8) % 2 == 1
        _bass_notes(t, cfg, bar, root, cfg['bass'])
        t.drums('kick', bar, cfg['kick'], 36, 0.95)
        t.drums('snare', bar, cfg['snare'], 38, 0.85)
        if cfg.get('toms'):
            t.drums('tom', bar, cfg['toms'], 45 if bar % 2 == 0 else 41, 0.8)
        if harmony in ('pad', 'strings'):
            for m in chord:
                t.note('harm', bar, 0, m, 16, 0.6)
        elif harmony == 'pluck':
            for i in range(8):
                t.note('harm', bar, i * 2, chord[[0, 1, 2, 1, 0, 1, 2, 1][i]] + (12 if i in (3, 7) else 0), 2, 0.7)
        elif harmony == 'brass':
            for s, ln in ((0, 3), (6, 2), (10, 2), (14, 1)) if not cfg.get('march') else ((0, 2), (4, 2), (8, 2), (12, 2)):
                for m in chord:
                    t.note('harm', bar, s, m - 12, ln, 0.6)
        if cfg.get('bell') and boss == 0:
            for i in range(16):
                t.note('arp', bar, i, chord[[0, 1, 2, 1][i % 4]] + 24, 2, 0.5 if i % 4 == 0 else 0.35)
        elif boss == 0:
            for i in range(16):
                t.note('arp', bar, i, chord[[0, 1, 2, 1][i % 4]] + 12 + (12 if section_b and i % 8 >= 4 else 0), 1, 0.55 if i % 4 == 0 else 0.35)
        if boss == 0:
            for i in range(16):
                t.note('hat', bar, i, 42, 1, 0.8 if i % 4 == 2 else 0.4)
            if bar % 2 == 1:
                t.note('hato', bar, 14, 46, 2, 0.7)
            if bar % 4 == 3:
                for i in range(12, 16):
                    t.note('fill', bar, i, 38, 1, 0.5 + 0.12 * (i - 12))
        else:
            for i in range(0, 16, 1):
                t.note('hat', bar, i, 42, 1, 0.8 if i % 2 == 0 else 0.4)
            t.note('hato', bar, 6, 46, 2, 0.7); t.note('hato', bar, 14, 46, 2, 0.7)
            for i in range(16):
                t.note('arp', bar, i, chord[[0, 1, 2, 1][i % 4]] + 12 + (12 if i % 8 >= 4 else 0), 1, 0.5 if i % 4 == 0 else 0.35)
            for i in (2, 5, 10, 13):
                t.note('kick2', bar, i, 36, 1, 0.8)
            for s, ln in ((0, 2), (3, 2), (8, 2), (11, 2)):
                for m in chord[:2]:
                    t.note('stab', bar, s, m, ln, 0.55)
            if bar % 4 == 3:
                for i in range(12, 16):
                    t.note('snare', bar, i, 38, 1, 0.55 + 0.1 * (i - 12))
            if boss >= 2:
                for s in (0, 4, 8, 12):
                    t.note('bellhi', bar, s, chord[2] + 24, 3, 0.6)
                for i in range(8, 16):
                    t.note('roll', bar, i, 45 + (i % 2) * 4, 1, 0.55)
    # melody notes
    for bar0 in range(0, cfg['bars'], 8):
        per = periods[1] if (bar0 // 8) % 4 == 2 else periods[0]
        for s, dgr, ln in per:
            step = bar0 * SPB + s
            if step >= cfg['bars'] * SPB:
                continue
            m = deg(tonic + 24, cfg['scale'], dgr)
            t.channels['lead']['notes'].append([step, m, ln, 0.8])
            if boss >= 2:
                t.channels['lead2']['notes'].append([step, m + 12, ln, 0.6])
    return t


# ---------------------------------------------------------------- title and village (calm, no drums)
def title():
    t = Track('title', 96, 16)
    t.ch('pad', 'pad', 'base', 0.5)
    t.ch('bell', 'bell', 'base', 0.5)
    t.ch('bass', 'bass', 'base', 0.4)
    t.ch('str', 'strings', 'base', 0.25)
    prog = [0, 5, 2, 6, 0, 5, 3, 4]       # D minor
    tonic = 38
    per = melody_period(t.rng, prog, density=0.55, cells=[[0, 6], [0, 4], [0], [0, 3, 6], [0, 5]])
    for bar in range(16):
        d = prog[bar % 8]
        for m in triad(tonic + 24, 'minor', d):
            t.note('pad', bar, 0, m, 16, 0.6)
        t.note('bass', bar, 0, deg(tonic, 'minor', d), 8, 0.7)
        t.note('bass', bar, 8, deg(tonic, 'minor', d) + 7, 8, 0.5)
        if bar % 2 == 0:
            for m in triad(tonic + 12, 'minor', d):
                t.note('str', bar, 0, m, 16, 0.5)
    for b0 in (0, 8):
        for s, d, ln in per:
            t.note('bell', b0 + s // 16, s % 16, deg(tonic + 36, 'minor', d - 7), 4 + ln, 0.8)
    return t


def village():
    t = Track('village', 80, 16)
    t.ch('pluck', 'pluck', 'base', 0.6)
    t.ch('pad', 'pad', 'base', 0.32)
    t.ch('bass', 'bass', 'base', 0.45)
    t.ch('mel', 'pluck', 'base', 0.5)
    prog = [0, 4, 5, 3, 0, 4, 1, 4]       # F major: I V vi IV I V ii V
    tonic = 41
    per = melody_period(t.rng, prog, density=0.6, cells=[[0, 6], [0, 3, 6], [0, 4, 6], [0, 2, 4], [0, 5]])
    for bar in range(16):
        d = prog[bar % 8]
        chord = triad(tonic + 12, 'major', d)
        for i in range(8):
            t.note('pluck', bar, i * 2, chord[[0, 1, 2, 1, 2, 1, 2, 1][i]] + (12 if i == 4 else 0), 3, 0.55 if i % 2 == 0 else 0.4)
        for m in triad(tonic + 12, 'major', d):
            t.note('pad', bar, 0, m, 16, 0.5)
        t.note('bass', bar, 0, deg(tonic - 12, 'major', d), 6, 0.6)
        t.note('bass', bar, 8, deg(tonic - 12, 'major', d) + 7, 6, 0.45)
    for b0 in (0, 8):
        for s, d, ln in per:
            t.note('mel', b0 + s // 16, s % 16, deg(tonic + 24, 'major', d - 2), ln + 1, 0.75)
    return t


# ---------------------------------------------------------------- stingers
def _sting(tid, bpm, bars, layers):
    t = Track(tid, bpm, bars, loop=False)
    for name, inst, gain, notes in layers:
        t.ch(name, inst, 'base', gain)
        for s, m, ln, v in notes:
            t.channels[name]['notes'].append([s, m, ln, v])
    return t


def stings():
    # victory: 2.0 s at 120 BPM, one bar, C major fanfare
    v = _sting('sting_victory', 120, 1, [
        ('brass', 'brass', 0.55, [(0, 60, 2, 0.8), (2, 64, 2, 0.8), (4, 67, 2, 0.85), (6, 72, 8, 0.95)]),
        ('brass2', 'brass', 0.4, [(6, 64, 8, 0.7), (6, 67, 8, 0.7)]),
        ('bell', 'bell', 0.5, [(6, 84, 6, 0.8), (10, 88, 6, 0.7)]),
        ('str', 'strings', 0.4, [(4, 48, 12, 0.7), (4, 55, 12, 0.7), (4, 64, 12, 0.7)]),
        ('kick', 'kick', 0.8, [(0, 36, 1, 0.9), (6, 36, 1, 0.9)])])
    # death: 2.5 s at 96 BPM, one bar, slow falling minor
    d = _sting('sting_death', 96, 1, [
        ('str', 'strings', 0.55, [(0, 57, 4, 0.8), (4, 55, 4, 0.8), (8, 53, 4, 0.75), (12, 52, 4, 0.7)]),
        ('str2', 'strings', 0.4, [(0, 48, 4, 0.7), (4, 46, 4, 0.7), (8, 45, 4, 0.65), (12, 40, 4, 0.65)]),
        ('bell', 'bell', 0.35, [(0, 69, 4, 0.6), (8, 65, 4, 0.5)]),
        ('tom', 'tom', 0.6, [(0, 36, 1, 0.9), (12, 33, 1, 0.8)])])
    # complete: 4.0 s at 120 BPM, two bars, a rising triumphant fanfare that ends on a held chord
    c = _sting('sting_complete', 120, 2, [
        ('brass', 'brass', 0.5, [(0, 60, 2, 0.8), (2, 64, 2, 0.8), (4, 67, 2, 0.85), (6, 72, 2, 0.9), (8, 76, 4, 0.9), (12, 79, 16, 1.0)]),
        ('brass2', 'brass', 0.4, [(12, 72, 16, 0.7), (12, 76, 16, 0.7)]),
        ('arp', 'arp', 0.3, [(16 + i, 72 + [0, 4, 7, 12][i % 4], 1, 0.5) for i in range(0, 8)]),
        ('str', 'strings', 0.45, [(0, 48, 16, 0.6), (0, 55, 16, 0.6), (16, 48, 16, 0.7), (16, 55, 16, 0.7), (16, 64, 16, 0.7)]),
        ('bell', 'bell', 0.5, [(12, 91, 8, 0.8), (16, 96, 12, 0.8)]),
        ('kick', 'kick', 0.8, [(0, 36, 1, 0.9), (4, 36, 1, 0.8), (8, 36, 1, 0.8), (12, 36, 1, 1.0)]),
        ('snare', 'snare', 0.6, [(10, 38, 1, 0.6), (11, 38, 1, 0.7), (12, 38, 1, 0.9)])])
    return [v, d, c]


def build_all():
    tracks = [stage_or_boss(tid, cfg) for tid, cfg in CFG.items()]
    tracks += [title(), village()] + stings()
    return {t.id: t.export() for t in tracks}


ORDER = ['title', 'village', 'plains', 'mountains', 'swamps', 'kingdom', 'castle',
         'boss_guardian', 'boss_black_knight', 'boss_king', 'boss_dragon',
         'sting_victory', 'sting_death', 'sting_complete']
