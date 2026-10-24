#!/usr/bin/env python3
"""Placeholder app icons (M12 Task 6) until ART10 draws the real ones: a dark tile with a gold blade.
Writes public/app/icon-192.png, icon-512.png and apple-touch-icon.png. Run: python3 scripts/placeholder_icons.py"""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'app')
os.makedirs(OUT, exist_ok=True)


def icon(size):
    im = Image.new('RGBA', (size, size), (13, 11, 20, 255))
    d = ImageDraw.Draw(im)
    m = size * 0.1
    d.rounded_rectangle([m, m, size - m, size - m], radius=size * 0.12, outline=(255, 211, 74, 255), width=max(2, size // 40))
    # A blade, bottom-left to top-right, with a guard.
    s = size
    d.polygon([(s * .30, s * .70), (s * .66, s * .26), (s * .74, s * .34), (s * .38, s * .78)], fill=(242, 239, 230, 255))
    d.polygon([(s * .22, s * .62), (s * .30, s * .54), (s * .46, s * .70), (s * .38, s * .78)], fill=(255, 211, 74, 255))
    return im


for name, size in (('icon-192.png', 192), ('icon-512.png', 512), ('apple-touch-icon.png', 180)):
    icon(size).save(os.path.join(OUT, name), optimize=False)
print('wrote', OUT)
