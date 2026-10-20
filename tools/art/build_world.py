"""Builds the Plains tileset, parallax layers and their previews."""
import os

import numpy as np
from PIL import Image

from . import backgrounds as B
from . import palette as P
from . import tiles as T


def demo_grid():
    """A 3 × 3 grass block, a pillar, a floating island and a ground strip (cells, True = solid)."""
    rows = [
        '..........................',
        '...............######.....',
        '..###....#.....######.....',
        '..###....#......####......',
        '..###....#................',
        '.........#................',
        '##########################',
        '##########################',
    ]
    return np.array([[c == '#' for c in r] for r in rows])


def tile_scene(sheet, grid, bg_layers):
    h, w = grid.shape
    W_, H_ = w * 16, h * 16
    scene = Image.new('RGBA', (W_, H_))
    for i, layer in enumerate(bg_layers):
        scene.alpha_composite(layer.crop((0, 360 - H_, W_, 360)))
    idx = T.autotile(grid)
    for y in range(h):
        for x in range(w):
            if idx[y, x] >= 0:
                cell = T.cell_image(sheet, idx[y, x])
                if idx[y, x] == 46:
                    v = (x * 7 + y * 3) % 5
                    if v:
                        cell = sheet.crop((1 + (v - 1) * 18, 1 + 3 * 18, 1 + (v - 1) * 18 + 16, 1 + 3 * 18 + 16))
                scene.alpha_composite(cell, (x * 16, y * 16))
    return scene


def build(assets, preview):
    os.makedirs(os.path.join(assets, 'tiles'), exist_ok=True)
    os.makedirs(os.path.join(assets, 'bg'), exist_ok=True)
    sheet = T.build_sheet('plains')
    P.check_palette_lock(sheet, P.allowed(T.ALLOWED), 'tiles_plains')
    sheet.save(os.path.join(assets, 'tiles', 'tiles_plains.png'))
    layers = []
    for i in range(3):
        img = B.render('plains', i)
        P.check_palette_lock(img, P.allowed(B.ALLOWED[i]), f'bg_plains_{i}')
        img.save(os.path.join(assets, 'bg', f'bg_plains_{i}.png'))
        layers.append(img)
    for vs in ('village_home', 'village_crossroads'):
        st = Image.new('RGBA', (640, 360))
        for i in range(3):
            img = B.render(vs, i)
            P.check_palette_lock(img, P.allowed(B.allowed_for(vs, i)), f'bg_{vs}_{i}')
            img.save(os.path.join(assets, 'bg', f'bg_{vs}_{i}.png'))
            st.alpha_composite(img)
        st.resize((1280, 720), Image.NEAREST).save(os.path.join(preview, f'bg_{vs}_stack.png'))
    big = sheet.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST)
    big.save(os.path.join(preview, 'tiles_plains_sheet.png'))
    scene = tile_scene(sheet, demo_grid(), layers)
    scene.resize((scene.width * 3, scene.height * 3), Image.NEAREST).save(os.path.join(preview, 'tiles_plains_demo.png'))
    stack = Image.new('RGBA', (640, 360))
    for l in layers:
        stack.alpha_composite(l)
    stack.resize((1280, 720), Image.NEAREST).save(os.path.join(preview, 'bg_plains_stack.png'))
    build_mountains(assets, preview)
    return sheet, layers


def mountains_demo_grid():
    rows = [
        '..........................',
        '..........................',
        '..........................',
        '...............######.....',
        '..###....#.....######.....',
        '..###....#......####......',
        '.........#................',
        '..........................',
        'RRRRRRRRRR################',
        '##########################',
    ]
    ice = np.array([[c == 'R' for c in r] for r in rows])
    return np.array([[c in '#R' for c in r] for r in rows]), ice


def build_mountains(assets, preview):
    sheet = T.build_sheet('mountains')
    P.check_palette_lock(sheet, P.allowed(T.MT_ALLOWED), 'tiles_mountains')
    sheet.save(os.path.join(assets, 'tiles', 'tiles_mountains.png'))
    sheet.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST).save(
        os.path.join(preview, 'tiles_mountains_sheet.png'))
    stacks = {}
    for sn in ('mountains', 'mountains_cave'):
        layers = []
        for i in range(3):
            img = B.render(sn, i)
            P.check_palette_lock(img, P.allowed(B.MT_ALLOWED[sn][i]), f'bg_{sn}_{i}')
            img.save(os.path.join(assets, 'bg', f'bg_{sn}_{i}.png'))
            layers.append(img)
        stack = Image.new('RGBA', (640, 360))
        for l in layers:
            stack.alpha_composite(l)
        stack.resize((1280, 720), Image.NEAREST).save(os.path.join(preview, f'bg_{sn}_stack.png'))
        stacks[sn] = layers
    # demo: solid rock, an ice strip, one-way, spikes
    solid, ice = mountains_demo_grid()
    idx = T.autotile(solid)
    h, w = solid.shape
    scene = Image.new('RGBA', (w * 16, h * 16))
    for l in stacks['mountains']:
        scene.alpha_composite(l.crop((0, 360 - h * 16, w * 16, 360)))
    for y in range(h):
        for x in range(w):
            if idx[y, x] >= 0:
                i = idx[y, x]
                if ice[y, x]:
                    cell = sheet.crop((1 + (i % 16) * 18, 1 + (4 + i // 16) * 18, 17 + (i % 16) * 18, 17 + (4 + i // 16) * 18))
                else:
                    cell = T.cell_image(sheet, i)
                scene.alpha_composite(cell, (x * 16, y * 16))
    scene.resize((w * 48, h * 48), Image.NEAREST).save(os.path.join(preview, 'tiles_mountains_demo.png'))
