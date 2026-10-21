"""One WAV with every ART8 sound in a row (0.4 s apart) plus a timed list, for the user to listen to."""
import os
import wave

import numpy as np

from .sfx_stage34 import SFX34, render_all, files_for
from .synth import SR, finalize

GAP = 0.4
VOL = [('vo_', 0.4), ('proj_', 0.45), ('boss_', 0.8), ('dragon_', 0.8), ('breath_', 0.8), ('wing_', 0.8), ('cannon_', 0.5),
       ('blade_', 0.5), ('platform_', 0.45), ('tele_', 0.5), ('step_', 0.22), ('shot_wand', 0.3), ('shot_', 0.5), ('throw_', 0.5),
       ('tome_', 0.5), ('rune_', 0.5), ('hit_', 0.65), ('block', 0.65), ('parry', 0.65), ('shield_', 0.65), ('ab_', 0.6),
       ('boulder_', 0.6), ('turret_', 0.6), ('time_', 0.6)]


def vol(sid):
    for k, v in VOL:
        if sid.startswith(k):
            return v
    raise KeyError(sid)


def build(docs_dir):
    os.makedirs(docs_dir, exist_ok=True)
    rendered = render_all()
    parts, lines, t = [], [], 0.0
    for sid, (_n, _r, desc) in SFX34.items():
        x = finalize(rendered[files_for(sid)[0]]).astype(np.float64) / 32767 * vol(sid)
        m, s = divmod(t, 60)
        lines.append(f'| {int(m)}:{s:04.1f} | `{sid}` | {desc} | {vol(sid)} |')
        parts += [x, np.zeros(int(GAP * SR))]
        t += len(x) / SR + GAP
    data = np.round(np.concatenate(parts) * 32767).astype('<i2')
    with wave.open(os.path.join(docs_dir, 'sounds_stage34.wav'), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())
    md = ['# Stage 3-4, Dragon, new weapons and abilities: sounds listening sheet', '',
          '`sounds_stage34.wav` plays every new sound once, in this order, with 0.4 s of silence between them. '
          'Each one plays at its in-game volume (08 §13.3). Sounds with variants play their first variant.', '',
          '| Starts at | Sound | What it is | Volume |', '|---|---|---|---|'] + lines + [
          '', f'Total length: {int(t // 60)}:{t % 60:04.1f}.', '']
    with open(os.path.join(docs_dir, 'sounds_stage34.md'), 'w', newline='\n') as f:
        f.write('\n'.join(md))
