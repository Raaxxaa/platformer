"""ART8 level objects (08 §8): the cannon, the swinging blade (pivot, chain link, blade). Atlas `objects`."""
import math

from . import atlas as A
from . import palette as P
from . import raster as R

ATLAS = 'objects'


def _part(L, name, ramp, shift=0):
    if name not in L.index:
        L.add_part(name, P.ramp_ids(ramp), shift)
    return name


def cannon(glow=None):
    """24 x 16 iron cannon on a wooden carriage, muzzle to the right. glow 0/1 = the muzzle-glow overlay only."""
    L = R.PartLayer(24, 16)
    if glow is not None:
        c = R.Canvas(24, 16)
        fc = P.RAMPS['fx_fire']
        r = 3 + glow
        for y in range(16):
            for x in range(24):
                d = math.hypot(x - 21, y - 6)
                if d <= r:
                    c.a[y, x] = P.sid(fc[3] if d <= r - 1.6 else fc[2])
        return c.to_image()
    wood = _part(L, 'carriage', 'w_wood')
    iron = _part(L, 'barrel', 'en_steel', -1)
    band = _part(L, 'band', 'gray')
    R.fill_polygon(L, [(2, 15), (4, 8), (17, 8), (19, 15)], wood)
    R.capsule(L, (4, 6), (19, 6), 7, iron)
    R.ellipse(L, 4, 6, 3.6, 3.6, iron)
    R.fill_rect(L, 20, 2, 3, 8, iron)
    R.fill_rect(L, 9, 2, 1, 9, band)
    R.fill_rect(L, 14, 2, 1, 9, band)
    R.ellipse(L, 9, 13, 3.2, 3.2, _part(L, 'wheel', 'w_wood', 1))
    R.ellipse(L, 9, 13, 1.2, 1.2, _part(L, 'hub', 'gray'))
    R.line(L, (21, 4), (21, 7), _part(L, 'bore', 'en_black', 0))
    c = R.auto_shade(L)
    R.outline(c, P.INK)
    return c.to_image()


def blade_disc():
    """Swinging blade 24 x 24: a toothed steel crescent axe-head disc, light on its upper-left."""
    L = R.PartLayer(24, 24)
    steel = _part(L, 'steel', 'en_steel')
    inner = _part(L, 'inner', 'en_steel', 1)
    R.ellipse(L, 12, 12, 11, 11, steel)
    for k in range(8):                                        # teeth
        a = k * math.pi / 4
        x, y = 12 + 11.5 * math.cos(a), 12 + 11.5 * math.sin(a)
        R.fill_polygon(L, [(12 + 9 * math.cos(a - 0.3), 12 + 9 * math.sin(a - 0.3)),
                           (12 + 12 * math.cos(a), 12 + 12 * math.sin(a)),
                           (12 + 9 * math.cos(a + 0.3), 12 + 9 * math.sin(a + 0.3))], steel)
        del x, y
    R.ellipse(L, 12, 12, 7, 7, inner)
    R.ellipse(L, 12, 12, 2.2, 2.2, _part(L, 'hub', 'en_gold'))
    R.ellipse(L, 12, 12, 3.2, 3.2, _part(L, 'ring', 'gray', 1))
    R.ellipse(L, 12, 12, 2.0, 2.0, _part(L, 'hub2', 'gray', 0))
    c = R.auto_shade(L)
    R.outline(c, P.INK)
    return c.to_image()


def pivot():
    L = R.PartLayer(8, 8)
    R.ellipse(L, 4, 4, 3.4, 3.4, _part(L, 'cap', 'en_steel', 1))
    R.ellipse(L, 4, 4, 1.4, 1.4, _part(L, 'bolt', 'gray'))
    c = R.auto_shade(L)
    R.outline(c, P.INK)
    return c.to_image()


def chain_link():
    c = R.Canvas(4, 4)
    for x, y in ((1, 0), (2, 0), (0, 1), (3, 1), (0, 2), (3, 2), (1, 3), (2, 3)):
        c.a[y, x] = P.sid(P.RAMPS['gray'][3])
    return c.to_image()


def frames():
    return {'cannon_idle_00': cannon(), 'cannon_glow_00': cannon(0), 'cannon_glow_01': cannon(1),
            'swinging_blade_00': blade_disc(), 'blade_pivot_00': pivot(), 'blade_chain_00': chain_link()}


def anims():
    return [A.anim('cannon_idle', ATLAS, 1, 'once'), A.anim('cannon_glow', ATLAS, 2, 'loop', 10),
            A.anim('swinging_blade', ATLAS, 1, 'once'), A.anim('blade_pivot', ATLAS, 1, 'once'),
            A.anim('blade_chain', ATLAS, 1, 'once')]
