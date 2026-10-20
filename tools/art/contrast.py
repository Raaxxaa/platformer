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
            + _lines(swamps_entities(), swamps_surfaces()))


def write_report(preview):
    lines = report_lines()
    with open(os.path.join(preview, 'contrast_report.txt'), 'w', newline='\n') as f:
        f.write('# entity surface oklab_distance result (FAIL below %.2f)\n' % THRESHOLD)
        acc = accepted_fails()
        f.write('\n'.join(l + (' (accepted)' if l.endswith('FAIL') and ' '.join(l.split()[:2]) in acc else '')
                          for l in lines) + '\n')
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
