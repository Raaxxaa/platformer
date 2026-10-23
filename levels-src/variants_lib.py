"""Helpers for section versions v2 and v3 (06 §8.7), shared by the gen_variants.py of mountains, swamps, kingdom and castle.

A `Sec` starts from the section's v1 (size, anchors, object list) so a version cannot lose or gain an object:
objects keep their type and props and only change position (`mv`). The terrain starts solid ('#') or open ('.').
Tiles; rows grow downward; inclusive ranges.
"""
import json
import math
import os

ROOT = os.path.dirname(os.path.abspath(__file__))


class Sec:
    def __init__(self, level, n, base='solid'):
        self.dir = os.path.join(ROOT, level, f's{n}')
        with open(os.path.join(self.dir, 'v1.txt'), encoding='utf-8') as f:
            lines = [l for l in f.read().split('\n') if l != '']
        with open(os.path.join(self.dir, 'v1.json'), encoding='utf-8') as f:
            self.v1 = json.load(f)
        self.v1_lines = lines
        self.w, self.h = max(len(l) for l in lines), len(lines)
        if base == 'v1':
            self.g = [list(l.ljust(self.w, '#')) for l in lines]
        else:
            self.g = [[('#' if base == 'solid' else '.') for _ in range(self.w)] for _ in range(self.h)]
        self.objects = json.loads(json.dumps(self.v1['objects']))
        self.entry, self.exit = self.v1['entry'], self.v1['exit']
        self.path = []

    # -- terrain
    def fill(self, x0, x1, y0, y1, c='#'):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.g[y][x] = c

    def carve(self, x0, x1, y0, y1):
        self.fill(x0, x1, y0, y1, '.')

    def put(self, x, y, c):
        self.g[y][x] = c

    def ground(self, x0, x1, top, below='#'):
        """Floor surface at row `top` over columns x0..x1: open above (to row 0), `below` from `top` to the bottom."""
        self.fill(x0, x1, 0, top - 1, '.')
        self.fill(x0, x1, top, self.h - 1, below)

    def profile(self, segs):
        """segs: [(x0, x1, top), ...] floor tops."""
        for x0, x1, top in segs:
            self.ground(x0, x1, top)

    def stamp(self, x0, x1, y0, y1, dx=0, dy=0, skip='.'):
        """Copies v1's tiles in the box (inclusive) to the same box moved by (dx, dy); `skip` characters are not copied."""
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                c = self.v1_lines[y][x]
                if c not in skip:
                    self.g[y + dy][x + dx] = c

    def row_str(self, y):
        return ''.join(self.g[y])

    # -- objects (keep type and props; only the place changes)
    def mv(self, i, x, y, w=None, h=None):
        o = self.objects[i]
        o['x'], o['y'] = x, y
        if w is not None:
            o['w'], o['h'] = w, h
        return o

    def mvs(self, items):
        """items: {index: (x, y)} or (x, y, w, h)."""
        for i, p in items.items():
            self.mv(i, *p)

    def path_length(self):
        return sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(self.path, self.path[1:]))

    def v1_length(self):
        p = self.v1['mainPath']
        return sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(p, p[1:]))

    def write(self, ver):
        assert self.path, 'no main path'
        for row in self.g:
            assert len(row) == self.w
        with open(os.path.join(self.dir, f'v{ver}.txt'), 'w', encoding='utf-8', newline='\n') as f:
            f.write('\n'.join(''.join(r) for r in self.g) + '\n')
        meta = {'entry': self.entry, 'exit': self.exit, 'objects': self.objects, 'mainPath': self.path}
        with open(os.path.join(self.dir, f'v{ver}.json'), 'w', encoding='utf-8', newline='\n') as f:
            json.dump(meta, f, indent=1)
            f.write('\n')
        ratio = self.path_length() / self.v1_length()
        print(f'{os.path.basename(os.path.dirname(self.dir))} s{os.path.basename(self.dir)[1:]} v{ver}: path {self.path_length():.1f} / v1 {self.v1_length():.1f} = {ratio * 100:.1f}%')
