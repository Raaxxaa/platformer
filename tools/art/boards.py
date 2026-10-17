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


def stretch9(img, c, w, h):
    """Draw a 9-slice frame at w × h: corners as is, edges and middle repeated."""
    a = np.array(img)
    fh, fw = a.shape[:2]
    xs = [x if x < c else (fw - (w - x) if x >= w - c else c) for x in range(w)]
    ys = [y if y < c else (fh - (h - y) if y >= h - c else c) for y in range(h)]
    return Image.fromarray(a[np.ix_(ys, xs)], 'RGBA')


def _alpha(img, f):
    a = np.array(img).astype(np.float32)
    a[:, :, 3] *= f
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def _tint(img, col):
    a = np.array(img)
    m = a[:, :, 3] > 0
    a[m, :3] = col
    return Image.fromarray(a, 'RGBA')


def ui_mock(path):
    """ART5 Task 8: the HUD over the Plains (07 §4.1), an item card with two slot choices (§6.1), and the pause
    menu on its LOADOUT tab (§7.x), drawn with the new plates and popup skin. Saved at 2×."""
    fr = U.build_frames()
    Uc = P.UI_COLORS
    scr = Image.new('RGBA', (640, 360))
    for i in range(3):
        scr.alpha_composite(Image.open(os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'assets', 'bg',
                                                    f'bg_plains_{i}.png')).convert('RGBA'))
    # HUD plates and heart + HP
    scr.alpha_composite(_alpha(stretch9(fr['hud_plate_9'], 8, 196, 48), 0.75), (4, 4))
    scr.alpha_composite(_alpha(stretch9(fr['hud_plate_9'], 8, 128, 76), 0.75), (4, 280))
    scr.alpha_composite(fr['hud_heart'], (8, 9))
    bar = Image.new('RGBA', (160, 12), Uc['ink'] + (255,))
    bar.paste(Image.new('RGBA', (int(158 * 0.87), 10), Uc['hp'] + (255,)), (1, 1))
    scr.alpha_composite(bar, (20, 8))
    text(scr, '87/100', 184, 10, color=Uc['text'])
    for i, f in enumerate((1.0, 0.5, 0.0)):
        seg = Image.new('RGBA', (48, 6), Uc['ink'] + (255,))
        if f:
            seg.paste(Image.new('RGBA', (int(46 * f), 4), Uc[f'rush{i + 1}'] + (255,)), (1, 1))
        scr.alpha_composite(seg, (8 + 50 * i, 22))
    for i in range(3):
        scr.alpha_composite(fr['hud_flask_full' if i < 2 else 'hud_flask_empty'], (8 + 12 * i, 30))
    scr.alpha_composite(fr['hud_coin'], (62, 34))
    text(scr, '128', 72, 34, color=Uc['text'])
    scr.alpha_composite(fr['hud_key'], (104, 33))
    text(scr, '1', 113, 34, color=Uc['text'])
    text(scr, 'Swordsman', 8, 285, color=Uc['class_swordsman'])
    for x, k in ((8, 'icon_weapon_katana'), (36, 'icon_weapon_greatsword'), (72, 'icon_ability_blade_dash'),
                 (100, 'icon_ability_whirlwind')):
        scr.alpha_composite(stretch9(fr['button_9'], 4, 24, 24), (x, 320))
        scr.alpha_composite(fr[k], (x + 4, 324))
    text(scr, '1:52.47', 632, 8, font='rb_large', color=Uc['text'], right=True)
    # item card: a weapon with both slots full
    cw, ch = 200, 70
    cx, cy = 300, 170
    scr.alpha_composite(stretch9(fr['panel_9'], 8, cw, ch), (cx, cy))
    scr.alpha_composite(_tint(stretch9(fr['panel_9_edge'], 8, cw, ch), Uc['grade_A']), (cx, cy))
    scr.alpha_composite(fr['icon_weapon_storm_hammer'], (cx + 8, cy + 8))
    text(scr, 'Storm Hammer', cx + 28, cy + 8, color=Uc['grade_A'])
    text(scr, 'A', cx + cw - 10, cy + 8, color=Uc['grade_A'], right=True)
    text(scr, 'Hammer - Lightning', cx + 28, cy + 18, color=Uc['textDim'])
    scr.alpha_composite(stretch9(fr['button_9_sel'], 4, cw - 16, 12), (cx + 8, cy + 30))
    scr.alpha_composite(fr['cursor'], (cx + 2, cy + 33))
    text(scr, '[J] Katana C  DMG 125  +75', cx + 12, cy + 32, color=Uc['text'])
    scr.alpha_composite(stretch9(fr['button_9'], 4, cw - 16, 12), (cx + 8, cy + 43))
    text(scr, '[K] Greatsword B  DMG 150  +50', cx + 12, cy + 45, color=Uc['text'])
    text(scr, '[E] Swap', cx + 8, cy + 58, color=Uc['highlight'])
    # pause menu, LOADOUT tab, as a second screen
    pz = Image.new('RGBA', (640, 360))
    pz.alpha_composite(scr)
    pz.alpha_composite(Image.new('RGBA', (640, 360), (0, 0, 0, 140)))
    pz.alpha_composite(stretch9(fr['panel_9'], 8, 360, 220), (140, 70))
    for i, (name, on) in enumerate((('MENU', False), ('LOADOUT', True), ('CONTROLS', False))):
        x = 152 + i * 72
        pz.alpha_composite(stretch9(fr['tab_on_9' if on else 'tab_off_9'], 4, 66, 14), (x, 58))
        text(pz, name, x + 6, 61, color=Uc['text'] if on else Uc['textDim'])
    rows = [('icon_weapon_katana', 'Katana', 'C', Uc['grade_C']),
            ('icon_weapon_greatsword', 'Greatsword', 'B', Uc['grade_B']),
            ('icon_ability_blade_dash', 'Blade Dash', 'Lv 2', Uc['class_swordsman']),
            ('icon_ability_whirlwind', 'Whirlwind', 'Lv 1', Uc['class_swordsman'])]
    for i, (ic, name, badge, col) in enumerate(rows):
        y = 86 + i * 28
        pz.alpha_composite(stretch9(fr['button_9_sel' if i == 0 else 'button_9'], 4, 328, 24), (156, y))
        pz.alpha_composite(fr[ic], (160, y + 4))
        text(pz, name, 182, y + 4, color=col)
        text(pz, badge, 478, y + 4, color=col, right=True)
    pz.alpha_composite(fr['cursor'], (148, 94))
    text(pz, 'Swordsman', 160, 210, color=Uc['class_swordsman'])
    text(pz, 'Add a 2nd Swordsman ability for its bond', 160, 222, color=Uc['textDim'])
    # 9-slice frames themselves, 4× in a strip
    strip = Image.new('RGBA', (640, 40), Uc['panel'] + (255,))
    x = 8
    for k in ('hud_heart', 'hud_plate_9', 'panel_9', 'panel_9_edge', 'tab_on_9', 'tab_off_9', 'button_9',
              'button_9_sel', 'cursor'):
        strip.alpha_composite(fr[k], (x, 8))
        x += fr[k].width + 10
    out = Image.new('RGBA', (640, 760), Uc['ink'] + (255,))
    out.alpha_composite(scr, (0, 0))
    out.alpha_composite(pz, (0, 360))
    out.alpha_composite(strip, (0, 720))
    out.resize((1280, 1520), Image.NEAREST).save(path)


def build(preview):
    moves_board(os.path.join(preview, 'player_moves_board.png'))
    loot_board(os.path.join(preview, 'style_board_loot.png'))
    ui_mock(os.path.join(preview, 'ui_mock.png'))
