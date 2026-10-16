"""Builds player_<outfit> and player_<outfit>_trim atlases, anims and previews."""
import os

from . import atlas as A
from . import palette as P
from . import preview as V
from .boxes import PLAYER_HURTBOX
from .outfits import OUTFITS, ANCHOR, build_outfit
from .poses.player import POSES, FPS

PREVIEW_BG = (0x78, 0xb1, 0x8b)    # plains mid-ground color (bg layer 1 light)


def build(assets, preview):
    anims = []
    hurt = (0, -PLAYER_HURTBOX[1] / 2, PLAYER_HURTBOX[0], PLAYER_HURTBOX[1])
    for o in OUTFITS:
        body, trim = build_outfit(o)
        for name, img in body.items():
            P.check_palette_lock(img, P.allowed(P.PLAYER_BODY_RAMPS), 'player_' + o, name)
        for name, img in trim.items():
            P.check_palette_lock(img, P.allowed(['trim']), f'player_{o}_trim', name)
        atl = os.path.join(assets, 'atlases')
        A.pack_atlas('player_' + o, body, atl)
        A.pack_atlas(f'player_{o}_trim', trim, atl)
        anims.append(A.anim('idle', 'player_' + o, 6, 'loop', FPS['idle']))
        anims.append(A.anim('run', 'player_' + o, 8, 'speed'))
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
