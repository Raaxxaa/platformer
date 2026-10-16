"""Preview sheets and GIFs at 4× (08 §12.7). Previews are for eyes only, never shipped."""
from PIL import Image, ImageDraw

SCALE = 4
BLUE = (60, 140, 255, 255)
RED = (255, 40, 40, 255)


def _box_rect(anchor, box):
    """box = (dx, dy, w, h) centered at feet + (dx, dy). Returns frame-px rect."""
    ax, ay = anchor
    dx, dy, w, h = box
    cx, cy = ax + dx, ay + dy
    return (cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2)


def overlay(img, anchor, hurt=None, attack=None, scale=SCALE):
    big = img.resize((img.width * scale, img.height * scale), Image.NEAREST)
    d = ImageDraw.Draw(big)
    for box, col in ((hurt, BLUE), (attack, RED)):
        if box:
            x0, y0, x1, y1 = _box_rect(anchor, box)
            d.rectangle([x0 * scale, y0 * scale, x1 * scale - 1, y1 * scale - 1], outline=col)
    return big


def preview_sheet(path, rows, bg, label_w=150):
    """rows: list of (label, [overlaid 4x images])."""
    if not rows:
        return
    w = label_w + max(sum(i.width + 4 for i in imgs) for _l, imgs in rows) + 4
    h = sum(max(i.height for i in imgs) + 6 for _l, imgs in rows) + 4
    sheet = Image.new('RGBA', (w, h), bg + (255,))
    d = ImageDraw.Draw(sheet)
    y = 4
    for label, imgs in rows:
        d.text((4, y + 4), label, fill=(0, 0, 0, 255))
        x = label_w
        for im in imgs:
            sheet.alpha_composite(im, (x, y))
            x += im.width + 4
        y += max(i.height for i in imgs) + 6
    sheet.convert('RGB').save(path)


def preview_gif(path, frames, fps, bg):
    """frames: 4x RGBA images; written at real fps on a solid bg."""
    out = []
    for f in frames:
        b = Image.new('RGB', f.size, bg)
        b.paste(f, (0, 0), f)
        out.append(b)
    ms = int(round(1000 / fps))
    out[0].save(path, save_all=True, append_images=out[1:], duration=ms, loop=0, optimize=False)
