"""Stage 2 style boards (08 §12.7): style_board_mountains.png and style_board_swamps.png, 640 x 360 at 2x."""
import os

import numpy as np
from PIL import Image

from . import backgrounds as B
from . import icons as IC
from . import items as I
from . import palette as P
from . import preview as V
from . import tiles as T
from .enemies import mountains
from .outfits import OUTFITS, draw, render
from .poses.player import POSES
from .style_board import _fill, _tint_white, TELE, TELE_ALPHA

GROUND = 19


def _cell(sheet, c, r):
    x, y = 1 + c * 18, 1 + r * 18
    return sheet.crop((x, y, x + 16, y + 16))


def players_row(scene, gy, x0=28, step=30):
    for k, o in enumerate(OUTFITS):
        b, ta, tb = render(draw(o, POSES['idle'][0]))
        col = P.CLASS_COLORS[o]
        img = V.compose_player(b, ta, tb, col, col)
        scene.alpha_composite(img, (x0 + k * step - 24, gy - 46))


def loot(scene, gy, x0=470):
    it = I.build_frames()
    scene.alpha_composite(it['chest_key_closed_00'], (146 - 12, gy - 16))
    scene.alpha_composite(it['lucky_block_idle_00'], (300 - 8, gy - 64))
    icon = IC.weapon_icon('greatsword')
    glow = it['glow_weapon_greatsword']
    for k, gr in enumerate('FCBAS'):
        x = x0 + k * 26
        col = P.GRADE_COLORS[gr]
        y = gy - 16 - 1
        if gr in 'AS':
            beam = Image.new('RGBA', (2, 40), col + (int(255 * 0.35),))
            scene.alpha_composite(beam, (x + 7, y - 40))
        scene.alpha_composite(_tint_white(glow, col), (x - 1, y - 1))
        scene.alpha_composite(icon, (x, y))


def compose_mountains():
    W, H = 640, 360
    scene = Image.new('RGBA', (W, H))
    for i in range(3):
        scene.alpha_composite(B.render('mountains', i))
    sheet = T.build_sheet('mountains')
    g = np.zeros((23, 40), bool)
    g[GROUND:, :] = True
    g[GROUND:GROUND + 2, 17:21] = False      # spike pit
    g[GROUND - 2:GROUND, 31:40] = True       # raised ledge on the right
    ice = np.zeros_like(g)
    ice[GROUND, 3:9] = True                  # an ice patch the player slides on
    ice[GROUND + 1, 3:9] = True
    idx = T.autotile(g)
    for y in range(g.shape[0]):
        for x in range(g.shape[1]):
            if idx[y, x] < 0:
                continue
            i = idx[y, x]
            if ice[y, x]:
                cell = _cell(sheet, i % 16, 4 + i // 16)
            else:
                cell = T.cell_image(sheet, i)
                if i == 46 and (x * 7 + y * 13) % 5:
                    cell = _cell(sheet, (x * 7 + y * 13) % 5 - 1, 3)
            scene.alpha_composite(cell, (x * 16, y * 16))
    for x in range(17, 21):
        scene.alpha_composite(_cell(sheet, 8, 3), (x * 16, (GROUND + 1) * 16))
    for k, x in enumerate(range(23, 28)):    # one-way platform
        scene.alpha_composite(_cell(sheet, 4 if k == 0 else (6 if x == 27 else 5), 3), (x * 16, 14 * 16))
    scene.alpha_composite(_cell(sheet, 12, 3), (29 * 16, (GROUND - 1) * 16))   # cracked wall in front
    gy = GROUND * 16
    ly = (GROUND - 2) * 16
    scene.alpha_composite(_cell(sheet, 11, 7), (10 * 16, gy - 16))
    scene.alpha_composite(_cell(sheet, 13, 7), (24 * 16, gy - 16))
    scene.alpha_composite(_cell(sheet, 8, 7), (35 * 16, ly - 16))
    scene.alpha_composite(_cell(sheet, 8, 8), (36 * 16, ly - 16))
    scene.alpha_composite(_cell(sheet, 9, 8), (37 * 16, ly - 16))
    players_row(scene, gy)
    frames, _ = mountains.build_frames()

    def place(img, x, feet_y, anchor):
        scene.alpha_composite(img, (x - anchor[0], feet_y - anchor[1]))
    place(frames['goblin_miner_idle_00'], 175, gy, (24, 46))
    place(frames['rock_golem_idle_00'], 225, gy, (24, 46))
    place(frames['ram_idle_00'], 372, gy, (24, 46))
    place(frames['goblin_miner_idle_01'], 405, 14 * 16, (24, 46))
    place(frames['bat_swarm_fly_00'], 330, gy - 46 - 30, (24, 46))
    place(frames['goblin_shaman_idle_00'], 590, ly, (64, 78))
    place(_fill(frames['rock_golem_atk_fist_slam_01'], TELE, TELE_ALPHA), 440, gy, (48, 46))
    place(_fill(frames['ram_atk_headbutt_01'], TELE, TELE_ALPHA), 520, ly, (48, 46))
    loot(scene, gy)
    return scene


def build(preview):
    scene = compose_mountains()
    path = os.path.join(preview, 'style_board_mountains.png')
    scene.resize((1280, 720), Image.NEAREST).convert('RGB').save(path)
    return path
