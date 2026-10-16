"""Plains style board (08 §12.7): a 640 × 360 mock scene written at 2×."""
import os

import numpy as np
from PIL import Image

from . import backgrounds as B
from . import icons as IC
from . import items as I
from . import palette as P
from . import preview as V
from . import tiles as T
from .enemies import plains
from .outfits import OUTFITS, draw, render
from .poses.player import POSES

TELE = (0xff, 0x8a, 0x1f)          # 08 §5.3 telegraph overlay
TELE_ALPHA = 0.55
GROUND = 19                        # first ground row (cells)


def _fill(img, color, alpha):
    a = np.array(img).astype(np.float32)
    m = a[:, :, 3] > 0
    for i in range(3):
        a[:, :, i][m] = a[:, :, i][m] * (1 - alpha) + color[i] * alpha
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def _tint_white(img, color, alpha=1.0):
    a = np.array(img).astype(np.float32)
    for i in range(3):
        a[:, :, i] = a[:, :, i] * color[i] / 255.0
    a[:, :, 3] *= alpha
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def grid():
    g = np.zeros((23, 40), bool)
    g[GROUND:, :] = True
    g[GROUND:GROUND + 2, 17:21] = False      # spike pit
    g[GROUND - 2:GROUND, 31:40] = True       # raised ledge on the right
    return g


def compose():
    W, H = 640, 360
    scene = Image.new('RGBA', (W, H))
    for i in range(3):
        scene.alpha_composite(B.render('plains', i))
    sheet = T.build_sheet('plains')
    g = grid()
    idx = T.autotile(g)
    for y in range(g.shape[0]):
        for x in range(g.shape[1]):
            if idx[y, x] >= 0:
                cell = T.cell_image(sheet, idx[y, x])
                if idx[y, x] == 46 and (x * 7 + y * 13) % 5:
                    v = (x * 7 + y * 13) % 5 - 1
                    cell = sheet.crop((1 + v * 18, 1 + 3 * 18, 1 + v * 18 + 16, 1 + 3 * 18 + 16))
                scene.alpha_composite(cell, (x * 16, y * 16))

    def cell(c, r):
        x, y = 1 + c * 18, 1 + r * 18
        return sheet.crop((x, y, x + 16, y + 16))
    for x in range(17, 21):                                   # spikes on the pit floor
        scene.alpha_composite(cell(8, 3), (x * 16, (GROUND + 1) * 16))
    for k, x in enumerate(range(23, 28)):                     # one-way platform
        c = 4 if k == 0 else (6 if x == 27 else 5)
        scene.alpha_composite(cell(c, 3), (x * 16, 14 * 16))

    gy = GROUND * 16                                          # ground surface y
    ly = (GROUND - 2) * 16                                    # ledge surface y

    def place(img, x, feet_y, anchor):
        scene.alpha_composite(img, (x - anchor[0], feet_y - anchor[1]))

    # players: the 4 outfits, trims tinted in the class colors
    for k, o in enumerate(OUTFITS):
        b, ta, tb = render(draw(o, POSES['idle'][0]))
        col = P.CLASS_COLORS[o]
        place(V.compose_player(b, ta, tb, col, col), 28 + k * 30, gy, (24, 46))
    frames, _ = plains.build_frames()
    # enemies, idle frame 0
    place(frames['wolf_idle_00'], 168, gy, (24, 46))
    place(frames['bandit_idle_00'], 220, gy, (24, 46))
    place(frames['bandit_archer_idle_00'], 400, 14 * 16, (24, 46))
    place(frames['wild_boar_idle_00'], 380, gy, (24, 46))
    place(frames['bandit_brute_idle_00'], 590, ly, (64, 78))
    # telegraphs: wolf and bandit in a Tele frame with the orange overlay
    place(_fill(frames['wolf_atk_lunge_bite_01'], TELE, TELE_ALPHA), 440, gy, (48, 46))
    place(_fill(frames['bandit_atk_slash_01'], TELE, TELE_ALPHA), 530, ly, (48, 46))
    # chest and Lucky Block
    it = I.build_frames()
    scene.alpha_composite(it['chest_key_closed_00'], (130 - 12, gy - 16))
    scene.alpha_composite(it['lucky_block_idle_00'], (300 - 8, gy - 64))
    # Greatsword on the ground in each grade color; A and S get light beams
    icon = IC.weapon_icon('greatsword')
    glow = it['glow_weapon_greatsword']
    for k, gr in enumerate('FCBAS'):
        x = 470 + k * 26
        col = P.GRADE_COLORS[gr]
        y = gy - 16 - 1
        if gr in 'AS':
            beam = Image.new('RGBA', (2, 40), col + (int(255 * 0.35),))
            scene.alpha_composite(beam, (x + 7, y - 40))
        scene.alpha_composite(_tint_white(glow, col), (x - 1, y - 1))
        scene.alpha_composite(icon, (x, y))
    return scene


def build(preview):
    scene = compose()
    out = scene.resize((1280, 720), Image.NEAREST).convert('RGB')
    path = os.path.join(preview, 'style_board_plains.png')
    out.save(path)
    return path


# ---------------------------------------------------------------- village board (ART3)

def _tint_trim(img, color):
    """Multiply only the tintable trim grays (#707070, #b0b0b0, #ffffff) by `color`."""
    a = np.array(img).astype(np.float32)
    grays = [(0x70, 0x70, 0x70), (0xb0, 0xb0, 0xb0), (0xff, 0xff, 0xff)]
    m = np.zeros(a.shape[:2], bool)
    for g in grays:
        m |= (a[:, :, 0] == g[0]) & (a[:, :, 1] == g[1]) & (a[:, :, 2] == g[2]) & (a[:, :, 3] > 0)
    for i in range(3):
        a[:, :, i][m] = a[:, :, i][m] * color[i] / 255.0
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def compose_village(which, cam_x=112, cam_y=8):
    from . import npcs, village as VL
    W, H = 640, 360
    set_name = 'village_home' if which == 'home' else 'village_crossroads'
    scene = Image.new('RGBA', (W, H))
    for i in range(3):
        scene.alpha_composite(B.render(set_name, i))
    world = Image.new('RGBA', (48 * 16, 23 * 16))
    obj = VL.all_frames()
    npc, _ = npcs.build_frames()

    def put(img, cx, bottom=VL.FLOOR_Y):
        world.alpha_composite(img, (int(cx - img.width // 2), int(bottom - img.height)))

    tile = lambda t: t * 16 + 8   # noqa: E731
    if which == 'home':
        put(obj['cottage_a_00'], 72)                 # tiles 2–6, left of the statues
        put(obj['well_00'], tile(31))                # between the dummy and the unlocks board
        put(obj['cottage_b_00'], 664)                # tiles 39–43, between the seed board and the gate
    else:
        world.alpha_composite(obj['market_roof_00'], (7 * 16, VL.FLOOR_Y - obj['market_roof_00'].height))
        world.alpha_composite(obj['inn_00'], VL.INN_ORIGIN)
    # floor: plains tiles, rows 20–22, walls at columns 0 and 47
    sheet = T.build_sheet('plains')
    g = np.zeros((23, 48), bool)
    g[20:, :] = True
    g[:, 0] = g[:, 47] = True
    idx = T.autotile(g)
    for y in range(17, 23):
        for x in range(48):
            if idx[y, x] >= 0:
                world.alpha_composite(T.cell_image(sheet, idx[y, x]), (x * 16, y * 16))
    if which == 'home':
        put(npc['villager_a_idle_00'], tile(5), VL.FLOOR_Y + 2)
        put(npc['villager_b_idle_01'], tile(41), VL.FLOOR_Y + 2)
    else:
        put(npc['merchant_idle_00'], tile(37.5), VL.FLOOR_Y + 2)
        put(npc['shopkeeper_wave_01'], tile(17), VL.FLOOR_Y + 2)
        put(npc['innkeeper_idle_00'], tile(44.6), VL.FLOOR_Y + 2)
    for frame, tx in VL.LAYOUT[which]:
        if frame.startswith('training_dummy'):
            put(VL.dummy_frames()[frame], tx * 16 + 8, VL.FLOOR_Y + 2)
            continue
        img = obj[frame]
        if frame.startswith('ability_altar'):
            img = _tint_trim(obj['ability_altar_idle_01'], P.CLASS_COLORS['archer' if tx == 19 else 'wizard'])
        put(img, tx * 16 + 8)
    if which == 'crossroads':
        icon = IC.weapon_icon('greatsword')
        glow = _tint_white(I.build_frames()['glow_weapon_greatsword'], P.GRADE_COLORS['B'])
        x, y = tile(9) - 8, VL.FLOOR_Y - 16 - 8 - 16
        world.alpha_composite(glow, (x - 1, y - 1))
        world.alpha_composite(icon, (x, y))
    # the player in the starter look, near the statues / the shop
    b, ta, tb = render(draw('swordsman', POSES['idle'][0]))
    col = P.CLASS_COLORS['none']
    put(V.compose_player(b, ta, tb, col, col), tile(11 if which == 'home' else 7), VL.FLOOR_Y + 2)
    scene.alpha_composite(world.crop((cam_x, cam_y, cam_x + W, cam_y + H)))
    return scene


def build_villages(preview):
    top, bottom = compose_village('home'), compose_village('crossroads')
    out = Image.new('RGBA', (640, 720))
    out.alpha_composite(top, (0, 0))
    out.alpha_composite(bottom, (0, 360))
    out = out.resize((1280, 1440), Image.NEAREST).convert('RGB')
    path = os.path.join(preview, 'style_board_villages.png')
    out.save(path)
    return path
