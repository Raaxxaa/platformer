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


def report_lines():
    ink = P.RAMPS['ink'][0]
    surf = surfaces()
    lines = []
    for name, img in entities().items():
        m = mean_oklab(img, skip=[ink])
        for sname, sm in surf.items():
            d = dist(m, sm)
            lines.append(f'{name} {sname} {d:.3f} {"PASS" if d >= THRESHOLD else "FAIL"}')
    return lines


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
