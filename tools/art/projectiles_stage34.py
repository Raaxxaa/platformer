"""ART8 projectiles (02 §10.4, 04 §8): the new player shots and the Stage 3-4 enemy shots. Drawn into the
`projectiles` atlas, facing right (the game rotates them to the velocity)."""
import math

from . import atlas as A
from . import palette as P
from . import raster as R

ATLAS = 'projectiles'
ALLOWED = ['ink', 'white', 'gray', 'w_steel', 'w_wood', 'w_gold', 'w_magic', 'fx_fire', 'fx_ice', 'fx_bolt', 'en_red',
           'en_steel', 'en_black', 'en_gold', 'en_ghost', 'en_bone']


def _L(w, h):
    return R.PartLayer(w, h)


def _part(L, name, ramp, shift=0):
    if name not in L.index:
        L.add_part(name, P.ramp_ids(ramp), shift)
    return name


def _one(L, name, color):
    if name not in L.index:
        L.add_part(name, [P.sid(color)])
    return name


def _done(L):
    c = R.auto_shade(L)
    R.outline(c, P.INK)
    return c.to_image()


# ---------------------------------------------------------------- player shots

def cannonball():
    """Hand Cannon ball 10 x 10: a heavy iron ball with a hot rim."""
    L = _L(10, 10)
    R.ellipse(L, 5, 5, 4.2, 4.2, _part(L, 'ball', 'gray', 1))
    R.ellipse(L, 5, 5, 4.2, 4.2, _part(L, 'ball2', 'w_steel', 2))
    R.line(L, (3, 3), (4, 3), _one(L, 'hi', P.RAMPS['white'][0]))
    R.line(L, (8, 6), (8, 7), _one(L, 'ember', P.RAMPS['fx_fire'][2]))
    return _done(L)


def javelin(w=20):
    L = _L(w, 4)
    R.fill_rect(L, 1, 1, w - 6, 2, _part(L, 'shaft', 'w_wood'))
    R.fill_rect(L, w - 6, 1, 1, 2, _part(L, 'wrap', 'w_gold'))
    R.fill_polygon(L, [(w - 5, 0.5), (w - 1, 2), (w - 5, 3.5)], _part(L, 'head', 'w_steel'))
    R.fill_rect(L, 0, 0, 2, 4, _part(L, 'fletch', 'w_gold', 1))
    return _done(L)


def javelin_platform():
    """The stuck javelin that serves as a 24 x 4 one-way platform (02 §10.5): shaft with the tip buried in the wall."""
    L = _L(26, 6)
    R.fill_rect(L, 1, 1, 24, 4, _part(L, 'shaft', 'w_wood'))
    R.fill_rect(L, 1, 1, 24, 1, _part(L, 'top', 'w_wood', -1))
    for x in (6, 12):
        R.fill_rect(L, x, 1, 1, 4, _part(L, 'wrap', 'w_gold'))
    R.fill_rect(L, 1, 1, 3, 4, _part(L, 'fletch', 'w_gold', 1))
    c = R.auto_shade(L)
    R.outline(c, P.INK)
    return c.to_image()


def knife():
    L = _L(8, 4)
    R.fill_polygon(L, [(2, 0.5), (7.5, 2), (2, 3.5)], _part(L, 'blade', 'w_steel'))
    R.fill_rect(L, 1, 0, 1, 4, _part(L, 'guard', 'w_gold'))
    R.fill_rect(L, 0, 1, 1, 2, _part(L, 'grip', 'w_wood'))
    return _done(L)


def wand_shot(frame):
    """Wand shot 6 x 6: a small violet rune diamond, twinkling."""
    L = _L(6, 6)
    R.fill_polygon(L, [(3, 0.2), (5.8, 3), (3, 5.8), (0.2, 3)], _part(L, 'rune', 'w_magic'))
    R.line(L, (3, 2 + frame), (3, 3 + frame), _one(L, 'core', P.RAMPS['white'][0]))
    return _done(L)


def rune(i):
    """Rune Ring rune 10 x 10 (02 §11 `runeRing`): a glowing glyph; four variants spin as the ring turns."""
    L = _L(10, 10)
    R.ellipse(L, 5, 5, 4.2, 4.2, _part(L, 'disc', 'w_magic', 1))
    g = _one(L, 'glyph', P.RAMPS['white'][0])
    glyphs = [((3, 3), (6, 3), (4, 5), (4, 6)), ((5, 2), (3, 5), (6, 5), (5, 7)),
              ((3, 4), (6, 4), (4, 2), (5, 7)), ((2, 5), (5, 3), (7, 5), (5, 6))]
    for (x, y) in glyphs[i]:
        R.line(L, (x, y), (x, y), g)
    return _done(L)


def skewer():
    """Spear signature shot 32 x 8: a ghostly spearhead."""
    L = _L(32, 8)
    R.fill_polygon(L, [(0, 3), (22, 3), (31, 4), (22, 5), (0, 5)], _part(L, 'shaft', 'w_steel'))
    R.fill_polygon(L, [(18, 0.5), (31.5, 4), (18, 7.5), (21, 4)], _part(L, 'head', 'w_steel', -1))
    R.line(L, (4, 4), (18, 4), _one(L, 'core', P.RAMPS['white'][0]))
    return _done(L)


def soul(frame):
    """Soul Reap soul 10 x 10: a pale wisp with a tail."""
    L = _L(10, 10)
    R.ellipse(L, 6, 5, 3.4 + 0.4 * frame, 3.4, _part(L, 'wisp', 'fx_ice'))
    R.fill_polygon(L, [(0, 5 - frame), (4, 3), (4, 7)], _part(L, 'tail', 'fx_ice', 1))
    R.line(L, (6, 4), (7, 4), _one(L, 'eye', P.RAMPS['ink'][0]))
    return _done(L)


def reflected(frame):
    """The Shield's reflected shot 8 x 8: a white-gold spark."""
    L = _L(8, 8)
    R.ellipse(L, 4, 4, 3.0 + 0.4 * frame, 3.0 + 0.4 * frame, _part(L, 'spark', 'w_gold'))
    R.ellipse(L, 4, 4, 1.4, 1.4, _one(L, 'core', P.RAMPS['white'][0]))
    return _done(L)


# ---------------------------------------------------------------- Stage 3-4 enemy shots

def enemy_bolt():
    """Crossbow bolt 12 x 4: short, dark and heavy."""
    L = _L(12, 4)
    R.fill_rect(L, 2, 1, 7, 2, _part(L, 'shaft', 'w_wood'))
    R.fill_polygon(L, [(8, 0.5), (11.5, 2), (8, 3.5)], _part(L, 'head', 'en_steel'))
    R.fill_rect(L, 0, 0, 3, 4, _part(L, 'fletch', 'en_red'))
    return _done(L)


def fireball(frame):
    """Battle Mage fireball 12 x 12 with a trailing tail."""
    L = _L(12, 12)
    R.fill_polygon(L, [(0, 5 + frame), (5, 2.5), (5, 9.5)], _part(L, 'tail', 'fx_fire', 1))
    R.ellipse(L, 7, 6, 4.2 + 0.4 * frame, 4.2 + 0.4 * frame, _part(L, 'ball', 'fx_fire'))
    R.ellipse(L, 7, 6, 2.2, 2.2, _one(L, 'core', P.RAMPS['fx_fire'][3]))
    return _done(L)


def dark_wave(frame):
    """Black Knight dark wave 20 x 32: a tall crescent of shadow with ember edges, running along the floor."""
    L = _L(20, 32)
    body = _part(L, 'wave', 'en_black')
    for y in range(32):
        t = (y - 15.5) / 15.5
        reach = 17 * (1 - t * t) + (1 if frame and y % 4 < 2 else 0)
        x0 = 3 + abs(t) * 5
        R.fill_rect(L, int(x0), y, max(1, int(reach - x0 + 3)), 1, body)
    edge = _part(L, 'edge', 'fx_fire', 0)
    for y in range(2, 30, 3):
        t = (y - 15.5) / 15.5
        x = int(3 + 17 * (1 - t * t))
        R.line(L, (min(19, x), y), (min(19, x), y), edge)
    return _done(L)


def arcane_bolt(frame):
    """Castle Mage arcane bolt 8 x 8: a ghost-cyan orb."""
    L = _L(8, 8)
    R.ellipse(L, 4, 4, 3.0 + 0.4 * frame, 3.0 + 0.4 * frame, _part(L, 'orb', 'en_ghost'))
    R.ellipse(L, 4, 4, 1.2, 1.2, _one(L, 'core', P.RAMPS['white'][0]))
    return _done(L)


def royal_orb(frame):
    """Enemy King scepter orb 12 x 12: a gold orb around a violet gem."""
    L = _L(12, 12)
    R.ellipse(L, 6, 6, 4.8 + 0.3 * frame, 4.8 + 0.3 * frame, _part(L, 'orb', 'en_gold'))
    R.ellipse(L, 6, 6, 2.6, 2.6, _part(L, 'gem', 'w_magic'))
    R.line(L, (5, 5), (5, 5), _one(L, 'hi', P.RAMPS['white'][0]))
    return _done(L)


def falling_sword():
    """King's falling sword, drawn pointing right 32 x 12 (rotated to point down in play)."""
    L = _L(32, 12)
    R.fill_polygon(L, [(8, 4.2), (27, 4.2), (31.5, 6), (27, 7.8), (8, 7.8)], _part(L, 'blade', 'en_steel'))
    R.line(L, (9, 6), (27, 6), _one(L, 'fuller', P.RAMPS['white'][0]))
    R.fill_rect(L, 6, 1, 3, 10, _part(L, 'guard', 'en_gold'))
    R.fill_rect(L, 1, 4, 5, 4, _part(L, 'grip', 'en_red'))
    R.ellipse(L, 1, 6, 1.6, 1.6, _part(L, 'pommel', 'en_gold'))
    return _done(L)


def fire_rain(frame):
    """Red Dragon fire rain 16 x 16: a falling fireball with a long tail, drawn pointing right."""
    L = _L(16, 16)
    R.fill_polygon(L, [(0, 7 + frame), (8, 3), (8, 13)], _part(L, 'tail', 'fx_fire', 1))
    R.ellipse(L, 10, 8, 5.0 + 0.4 * frame, 5.0 + 0.4 * frame, _part(L, 'ball', 'fx_fire'))
    R.ellipse(L, 10, 8, 2.6, 2.6, _one(L, 'core', P.RAMPS['fx_fire'][3]))
    return _done(L)


def fire_pool(frame):
    """Fire pool 48 x 8 (2 frames at 6 fps), the Red Dragon's burning floor."""
    L = _L(48, 8)
    R.ellipse(L, 24, 5, 23, 2.6, _part(L, 'pool', 'fx_fire', 1))
    for k in range(7):
        x = 5 + k * 6 + (frame * 2 if k % 2 else 0)
        h = 3 + (k + frame) % 3
        R.fill_polygon(L, [(x - 1.5, 6), (x + frame * 0.4, 6 - h), (x + 1.5, 6)], _part(L, 'flame', 'fx_fire', -1))
    return R.auto_shade(L).to_image()


def build_frames():
    fr = {'cannonball_00': cannonball(), 'javelin_00': javelin(), 'javelin_platform_00': javelin_platform(),
          'knife_00': knife(), 'skewer_00': skewer(), 'enemy_bolt_00': enemy_bolt(), 'falling_sword_00': falling_sword()}
    for i in range(2):
        fr[f'wand_shot_{i:02d}'] = wand_shot(i)
        fr[f'soul_{i:02d}'] = soul(i)
        fr[f'reflected_{i:02d}'] = reflected(i)
        fr[f'fireball_{i:02d}'] = fireball(i)
        fr[f'dark_wave_{i:02d}'] = dark_wave(i)
        fr[f'arcane_bolt_{i:02d}'] = arcane_bolt(i)
        fr[f'royal_orb_{i:02d}'] = royal_orb(i)
        fr[f'fire_rain_{i:02d}'] = fire_rain(i)
        fr[f'fire_pool_{i:02d}'] = fire_pool(i)
    for i in range(4):
        fr[f'rune_{i:02d}'] = rune(i)
    anims = [A.anim('cannonball', ATLAS, 1, 'once'), A.anim('javelin', ATLAS, 1, 'once'),
             A.anim('javelin_platform', ATLAS, 1, 'once'), A.anim('knife', ATLAS, 1, 'once'),
             A.anim('skewer', ATLAS, 1, 'once'), A.anim('enemy_bolt', ATLAS, 1, 'once'),
             A.anim('falling_sword', ATLAS, 1, 'once'), A.anim('rune', ATLAS, 4, 'loop', 12),
             A.anim('wand_shot', ATLAS, 2, 'loop', 12), A.anim('soul', ATLAS, 2, 'loop', 10),
             A.anim('reflected', ATLAS, 2, 'loop', 12), A.anim('fireball', ATLAS, 2, 'loop', 12),
             A.anim('dark_wave', ATLAS, 2, 'loop', 10), A.anim('arcane_bolt', ATLAS, 2, 'loop', 12),
             A.anim('royal_orb', ATLAS, 2, 'loop', 10), A.anim('fire_rain', ATLAS, 2, 'loop', 12),
             A.anim('fire_pool', ATLAS, 2, 'loop', 6)]
    return fr, anims
