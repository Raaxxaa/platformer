"""ART8: atlas build, anim defs and previews shared by `kingdom.py`, `castle.py` and the bosses (08 §7.2, §12.5, §12.7)."""
import os

from .. import atlas as A
from .. import palette as P
from .plains import on_ground

MODES = {'idle': ('loop', 6), 'walk': ('speed', None), 'hurt': ('once', None), 'stagger': ('loop', 8),
         'knockdown': ('once', 10), 'death': ('once', 10), 'fly': ('loop', 12), 'float': ('loop', 10),
         'dazed': ('loop', 6), 'channel': ('loop', 6), 'guard_hit': ('once', None), 'stone': ('once', None),
         'pile': ('once', None), 'bulwark': ('once', None), 'hang': ('loop', 4), 'turn': ('once', 3),
         'perched': ('loop', 2), 'hover': ('loop', 10), 'dive': ('once', None), 'fall': ('once', None),
         'breath_loop': ('loop', 8)}
PHASE = {'wake': 0.5, 'rise': 0.5, 'takeoff': 0.6, 'intro': 1.0, 'transition': 1.0}     # phase anims, nominal seconds


def default_segments(n):
    return [{'phase': 'tele', 'frames': [0, 1]}, {'phase': 'act', 'frames': [2]},
            {'phase': 'rec', 'frames': [n - 2, n - 1]}]


def anim_def(atlas, key, n, seg_override=None, fps_override=None):
    """`key` is the full anim key (`<enemy>_<anim>` or the boss's bare key); `anim` is its last part."""
    anim = key
    if anim == 'break':
        return A.anim(key, atlas, n, 'phase', segments=[{'phase': 'all', 'frames': [0]}, {'phase': 'all', 'frames': [1, 2], 'loopFps': 4}])
    if anim == 'death' and n == 9:                       # bosses: 9 frames once at 6 fps = 1.5 s (08 §7.4)
        return A.anim(key, atlas, n, 'once', 6)
    if anim.startswith('atk_') or '_atk_' in anim:
        return A.anim(key, atlas, n, 'phase', segments=seg_override or default_segments(n))
    base = next((m for m in MODES if anim == m or anim.endswith('_' + m)), None)
    if base in ('collapse',):
        return A.anim(key, atlas, n, 'once', 13)
    if any(anim == p or anim.endswith('_' + p) for p in PHASE):
        return A.anim(key, atlas, n, 'phase', segments=[{'phase': 'all', 'frames': list(range(n))}])
    if anim.endswith('collapse'):
        return A.anim(key, atlas, n, 'once', 13)
    if base is None:
        raise KeyError(key)
    mode, fps = MODES[base]
    return A.anim(key, atlas, n, mode, fps_override or fps)


def build_enemy_atlas(atlas, enemies, tables, drawer, size_fn, allowed_ramps, preview, bg_color, seg_overrides=None,
                      hidden=(), assets=None, label_w=330, boss=False, pack_kw=None):
    """tables: {enemy: {anim: [poses]}}; drawer(enemy, pose, size, feet) -> RGBA image; size_fn(enemy, anim) ->
    ((w, h), (anchorX, anchorY)). Returns the anims.json entries (anims in `hidden` are drawn but not listed)."""
    from .. import preview as V
    from ..boxes import HURTBOX, ATTACK_BOX
    seg_overrides = seg_overrides or {}
    frames, anims = {}, []
    for enemy in enemies:
        for anim, poses in tables[enemy].items():
            size, (ax, ay) = size_fn(enemy, anim)
            for i, pose in enumerate(poses):
                key = f'{anim}_{i:02d}' if boss else f'{enemy}_{anim}_{i:02d}'
                frames[key] = on_ground(drawer(enemy, pose, size, (ax, ay - 2)), ay)
            full = anim if boss else f'{enemy}_{anim}'
            if (enemy, anim) in hidden:
                continue
            anims.append(anim_def(atlas, full, len(poses), seg_overrides.get((enemy, anim))))
    allowed = P.allowed(allowed_ramps)
    for n, img in frames.items():
        P.check_palette_lock(img, allowed, atlas, n)
    if assets:
        A.pack_atlas(atlas, frames, os.path.join(assets, 'atlases'), **(pack_kw or {}))
    if preview is None:
        return anims, frames
    rows = []
    owner = {}
    for enemy in enemies:
        for anim in tables[enemy]:
            owner[(f'{anim}' if boss else f'{enemy}_{anim}')] = (enemy, anim)
    for enemy in enemies:
        for anim, poses in tables[enemy].items():
            size, anchor = size_fn(enemy, anim)
            w, h = HURTBOX[enemy]
            hurt = (0, -h / 2, w, h)
            atk = ATTACK_BOX.get(enemy, {}).get(anim[4:]) if anim.startswith('atk_') else None
            imgs = []
            ad = next((a for a in anims if a['key'] == (anim if boss else f'{enemy}_{anim}')), None)
            act = set()
            if ad and ad.get('segments'):
                for sg in ad['segments']:
                    if sg['phase'].startswith('act'):
                        act.update(sg['frames'])
            for i in range(len(poses)):
                k = f'{anim}_{i:02d}' if boss else f'{enemy}_{anim}_{i:02d}'
                imgs.append(V.overlay(frames[k], anchor, hurt, atk if (atk and i in act) else None))
            fps = (ad or {}).get('fps') or 8
            rows.append((f'{enemy} {anim} ({len(poses)})', imgs))
            plain = [V.overlay(frames[f'{anim}_{i:02d}' if boss else f'{enemy}_{anim}_{i:02d}'], anchor) for i in range(len(poses))]
            V.preview_gif(os.path.join(preview, f'{atlas}__{enemy}_{anim}.gif'), plain, fps, bg_color)
    V.preview_sheet(os.path.join(preview, f'{atlas}_sheet.png'), rows, bg_color, label_w=label_w)
    return anims, frames
