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
    build_swamps(preview)
    build_border(preview)
    return path


# ---------------------------------------------------------------- swamps

DARK = (0x06, 0x07, 0x0a)
ZONE_ALPHA = 0.82


def darkness(scene, zone, lights, zone_alpha=ZONE_ALPHA):
    """08 §10.2: a dark zone (x0, y0, x1, y1 in px) with a 32 px ramp of 4 steps; lights cut holes.
    lights: (cx, cy, R). Where lights overlap the lowest alpha wins."""
    W, H = scene.size
    ys, xs = np.mgrid[0:H, 0:W]
    x0, y0, x1, y1 = zone
    inside = (xs >= x0) & (xs < x1) & (ys >= y0) & (ys < y1)
    edge = np.minimum.reduce([xs - x0, x1 - 1 - xs, ys - y0, y1 - 1 - ys])
    ramp = np.select([edge < 8, edge < 16, edge < 24, edge < 32], [0.2, 0.4, 0.6, 0.8], zone_alpha)
    a = np.where(inside, np.minimum(ramp, zone_alpha), 0.0).astype(np.float32)
    for cx, cy, r in lights:
        d = np.hypot(xs - cx, ys - cy)
        la = np.select([d <= 0.6 * r, d <= 0.85 * r, d <= r], [0.0, 0.4, 0.65], 1.0)
        a = np.where(inside & (la < 1.0), np.minimum(a, la), a)
    img = np.array(scene).astype(np.float32)
    for i in range(3):
        img[:, :, i] = img[:, :, i] * (1 - a) + DARK[i] * a
    return Image.fromarray(img.astype(np.uint8), 'RGBA')


def compose_swamps():
    from .enemies import swamps
    from . import objects
    W, H = 640, 360
    scene = Image.new('RGBA', (W, H))
    for i in range(3):
        scene.alpha_composite(B.render('swamps', i))
    sheet = T.build_sheet('swamps')
    g = np.zeros((23, 40), bool)
    g[GROUND:, :] = True
    g[GROUND:GROUND + 2, 12:18] = False          # water pool (ground gap)
    g[GROUND - 2:GROUND, 33:40] = True
    idx = T.autotile(g)
    for y in range(g.shape[0]):
        for x in range(g.shape[1]):
            if idx[y, x] >= 0:
                scene.alpha_composite(T.cell_image(sheet, idx[y, x]), (x * 16, y * 16))
    water = Image.new('RGBA', (W, H))
    for x in range(12, 18):
        water.alpha_composite(_cell(sheet, x % 4, 7), (x * 16, GROUND * 16))
        water.alpha_composite(_cell(sheet, 4 + x % 4, 7), (x * 16, (GROUND + 1) * 16))
    wa = np.array(water)
    wa[:, :, 3] = (wa[:, :, 3] * 0.65).astype(np.uint8)
    scene.alpha_composite(Image.fromarray(wa, 'RGBA'))
    for k, x in enumerate(range(22, 27)):        # one-way root
        scene.alpha_composite(_cell(sheet, 4 if k == 0 else (6 if x == 26 else 5), 3), (x * 16, 14 * 16))
    gy, ly = GROUND * 16, (GROUND - 2) * 16
    for x, c in ((3, 8), (6, 12), (9, 10), (20, 9), (24, 13)):
        scene.alpha_composite(_cell(sheet, c, 7), (x * 16, gy - 16))
    players_row(scene, gy)
    frames, _ = swamps.build_frames()
    fr = objects.stage2_frames()

    def place(img, x, feet_y, anchor):
        scene.alpha_composite(img, (x - anchor[0], feet_y - anchor[1]))
    place(frames['bog_zombie_idle_00'], 185, gy, (24, 46))
    place(frames['giant_spider_idle_00'], 262, gy, (24, 46))
    place(frames['swamp_witch_idle_00'], 358, 14 * 16, (24, 46))
    place(frames['wisp_float_00'], 320, gy - 70, (24, 46))
    place(_fill(frames['swamp_witch_atk_poison_potion_01'], TELE, TELE_ALPHA), 300, gy, (48, 46))
    place(_fill(frames['bog_zombie_atk_claw_01'], TELE, TELE_ALPHA), 440, gy, (48, 46))
    place(frames['treant_idle_00'], 600, ly, (64, 78))
    loot(scene, gy, x0=470)
    # a dark zone on the right: lit by the player (R 112), three fireflies (R 40) and the Wisp (R 32)
    px, py = 552, gy - 22
    tmp = Image.new('RGBA', (W, H))
    b, ta, tb = render(draw('wizard', POSES['idle'][0]))
    col = P.CLASS_COLORS['wizard']
    tmp.alpha_composite(V.compose_player(b, ta, tb, col, col), (px - 24, gy - 46))
    flies = ((470, 250), (526, 200), (610, 232))
    lights = [(px, py, 112), (320, gy - 77, 32)] + [(fx, fy, 40) for fx, fy in flies]
    scene = darkness(scene, (320, 0, 640, 360), lights)
    scene.alpha_composite(tmp)
    for k, (fx, fy) in enumerate(flies):
        scene.alpha_composite(fr[f'firefly_{k:02d}'], (fx - 2, fy - 2))
    scene.alpha_composite(frames['wisp_float_00'], (320 - 24, gy - 70 - 46))
    glint = Image.new('RGBA', (2, 1), P.RAMPS['en_glow'][1] + (255,))            # eye glints above the darkness
    for gx, gy_ in ((600 - 3, ly - 44), (600 + 4, ly - 44)):
        scene.alpha_composite(glint, (gx, gy_))
    return scene


def compose_border(cam_x=112, cam_y=8):
    """The Border Village with the Crossroads layout (06 §12.2): mountain backdrop, stone floor, slate roofs."""
    from . import npcs, village as VL
    from .style_board import _tint_trim
    W, H = 640, 360
    scene = Image.new('RGBA', (W, H))
    for i in range(3):
        scene.alpha_composite(B.render('village_border', i))
    world = Image.new('RGBA', (48 * 16, 23 * 16))
    obj = VL.all_frames()
    npc, _ = npcs.build_frames()

    def put(img, cx, bottom=VL.FLOOR_Y):
        world.alpha_composite(img, (int(cx - img.width // 2), int(bottom - img.height)))
    tile = lambda t: t * 16 + 8   # noqa: E731
    roof = obj['market_roof_border_00']
    world.alpha_composite(roof, (7 * 16, VL.FLOOR_Y - roof.height))
    world.alpha_composite(obj['inn_border_00'], VL.INN_ORIGIN)
    sheet = T.build_sheet('mountains')
    g = np.zeros((23, 48), bool)
    g[20:, :] = True
    g[:, 0] = g[:, 47] = True
    idx = T.autotile(g)
    for y in range(17, 23):
        for x in range(48):
            if idx[y, x] >= 0:
                world.alpha_composite(T.cell_image(sheet, idx[y, x]), (x * 16, y * 16))
    put(npc['merchant_idle_00'], tile(37.5), VL.FLOOR_Y + 2)
    put(npc['shopkeeper_wave_01'], tile(17), VL.FLOOR_Y + 2)
    put(npc['innkeeper_idle_00'], tile(44.6), VL.FLOOR_Y + 2)
    for frame, tx in VL.LAYOUT['crossroads']:
        img = obj[frame]
        if frame.startswith('ability_altar'):
            img = _tint_trim(obj['ability_altar_idle_01'], P.CLASS_COLORS['archer' if tx == 19 else 'wizard'])
        put(img, tx * 16 + 8)
    b, ta, tb = render(draw('swordsman', POSES['idle'][0]))
    col = P.CLASS_COLORS['none']
    put(V.compose_player(b, ta, tb, col, col), tile(7), VL.FLOOR_Y + 2)
    scene.alpha_composite(world.crop((cam_x, cam_y, cam_x + W, cam_y + H)))
    return scene


def build_border(preview):
    path = os.path.join(preview, 'style_board_village_border.png')
    compose_border().resize((1280, 720), Image.NEAREST).convert('RGB').save(path)
    return path


def build_swamps(preview):
    path = os.path.join(preview, 'style_board_swamps.png')
    compose_swamps().resize((1280, 720), Image.NEAREST).convert('RGB').save(path)
    return path
