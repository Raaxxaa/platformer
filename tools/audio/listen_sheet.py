"""One WAV with every Stage 1 sound in a row (0.4 s apart) plus a timed list, for the user to listen to."""
import os
import wave

import numpy as np

from .sfx_defs import SFX, render_all, files_for
from .synth import SR, finalize

GAP = 0.4
# 08 §13.3 playback volumes, so the sheet plays each sound as loud as the game will
VOL = {'vo_': 0.4, 'boss_': 0.8, 'enemy_swing': 0.45, 'enemy_death': 0.55, 'proj_': 0.45, 'rock_shatter': 0.45,
       'rock_whistle': 0.5, 'hit_': 0.65, 'swing_': 0.5, 'player_': 0.8, 'jump': 0.45, 'double_jump': 0.45,
       'wall_jump': 0.45, 'land': 0.45, 'dash': 0.5, 'slide': 0.5, 'dive_': 0.6, 'step_': 0.22,
       'flask_tick': 0.25, 'flask_': 0.5, 'door_': 0.6, 'arena_': 0.6, 'timed_': 0.6,
       'ledge_grab': 0.5, 'drop_through': 0.5, 'spike_hit': 0.45, 'rush_': 0.45, 'charge_': 0.4,
       'explosion_': 0.75, 'lucky_': 0.7, 'jackpot': 0.7, 'chest_': 0.6, 'cursed_open': 0.6, 'curse_lifted': 0.6,
       'key_pickup': 0.5, 'keys_full': 0.5, 'coin': 0.5, 'item_pop': 0.5, 'pickup_': 0.5, 'blueprint': 0.5,
       'purchase': 0.6, 'cant_afford': 0.6, 'upgrade': 0.6, 'sell': 0.6, 'reroll': 0.6, 'split_': 0.6, 'pb': 0.6,
       'sleep': 0.6, 'restart': 0.6, 'ui_': 0.5}


def vol(sid):
    for k, v in VOL.items():
        if sid.startswith(k):
            return v
    raise KeyError(sid)


def build(docs_dir):
    os.makedirs(docs_dir, exist_ok=True)
    rendered = render_all()
    parts, lines, t = [], [], 0.0
    for sid, (_n, _r, desc) in SFX.items():
        x = finalize(rendered[files_for(sid)[0]]).astype(np.float64) / 32767 * vol(sid)
        m, s = divmod(t, 60)
        lines.append(f'| {int(m)}:{s:04.1f} | `{sid}` | {desc} | {vol(sid)} |')
        parts += [x, np.zeros(int(GAP * SR))]
        t += len(x) / SR + GAP
    data = np.round(np.concatenate(parts) * 32767).astype('<i2')
    with wave.open(os.path.join(docs_dir, 'sounds_stage1.wav'), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())
    md = ['# Stage 1 sounds — listening sheet', '',
          '`sounds_stage1.wav` plays every Stage 1 sound once, in this order, with 0.4 s of silence between them. '
          'Each one plays at its in-game volume (08 §13.3), so you hear how loud they are next to each other. '
          'Sounds with variants play their first variant.', '',
          '| Starts at | Sound | What it is | Volume |', '|---|---|---|---|'] + lines + [
          '', f'Total length: {int(t // 60)}:{t % 60:04.1f}.', '']
    with open(os.path.join(docs_dir, 'sounds_stage1.md'), 'w', newline='\n') as f:
        f.write('\n'.join(md))
