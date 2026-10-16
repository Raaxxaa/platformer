"""Builds player_<outfit> and player_<outfit>_trim atlases, anims and previews."""
import os

from . import atlas as A
from . import palette as P
from . import preview as V
from .boxes import PLAYER_HURTBOX
from .outfits import OUTFITS, ANCHOR, BODY_RAMPS, build_outfit
from .poses.player import POSES, FPS

PREVIEW_BG = (0x78, 0xb1, 0x8b)    # plains mid-ground color (bg layer 1 light)

# 08 §6.1 drives (mode, fps)
MODES = {'idle': ('loop', 8), 'run': ('speed', None), 'skid': ('once', None), 'jump': ('loop', 12),
         'apex': ('once', None), 'fall': ('loop', 12), 'double_jump': ('once', 24), 'wall_jump': ('once', 16),
         'land': ('once', 20), 'dash': ('phase', None), 'wall_slide': ('loop', 8), 'ledge_climb': ('phase', None),
         'slide': ('once', None), 'crawl': ('loop', 8), 'dive_windup': ('phase', None), 'dive_fall': ('loop', 16),
         'dive_land': ('phase', None), 'hurt': ('once', 10), 'dead': ('once', 10), 'drink': ('phase', None),
         'cart_ride': ('loop', 6)}


def build(assets, preview):
    anims = []
    hurt = (0, -PLAYER_HURTBOX[1] / 2, PLAYER_HURTBOX[0], PLAYER_HURTBOX[1])
    for o in OUTFITS:
        body, trim = build_outfit(o)
        for name, img in body.items():
            P.check_palette_lock(img, P.allowed(BODY_RAMPS), 'player_' + o, name)
        for name, img in trim.items():
            P.check_palette_lock(img, P.allowed(['trim']), f'player_{o}_trim', name)
        atl = os.path.join(assets, 'atlases')
        A.pack_atlas('player_' + o, body, atl)
        A.pack_atlas(f'player_{o}_trim', trim, atl)
        for key, poses in POSES.items():
            if key.startswith('atk_') or key.startswith('cast_'):
                continue
            mode, fps = MODES[key]
            seg = [{'phase': 'all', 'frames': list(range(len(poses)))}] if mode == 'phase' else None
            anims.append(A.anim(key, 'player_' + o, len(poses), mode, fps, segments=seg))
        col = P.CLASS_COLORS[o]
        rows = []
        for key, poses in POSES.items():
            imgs = []
            for i in range(len(poses)):
                n = f'{key}_{i:02d}'
                im = V.compose_player(body[n], trim['a/' + n], trim['b/' + n], col, col)
                imgs.append(V.overlay(im, ANCHOR, hurt))
            rows.append((f'{key} ({len(poses)})', imgs))
            plain = [V.overlay(V.compose_player(body[f'{key}_{i:02d}'], trim[f'a/{key}_{i:02d}'],
                                                trim[f'b/{key}_{i:02d}'], col, col), ANCHOR)
                     for i in range(len(poses))]
            V.preview_gif(os.path.join(preview, f'player_{o}__{key}.gif'), plain, FPS.get(key, 12), PREVIEW_BG)
        V.preview_sheet(os.path.join(preview, f'player_{o}_sheet.png'), rows, PREVIEW_BG)
    return anims
