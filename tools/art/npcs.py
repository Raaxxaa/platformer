"""Village NPCs (ART3, 08 §8): humanoid rig with the `npc` ramp. Atlas `npcs`, 48 × 48, anchor (24, 46)."""
import os

from . import atlas as A
from . import palette as P
from . import raster as R
from .enemies.plains import on_ground
from .rig import humanoid_fk

ATLAS = 'npcs'
ALLOWED = ['ink', 'white', 'skin', 'hair', 'npc', 'vl_wood', 'vl_plaster', 'vl_light', 'w_gold', 'w_wood', 'gray']
NPCS = ['shopkeeper', 'innkeeper', 'merchant', 'villager_a', 'villager_b']
WAVERS = ['shopkeeper', 'innkeeper']


class Fig:
    def __init__(self):
        self.L = R.PartLayer(48, 48)

    def part(self, name, ramp, shift=0):
        if name not in self.L.index:
            self.L.add_part(name, P.ramp_ids(ramp), shift)
        return name


def pose(i, wave=None, **kw):
    bob = [0, 0, 1, 1][i]
    p = {'lean': 0, 'hipOffset': (0, 0), 'chest': (0, bob), 'head': (0, 0),
         'armF': (10 + [0, 2, 3, 1][i], 20), 'armB': (-8 - [0, 2, 3, 1][i], 14), 'legF': (8, 4), 'legB': (-7, 2)}
    if wave is not None:
        p['armF'] = (112, [40, 70, 40, 70][wave])
    p.update(kw)
    return p


def draw(npc, p):
    f = Fig()
    j = humanoid_fk(p)
    hx, hy = j['head']
    cx, cy = j['chest']
    hpx, hpy = j['hip']
    spec = {
        'shopkeeper': dict(shirt='npc', sleeve='npc', pants='vl_wood', boots='vl_wood', torso=9),
        'innkeeper': dict(shirt='vl_plaster', sleeve='vl_plaster', pants='vl_wood', boots='vl_wood', torso=12),
        'merchant': dict(shirt='npc', sleeve='npc', pants='vl_wood', boots='vl_wood', torso=9),
        'villager_a': dict(shirt='npc', sleeve='npc', pants='npc', boots='vl_wood', torso=8),
        'villager_b': dict(shirt='vl_plaster', sleeve='vl_plaster', pants='vl_wood', boots='vl_wood', torso=9),
    }[npc]

    def arm(side, shift):
        u = f.part('upper' + side, spec['sleeve'], shift)
        fo = f.part('fore' + side, 'skin', shift)
        R.capsule(f.L, j['shoulder' + side], j['elbow' + side], 3, u)
        R.capsule(f.L, j['elbow' + side], j['hand' + side], 3, fo)

    def leg(side, shift):
        t = f.part('leg' + side, spec['pants'], shift)
        b = f.part('boot' + side, spec['boots'], shift + 1)
        kn, ft = j['knee' + side], j['foot' + side]
        ft = (ft[0], min(ft[1], 44))
        R.capsule(f.L, (hpx, hpy + 1), kn, 4, t)
        R.capsule(f.L, kn, (ft[0], ft[1] - 1), 3, t)
        R.fill_rect(f.L, ft[0] - 1, ft[1] - 1, 4, 2, b)

    if npc == 'merchant':                                     # big backpack behind everything
        pack = f.part('pack', 'vl_wood')
        R.fill_rect(f.L, cx - 10, cy - 6, 9, 16, pack)
        roll = f.part('roll', 'vl_plaster', 1)
        R.fill_rect(f.L, cx - 11, cy - 9, 11, 4, roll)
        pot = f.part('pot', 'gray')
        R.ellipse(f.L, cx - 11, cy + 6, 2.2, 2.2, pot)
    arm('B', 1)
    leg('B', 1)
    leg('F', 0)
    torso = f.part('torso', spec['shirt'])
    w = spec['torso'] / 2
    if npc == 'innkeeper':
        R.ellipse(f.L, (cx + hpx) / 2 + 0.5, (cy + hpy) / 2 + 1, w, 6.5, torso)      # round
    elif npc == 'villager_a':                                 # dress down to the knees
        R.fill_polygon(f.L, [(cx + 0.5 - w, cy), (cx + 0.5 + w, cy), (hpx + 6.5, 39), (hpx - 5.5, 39)], torso)
    else:
        R.fill_polygon(f.L, [(cx + 0.5 - w, cy), (cx + 0.5 + w, cy), (hpx + w, hpy + 2), (hpx + 1 - w, hpy + 2)], torso)
    if npc == 'shopkeeper':
        apron = f.part('apron', 'vl_plaster', -1)
        R.fill_rect(f.L, cx - 1, cy + 3, 6, hpy - cy + 3, apron)
    if npc == 'merchant':
        strap = f.part('strap', 'vl_wood', 1)
        R.line(f.L, (cx - 2, cy), (cx + 2, hpy), strap)
    if npc == 'villager_b':
        vest = f.part('vest', 'vl_wood')
        R.fill_rect(f.L, cx - 4, cy + 1, 3, hpy - cy, vest)
        R.fill_rect(f.L, cx + 3, cy + 1, 2, hpy - cy, vest)
    head = f.part('head', 'skin')
    R.ellipse(f.L, hx, hy, 3.7, 4.1, head)
    hair = f.part('hair', 'hair')
    if npc == 'shopkeeper':                                   # balding with a big mustache
        R.fill_polygon(f.L, [(hx - 4, hy + 2), (hx - 4, hy - 1), (hx - 2, hy - 1), (hx - 2, hy + 2)], hair)
        R.fill_rect(f.L, hx, hy + 2, 5, 1, hair)
        R.fill_rect(f.L, hx + 1, hy + 3, 2, 1, hair)
    elif npc == 'innkeeper':
        R.fill_polygon(f.L, [(hx - 4, hy + 2), (hx - 4.5, hy - 3), (hx + 3.5, hy - 4.5), (hx + 4, hy - 2),
                             (hx - 1, hy - 2), (hx - 2, hy + 2)], hair)
        R.fill_rect(f.L, hx + 1, hy + 2, 4, 2, hair)                                   # beard
    elif npc == 'merchant':
        hood = f.part('hood', 'npc', 2)
        R.ellipse(f.L, hx - 1, hy - 0.5, 4.5, 4.7, hood)
        R.ellipse(f.L, hx + 2.4, hy + 0.8, 2.1, 2.8, head)
    elif npc == 'villager_a':                                 # long hair and a kerchief
        R.fill_polygon(f.L, [(hx - 4.5, hy + 6), (hx - 4.5, hy - 2), (hx + 3, hy - 4.5), (hx + 4.5, hy - 2),
                             (hx - 1, hy - 1.5), (hx - 1.5, hy + 6)], hair)
        kerch = f.part('kerchief', 'vl_plaster', -1)
        R.fill_rect(f.L, hx - 4, hy - 5, 8, 2, kerch)
    else:                                                     # straw hat
        R.fill_polygon(f.L, [(hx - 4, hy + 2), (hx - 4, hy - 2), (hx, hy - 2), (hx - 1, hy + 2)], hair)
        hat = f.part('hat', 'w_gold', 1)
        R.fill_rect(f.L, hx - 6, hy - 3, 13, 2, hat)
        R.ellipse(f.L, hx, hy - 4.5, 3.5, 2.2, hat)
    eye = f.part('eye', 'ink')
    R.fill_rect(f.L, hx + 2, hy - 1, 1, 2, eye)
    arm('F', 0)
    if npc == 'innkeeper' and p['armF'][0] < 90:              # holding a mug
        mug = f.part('mug', 'w_gold')
        foam = f.part('foam', 'vl_light', -1)
        hx2, hy2 = j['handF']
        R.fill_rect(f.L, hx2, hy2 - 3, 4, 5, mug)
        R.fill_rect(f.L, hx2, hy2 - 4, 4, 1, foam)
    c = R.auto_shade(f.L)
    R.outline(c, P.INK)
    return on_ground(c.to_image(), 46)


def build_frames():
    fr, anims = {}, []
    for npc in NPCS:
        for i in range(4):
            fr[f'{npc}_idle_{i:02d}'] = draw(npc, pose(i))
        anims.append(A.anim(f'{npc}_idle', ATLAS, 4, 'loop', 6))
        if npc in WAVERS:
            for i in range(4):
                fr[f'{npc}_wave_{i:02d}'] = draw(npc, pose(0, wave=i))
            anims.append(A.anim(f'{npc}_wave', ATLAS, 4, 'loop', 6))
    return fr, anims


def build(assets, preview):
    from . import preview as V
    fr, anims = build_frames()
    for n, img in fr.items():
        P.check_palette_lock(img, P.allowed(ALLOWED), ATLAS, n)
    A.pack_atlas(ATLAS, fr, os.path.join(assets, 'atlases'))
    bg = tuple(P.RAMPS['pl_bg1'][1])
    rows = []
    for a in anims:
        imgs = [V.overlay(fr[n], (24, 46)) for n in a['frames']]
        rows.append((a['key'], imgs))
        V.preview_gif(os.path.join(preview, f"{ATLAS}__{a['key']}.gif"), imgs, 6, bg)
    V.preview_sheet(os.path.join(preview, f'{ATLAS}_sheet.png'), rows, bg)
    return anims
