"""Grid atlas packer (Phaser JSON-hash) and anims.json writer (08 §12.5, §16)."""
import json
import os
import re
from PIL import Image

PAD = 2
MAX_PAGE = 2048
ROW_WIDTH = 1024        # target page width before the 2048 cap
_NAME = re.compile(r'^([ab]/)?([a-z0-9_]+_(\d\d|smear)|(glow|icon)_[a-z0-9_]+)$')


def frame_names(key, n):
    return [f'{key}_{i:02d}' for i in range(n)]


def check_frame_name(name):
    if not _NAME.match(name):
        raise ValueError(f'bad frame name {name!r} (want <animKey>_<NN>)')


def _layout(frames):
    """Returns list of pages; each page = (w, h, [(name, x, y)])."""
    groups = {}
    for name, img in frames.items():
        groups.setdefault(img.size, []).append(name)
    order = sorted(groups, key=lambda s: (-s[0] * s[1], -s[0], -s[1]))
    pages, cur, y, used_w = [], [], PAD, 0
    for size in order:
        w, h = size
        cols = max(1, min(len(groups[size]), (min(ROW_WIDTH, MAX_PAGE) - PAD) // (w + PAD)))
        names = sorted(groups[size])
        for r in range(0, len(names), cols):
            row = names[r:r + cols]
            if y + h + PAD > MAX_PAGE and cur:
                pages.append((used_w, y, cur))
                cur, y, used_w = [], PAD, 0
            x = PAD
            for n in row:
                cur.append((n, x, y))
                x += w + PAD
            used_w = max(used_w, x)
            y += h + PAD
    if cur:
        pages.append((used_w, y, cur))
    return pages


def pack_atlas(name, frames, out_dir, strict=True):
    """Pack frames {frameName: RGBA Image}; write <name>.png + <name>.json (or _0, _1 … pages)."""
    if strict:
        for n in frames:
            check_frame_name(n)
    os.makedirs(out_dir, exist_ok=True)
    pages = _layout(frames)
    meta = {'frames': {}, 'pages': []}
    for pi, (pw, ph, items) in enumerate(pages):
        base = name if len(pages) == 1 else f'{name}_{pi}'
        sheet = Image.new('RGBA', (pw, ph), (0, 0, 0, 0))
        data = {}
        for n, x, y in sorted(items):
            img = frames[n]
            sheet.paste(img, (x, y))
            w, h = img.size
            data[n] = {'frame': {'x': x, 'y': y, 'w': w, 'h': h}, 'rotated': False, 'trimmed': False,
                       'spriteSourceSize': {'x': 0, 'y': 0, 'w': w, 'h': h}, 'sourceSize': {'w': w, 'h': h}}
            meta['frames'][n] = (base, x, y, w, h)
        sheet.save(os.path.join(out_dir, base + '.png'), optimize=False)
        doc = {'frames': data, 'meta': {'app': 'rushblade tools/art/atlas.py', 'version': '1',
                                        'image': base + '.png', 'format': 'RGBA8888',
                                        'size': {'w': pw, 'h': ph}, 'scale': '1'}}
        with open(os.path.join(out_dir, base + '.json'), 'w', newline='\n') as f:
            json.dump(doc, f, indent=1, sort_keys=True)
            f.write('\n')
        meta['pages'].append((base, sheet))
    return meta


def anim(key, atlas, n, mode, fps=None, segments=None, prefix=''):
    d = {'key': key, 'atlas': atlas, 'frames': [prefix + f for f in frame_names(key, n)], 'mode': mode}
    if fps is not None:
        d['fps'] = fps
    if segments is not None:
        d['segments'] = segments
    return d


def write_anims(path, anims):
    anims = sorted(anims, key=lambda a: (a['atlas'], a['key']))
    with open(path, 'w', newline='\n') as f:
        json.dump(anims, f, indent=1)
        f.write('\n')
