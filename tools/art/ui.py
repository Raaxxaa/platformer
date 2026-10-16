"""The `ui` atlas (08 §12.5, 07 §3.4): 94 frames, one page, public/assets/ui/ui.png + ui.json."""
import os

from . import atlas as A
from . import icons as I
from . import palette as P

CLASSES = ['swordsman', 'tank', 'archer', 'wizard']
ELEMENTS = ['fire', 'ice', 'lightning', 'poison', 'wind']
STATUSES = ['burning', 'poisoned', 'chilled', 'rooted']


def build_frames():
    fr = {}
    fr.update({f'icon_weapon_{w}': I.weapon_icon(w) for w in I.WEAPONS})
    fr.update({f'icon_ability_{a}': I.ability_icon(a) for a in I.ABILITIES})
    fr.update({f'icon_stat_{s}': I.stat_icon(s) for s in I.STATS})
    fr.update({f'icon_class_{c}': I.class_icon(c) for c in CLASSES})
    fr.update({f'elem_{e}': I.element_icon(e) for e in ELEMENTS})
    fr.update({f'status_{s}': I.status_icon(s) for s in STATUSES})
    fr.update({f'effect_{e}': I.effect_icon(e) for e in I.LUCKY})
    fr.update({f'effect_curse_{c}': I.effect_icon(c, curse=True) for c in I.CURSES})
    fr.update(I.hud_frames())
    fr.update(I.tint_frames())
    return fr


def build(assets, preview):
    from PIL import Image
    fr = build_frames()
    for k, img in fr.items():
        ok = {(255, 255, 255)} if k.startswith(('class_', 'prompt_ps_')) else P.allowed_ui()
        P.check_palette_lock(img, ok, 'ui', k)
    A.pack_atlas('ui', fr, os.path.join(assets, 'ui'), strict=False)
    # preview: every frame on a panel, 5×
    names = sorted(fr)
    cols = 16
    cell = 18
    rows = (len(names) + cols - 1) // cols
    im = Image.new('RGBA', (cols * cell + 2, rows * cell + 2), (0x1b, 0x18, 0x26, 255))
    for i, n in enumerate(names):
        im.alpha_composite(fr[n], (2 + (i % cols) * cell, 2 + (i // cols) * cell))
    im.resize((im.width * 5, im.height * 5), Image.NEAREST).save(os.path.join(preview, 'ui_sheet.png'))
    return fr
