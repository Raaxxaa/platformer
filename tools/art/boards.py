"""ART4 review boards: the movement sheet and the loot/HUD board (written to tools/out/preview/)."""
import os

import numpy as np
from PIL import Image

from . import backgrounds as B
from . import fonts as F
from . import icons as IC
from . import items as I
from . import objects as OB
from . import outfits as O
from . import palette as P
from . import preview as V
from . import tiles as T
from . import ui as U
from . import weapons as WP
from .poses.player import POSES

MOVES = ['idle', 'run', 'skid', 'jump', 'apex', 'fall', 'double_jump', 'wall_jump', 'land', 'dash', 'wall_slide',
         'ledge_climb', 'slide', 'crawl', 'dive_windup', 'dive_fall', 'dive_land', 'hurt', 'dead', 'drink', 'cart_ride']


def text(img, s, x, y, font='rb_small', color=(255, 255, 255), right=False):
    """Draw text with the real glyphs (white glyph × color, ink outline)."""
    sc, outline, *_ = F.FONTS[font]
    parts, cx = [], 0
    for ch in s:
        g = F._render(ch, sc, outline).astype(np.float32)
        white = (g[:, :, 0] == 255) & (g[:, :, 3] == 255)
        for i in range(3):
            g[:, :, i][white] = color[i]
        parts.append((cx, Image.fromarray(g.astype(np.uint8), 'RGBA')))
        adv = 4 * sc if ch == ' ' else (6 * sc if ch.isdigit() else len(F.GLYPHS[ch][0]) * sc + sc)
        cx += adv
    if right:
        x -= cx
    off = -1 if outline else 0
    for dx, im in parts:
        img.alpha_composite(im, (x + dx + off, y + off))


def player(outfit, pose, cls=None):
    b, ta, tb = O.draw_player(outfit, pose)
    col = P.CLASS_COLORS[cls or outfit]
    return V.compose_player(b, ta, tb, col, col)


def moves_board(path):
    label_w, cell = 70, 50
    rows = []
    for key in MOVES:
        n = len(POSES[key])
        rows.append((key, n))
    W = label_w + max(n for _k, n in rows) * 4 * cell + 8
    H = len(rows) * (cell + 4) + 8
    im = Image.new('RGBA', (W, H), (0x78, 0xb1, 0x8b, 255))
    y = 4
    for key, n in rows:
        text(im, key, 4, y + 20, 'rb_small_plain', (0x1b, 0x18, 0x26))
        x = label_w
        for o in O.OUTFITS:
            for p in POSES[key]:
                im.alpha_composite(player(o, p), (x, y))
                x += cell
            x += 6
        y += cell + 4
    im.resize((W * 3, H * 3), Image.NEAREST).convert('RGB').save(path)


def loot_board(path):
    W, H = 640, 360
    scene = Image.new('RGBA', (W, H))
    for i in range(3):
        scene.alpha_composite(B.render('plains', i))
    sheet = T.build_sheet('plains')
    g = np.zeros((23, 40), bool)
    g[19:, :] = True
    idx = T.autotile(g)
    for y in range(23):
        for x in range(40):
            if idx[y, x] >= 0:
                scene.alpha_composite(T.cell_image(sheet, idx[y, x]), (x * 16, y * 16))
    for x in range(0, 40, 3):                                           # top decorations
        v = (x * 5) % 8
        scene.alpha_composite(sheet.crop((1 + (8 + v) * 18, 1 + 7 * 18, 1 + (8 + v) * 18 + 16, 1 + 7 * 18 + 16)),
                              (x * 16, 18 * 16))
    gy = 19 * 16
    it = I.build_frames()
    ob = OB.frames()
    x = 262
    for k in ('chest_key_closed_00', 'chest_key_open_00', 'chest_timed_closed_00', 'chest_timed_open_00',
              'chest_cursed_closed_00', 'chest_cursed_open_00'):
        scene.alpha_composite(it[k], (x, gy - 16))
        x += 28
    scene.alpha_composite(it['lucky_block_idle_00'], (420, gy - 56))
    scene.alpha_composite(it['key_00'], (432, gy - 16))
    for i in range(4):
        scene.alpha_composite(it[f'coin_spin_{i:02d}'], (450 + i * 10, gy - 10))
    scene.alpha_composite(it['blueprint_00'], (492, gy - 16))
    # ground weapons of each grade, two ground abilities
    for k, (wid, gr) in enumerate(zip(('greatsword', 'war_maul', 'katana', 'bow', 'staff'), 'FCBAS')):
        gx, gy2 = 514 + k * 18, gy - 17
        col = P.GRADE_COLORS[gr]
        if gr in 'AS':
            beam = np.array(it['beam_00']).astype(np.float32)
            for c in range(3):
                beam[:, :, c] *= col[c] / 255
            beam[:, :, 3] *= 0.35
            scene.alpha_composite(Image.fromarray(beam.astype(np.uint8), 'RGBA'), (gx + 7, gy2 - 40))
        glow = np.array(it[f'glow_weapon_{wid}']).astype(np.float32)
        for c in range(3):
            glow[:, :, c] *= col[c] / 255
        scene.alpha_composite(Image.fromarray(glow.astype(np.uint8), 'RGBA'), (gx - 1, gy2 - 1))
        scene.alpha_composite(IC.weapon_icon(wid), (gx, gy2))
    for k, aid in enumerate(('blade_dash', 'thunder_strike')):
        gx = 604 + k * 18
        cc = P.CLASS_COLORS[IC.ABILITY_CLASS[aid]]
        glow = np.array(it[f'glow_ability_{aid}']).astype(np.float32)
        for c in range(3):
            glow[:, :, c] *= cc[c] / 255
        scene.alpha_composite(Image.fromarray(glow.astype(np.uint8), 'RGBA'), (gx - 1, gy - 18))
        scene.alpha_composite(IC.ability_icon(aid), (gx, gy - 17))
    # doors: arena door and the timed door in its 3 lamp states
    for k, cap in enumerate(('arena_door_cap_00', 'timed_door_cap_pending_00', 'timed_door_cap_open_00',
                             'timed_door_cap_missed_00')):
        door = 'arena_door' if k == 0 else 'timed_door'
        dx = 140 + k * 0
        dx = [176, 196, 216, 236][k]
        for j, part in enumerate([cap, f'{door}_mid_00', f'{door}_mid_00', f'{door}_bottom_00']):
            scene.alpha_composite(ob[part], (dx, gy - 64 + j * 16))
    for i, a in enumerate((0, 1, 2, 7)):
        scene.alpha_composite(ob[f'guide_arrow_{a:02d}'], (300 + i * 20, gy - 44))
    # the player: dashing with the Greatsword, smashing with the War Maul
    sm = WP.build_frames('war_maul')
    for (px, key, frame_key, wid) in ((96, 'dash', None, 'greatsword'), (134, 'atk_war_maul_2', 2, 'war_maul')):
        if key == 'dash':
            scene.alpha_composite(player('swordsman', POSES['dash'][1]), (px - 24, gy - 46))
        else:
            pose = POSES[key][frame_key]
            scene.alpha_composite(sm[f'{key}_smear'], (px - 80, gy - 72))
            scene.alpha_composite(player('tank', pose), (px - 24, gy - 46))
            scene.alpha_composite(sm[f'{key}_{frame_key:02d}'], (px - 80, gy - 72))
    # mock HUD (07 §4.1)
    ui = U.build_frames()
    hud = Image.new('RGBA', (W, H))
    d = np.zeros((12, 160, 4), np.uint8)
    d[:, :] = P.UI_COLORS['ink'] + (255,)
    d[1:11, 1:120] = P.UI_COLORS['hp'] + (255,)
    d[1:11, 120:159] = P.UI_COLORS['slotEmpty'] + (255,)
    hud.alpha_composite(Image.fromarray(d, 'RGBA'), (20, 8))
    text(hud, '87/100', 184, 10)
    for i, (fill, col) in enumerate(((46, 'rush1'), (20, 'rush2'), (0, 'rush3'))):
        r = np.zeros((6, 48, 4), np.uint8)
        r[:, :] = P.UI_COLORS['ink'] + (255,)
        r[1:5, 1:47] = P.UI_COLORS['slotEmpty'] + (255,)
        r[1:5, 1:1 + fill] = P.UI_COLORS[col] + (255,)
        hud.alpha_composite(Image.fromarray(r, 'RGBA'), (8 + 50 * i, 22))
    for i, k in enumerate(('full', 'full', 'empty')):
        hud.alpha_composite(ui[f'hud_flask_{k}'], (8 + 12 * i, 30))
    hud.alpha_composite(ui['hud_coin'], (62, 34))
    text(hud, '128', 72, 34, color=P.UI_COLORS['highlight'])
    hud.alpha_composite(ui['hud_key'], (104, 33))
    text(hud, '2', 113, 34)
    for i, e in enumerate(('effect_swift', 'effect_golden_touch', 'effect_curse_hunted')):
        hud.alpha_composite(ui[e], (9 + 14 * i, 55))
    text(hud, 'SWORDSMAN', 8, 285, color=P.CLASS_COLORS['swordsman'])
    for bx, icon in ((8, 'icon_weapon_greatsword'), (36, 'icon_weapon_war_maul'), (72, 'icon_ability_blade_dash'),
                     (100, 'icon_ability_whirlwind')):
        box = np.zeros((24, 24, 4), np.uint8)
        box[:, :] = P.UI_COLORS['ink'] + (255,)
        box[1:23, 1:23] = P.UI_COLORS['panel'] + (255,)
        hud.alpha_composite(Image.fromarray(box, 'RGBA'), (bx, 320))
        hud.alpha_composite(ui[icon], (bx + 4, 324))
    hud.alpha_composite(ui['class_swordsman'], (74, 346))
    text(hud, '1:52.47', 632, 8, 'rb_large', right=True)
    text(hud, 'Plains  +0:01.3', 632, 27, color=P.UI_COLORS['good'], right=True)
    scene.alpha_composite(hud)
    scene.resize((1280, 720), Image.NEAREST).convert('RGB').save(path)


def build(preview):
    moves_board(os.path.join(preview, 'player_moves_board.png'))
    loot_board(os.path.join(preview, 'style_board_loot.png'))
