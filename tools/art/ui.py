"""The `ui` atlas (08 §12.5, 07 §3.4): 103 frames, one page, public/assets/ui/ui.png + ui.json."""
import os

from . import atlas as A
from . import icons as I
from . import palette as P

import numpy as np
from PIL import Image

CLASSES = ['swordsman', 'tank', 'archer', 'wizard']
ELEMENTS = ['fire', 'ice', 'lightning', 'poison', 'wind']
STATUSES = ['burning', 'poisoned', 'chilled', 'rooted']


# 07 §3.4 popup skin and HUD plates. A 9-slice frame is built from a border profile: the color at depth d from the
# nearest edge. Edge cells repeat along their length and the middle cell is one flat color, so stretching never seams.
U = P.UI_COLORS
WOOD = P.RAMPS['w_wood']
STEEL = P.RAMPS['w_steel']
WHITE = (255, 255, 255)


def nine(w, h, c, profile, fill, rivet=None, round_corner=True):
    a = np.zeros((h, w, 4), np.uint8)
    for y in range(h):
        for x in range(w):
            cx = x < c or x >= w - c
            cy = y < c or y >= h - c
            dx, dy = min(x, w - 1 - x), min(y, h - 1 - y)
            if cx and cy:
                d = min(dx, dy)
            elif cx:
                d = dx
            elif cy:
                d = dy
            else:
                d = None
            col = profile[d] if d is not None and d < len(profile) else fill
            if round_corner and dx == 0 and dy == 0:
                col = None
            if col is not None:
                a[y, x] = (*col, 255)
    if rivet:
        rx, rcol, rhi = rivet
        for (x, y) in ((rx, rx), (w - 1 - rx, rx), (rx, h - 1 - rx), (w - 1 - rx, h - 1 - rx)):
            a[y, x] = (*rcol, 255)
        for (x, y) in ((rx, rx), (w - 1 - rx, rx)):
            a[y, x] = (*rhi, 255)
    return Image.fromarray(a, 'RGBA')


def heart():
    rows = ['.##...##..',
            '#hh#.#hh#.',
            '#hwr#rrr#.',
            '#hrrrrrr#.',
            '#rrrrrrr#.',
            '.#rrrrr#..',
            '..#rrr#...',
            '...#r#....',
            '....#.....',
            '..........']
    cols = {'#': U['ink'], 'r': U['hp'], 'h': U['hpLow'], 'w': WHITE}
    return _bitmap(rows, cols)


def cursor():
    rows = ['##.....',
            '#h##...',
            '#hhh##.',
            '#hhhhh#',
            '#hhh##.',
            '#h##...',
            '##.....']
    return _bitmap(rows, {'#': U['ink'], 'h': U['highlight']})


def _bitmap(rows, cols):
    a = np.zeros((len(rows), len(rows[0]), 4), np.uint8)
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch in cols:
                a[y, x] = (*cols[ch], 255)
    return Image.fromarray(a, 'RGBA')


def skin_frames():
    ink = U['ink']
    return {
        'hud_heart': heart(),
        'hud_plate_9': nine(24, 24, 8, [ink, WOOD[1], U['panelBorder']], U['panel']),
        'panel_9': nine(24, 24, 8, [ink, WOOD[0], WOOD[1], WOOD[2], WOOD[0], ink], U['panel'],
                        rivet=(2, STEEL[1], STEEL[3])),
        'panel_9_edge': nine(24, 24, 8, [None, WHITE, WHITE, WHITE, WHITE], None),
        'tab_on_9': nine(16, 12, 4, [ink, U['highlight'], WOOD[2]], WOOD[1]),
        'tab_off_9': nine(16, 12, 4, [ink, WOOD[1], WOOD[0]], WOOD[0]),
        'button_9': nine(16, 16, 4, [ink, WOOD[2], WOOD[0]], WOOD[1]),
        'button_9_sel': nine(16, 16, 4, [ink, U['highlight'], WOOD[2]], WOOD[1]),
        'cursor': cursor(),
    }


NINE = {'hud_plate_9': 8, 'panel_9': 8, 'panel_9_edge': 8, 'tab_on_9': 4, 'tab_off_9': 4, 'button_9': 4,
        'button_9_sel': 4}


def build_frames():
    fr = {}
    fr.update({f'icon_weapon_{w}': I.weapon_icon(w) for w in I.WEAPONS})
    fr.update({f'icon_ability_{a}': I.ability_icon(a) for a in I.ABILITIES})
    fr.update({f'icon_stat_{s}': I.stat_icon(s) for s in I.STATS})
    fr.update({f'icon_class_{c}': I.class_icon(c) for c in CLASSES})
    fr.update({f'elem_{e}': I.element_icon(e) for e in ELEMENTS})
    fr.update({f'status_{s}': I.status_icon(s) for s in STATUSES})
    fr.update({f'effect_{e}': I.effect_icon(e) for e in I.LUCKY})
    fr.update({f'effect_curse_{c}': I.effect_icon(c, curse=True) for c in I.CURSES})
    fr.update(I.hud_frames())
    fr.update(I.tint_frames())
    fr.update(skin_frames())
    return fr


def build(assets, preview):
    from PIL import Image
    fr = build_frames()
    for k, img in fr.items():
        ok = {(255, 255, 255)} if k.startswith(('class_', 'prompt_ps_')) or k == 'panel_9_edge' else P.allowed_ui()
        P.check_palette_lock(img, ok, 'ui', k)
    A.pack_atlas('ui', fr, os.path.join(assets, 'ui'), strict=False)
    # preview: every frame on a panel, 5×
    names = sorted(fr)
    cols = 16
    cell = 18
    rows = (len(names) + cols - 1) // cols
    im = Image.new('RGBA', (cols * cell + 2, rows * cell + 2), (0x1b, 0x18, 0x26, 255))
    for i, n in enumerate(names):
        im.alpha_composite(fr[n], (2 + (i % cols) * cell, 2 + (i // cols) * cell))
    im.resize((im.width * 5, im.height * 5), Image.NEAREST).save(os.path.join(preview, 'ui_sheet.png'))
    return fr
