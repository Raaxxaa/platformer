"""Master palette (08 §3) and the palette lock (08 §3.1)."""
import json
import math


def _hex(*codes):
    return [(int(c[1:3], 16), int(c[3:5], 16), int(c[5:7], 16)) for c in codes]


def sky_bands(top, bottom, n=6):
    """n bands from top to bottom, linear sRGB interpolation, each channel rounded half up."""
    out = []
    for i in range(n):
        t = i / (n - 1)
        out.append(tuple(int(math.floor(a + (b - a) * t + 0.5)) for a, b in zip(top, bottom)))
    return out


RAMPS = {
    # 08 §3.2 shared ramps (dark -> light)
    'ink': _hex('#0d0b14'),
    'white': _hex('#f8f6f0'),
    'gray': _hex('#2b2934', '#4b4858', '#76737f', '#a9a6b1', '#dddce2'),
    'skin': _hex('#5e3b30', '#9c6149', '#d4966f', '#f3c8a1'),
    'hair': _hex('#2e1d19', '#563425', '#87573a'),
    'p_cloth': _hex('#1a2140', '#2b3b6c', '#4565a6', '#7b9ed6'),
    'p_leather': _hex('#3b2519', '#6b4127', '#9b6639', '#c9945b'),
    'p_steel': _hex('#3d4351', '#697387', '#9ba7b9', '#d3dbe5'),
    'trim': _hex('#707070', '#b0b0b0', '#ffffff'),
    'smear': _hex('#b0b0b0', '#ffffff'),
    'w_steel': _hex('#333a4a', '#5f6b82', '#97a5bb', '#d8e1ec'),
    'w_wood': _hex('#3a2216', '#6a3d22', '#9a6233'),
    'w_gold': _hex('#6b4615', '#a8781f', '#e0b43c', '#fbe58a'),
    'w_magic': _hex('#2d1d55', '#5638a0', '#8d6ae0', '#c9b4ff'),
    'npc': _hex('#1e3b3a', '#2f5e55', '#4f8a72', '#86b996'),
    'fx_fire': _hex('#8a2416', '#d8481e', '#ff7a2e', '#ffd86b'),
    'fx_ice': _hex('#2f6fb0', '#4fa9e0', '#8fdcff', '#e8fbff'),
    'fx_bolt': _hex('#3a58c8', '#7ad8ff', '#ffe94a', '#fffbe0'),
    'fx_poison': _hex('#1f5a32', '#2f8a3e', '#78d94a', '#c8f58a'),
    'fx_wind': _hex('#5aa890', '#8fd6bc', '#b9f2dc'),
    'fx_dark': _hex('#1e1030', '#3d1f5c', '#6a3a94', '#a070d0'),
    'fx_heal': _hex('#7a1e3a', '#c8385a', '#f07090', '#ffc8d8'),
    # 08 §3.7 plains
    'pl_soil': _hex('#2f211f', '#4f3428', '#7a5035', '#a5744a', '#c99a63'),
    'pl_grass': _hex('#1f3f2a', '#2c6334', '#4c933a', '#8bc54a'),
    'pl_wood': _hex('#3a2a1e', '#6b4a2c', '#9a6e3e'),
    'pl_sky': sky_bands((0x78, 0xbf, 0xe6), (0xd9, 0xee, 0xf0)),
    'pl_bg0': _hex('#9ec7c6', '#b4d6cd'),
    'pl_bg1': _hex('#5f9b7c', '#78b18b'),
    'pl_bg2': _hex('#2f5f49', '#3f7a56'),
    # 08 §3.7 villages
    'vl_wood': _hex('#3b2618', '#6a4228', '#9a663a', '#c99560'),
    'vl_plaster': _hex('#8c7e6a', '#b8a88c', '#e2d6b8'),
    'vl_light': _hex('#ffd27a', '#fff0c0'),
    'vh_sky': sky_bands((0xf2, 0xb4, 0x8a), (0xfb, 0xe6, 0xc8)),      # village_home (dawn)
    'vc_sky': sky_bands((0xe0, 0x78, 0x5a), (0xf6, 0xc8, 0x90)),      # village_crossroads (sunset)
    # 08 §3.7 mountains (Stage 2, Caves & Mountains)
    'mt_rock': _hex('#1c1e2e', '#31364b', '#4d556e', '#747f98', '#a7b2c6'),
    'mt_snow': _hex('#6ea6cf', '#a5d6ef', '#e5f5ff'),
    'mt_ice': _hex('#3e7fb8', '#6fb4e0', '#a9e0f5', '#e2f7ff'),
    'mt_sky': sky_bands((0x58, 0x78, 0xae), (0xbc, 0xcc, 0xe0)),
    'mt_bg0': _hex('#8aa1c2', '#a6bad4'),
    'mt_bg1': _hex('#5c7096', '#6f819f'),
    'mt_bg2': _hex('#384464', '#455378'),
    'mtc_sky': sky_bands((0x0f, 0x11, 0x19), (0x16, 0x1a, 0x26)),
    'mtc_bg0': _hex('#0f1119', '#161a26'),
    'mtc_bg1': _hex('#1b2030', '#232a3d'),
    'mtc_bg2': _hex('#2a3247', '#343d55'),
    # 08 §3.7 swamps (Stage 2, Dark Forest & Swamps)
    'sw_mud': _hex('#17171b', '#29272a', '#433a36', '#635548'),
    'sw_moss': _hex('#1c2e27', '#2c4834', '#476842', '#6a8a52'),
    'sw_water': _hex('#173232', '#24504a', '#4d8878', '#a6d6b6'),
    'sw_sky': sky_bands((0x12, 0x1a, 0x20), (0x2a, 0x41, 0x40)),
    'sw_bg0': _hex('#22333a', '#2a3f45'),
    'sw_bg1': _hex('#19262b', '#213239'),
    'sw_bg2': _hex('#0f171b', '#162125'),
    'en_violet': _hex('#2d1e3d', '#4f3469', '#7d599f', '#b389cf'),
    'en_glow': _hex('#39aebf', '#8cefef', '#e6ffff'),
    'en_ochre': _hex('#4a2d1b', '#7a4926', '#b07335', '#e2a951'),
    'en_magenta': _hex('#3a1736', '#6a2a59', '#a1457d', '#d978a7'),
    'en_olive': _hex('#2d391a', '#4e6526', '#7d9937', '#b5cb59'),
    'en_red': _hex('#4a1824', '#7e2a34', '#b8443f', '#e27b5b'),
    'en_slate': _hex('#24263a', '#444a6a', '#737ca0', '#adb6d4'),
    # 08 §3.7 kingdom (Stage 3, Enemy Kingdom) and its night village (Rebel Camp)
    'kg_stone': _hex('#2d2521', '#4d3f39', '#786454', '#a68e76', '#cfbb9f'),
    'kg_roof': _hex('#592a20', '#894330', '#b76943'),
    'kg_sky': sky_bands((0x3a, 0x3a, 0x5e), (0x9a, 0x8a, 0x94)),
    'kg_bg0': _hex('#6a6482', '#7f7792'),
    'kg_bg1': _hex('#4a4562', '#58516f'),
    'kg_bg2': _hex('#2e2a3f', '#38334a'),
    'rc_sky': sky_bands((0x0c, 0x0e, 0x22), (0x2a, 0x2a, 0x4a)),    # village_rebel_camp (night)
    # 08 §3.7 castle (Stage 4, King's Castle)
    'cs_stone': _hex('#16131e', '#29243a', '#423a55', '#615776', '#897fa0'),
    'cs_trim': _hex('#5c4318', '#93702a', '#c9a24a'),
    'cs_carpet': _hex('#4a1020', '#7a1a30', '#a8283e'),
    'cs_sky': sky_bands((0x0d, 0x0b, 0x14), (0x1e, 0x1a, 0x2a)),
    'cs_bg0': _hex('#19152a', '#211b33'),
    'cs_bg1': _hex('#241e36', '#2c2541'),
    'cs_bg2': _hex('#30294a', '#3a3257'),
    # 08 §3.7 enemy ramps of Stages 3-4
    'en_steel': _hex('#252a37', '#495167', '#7d879d', '#bfc7d7'),
    'en_black': _hex('#1c1a27', '#2f2b3d', '#4a465f', '#75708f'),
    'en_gold': _hex('#5a3d14', '#9b6e23', '#d9a83b', '#f9e08b'),
    'en_verdigris': _hex('#1d3933', '#2e594d', '#4a8a72', '#7bc0a0'),
    'en_ghost': _hex('#2a8999', '#59cfd7', '#c1f7f7'),
    # 08 §3.7 Dragon ramps (the §7.4 recolor)
    'dr_red': _hex('#4a1010', '#8a1e18', '#cf3b22', '#ff7a3a'),
    'dr_white': _hex('#5a6884', '#8fa0bc', '#c6d4e8', '#f2f8ff'),
    'dr_storm': _hex('#141f4a', '#26398a', '#3f6fd0', '#6fd2ff'),
    'dr_green': _hex('#14321c', '#22582e', '#3f8f3a', '#8ed65a'),
    # The plains row lists en_bone without values; the swamps row gives them (plan ART1 Task 1).
    'en_bone': _hex('#59534a', '#8a8478', '#b8b2a4', '#e0dccc'),
}

# 08 §3.3 / 07 §3.2 grade colors and 08 §3.4 / 07 §3.3 class colors (07 owns them; copied unchanged).
GRADE_COLORS = dict(zip('FCBAS', _hex('#9b9ba6', '#5ad16a', '#4a9dff', '#b264ff', '#ffc93c')))
CLASS_COLORS = dict(zip(['swordsman', 'tank', 'archer', 'wizard', 'none'],
                        _hex('#ff5a5a', '#ff9a3c', '#a8d846', '#42d9ff', '#9d98b0')))

PLAINS_WORLD_RAMPS = ['pl_soil', 'pl_grass', 'pl_wood', 'pl_sky', 'pl_bg0', 'pl_bg1', 'pl_bg2']
MOUNTAINS_WORLD_RAMPS = ['mt_rock', 'mt_snow', 'mt_ice', 'mt_sky', 'mt_bg0', 'mt_bg1', 'mt_bg2',
                         'mtc_sky', 'mtc_bg0', 'mtc_bg1', 'mtc_bg2']
MOUNTAINS_ENEMY_RAMPS = ['ink', 'white', 'gray', 'en_ochre', 'en_magenta', 'en_olive', 'en_bone', 'fx_fire']
SWAMPS_WORLD_RAMPS = ['sw_mud', 'sw_moss', 'sw_water', 'sw_sky', 'sw_bg0', 'sw_bg1', 'sw_bg2']
SWAMPS_ENEMY_RAMPS = ['ink', 'white', 'gray', 'en_violet', 'en_bone', 'en_glow', 'en_red', 'fx_poison']
KINGDOM_WORLD_RAMPS = ['kg_stone', 'kg_roof', 'kg_sky', 'kg_bg0', 'kg_bg1', 'kg_bg2', 'rc_sky']
KINGDOM_ENEMY_RAMPS = ['ink', 'white', 'gray', 'skin', 'hair', 'en_red', 'en_steel', 'en_black', 'fx_fire', 'en_bone', 'w_magic']
CASTLE_WORLD_RAMPS = ['cs_stone', 'cs_trim', 'cs_carpet', 'cs_sky', 'cs_bg0', 'cs_bg1', 'cs_bg2']
CASTLE_ENEMY_RAMPS = ['ink', 'white', 'gray', 'skin', 'hair', 'en_red', 'en_steel', 'en_gold', 'en_verdigris', 'en_ghost',
                      'en_black', 'fx_fire', 'en_bone', 'w_magic']
DRAGON_RAMPS = {'red': 'dr_red', 'white': 'dr_white', 'storm': 'dr_storm', 'green': 'dr_green'}
PLAYER_BODY_RAMPS = ['ink', 'skin', 'hair', 'p_cloth', 'p_leather', 'p_steel']
PLAINS_ENEMY_RAMPS = ['ink', 'white', 'skin', 'hair', 'en_red', 'en_slate', 'en_bone', 'gray']


def allowed(ramp_names):
    s = set()
    for n in ramp_names:
        s.update(RAMPS[n])
    return s


class PaletteError(Exception):
    def __init__(self, atlas, frame, x, y, color):
        super().__init__(f'palette lock: atlas={atlas} frame={frame} x={x} y={y} color={color}')
        self.atlas, self.frame, self.x, self.y, self.color = atlas, frame, x, y, color


def check_palette_lock(img, allowed_set, atlas, frame=None):
    img = img.convert('RGBA')
    w, h = img.size
    px = img.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if a != 255 or (r, g, b) not in allowed_set:
                raise PaletteError(atlas, frame, x, y, (r, g, b, a))


def _num(c):
    return '0x%02x%02x%02x' % c


def write_ts(path):
    lines = ['// Generated by tools/art/palette.py. Never edit by hand.',
             'export const PALETTE: Record<string, number[]> = {']
    for name, ramp in RAMPS.items():
        lines.append(f'  {name}: [{", ".join(_num(c) for c in ramp)}],')
    lines.append('};')
    lines.append('// Copy of 07 §3 UI colors; only a test reads it (08 §12.8 check 6).')
    lines.append('export const UI_COLORS_COPY: Record<string, number> = {')
    for name, c in UI_COLORS.items():
        lines.append(f'  {name}: {_num(c)},')
    lines.append('};')
    lines.append('')
    with open(path, 'w', newline='\n') as f:
        f.write('\n'.join(lines))


def write_json(path):
    data = {name: ['#%02x%02x%02x' % c for c in ramp] for name, ramp in RAMPS.items()}
    with open(path, 'w', newline='\n') as f:
        json.dump(data, f, indent=1)
        f.write('\n')


# 08 §3.6: a copy of 07's UI colors (07 §3.1 tokens, §3.2 grades, §3.3 classes). Used only for `ui` atlas
# pixels, font pixels and previews; written to palette.generated.ts as UI_COLORS_COPY.
UI_COLORS = {
    'ink': (0x0d, 0x0b, 0x14), 'panel': (0x1b, 0x18, 0x26), 'panelBorder': (0x4a, 0x45, 0x60),
    'text': (0xf2, 0xef, 0xe6), 'textDim': (0x9d, 0x98, 0xb0), 'textOff': (0x5c, 0x58, 0x70),
    'slotEmpty': (0x3a, 0x36, 0x48), 'good': (0x5c, 0xe0, 0x6a), 'bad': (0xff, 0x4a, 0x4a),
    'highlight': (0xff, 0xd3, 0x4a), 'hp': (0xe5, 0x40, 0x4a), 'hpLow': (0xff, 0x70, 0x80),
    'flask': (0xff, 0x8f, 0xa0), 'rush1': (0xff, 0xd3, 0x4a), 'rush2': (0xff, 0xa8, 0x3a),
    'rush3': (0xff, 0x5a, 0x3a), 'curse': (0xd0, 0x30, 0x6a), 'barrier': (0x6f, 0xe3, 0xff),
    'ward': (0xc8, 0xa0, 0xff), 'elite': (0xff, 0xc9, 0x3c), 'crit': (0xff, 0xe9, 0x4a),
}
UI_COLORS.update({f'grade_{g}': c for g, c in GRADE_COLORS.items()})
UI_COLORS.update({f'class_{k}': c for k, c in CLASS_COLORS.items() if k != 'none'})
UI_COLORS['class_neutral'] = CLASS_COLORS['none']

# Slot table: every ramp color gets one integer slot id, used by raster canvases.
COLORS = []
_SLOT = {}
for _ramp in RAMPS.values():
    for _c in _ramp:
        if _c not in _SLOT:
            _SLOT[_c] = len(COLORS)
            COLORS.append(_c)


for _c in UI_COLORS.values():
    if _c not in _SLOT:
        _SLOT[_c] = len(COLORS)
        COLORS.append(_c)
_PURE_WHITE = (255, 255, 255)


def sid(color):
    """Slot id of an RGB tuple (must be a ramp color)."""
    return _SLOT[color]


def ramp_ids(name):
    """Slot ids of a ramp; 'ui:<key>' gives a one-color ramp from the 07 copy."""
    if name.startswith('ui:'):
        return [_SLOT[UI_COLORS[name[3:]]]]
    return [_SLOT[c] for c in RAMPS[name]]


def allowed_ui():
    """`ui` atlas colors (08 §12.5): ink, white, gray, w_*, fx_*, #ffffff and the 07 copy."""
    s = allowed(['ink', 'white', 'gray', 'trim'] + [k for k in RAMPS if k.startswith(('w_', 'fx_'))])
    return s | set(UI_COLORS.values())


INK = _SLOT[RAMPS['ink'][0]]
WHITE = _SLOT[RAMPS['white'][0]]
