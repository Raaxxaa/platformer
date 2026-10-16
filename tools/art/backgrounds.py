"""Parallax backgrounds (08 §10.1). Every shape repeats every 640 px, so the layers tile seamlessly."""
import math
import zlib

import numpy as np
from PIL import Image

from . import palette as P

W, H = 640, 360
ALLOWED = {0: ['pl_sky', 'pl_bg0'], 1: ['pl_bg1'], 2: ['pl_bg2']}


def _rng(asset_id):
    return np.random.default_rng(zlib.crc32(asset_id.encode()))


def _wrap(dx):
    """Circular distance in the 640 px period."""
    return (dx + W / 2) % W - W / 2


def _wave(x, terms):
    return sum(a * np.sin(2 * math.pi * k * x / W + ph) for k, a, ph in terms)


def _paint(img, mask, col):
    img[mask, :3] = col
    img[mask, 3] = 255


def _fill_below(img, xs, top, dark, light, rim=3):
    """Fill every column below `top` with `dark`; the top `rim` px in `light`, 2 px checker between."""
    h = img.shape[0]
    ys = np.arange(h)[:, None]
    t = np.round(top).astype(int)[None, :]
    below = ys >= t
    _paint(img, below, dark)
    _paint(img, below & (ys < t + rim), light)
    checker = ((ys + xs[None, :]) % 2 == 0)
    _paint(img, below & (ys >= t + rim) & (ys < t + rim + 2) & checker, light)


def render(set_name, layer, width=W):
    assert set_name == 'plains'
    xs = np.arange(width)
    img = np.zeros((H, width, 4), np.uint8)
    ys = np.arange(H)[:, None]
    if layer == 0:
        sky = P.RAMPS['pl_sky']
        band = 44
        for i, col in enumerate(sky):
            _paint(img, np.broadcast_to((ys >= i * band), (H, width)), col)
        # a few flat clouds in the lightest band color
        g = _rng('bg_plains_0_clouds')
        for _ in range(5):
            cx, cy = g.integers(0, W), g.integers(40, 150)
            ln, th = g.integers(40, 90), g.integers(4, 8)
            dx = np.abs(_wrap(xs[None, :] - cx))
            body = (dx < ln / 2) & (np.abs(ys - cy) < th / 2 + 2 * np.cos(np.minimum(dx / ln * math.pi, math.pi / 2)))
            _paint(img, body, sky[5])
            _paint(img, body & (ys >= cy + th / 2 - 1), sky[4])
        top = 238 + _wave(xs, [(1, 14, 0.4), (3, 9, 1.9), (7, 4, 0.2)])
        _fill_below(img, xs, top, P.RAMPS['pl_bg0'][0], P.RAMPS['pl_bg0'][1], rim=2)
        return Image.fromarray(img, 'RGBA')
    if layer == 1:
        g = _rng('bg_plains_1_forest')
        top = np.full(width, 1e9)
        n = 26
        for k in range(n):
            cx = k * W / n + g.uniform(-6, 6)
            r = g.uniform(12, 22)
            cy = 272 + g.uniform(-10, 6)
            dx = np.abs(_wrap(xs - cx))
            cap = np.where(dx < r, cy - np.sqrt(np.maximum(r * r - dx * dx, 0)), 1e9)
            top = np.minimum(top, cap)
        top = np.minimum(top, 290 + _wave(xs, [(2, 4, 0.0)]))
        _fill_below(img, xs, top, P.RAMPS['pl_bg1'][0], P.RAMPS['pl_bg1'][1], rim=3)
        return Image.fromarray(img, 'RGBA')
    if layer == 2:
        dark, light = P.RAMPS['pl_bg2']
        g = _rng('bg_plains_2_trees')
        trees = [(k * W / 4 + g.uniform(-40, 40), g.uniform(46, 58)) for k in range(4)]
        # trunks
        for cx, r in trees:
            dx = _wrap(xs[None, :] - cx)
            tw = 4 + r / 8 + np.maximum(0, ys - 300) * 0.18
            _paint(img, (np.abs(dx) < tw) & (ys > 150), dark)
            _paint(img, (dx > -tw) & (dx < -tw + 2) & (ys > 150) & ((ys + xs[None, :]) % 2 == 0), light)
            for side, by in ((-1, 215), (1, 200)):          # two branches
                bdx = dx - side * (ys - by) * -0.9
                _paint(img, (np.abs(bdx) < 2.5) & (ys < by) & (ys > by - 26), dark)
        # canopies: clusters of discs, lit top-left
        for cx, r in trees:
            for j in range(12):
                ox, oy = g.uniform(-r, r), g.uniform(-r * 0.45, r * 0.35)
                rr = g.uniform(r * 0.35, r * 0.6)
                dx = _wrap(xs[None, :] - (cx + ox))
                dy = ys - (160 + oy)
                d = dx * dx + dy * dy
                _paint(img, d < rr * rr, dark)
                _paint(img, (d < rr * rr) & ~((dx - 2) ** 2 + (dy - 2) ** 2 < (rr - 1) ** 2) & (dx < 2) & (dy < 2),
                       light)
        # near ground strip
        top = 334 + _wave(xs, [(3, 3, 1.0), (8, 2, 0.5)])
        _fill_below(img, xs, top, dark, light, rim=2)
        return Image.fromarray(img, 'RGBA')
    raise ValueError(layer)
