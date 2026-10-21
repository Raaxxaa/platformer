"""ART8 style boards (08 §12.7): kingdom, castle, bosses and weapons. 640 x 360 scenes shown at 2x."""
import os

import numpy as np
from PIL import Image

from . import backgrounds as B
from . import palette as P
from . import tiles as T
from . import weapons as WP
from . import world34
from .boards import text
from .poses.player import POSES
from .style_board import _fill, TELE, TELE_ALPHA
from .style_board_stage2 import GROUND, _cell, loot, players_row
from .outfits import draw_player

DOCS = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'docs', 'art')


def _save(scene, preview, name):
    big = scene.resize((scene.width * 2, scene.height * 2), Image.NEAREST).convert('RGB')
    big.save(os.path.join(preview, name + '.png'))
    if os.path.isdir(DOCS):
        big.save(os.path.join(DOCS, name + '_v1.png'))


def _terrain(scene, set_name, g, sheet):
    idx = T.autotile(g)
    for y in range(g.shape[0]):
        for x in range(g.shape[1]):
            if idx[y, x] < 0:
                continue
            i = idx[y, x]
            cell = T.cell_image(sheet, i)
            if i == 46 and (x * 7 + y * 13) % 5:
                cell = _cell(sheet, (x * 7 + y * 13) % 5 - 1, 3)
            scene.alpha_composite(cell, (x * 16, y * 16))


def _place(scene, img, x, feet_y, anchor):
    scene.alpha_composite(img, (int(x - anchor[0]), int(feet_y - anchor[1])))


def compose_kingdom():
    from .enemies import kingdom
    from .bosses import black_knight
    from . import objects34
    W, H = 640, 360
    scene = Image.new('RGBA', (W, H))
    for i in range(3):
        scene.alpha_composite(world34.render('kingdom', i))
    sheet = T.build_sheet('kingdom')
    g = np.zeros((23, 40), bool)
    g[GROUND:, :] = True
    g[GROUND:GROUND + 2, 17:21] = False
    g[GROUND - 2:GROUND, 33:40] = True
    _terrain(scene, 'kingdom', g, sheet)
    for x in range(17, 21):
        scene.alpha_composite(_cell(sheet, 8, 3), (x * 16, (GROUND + 1) * 16))
    for k, x in enumerate(range(22, 27)):
        scene.alpha_composite(_cell(sheet, 4 if k == 0 else (6 if x == 26 else 5), 3), (x * 16, 14 * 16))
    gy, ly = GROUND * 16, (GROUND - 2) * 16
    for x, c in ((2, 8), (5, 9), (8, 11), (12, 15), (14, 8)):
        scene.alpha_composite(_cell(sheet, c, 7), (x * 16, gy - 16))
    scene.alpha_composite(_cell(sheet, 12, 3), (31 * 16, (GROUND - 1) * 16))
    players_row(scene, gy)
    frames, _ = kingdom.build_frames()
    bk, _ = black_knight.build_frames()
    ob = objects34.frames()
    _place(scene, frames['soldier_idle_00'], 175, gy, (24, 46))
    _place(scene, frames['crossbowman_idle_00'], 225, gy, (24, 46))
    _place(scene, frames['war_hound_idle_00'], 268, gy, (24, 46))
    _place(scene, frames['battle_mage_idle_00'], 372, gy, (24, 46))
    _place(scene, frames['knight_idle_00'], 590, ly, (64, 78))
    _place(scene, _fill(frames['soldier_atk_sword_thrust_01'], TELE, TELE_ALPHA), 320, gy, (48, 46))
    _place(scene, bk['idle_00'], 430, gy, (72, 94))
    # a cannon on the right ledge, muzzle glowing while it telegraphs, firing left, and a ball in flight
    cn = ob['cannon_idle_00'].transpose(Image.FLIP_LEFT_RIGHT)
    gl = ob['cannon_glow_00'].transpose(Image.FLIP_LEFT_RIGHT)
    scene.alpha_composite(cn, (36 * 16 - 12, ly - 16))
    scene.alpha_composite(gl, (36 * 16 - 12, ly - 16))
    from . import projectiles_stage34 as S34
    scene.alpha_composite(S34.cannonball(), (36 * 16 - 60, ly - 14))
    loot(scene, gy, x0=480)
    return scene


def compose_weapons():
    """Every new weapon mid-attack on the Plains, in its own cell (wizard / swordsman / tank / archer outfits)."""
    W, H = 640, 360
    scene = Image.new('RGBA', (W, H))
    for i in range(3):
        scene.alpha_composite(B.render('plains', i))
    scene.alpha_composite(Image.new('RGBA', (W, 120), (0x3a, 0x2a, 0x22, 255)), (0, 280))
    wl = [('twin_daggers', 'swordsman', 3), ('spear', 'swordsman', 2), ('scythe', 'wizard', 2), ('giant_axe', 'tank', 2),
          ('flail', 'tank', 2), ('shield', 'tank', 1), ('hand_cannon', 'archer', 2), ('javelin', 'archer', 1),
          ('throwing_knives', 'archer', 1), ('wand', 'wizard', 2), ('spell_tome', 'wizard', 1)]
    from . import projectiles_stage34 as S34
    shots = {'hand_cannon': (S34.cannonball(), 34, -22), 'javelin': (S34.javelin(), 34, -26),
             'throwing_knives': (S34.knife(), 36, -24), 'wand': (S34.wand_shot(0), 34, -24)}
    cols = 4
    cell_w, cell_h = 160, 120
    for k, (wid, outfit, step) in enumerate(wl):
        key = WP.KEYS[wid][min(step, len(WP.KEYS[wid]) - 1) if wid != 'shield' else 1]
        if wid == 'shield':
            key = 'atk_shield_bash'
        elif wid == 'spear':
            key = 'atk_spear_lunge'
        elif wid == 'spell_tome':
            key = 'atk_spell_tome_1'
        elif wid == 'giant_axe':
            key = 'atk_giant_axe_spin'
        else:
            key = WP.KEYS[wid][0]
        fr = WP.build_frames(wid)
        cx = (k % cols) * cell_w + 56
        gyc = (k // cols) * cell_h + 110
        i = 2
        pose = POSES[key][i]
        col = P.CLASS_COLORS[outfit]
        from .preview import compose_player
        b, ta, tb = draw_player(outfit, pose)
        body = compose_player(b, ta, tb, col, col)
        if f'{key}_smear' in fr:
            scene.alpha_composite(fr[f'{key}_smear'], (cx - 80, gyc - 72))
        scene.alpha_composite(body, (cx - 24, gyc - 46))
        scene.alpha_composite(fr[f'{key}_{i:02d}'], (cx - 80, gyc - 72))
        if wid in shots:
            img, dx, dy = shots[wid]
            scene.alpha_composite(img, (cx + dx, gyc + dy))
        text(scene, wid.replace('_', ' ').title(), (k % cols) * cell_w + 6, (k // cols) * cell_h + 6,
             color=P.UI_COLORS['text'])
    # the stuck javelin platform and a rune ring in the last cell
    cx, gyc = (11 % cols) * cell_w + 20, (11 // cols) * cell_h + 100
    scene.alpha_composite(S34.javelin_platform(), (cx, gyc - 30))
    for r in range(4):
        scene.alpha_composite(S34.rune(r), (cx + 70 + int(24 * np.cos(r * np.pi / 2)), gyc - 60 + int(14 * np.sin(r * np.pi / 2))))
    text(scene, 'Javelin platform / Rune Ring', cx - 14, (11 // cols) * cell_h + 6, color=P.UI_COLORS['text'])
    return scene


def build(preview):
    _save(compose_kingdom(), preview, 'style_board_kingdom')
    _save(compose_weapons(), preview, 'style_board_weapons')
    try:
        from . import style_board_castle
        style_board_castle.build(preview, _save)
    except ImportError:
        pass
