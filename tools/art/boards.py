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


CLASS_KITS = {'swordsman': (('greatsword', 'katana'), ('blade_dash', 'whirlwind')),
              'tank': (('war_maul', 'iron_fists'), ('shockwave', 'shoulder_charge')),
              'archer': (('bow', 'crossbow'), ('arrow_rain', 'hunters_mark')),
              'wizard': (('storm_hammer', 'staff'), ('thunder_strike', 'blink'))}
SHOT = {'bow': 'arrow_00', 'crossbow': 'bolt_00', 'staff': 'staff_bolt_00'}


def classes_board(path):
    """ART5 Task 9: one row per class: its outfit with its 2 starting weapons mid-attack, then its 2 M4 abilities
    mid-effect next to a training dummy."""
    from . import projectiles as PR
    from . import vfx as VX
    from . import village as VL
    vfx, _ = VX.build_frames()
    proj, _ = PR.build_frames()
    dummy = VL.dummy_frames()['training_dummy_idle_00']
    root = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'assets', 'bg')
    bg = Image.new('RGBA', (640, 360))
    for i in range(3):
        bg.alpha_composite(Image.open(os.path.join(root, f'bg_plains_{i}.png')).convert('RGBA'))
    RH, gy = 120, 108
    out = Image.new('RGBA', (640, RH * 4), (0, 0, 0, 255))
    for r, (cls, (weapons, abilities)) in enumerate(CLASS_KITS.items()):
        row = bg.crop((0, 360 - RH - 20, 640, 360 - 20)).copy()
        row.alpha_composite(Image.new('RGBA', (640, RH - gy), (0x3a, 0x2a, 0x22, 255)), (0, gy))
        col = P.CLASS_COLORS[cls]

        def body(pose, px):
            row.alpha_composite(player(cls, pose), (px - 24, gy - 46))

        def fx(name, cx, bottom):
            im = vfx[name]
            row.alpha_composite(im, (int(cx - im.width / 2), int(bottom - im.height)))

        # the 2 starting weapons, mid-attack (frame 2 of step 1)
        for k, wid in enumerate(weapons):
            px = 70 + k * 120
            key = WP.KEYS[wid][0]
            fr = WP.build_frames(wid)
            pose = POSES[key][2]
            if f'{key}_smear' in fr:
                row.alpha_composite(fr[f'{key}_smear'], (px - 80, gy - 72))
            body(pose, px)
            row.alpha_composite(fr[f'{key}_02'], (px - 80, gy - 72))
            if wid in SHOT:
                row.alpha_composite(proj[SHOT[wid]], (px + 34, gy - 26))
        # the 2 abilities, mid-effect, each next to a dummy
        for k, ab in enumerate(abilities):
            px, dx = 320 + k * 160, 320 + k * 160 + 64
            row.alpha_composite(dummy, (dx - 24, gy - 46))
            if ab == 'blade_dash':
                fx('blade_dash_00', px - 10, gy - 16)
                body(POSES['dash'][1], px + 30)
            elif ab == 'whirlwind':
                body(POSES['spin'][1], px + 30)
                fx('whirlwind_01', px + 30, gy - 4)
            elif ab == 'shockwave':
                body(POSES['cast_slam'][2], px + 10)
                fx('ab_shockwave_64_02', px + 10, gy)
            elif ab == 'shoulder_charge':
                fx('shoulder_lines_01', px, gy - 14)
                body(POSES['shoulder'][0], px + 30)
            elif ab == 'arrow_rain':
                body(POSES['cast_up'][1], px)
                for j, (ax, ay) in enumerate(((-14, -60), (-4, -80), (6, -50), (14, -72), (-8, -36))):
                    row.alpha_composite(vfx['arrow_rain_00'], (dx + ax, gy + ay))
            elif ab == 'hunters_mark':
                body(POSES['idle'][0], px)
                fx('mark_01', dx, gy - 46)
            elif ab == 'thunder_strike':
                body(POSES['cast_up'][1], px)
                fx('thunder_01', dx, gy)
            elif ab == 'blink':
                body(POSES['idle'][0], px + 20)
                fx('blink_puff_01', px - 20, gy)
                fx('blink_puff_00', px + 20, gy)
        text(row, cls.capitalize(), 6, 6, color=col)
        text(row, ' / '.join(w.replace('_', ' ').title() for w in weapons), 6, 18, 'rb_small', P.UI_COLORS['text'])
        text(row, ' / '.join(a.replace('_', ' ').title() for a in abilities), 320, 6, 'rb_small',
             P.UI_COLORS['text'])
        out.alpha_composite(row, (0, r * RH))
    out.resize((1280, RH * 8), Image.NEAREST).convert('RGB').save(path)


def _atlas_frame(atlas, name):
    import json
    root = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'assets', 'atlases')
    d = json.load(open(os.path.join(root, f'{atlas}.json')))
    f = d['frames'][name]['frame']
    sheet = Image.open(os.path.join(root, d['meta']['image'])).convert('RGBA')
    return sheet.crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h']))


def _mul(img, col):
    a = np.array(img).astype(np.float32)
    for i in range(3):
        a[:, :, i] *= col[i] / 255
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def _mix(img, col, f):
    a = np.array(img).astype(np.float32)
    m = a[:, :, 3] > 0
    for i in range(3):
        a[:, :, i][m] = a[:, :, i][m] * (1 - f) + col[i] * f
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def loot2_board(path):
    """ART6 Task 5: a fight on the Plains: one enemy under each status, an S Greatsword's Ground Wave, Storm Hammer
    Tempest clouds, a Lucky Block breaking and an open cursed chest."""
    from . import vfx_elements as EL
    fx = EL.frames()
    root = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'assets', 'bg')
    scr = Image.new('RGBA', (640, 360))
    for i in range(3):
        scr.alpha_composite(Image.open(os.path.join(root, f'bg_plains_{i}.png')).convert('RGBA'))
    gy = 300
    scr.alpha_composite(Image.new('RGBA', (640, 60), (0x3a, 0x2a, 0x22, 255)), (0, gy))
    grass = Image.new('RGBA', (640, 3), (0x4e, 0x7a, 0x3a, 255))
    scr.alpha_composite(grass, (0, gy))
    FIRE, ICE, BOLT = (0xff, 0x7a, 0x2e), (0x8f, 0xdc, 0xff), (0xff, 0xe9, 0x4a)

    def put(img, cx, bottom):
        scr.alpha_composite(img, (int(cx - img.width / 2), int(bottom - img.height)))

    def label(s, cx, y=gy + 10):
        text(scr, s, int(cx - len(s) * 3), y, color=P.UI_COLORS['text'])
    enemies = [('wolf', 'burning'), ('bandit', 'chilled'), ('bandit_brute', 'frozen'), ('wild_boar', 'poisoned'),
               ('bandit_archer', 'shocked')]
    xs = [250, 320, 400, 480, 560]
    for (en, st), x in zip(enemies, xs):
        im = _atlas_frame('enemies_plains', f'{en}_idle_00')
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
        aw = im.width
        if st == 'frozen':
            im = _mix(im, ICE, 0.5)
        put(im, x, gy + 2)
        top = gy - 30 if en != 'bandit_brute' else gy - 44
        if st == 'burning':
            for (dx, dy, k) in ((-9, -10, 0), (8, -16, 1), (-3, -22, 2)):
                put(fx[f'burn_flame_{k:02d}'], x + dx, gy + dy)
        elif st == 'chilled':
            for (dx, dy, k) in ((-9, -14, 1), (10, -24, 2), (-6, -30, 0), (8, -6, 1)):
                put(fx[f'chill_frost_{k:02d}'], x + dx, gy + dy)
        elif st == 'frozen':
            blk = stretch9(fx['freeze_block_00'], EL.FREEZE_CORNER, 32, 48)
            put(blk, x, gy + 2)
        elif st == 'poisoned':
            for (dx, dy, k) in ((-10, -12, 0), (10, -18, 1), (2, -24, 0)):
                put(fx[f'poison_bubble_{k:02d}'], x + dx, gy + dy)
        elif st == 'shocked':
            # the code draws the chain line; here a stand-in zigzag from the boar to the archer + the end sparks
            from PIL import ImageDraw
            d = ImageDraw.Draw(scr)
            pts = [(480, gy - 16), (500, gy - 24), (515, gy - 12), (532, gy - 22), (545, gy - 14), (560, gy - 18)]
            d.line(pts, fill=(0x7a, 0xd8, 0xff, 255), width=2)
            d.line(pts, fill=(0xff, 0xfb, 0xe0, 255), width=1)
            put(fx['chain_spark_00'], 480, gy - 13)
            put(fx['chain_spark_01'], 560, gy - 15)
        label(st, x)
    put(fx['hit_fire_01'], 250, gy - 26)
    # the player with an S Fire Greatsword, its Ground Waves rolling forward
    gs = WP.build_frames('greatsword')
    pose = POSES['atk_greatsword_1'][2]
    scr.alpha_composite(gs['atk_greatsword_1_smear'].copy() if False else _mul(gs['atk_greatsword_1_smear'], FIRE), (60 - 80, gy - 72))
    scr.alpha_composite(player('swordsman', pose), (60 - 24, gy - 46))
    scr.alpha_composite(gs['atk_greatsword_1_02'], (60 - 80, gy - 72))
    for k, x in enumerate((112, 140, 168)):
        put(_mul(fx[f'sig_ground_wave_{k:02d}'], FIRE), x, gy)
    label('Ground Wave (fire)', 120, gy + 22)
    # Tempest clouds (lightning Storm Hammer) over the fight
    for k, (x, y) in enumerate(((300, 210), (360, 196), (430, 214))):
        put(_mul(fx[f'sig_tempest_{k:02d}'], BOLT), x, y)
    label('Tempest (lightning)', 365, 170)
    # a Lucky Block breaking and an open cursed chest, up on the left
    lb = _atlas_frame('items', 'lucky_block_idle_00')
    put(lb, 60, 200)
    put(fx['lucky_break_02'], 60, 196)
    label('Lucky Block', 60, 206)
    put(_atlas_frame('items', 'chest_cursed_open_00'), 160, 200)
    put(fx['chest_open_cursed_02'], 160, 190)
    put(fx['debuff_aura_02'], 200, 200)
    label('cursed chest', 170, 206)
    scr.resize((1280, 720), Image.NEAREST).convert('RGB').save(path)


def build(preview):
    moves_board(os.path.join(preview, 'player_moves_board.png'))
    loot_board(os.path.join(preview, 'style_board_loot.png'))
    ui_mock(os.path.join(preview, 'ui_mock.png'))
    classes_board(os.path.join(preview, 'style_board_classes.png'))
    loot2_board(os.path.join(preview, 'style_board_loot2.png'))
    from . import looks_board
    looks_board.build(preview)
    from . import touch
    root = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'assets')
    touch.mock(os.path.join(preview, 'touch_mock.png'), os.path.join(root, 'bg'))
