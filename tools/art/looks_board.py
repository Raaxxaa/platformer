"""ART10 Task 3: the looks board (`style_board_looks.png`): every race in every outfit, every hair style, beard and
face, the skin tones and dyes, and one character through run, jump, dash, attack and death."""
import os

import numpy as np
from PIL import Image

from . import boards as B
from . import look as LK
from . import palette as P
from . import weapons as WP
from .poses.player import POSES
from .rig import humanoid_fk

BG = (0x78, 0xb1, 0x8b, 255)
DARK = (0x2d, 0x4a, 0x3a, 255)
SKY = (0xa9, 0xd6, 0xe8, 255)
CLASS_PAIR = ((0x42, 0xd9, 0xff), (0xff, 0xa8, 0x3a))        # the Wizard's trims, as a sample

# (hair, hair color, beard, face, color A, color B) variants per cell; `None` race entries are filled by position
SAMPLES = [
    [('spiky', '#5a3a28', 'none', 'calm', '#4a5a78', '#6b4a30'), ('short', '#2a2630', 'stubble', 'fierce', '#3a6a40', '#7a2a3a')],
    [('long_tied', '#d6b04a', 'none', 'cheerful', '#7a2a3a', '#c2a878'), ('braid', '#8a3a22', 'none', 'calm', '#2a3a78', '#7c7c88')],
    [('curly', '#8d8d96', 'short', 'tired', '#6a7030', '#6b4a30'), ('top_knot', '#e6e2dc', 'long', 'fierce', '#4a5a78', '#c2a878')],
    [('mohawk', '#8a3a22', 'none', 'fierce', '#7c7c88', '#2a3a78'), ('bald', '#2a2630', 'braided', 'tired', '#3a6a40', '#6a7030')],
]
SKIN_OF = {'human': (2, 4), 'elf': (1, 3), 'dwarf': (3, 5), 'orc': (0, 3)}


def _crop(im, x0=8, x1=40):
    return im.crop((x0, 0, x1, 48))


def _head_crop(im, frame='idle_00', w=22, h=26):
    hx, hy = humanoid_fk(POSES['idle'][0])['head']
    return im.crop((hx - 14, hy - 12, hx - 14 + 26, hy - 12 + h))


def _paste(canvas, im, x, y, z):
    canvas.alpha_composite(im.resize((im.width * z, im.height * z), Image.NEAREST), (int(x), int(y)))


def _weapon_frames(frame, wid):
    fr = WP.build_frames(wid)
    return fr.get(frame), fr.get(frame.rsplit('_', 1)[0] + '_smear')


def _swatches(cv, x, y, hexes, sw, gap=3):
    for hexc in hexes:
        cv.paste(tuple(int(hexc[i:i + 2], 16) for i in (1, 3, 5)), (x, y, x + sw, y + sw))
        x += sw + gap
    return x


def board(path):
    Z = 4
    INK = (0x1b, 0x18, 0x26)
    cell_w, cell_h = 32 * Z + 8, 48 * Z + 6
    W = 8 * cell_w + 150
    hz, tile = 4, 26 * 4 + 6
    H = 24 + 4 * cell_h + 8 + 24 + 2 * (26 * hz + 30) + 24 + 70 + 24 + 48 * 3 + 40
    cv = Image.new('RGBA', (W, H), BG)

    def title(s, x, y):
        B.text(cv, s, x, y, 'rb_large', INK)
    y = 6
    title('Races x outfits (idle): same frames, same feet, same size. Only the look changes.', 8, y)
    y += 24
    for r, race in enumerate(LK.RACES):
        B.text(cv, race.capitalize(), 6, y + r * cell_h + 90, 'rb_large', INK)
        for c, outfit in enumerate(LK.OUTFITS):
            for v in range(2):
                hair, hc, beard, face, ca, cb = SAMPLES[(r + c + v) % 4][v]
                if race == 'dwarf' and beard == 'none':
                    beard = 'long'
                look = dict(race=race, outfit=outfit, skin=SKIN_OF[race][v], hair=hair, hair_color=hc, beard=beard,
                            face=face, color_a=ca, color_b=cb)
                _paste(cv, _crop(LK.compose('idle_00', look, CLASS_PAIR)), 150 + (c * 2 + v) * cell_w, y + r * cell_h, Z)
    y += 4 * cell_h + 8
    title('Hair styles (8)', 8, y)
    y += 24
    hair_cols = ['#5a3a28', '#2a2630', '#d0aa48', '#8a3a22', '#8d8d96', '#d0cec8', '#5a3a28', '#2a2630']
    for i, style in enumerate(LK.HAIRS):
        look = dict(hair=style, hair_color=hair_cols[i], beard='none', face='calm', outfit='leather')
        _paste(cv, _head_crop(LK.compose('idle_00', look)), 8 + i * tile, y, hz)
        B.text(cv, style.replace('_', ' '), 8 + i * tile + 4, y + 26 * hz + 2, 'rb_small', INK)
    y += 26 * hz + 18
    title('Beards (5) and faces (4)', 8, y)
    y += 24
    for i, style in enumerate(LK.BEARDS):
        look = dict(hair='short', hair_color='#8a3a22', beard=style, face='calm', outfit='leather', skin=3)
        _paste(cv, _head_crop(LK.compose('idle_00', look)), 8 + i * tile, y, hz)
        B.text(cv, style, 8 + i * tile + 4, y + 26 * hz + 2, 'rb_small', INK)
    hx, hy = humanoid_fk(POSES['idle'][0])['head']
    for i, face in enumerate(LK.FACES):
        look = dict(hair='short', hair_color='#2a2630', beard='none', face=face, outfit='leather', skin=1)
        crop = LK.compose('idle_00', look).crop((hx - 7, hy - 7, hx + 7, hy + 7))
        x = 5 * tile + 30 + i * 150
        _paste(cv, crop, x, y, 8)
        B.text(cv, face, x + 4, y + 14 * 8 + 2, 'rb_small', INK)
    y += 26 * hz + 18
    title('Skin tones (6 + orc 4), cloth dyes (8 + 8 from shops), hair colors (6 + 6 from shops)', 8, y)
    y += 24
    x = _swatches(cv, 8, y, P.COSMETIC_COLORS['skin'] + P.COSMETIC_COLORS['skin_orc'], 26) + 16
    x = _swatches(cv, x, y, P.COSMETIC_COLORS['dye'] + list(P.COSMETIC_COLORS['dye_shop'].values()), 26) + 16
    _swatches(cv, x, y, P.COSMETIC_COLORS['hair'] + list(P.COSMETIC_COLORS['hair_shop'].values()), 26)
    y += 40
    title('One hero (elf ranger) through idle, run, jump, dash, attack and death', 8, y)
    y += 24
    look = dict(race='elf', outfit='ranger', skin=1, hair='braid', hair_color='#d0aa48', beard='none', face='cheerful',
                color_a='#3a6a40', color_b='#6b4a30')
    seq = ['idle_00', 'run_01', 'run_05', 'jump_00', 'dash_01', 'atk_greatsword_1_02', 'dead_00', 'dead_05']
    for i, frame in enumerate(seq):
        im = LK.compose(frame, look, CLASS_PAIR)
        x = 8 + i * (48 * 3 + 6)
        if frame.startswith('atk_'):
            wimg, smear = _weapon_frames(frame, 'greatsword')
            big = Image.new('RGBA', (160, 96))
            if smear is not None:
                big.alpha_composite(smear, (0, 0))
            big.alpha_composite(im, (80 - 24, 72 - 46))
            if wimg is not None:
                big.alpha_composite(wimg, (0, 0))
            im = big.crop((56, 26, 104, 74))
        _paste(cv, im, x, y, 3)
        B.text(cv, frame, x + 4, y + 48 * 3 + 2, 'rb_small', INK)
    cv.convert('RGB').save(path)


def build(preview):
    board(os.path.join(preview, 'style_board_looks.png'))
    accessories_board(os.path.join(preview, 'style_board_accessories.png'))


def accessories_board(path):
    """ART10 Task 4-5: the 35 enemy accessories worn by a human (idle), 6 on other races, the 10 shop hats and
    capes, and every cosmetic icon (59)."""
    from . import cosmetics as CS
    Z, INK = 3, (0x1b, 0x18, 0x26)
    cols = 9
    cw, ch = 40 * Z + 6, 48 * Z + 16
    ids = list(CS.ACCESSORIES)
    W = cols * cw + 8
    rows = (len(ids) + cols - 1) // cols
    n_icons = len(ids) + len(CS.SHOP) + 14
    per = (W - 16) // (16 * 5 + 6)
    H = 24 + rows * ch + 24 + ch + 24 + 2 * ch + 24 + ((n_icons + per - 1) // per) * (16 * 5 + 4) + 20
    cv = Image.new('RGBA', (W, H), BG)

    def title(s, y):
        B.text(cv, s, 8, y, 'rb_large', INK)

    def cell(i, y, cid, look, label=None):
        im = LK.compose('idle_00', look, accessories=[cid] if cid else []).crop((4, 0, 44, 48))
        x = 4 + (i % cols) * cw
        yy = y + (i // cols) * ch
        _paste(cv, im, x, yy, Z)
        B.text(cv, label or cid.split('_', 1)[1].replace('_', ' '), x + 2, yy + 48 * Z + 2, 'rb_small', INK)
    base = dict(outfit='leather', hair='short', hair_color='#5a3a28')
    y = 6
    title('The 35 accessories from enemies (worn by a human, idle)', y)
    y += 24
    for i, cid in enumerate(ids):
        cell(i, y, cid, base)
    y += rows * ch + 6
    title('On other races (elf, dwarf, orc): head, back and extra items', y)
    y += 24
    others = [('acc_wolf', 'elf', 'ranger'), ('acc_stone_colossus', 'dwarf', 'plate'), ('acc_bat_swarm', 'orc', 'robe'),
              ('acc_goblin_miner', 'dwarf', 'leather'), ('acc_dragon_storm', 'elf', 'leather'),
              ('acc_enemy_king', 'orc', 'leather')]
    for i, (cid, race, outfit) in enumerate(others):
        cell(i, y, cid, dict(base, race=race, outfit=outfit, skin=1 if race != 'orc' else 0, beard='long' if race == 'dwarf' else 'none'),
             f'{cid.split("_", 1)[1].replace("_", " ")} / {race}')
    y += ch + 6
    title('The 10 shop hats and capes', y)
    y += 24
    for i, cid in enumerate(CS.SHOP):
        cell(i, y, cid, base)
    y += 2 * ch + 6
    title('Icons (16 x 16): 35 accessories, 10 shop hats and capes, 8 cloth dyes, 6 hair dyes', y)
    y += 24
    _f, icons = CS.build_frames()
    for i, name in enumerate(sorted(icons)):
        _paste(cv, icons[name], 8 + (i % per) * (16 * 5 + 6), y + (i // per) * (16 * 5 + 4), 5)
    cv.convert('RGB').save(path)
