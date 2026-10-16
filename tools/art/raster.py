"""Raster primitives on palette-slot arrays (08 §12.2). -1 = transparent."""
import numpy as np
from PIL import Image


class Canvas:
    def __init__(self, w, h, a=None):
        self.w, self.h = w, h
        self.a = np.full((h, w), -1, dtype=np.int16) if a is None else a

    def to_image(self, slot_colors=None):
        if slot_colors is None:
            from . import palette
            slot_colors = palette.COLORS
        lut = np.zeros((len(slot_colors) + 1, 4), dtype=np.uint8)
        for i, c in enumerate(slot_colors):
            lut[i] = (c[0], c[1], c[2], 255)
        idx = np.where(self.a < 0, len(slot_colors), self.a)
        return Image.fromarray(lut[idx], 'RGBA')

    def paste(self, other, x, y):
        """Copy other's opaque pixels onto self at (x, y), clipped."""
        h, w = other.a.shape
        x0, y0 = max(0, x), max(0, y)
        x1, y1 = min(self.w, x + w), min(self.h, y + h)
        if x1 <= x0 or y1 <= y0:
            return
        src = other.a[y0 - y:y1 - y, x0 - x:x1 - x]
        dst = self.a[y0:y1, x0:x1]
        m = src >= 0
        dst[m] = src[m]


class PartLayer:
    """Pixels labelled with part indexes; later draws cover earlier ones."""

    def __init__(self, w, h):
        self.w, self.h = w, h
        self.ids = np.full((h, w), -1, dtype=np.int16)
        self.parts = []      # list of (name, ramp slot ids)
        self.index = {}

    def add_part(self, name, ramp, shift=0):
        """ramp: slot ids dark -> light. shift > 0 makes the part that many shades darker."""
        if shift:
            ramp = [ramp[max(0, i - shift)] for i in range(len(ramp))]
        self.index[name] = len(self.parts)
        self.parts.append((name, list(ramp)))
        return name

    def put(self, mask, part):
        self.ids[mask] = self.index[part]


def _centers(w, h):
    ys, xs = np.mgrid[0:h, 0:w]
    return xs + 0.5, ys + 0.5


def fill_polygon(c, pts, part):
    """Fill pixels whose centers are inside the polygon (even-odd rule)."""
    xs, ys = _centers(c.w, c.h)
    inside = np.zeros((c.h, c.w), dtype=bool)
    n = len(pts)
    for i in range(n):
        x0, y0 = pts[i]
        x1, y1 = pts[(i + 1) % n]
        if y0 == y1:
            continue
        cond = (ys >= min(y0, y1)) & (ys < max(y0, y1))
        xi = x0 + (ys - y0) * (x1 - x0) / (y1 - y0)
        inside ^= cond & (xs < xi)
    c.put(inside, part)


def fill_rect(c, x, y, w, h, part):
    m = np.zeros((c.h, c.w), dtype=bool)
    m[max(0, y):max(0, y + h), max(0, x):max(0, x + w)] = True
    c.put(m, part)


def capsule(c, p0, p1, width, part):
    """Pixels whose centers lie within width/2 of the segment p0-p1 (points in pixel-center coords)."""
    xs, ys = _centers(c.w, c.h)
    ax, ay = p0[0] + 0.5, p0[1] + 0.5
    bx, by = p1[0] + 0.5, p1[1] + 0.5
    dx, dy = bx - ax, by - ay
    ll = dx * dx + dy * dy
    if ll == 0:
        t = np.zeros_like(xs)
    else:
        t = np.clip(((xs - ax) * dx + (ys - ay) * dy) / ll, 0, 1)
    px, py = ax + t * dx, ay + t * dy
    r = width / 2.0
    m = (xs - px) ** 2 + (ys - py) ** 2 <= r * r + 1e-6
    if width <= 1:
        m = np.zeros_like(m)
        line(c, p0, p1, part)
        return
    c.put(m, part)


def ellipse(c, cx, cy, rx, ry, part):
    """Ellipse centered on (cx, cy) in pixel units (cx=10 means the middle of pixel column 10)."""
    xs, ys = _centers(c.w, c.h)
    m = ((xs - (cx + 0.5)) / rx) ** 2 + ((ys - (cy + 0.5)) / ry) ** 2 <= 1.0
    c.put(m, part)


def line(c, p0, p1, part):
    """Bresenham line between integer points."""
    x0, y0 = int(p0[0]), int(p0[1])
    x1, y1 = int(p1[0]), int(p1[1])
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx + dy
    m = np.zeros((c.h, c.w), dtype=bool)
    while True:
        if 0 <= x0 < c.w and 0 <= y0 < c.h:
            m[y0, x0] = True
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy
    c.put(m, part)


def stamp(c, x, y, grid, mapping):
    """Hand-typed grid (≤ 16 × 16). mapping: char -> part name; '.' and ' ' are skipped."""
    assert len(grid) <= 16 and all(len(r) <= 16 for r in grid)
    for j, row in enumerate(grid):
        for i, ch in enumerate(row):
            if ch in '. ':
                continue
            px, py = x + i, y + j
            if 0 <= px < c.w and 0 <= py < c.h:
                c.ids[py, px] = c.index[mapping[ch]]


def base_index(n):
    return 1 if n <= 3 else n // 2


def auto_shade(layer):
    """08 §12.2: up/left outside the part -> light, down/right outside -> dark, else base."""
    ids = layer.ids
    h, w = ids.shape
    pad = np.full((h + 2, w + 2), -1, dtype=np.int16)
    pad[1:-1, 1:-1] = ids
    up, down = pad[:-2, 1:-1], pad[2:, 1:-1]
    left, right = pad[1:-1, :-2], pad[1:-1, 2:]
    light = (up != ids) | (left != ids)
    dark = (down != ids) | (right != ids)
    out = np.full((h, w), -1, dtype=np.int16)
    for pi, (_name, ramp) in enumerate(layer.parts):
        m = ids == pi
        if not m.any():
            continue
        n = len(ramp)
        out[m] = ramp[base_index(n)]
        out[m & dark] = ramp[0]
        out[m & light] = ramp[-1]
    return Canvas(w, h, out)


def flat(layer, shade='base'):
    """Fill every part with one shade (no auto-shading)."""
    out = np.full(layer.ids.shape, -1, dtype=np.int16)
    for pi, (_name, ramp) in enumerate(layer.parts):
        i = {'base': base_index(len(ramp)), 'dark': 0, 'light': len(ramp) - 1}[shade]
        out[layer.ids == pi] = ramp[i]
    return Canvas(layer.w, layer.h, out)


def outline(c, ink):
    """Add ink on every transparent pixel 4-adjacent to an opaque one."""
    op = c.a >= 0
    pad = np.zeros((c.h + 2, c.w + 2), dtype=bool)
    pad[1:-1, 1:-1] = op
    near = pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:]
    c.a[near & ~op] = ink
    return c
