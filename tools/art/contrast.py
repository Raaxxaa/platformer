"""OKLab contrast report (08 §12.8 check 5)."""
import math
import os

import numpy as np

from . import backgrounds as B
from . import palette as P
from . import tiles as T

THRESHOLD = 0.15


def _lin(c):
    c = c / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def oklab(rgb):
    r, g, b = _lin(np.asarray(rgb, dtype=np.float64))
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l, m, s = np.cbrt(l), np.cbrt(m), np.cbrt(s)
    return (0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
            1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
            0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s)


def mean_oklab(img, skip=()):
    """Mean OKLab of the opaque pixels of an RGBA image, leaving out colors in `skip`."""
    a = np.asarray(img.convert('RGBA')).reshape(-1, 4)
    a = a[a[:, 3] == 255][:, :3]
    if skip:
        keep = np.ones(len(a), bool)
        for c in skip:
            keep &= ~np.all(a == c, axis=1)
        a = a[keep]
    labs = np.array(oklab(a.T.astype(np.float64))).T
    return labs.mean(axis=0)


def dist(p, q):
    return float(math.sqrt(sum((x - y) ** 2 for x, y in zip(p, q))))


def entities():
    from .enemies import plains
    from .outfits import OUTFITS, draw, render
    from .poses.player import POSES
    from .preview import compose_player
    out = {}
    frames, _ = plains.build_frames()
    for e in plains.ENEMIES:
        out[e] = frames[f'{e}_idle_00']
    for o in OUTFITS:
        b, ta, tb = render(draw(o, POSES['idle'][0]))
        col = P.CLASS_COLORS[o]
        out['player_' + o] = compose_player(b, ta, tb, col, col)
    from . import projectiles
    pfr, _ = projectiles.build_frames()
    for pid in ('enemy_arrow', 'brute_wave', 'shockwave', 'falling_rock'):
        out[pid] = pfr[pid + '_00']
    return out


def surfaces():
    from PIL import Image
    sheet = T.build_sheet('plains')
    blobs = Image.new('RGBA', (16 * 47, 16))
    for i in range(47):
        blobs.paste(T.cell_image(sheet, i), (16 * i, 0))
    s = {'terrain': mean_oklab(blobs)}
    for i in range(3):
        s[f'bg_plains_{i}'] = mean_oklab(B.render('plains', i))
    return s


def village_entities():
    """The player (starter outfits) and the village NPCs."""
    from . import npcs
    out = {k: v for k, v in entities().items() if k.startswith('player_')}
    fr, _ = npcs.build_frames()
    for n in npcs.NPCS:
        out[n] = fr[f'{n}_idle_00']
    return out


def village_surfaces():
    return {f'bg_{v}_{i}': mean_oklab(B.render(v, i)) for v in ('village_home', 'village_crossroads', 'village_border')
            for i in range(3)}


def mountains_entities():
    from .enemies import mountains
    out = {k: v for k, v in entities().items() if k.startswith('player_')}
    frames, _ = mountains.build_frames()
    for e in mountains.ENEMIES:
        out[e] = frames[mountains.idle_key(e)]
    return out


def mountains_surfaces():
    from PIL import Image
    sheet = T.build_sheet('mountains')
    rock = Image.new('RGBA', (16 * 47, 16))
    ice = Image.new('RGBA', (16 * 47, 16))
    for i in range(47):
        rock.paste(T.cell_image(sheet, i), (16 * i, 0))
        x, y = 1 + (i % 16) * 18, 1 + (4 + i // 16) * 18
        ice.paste(sheet.crop((x, y, x + 16, y + 16)), (16 * i, 0))
    s = {'terrain_mountains': mean_oklab(rock), 'terrain_ice': mean_oklab(ice)}
    for i in range(3):
        s[f'bg_mountains_{i}'] = mean_oklab(B.render('mountains', i))
        s[f'bg_mountains_cave_{i}'] = mean_oklab(B.render('mountains_cave', i))
    return s


DARK = (0x06, 0x07, 0x0a)        # 08 §10.2 darkness color; alpha 0.82 in the zone, 0.4 on the lit ring


def darkened(img, alpha):
    """Blend the opaque pixels of an RGBA image toward the darkness color."""
    from PIL import Image
    a = np.array(img.convert('RGBA')).astype(np.float64)
    for i in range(3):
        a[:, :, i] = a[:, :, i] * (1 - alpha) + DARK[i] * alpha
    return Image.fromarray(np.round(a).astype(np.uint8), 'RGBA')


def swamps_entities():
    from .enemies import swamps
    out = {k: v for k, v in entities().items() if k.startswith('player_')}
    frames, _ = swamps.build_frames()
    for e in swamps.ENEMIES:
        out[e] = frames[swamps.idle_key(e)]
    return out


def swamps_surfaces():
    """Plain surfaces plus `*_night` ones: the same art under the zone's darkness (alpha 0.82)."""
    from PIL import Image
    sheet = T.build_sheet('swamps')
    blobs = Image.new('RGBA', (16 * 47, 16))
    for i in range(47):
        blobs.paste(T.cell_image(sheet, i), (16 * i, 0))
    imgs = {'terrain_swamps': blobs}
    for i in range(3):
        imgs[f'bg_swamps_{i}'] = B.render('swamps', i)
    out = {k: mean_oklab(v) for k, v in imgs.items()}
    out.update({k + '_night': mean_oklab(darkened(v, 0.82)) for k, v in imgs.items()})
    return out


def _sheet_surfaces(set_name, bgs, key):
    from PIL import Image
    from . import world34
    sheet = T.build_sheet(set_name)
    blobs = Image.new('RGBA', (16 * 47, 16))
    for i in range(47):
        blobs.paste(T.cell_image(sheet, i), (16 * i, 0))
    s = {f'terrain_{set_name}': mean_oklab(blobs)}
    for i in range(3):
        s[f'bg_{key}_{i}'] = mean_oklab(world34.render(key, i))
    return s


def kingdom_entities():
    from .enemies import kingdom
    from .bosses import black_knight
    out = {k: v for k, v in entities().items() if k.startswith('player_')}
    frames, _ = kingdom.build_frames()
    for e in kingdom.ENEMIES:
        out[e] = frames[kingdom.idle_key(e)]
    bf, _ = black_knight.build_frames()
    out['black_knight'] = bf['idle_00']
    return out


def kingdom_surfaces():
    return _sheet_surfaces('kingdom', None, 'kingdom')


def castle_entities():
    from .enemies import castle
    from .bosses import enemy_king
    out = {k: v for k, v in entities().items() if k.startswith('player_')}
    frames, _ = castle.build_frames()
    for e in castle.ENEMIES:
        out[e] = frames[castle.idle_key(e)]
    kf, _ = enemy_king.build_frames()
    out['enemy_king'] = kf['idle_00']
    return out


def castle_surfaces():
    return _sheet_surfaces('castle', None, 'castle')


def _lines(ents, surf):
    ink = P.RAMPS['ink'][0]
    lines = []
    for name, img in ents.items():
        m = mean_oklab(img, skip=[ink])
        lit = mean_oklab(darkened(img, 0.4), skip=[tuple(int(round(c * 0.6 + d * 0.4)) for c, d in zip(ink, DARK))])
        for sname, sm in surf.items():
            d = dist(lit if sname.endswith('_night') else m, sm)
            lines.append(f'{name} {sname} {d:.3f} {"PASS" if d >= THRESHOLD else "FAIL"}')
    return lines


def report_lines():
    return (_lines(entities(), surfaces()) + _lines(village_entities(), village_surfaces())
            + _lines(mountains_entities(), mountains_surfaces())
            + _lines(swamps_entities(), swamps_surfaces())
            + _lines(kingdom_entities(), kingdom_surfaces())
            + _castle_lines() + dragon_lines())


def dragon_lines():
    """The four Dragons against the biomes they can appear in (08 §12.8: mountains, swamps, kingdom)."""
    from .bosses import dragon
    ents = {}
    for c in dragon.COLORS:
        frames, _ = dragon.build_frames(c)
        ents[f'dragon_{c}'] = frames['idle_00']
    out = []
    for surf in (mountains_surfaces(), swamps_surfaces(), kingdom_surfaces()):
        out += _lines(ents, surf)
    return out


def _castle_lines():
    try:
        return _lines(castle_entities(), castle_surfaces())
    except ImportError:          # the castle art is added in ART8 Task 4
        return []


def look_lines():
    """ART10: the extreme looks (lightest and darkest skin with the lightest and darkest dye, hair and an orc) against
    every biome's terrain and backgrounds. Informational: a look is the player's choice, so these never fail a test."""
    from . import look as LK
    surf = {}
    for fn in (surfaces, village_surfaces, mountains_surfaces, swamps_surfaces, kingdom_surfaces, castle_surfaces):
        surf.update(fn())
    looks = {'look_darkest': dict(skin=5, color_a='#34303c', color_b='#34303c', hair_color='#2a2630'),
             'look_lightest': dict(skin=0, color_a='#d0ccc4', color_b='#d0ccc4', hair_color='#d0cec8'),
             'look_orc_grey': dict(race='orc', skin=3, color_a='#7c7c88', color_b='#7c7c88')}
    ink = P.RAMPS['ink'][0]
    out = []
    for name, lk in looks.items():
        img = LK.compose('idle_00', dict(lk, outfit='leather', hair='short'))
        m = mean_oklab(img, skip=[ink])
        for sname, sm in surf.items():
            d = dist(m, sm)
            out.append(f'{name} {sname} {d:.3f} {"PASS" if d >= THRESHOLD else "FAIL"}')
    return out


def write_report(preview):
    lines = report_lines()
    with open(os.path.join(preview, 'contrast_report.txt'), 'w', newline='\n') as f:
        f.write('# entity surface oklab_distance result (FAIL below %.2f)\n' % THRESHOLD)
        acc = accepted_fails()
        f.write('\n'.join(l + (' (accepted)' if l.endswith('FAIL') and ' '.join(l.split()[:2]) in acc else '')
                          for l in lines) + '\n')
        f.write('# ART10 extreme looks (informational: a look is the player\'s choice, these never fail a test)\n')
        f.write('\n'.join(look_lines()) + '\n')
    return lines


APPROVALS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'approved', 'APPROVALS.md')


def accepted_fails(path=APPROVALS):
    """`entity surface` pairs listed in the code block under '## Accepted contrast FAILs'."""
    if not os.path.exists(path):
        return set()
    text = open(path).read()
    if '## Accepted contrast FAILs' not in text:
        return set()
    sec = text.split('## Accepted contrast FAILs', 1)[1]
    parts = sec.split('```')
    return {l.strip() for l in parts[1].splitlines() if l.strip()} if len(parts) > 2 else set()
