#!/usr/bin/env python3
"""Level builder: ASCII chunks + manifest (levels-src/<id>/) -> Tiled 1.10 JSON (public/levels/<id>.json).

06 §13.1-13.5. Run `npm run levels`. Same source gives byte-identical output (no timestamps, fixed key order).
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'levels-src')
OUT = os.path.join(ROOT, 'public', 'levels')
T = 16  # tile size, px

# 06 §13.3: ASCII -> gid.
TILE_GID = {'.': 0, '#': 1, '=': 2, 'I': 3, '~': 4, '^': 5, 'v': 6, '<': 7, '>': 8}
KIND_COLORS = [  # kinds.png: one flat 16x16 tile per gid 1..8
    (74, 79, 99), (138, 144, 168), (143, 220, 255), (66, 120, 200),
    (224, 70, 60), (224, 70, 60), (224, 70, 60), (224, 70, 60),
]
# Special cells (06 §13.5): the cell's collision kind, and the body each run of them becomes.
SPECIAL = {'%': ('.', 'collapsing_platform', {'oneWay': False}), '&': ('.', 'collapsing_platform', {'oneWay': True}),
           '+': ('.', 'cracked_wall', {}), '@': ('#', 'blink_block', {})}
DEFAULT_LEGEND = {
    'P': {'type': 'player_start'}, 'L': {'type': 'lucky_block'}, 'K': {'type': 'key'}, 'C': {'type': 'key_chest'},
    'Q': {'type': 'cursed_chest'}, 'T': {'type': 'timed_chest'}, 'M': {'type': 'merchant_spot'}, 'G': {'type': 'grapple_point'},
}
# 06 §13.4 point anchors.
CENTER_POINTS = {'lucky_block', 'key', 'grapple_point', 'cannon', 'swinging_blade', 'firefly', 'guide_arrow'}
POINT_TYPES = CENTER_POINTS | {
    'player_start', 'enemy', 'summon_point', 'loot_stand', 'key_chest', 'cursed_chest', 'timed_chest', 'merchant_spot',
    'minecart', 'shop_item', 'ability_altar', 'shop_flask', 'shop_refill', 'shop_key', 'shop_reroll', 'shop_cosmetic', 'class_statue',
    'unlocks_board', 'seed_board', 'checkpoint', 'station_flag', 'item_stand', 'checklist_board', 'armory_label'}
ZONE_TYPES = {'main_path', 'section', 'hint', 'exit', 'camera_zone', 'dragon_warning', 'dark_zone', 'arena', 'falling_rocks', 'minecart_stop', 'station', 'station_goal', 'respawn'}


class BuildError(Exception):
    pass


def prop_type(v):
    if isinstance(v, bool):
        return 'bool'
    if isinstance(v, int):
        return 'int'
    if isinstance(v, float):
        return 'float'
    return 'string'


def tiled_props(props):
    return [{'name': k, 'type': prop_type(v), 'value': v} for k, v in sorted(props.items())]


def anchor(obj_type, tx, ty):
    if obj_type in CENTER_POINTS:
        return tx * T + 8, ty * T + 8
    return tx * T + 8, ty * T + 16


def merge_rects(cells):
    """Fewest rectangles: horizontal runs first, then stack identical runs (06 §13.5). cells: set of (x, y)."""
    runs = []
    for y in sorted({c[1] for c in cells}):
        xs = sorted(c[0] for c in cells if c[1] == y)
        start = prev = xs[0]
        for x in xs[1:] + [None]:
            if x is not None and x == prev + 1:
                prev = x
                continue
            runs.append((start, y, prev - start + 1))
            if x is not None:
                start = prev = x
    rects, used = [], set()
    for r in runs:
        if r in used:
            continue
        x, y, w = r
        h = 1
        while (x, y + h, w) in runs and (x, y + h, w) not in used:
            used.add((x, y + h, w))
            h += 1
        used.add(r)
        rects.append((x, y, w, h))
    return rects


def read_lines(path):
    with open(path, encoding='utf-8') as f:
        lines = f.read().split('\n')
    while lines and lines[-1] == '':
        lines.pop()
    return lines


def read_versions(level_dir, man):
    """06 §8.7 section variants: [[version dict per v1, v2, ...] per section]. Version: lines, entry, exit, objects, mainPath."""
    out = []
    for n in range(1, man['sections'] + 1):
        vs, v = [], 1
        while os.path.isfile(os.path.join(level_dir, f's{n}', f'v{v}.json')):
            with open(os.path.join(level_dir, f's{n}', f'v{v}.json'), encoding='utf-8') as f:
                meta = json.load(f)
            meta['lines'] = read_lines(os.path.join(level_dir, f's{n}', f'v{v}.txt'))
            meta['width'] = max(len(line) for line in meta['lines'])
            vs.append(meta)
            v += 1
        if not vs:
            raise BuildError(f's{n}: no v1')
        out.append(vs)
    return out


def assemble(man, versions, picks):
    """Each section's entry anchor on the previous exit anchor (06 §8.7). Returns a classic manifest (chunks + objects)."""
    chunks, objects, sections, path = [], [], [], []
    x, y = man['origin']
    prev = None
    placed = []
    for i, vs in enumerate(versions):
        v = vs[picks[i] - 1]
        if prev is not None:
            px, py, pv = prev
            x = px + pv['exit'][0] + 1 - v['entry'][0]
            y = py + pv['exit'][1] - v['entry'][1]
        placed.append((x, y, v))
        prev = (x, y, v)
    x0 = min(p[0] for p in placed)
    y0 = min(p[1] for p in placed)
    for i, (x, y, v) in enumerate(placed):
        x -= x0; y -= y0
        chunks.append({'lines': v['lines'], 'x': x, 'y': y, 'file': f's{i + 1}/v{picks[i]}.txt'})
        for o in v['objects']:
            o = json.loads(json.dumps(o))
            o['x'] += x; o['y'] += y
            objects.append(o)
        path += [[px + x, py + y] for px, py in v['mainPath']]
        sections.append({'type': 'section', 'x': x, 'y': y, 'w': v['width'], 'h': len(v['lines']), 'props': {'index': i + 1}})
    W = max(c['x'] + max(len(line) for line in c['lines']) for c in chunks)
    H = max(c['y'] + len(c['lines']) for c in chunks)
    return dict(man, width=W, height=max(H, man.get('height', 0)), chunks=chunks, objects=objects + sections, mainPath=path)


def load_manifest(level_dir):
    with open(os.path.join(level_dir, 'level.json'), encoding='utf-8') as f:
        man = json.load(f)
    if 'sections' in man:
        versions = read_versions(level_dir, man)
        man = assemble(man, versions, [1] * len(versions))
    return man


def write_pack(level_dir, out_dir):
    """06 §8.7: every section version for the game's assembler (public/levels/<id>.pack.json)."""
    with open(os.path.join(level_dir, 'level.json'), encoding='utf-8') as f:
        man = json.load(f)
    if 'sections' not in man:
        return None
    versions = read_versions(level_dir, man)
    legend = dict(DEFAULT_LEGEND)
    legend.update(man.get('legend', {}))
    pack = {k: man[k] for k in ('levelId', 'kind', 'stage', 'biome', 'height', 'origin')}
    pack['legend'] = legend
    pack['vary'] = man.get('vary', [])
    pack['sections'] = [[{k: v[k] for k in ('entry', 'exit', 'lines', 'mainPath', 'objects')} for v in vs] for vs in versions]
    path = os.path.join(out_dir, f'{man["levelId"]}.pack.json')
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(json.dumps(pack, indent=1, sort_keys=True, ensure_ascii=False) + '\n')
    return path


def build(level_dir):
    """Returns (tiled_dict, level_id)."""
    man = load_manifest(level_dir)
    W, H = man['width'], man['height']
    grid = [['#'] * W for _ in range(H)]          # uncovered cells are solid
    legend = dict(DEFAULT_LEGEND)
    legend.update(man.get('legend', {}))
    markers = {}                                  # (x, y) -> legend entry (later chunks win)
    specials = {}                                 # (x, y) -> special char
    for ch in man['chunks']:
        lines = ch['lines'] if 'lines' in ch else read_lines(os.path.join(level_dir, ch['file']))
        for row, line in enumerate(lines):
            for col, c in enumerate(line):
                if c == ' ':
                    continue
                x, y = ch['x'] + col, ch['y'] + row
                if not (0 <= x < W and 0 <= y < H):
                    raise BuildError(f'{ch["file"]}:{row + 1}:{col + 1}: cell ({x}, {y}) outside the {W}x{H} map')
                markers.pop((x, y), None)
                specials.pop((x, y), None)
                if c in TILE_GID:
                    grid[y][x] = c
                elif c in SPECIAL:
                    grid[y][x] = SPECIAL[c][0]
                    specials[(x, y)] = c
                elif c in legend:
                    grid[y][x] = '.'
                    markers[(x, y)] = legend[c]
                else:
                    raise BuildError(f'{ch["file"]}:{row + 1}:{col + 1}: unknown character {c!r}')

    points, rects = [], []
    for (x, y), entry in markers.items():
        props = {k: v for k, v in entry.items() if k != 'type'}
        points.append((entry['type'], x, y, props))
    for o in man.get('objects', []):
        props = dict(o.get('props', {}))
        if 'w' in o:
            rects.append((o['type'], o['x'] * T, o['y'] * T, o['w'] * T, o['h'] * T, props))
        else:
            points.append((o['type'], o['x'], o['y'], props))
    # Special runs: collapsing platforms merge horizontally only; walls merge into rectangles.
    for c in ('%', '&', '+', '@'):
        cells = {p for p, s in specials.items() if s == c}
        if not cells:
            continue
        _, typ, extra = SPECIAL[c]
        if c in '%&':
            found = []
            for y in sorted({p[1] for p in cells}):
                xs = sorted(p[0] for p in cells if p[1] == y)
                start = prev = xs[0]
                for x in xs[1:] + [None]:
                    if x is not None and x == prev + 1:
                        prev = x
                        continue
                    found.append((start, y, prev - start + 1, 1))
                    if x is not None:
                        start = prev = x
        else:
            found = merge_rects(cells)
        for (x, y, w, h) in found:
            rects.append((typ, x * T, y * T, w * T, h * T, dict(extra)))

    for (typ, *_rest) in points:
        if typ not in POINT_TYPES:
            raise BuildError(f'unknown point object type {typ!r}')

    objects = []
    next_id = 1
    for typ, tx, ty, props in sorted(points, key=lambda p: (p[2], p[1], p[0])):
        ax, ay = anchor(typ, tx, ty)
        objects.append({'height': 0, 'id': next_id, 'name': '', 'point': True, 'properties': tiled_props(props),
                        'rotation': 0, 'type': typ, 'visible': True, 'width': 0, 'x': ax, 'y': ay})
        next_id += 1
    for typ, x, y, w, h, props in rects:
        objects.append({'height': h, 'id': next_id, 'name': '', 'properties': tiled_props(props),
                        'rotation': 0, 'type': typ, 'visible': True, 'width': w, 'x': x, 'y': y})
        next_id += 1
    if man.get('mainPath'):
        pts = [(tx * T + 8, ty * T + 8) for tx, ty in man['mainPath']]
        x0, y0 = pts[0]
        objects.append({'height': 0, 'id': next_id, 'name': '', 'polyline': [{'x': x - x0, 'y': y - y0} for x, y in pts],
                        'properties': [], 'rotation': 0, 'type': 'main_path', 'visible': True, 'width': 0, 'x': x0, 'y': y0})
        next_id += 1

    def layer(lid, name, objs):
        return {'draworder': 'topdown', 'id': lid, 'name': name, 'objects': objs, 'opacity': 1, 'type': 'objectgroup',
                'visible': True, 'x': 0, 'y': 0}

    zones = [o for o in objects if o['type'] in ZONE_TYPES]
    spawns = [o for o in objects if o['type'] == 'enemy']
    others = [o for o in objects if o['type'] not in ZONE_TYPES and o['type'] != 'enemy']
    data = [TILE_GID[grid[y][x]] for y in range(H) for x in range(W)]
    tiled = {
        'compressionlevel': -1, 'height': H, 'infinite': False,
        'layers': [
            {'data': data, 'height': H, 'id': 1, 'name': 'collision', 'opacity': 1, 'type': 'tilelayer', 'visible': True,
             'width': W, 'x': 0, 'y': 0},
            layer(2, 'zones', zones), layer(3, 'objects', others), layer(4, 'spawns', spawns),
        ],
        'nextlayerid': 5, 'nextobjectid': next_id, 'orientation': 'orthogonal',
        'properties': tiled_props({'levelId': man['levelId'], 'kind': man['kind'], 'stage': man['stage'], 'biome': man['biome']}),
        'renderorder': 'right-down', 'tiledversion': '1.10.2', 'tileheight': T,
        'tilesets': [{'columns': 8, 'firstgid': 1, 'image': 'kinds.png', 'imageheight': T, 'imagewidth': 8 * T, 'margin': 0,
                      'name': 'kinds', 'spacing': 0, 'tilecount': 8, 'tileheight': T, 'tilewidth': T}],
        'tilewidth': T, 'type': 'map', 'version': '1.10', 'width': W,
    }
    return tiled, man['levelId']


def to_text(tiled):
    """Sorted keys; the collision data is written one map row per line."""
    W = tiled['width']
    data = tiled['layers'][0]['data']
    tiled = json.loads(json.dumps(tiled))
    tiled['layers'][0]['data'] = '@@DATA@@'
    text = json.dumps(tiled, indent=1, sort_keys=True, ensure_ascii=False)
    rows = [','.join(str(v) for v in data[i:i + W]) for i in range(0, len(data), W)]
    return text.replace('"@@DATA@@"', '[\n' + ',\n'.join(rows) + '\n]') + '\n'


def write_kinds_png(path):
    from PIL import Image
    im = Image.new('RGBA', (8 * T, T))
    for i, c in enumerate(KIND_COLORS):
        for y in range(T):
            for x in range(T):
                im.putpixel((i * T + x, y), c + (255,))
    im.save(path, optimize=False)


def main(argv):
    os.makedirs(OUT, exist_ok=True)
    ids = argv or (sorted(d for d in os.listdir(SRC) if os.path.isfile(os.path.join(SRC, d, 'level.json'))) if os.path.isdir(SRC) else [])
    for lid in ids:
        tiled, level_id = build(os.path.join(SRC, lid))
        with open(os.path.join(OUT, f'{level_id}.json'), 'w', encoding='utf-8', newline='\n') as f:
            f.write(to_text(tiled))
        print(f'levels: wrote public/levels/{level_id}.json')
        if write_pack(os.path.join(SRC, lid), OUT):
            print(f'levels: wrote public/levels/{level_id}.pack.json')
    write_kinds_png(os.path.join(OUT, 'kinds.png'))


if __name__ == '__main__':
    try:
        main(sys.argv[1:])
    except BuildError as e:
        print(f'build_levels: {e}', file=sys.stderr)
        sys.exit(1)
