"""ART9 entry: instrument samples, track JSON, per-track preview WAVs, the combined preview and the listening sheet.
The renderer here mirrors the in-game sequencer (08 §14.1): samples are pitched by playbackRate = 2^((midi - root)/12)
(linear interpolation), 5 ms attack, linear release after the note length, channel gain x velocity. Preview is mono."""
import json
import os

import numpy as np

from . import instruments
from .music import tracks as T
from .music.lib import SPB, write_json

SR = instruments.SR
LAYERS = ('base', 'L1', 'L2', 'L3')
TITLES = {
    'title': ('Title, menus, run summary', 'Calm and a little sad: soft pad and strings with a slow bell tune in D minor.'),
    'village': ('All 4 villages', 'Warm and safe: plucked guitar-like arpeggios, a gentle tune, no drums, F major.'),
    'plains': ('Stage 1 Plains', 'Fast and open: driving bass and beat, bright arpeggio and lead as your Rush climbs.'),
    'mountains': ('Stage 2 Mountain road', 'Rocky and tense: plucked strings over a steady stomp, E minor.'),
    'swamps': ('Stage 2 Forest road', 'Slow and murky: toms and low strings, a creeping C minor groove.'),
    'kingdom': ('Stage 3 Enemy Kingdom', 'Marching: snare drumline and brass stabs, G minor.'),
    'castle': ('Stage 4 King\'s Castle', 'Grand and ominous: strings, bell arpeggios, D harmonic minor.'),
    'boss_guardian': ('Great Boar, Stone Colossus, Spider Queen', 'Heavy fight music: galloping bass, toms, strings; the extra layer is the enraged form.'),
    'boss_black_knight': ('Black Knight', 'Armored duel: marching brass and fast gallop, C minor; extra layer in phase 2.'),
    'boss_king': ('Enemy King', 'Royal and relentless: chugging strings, bells; two extra layers for phases 2 and 3.'),
    'boss_dragon': ('Dragon', 'The fastest and wildest: brass over a pounding chug, F# minor; extra layer in phase 2.'),
    'sting_victory': ('Boss defeated', 'Short brass fanfare.'),
    'sting_death': ('You died', 'Slow falling strings.'),
    'sting_complete': ('Run completed', 'Longer triumphant fanfare with a held chord.'),
}


def render(track, inst, layers=LAYERS, bar_from=0, bar_to=None, layer_by_bar=None):
    """layer_by_bar: optional function bar -> set of layers on (for the demo). Returns mono float array."""
    step = 60.0 / track['bpm'] / 4
    bar_to = track['bars'] if bar_to is None else bar_to
    total = int(((bar_to - bar_from) * SPB * step + 1.5) * SR)
    mix = np.zeros(total)
    for c in track['channels']:
        meta, smp = inst[c['inst']]
        for s, midi, ln, vel in c['notes']:
            bar = s // SPB
            if not (bar_from <= bar < bar_to):
                continue
            on = layer_by_bar(bar) if layer_by_bar else layers
            if c['layer'] not in on:
                continue
            rate = 2 ** ((midi - meta['rootMidi']) / 12)
            dur = ln * step
            rel = meta['release']
            n_out = int((dur + rel) * SR)
            idx = np.arange(n_out) * rate
            n_out = int(np.searchsorted(idx, len(smp) - 1))
            idx = idx[:n_out]
            y = np.interp(idx, np.arange(len(smp)), smp)
            t = np.arange(n_out) / SR
            env = np.minimum(1, t / 0.005) * np.where(t < dur, 1.0, np.clip(1 - (t - dur) / rel, 0, 1))
            a = int(round((s - bar_from * SPB) * step * SR))
            mix[a:a + n_out] += (y * env * vel * c['gain'])[:max(0, total - a)] if a < total else 0
    return mix


def demo(track, inst):
    """A short, representative excerpt: stage tracks turn the Rush layers on bar by bar; bosses play full."""
    stage = any(c['layer'] == 'L3' for c in track['channels'])
    boss = track['id'].startswith('boss')
    if track['id'].startswith('sting'):
        return render(track, inst)
    if stage:
        return render(track, inst, bar_from=0, bar_to=8, layer_by_bar=lambda b: set(LAYERS[:1 + b // 2]))
    if boss:
        top = {'boss_king': 3}.get(track['id'], 2)
        return render(track, inst, bar_from=0, bar_to=8, layer_by_bar=lambda b: set(LAYERS[:1 if b < 4 else top]))
    return render(track, inst, bar_from=0, bar_to=8)


def trim(y):
    nz = np.nonzero(np.abs(y) > 1e-4)[0]
    return y[:nz[-1] + 1] if len(nz) else y


def validate(tracks, inst_meta):
    ids = {m['id']: m for m in inst_meta}
    for tid, tr in tracks.items():
        assert tr['loopStartBar'] <= tr['bars'], tid
        step = 60.0 / tr['bpm'] / 4
        for c in tr['channels']:
            m = ids[c['inst']]
            for s, midi, ln, vel in c['notes']:
                assert s < tr['bars'] * SPB, (tid, s)
                assert ln * step <= m['seconds'] + 1e-9, (tid, c['inst'], ln)


def seconds(tr):
    return tr['bars'] * SPB * 60.0 / tr['bpm'] / 4


def build(root):
    assets = os.path.join(root, 'public', 'assets')
    meta = instruments.build(assets)
    tracks = T.build_all()
    validate(tracks, meta)
    inst = instruments.load(assets)
    for tr in tracks.values():            # level every track so the full mix (all layers) peaks at 0.9
        k = 0.9 / max(1e-9, np.abs(render(tr, inst)).max())
        for c in tr['channels']:
            c['gain'] = round(c['gain'] * k, 3)
    for tid, tr in tracks.items():
        write_json(os.path.join(assets, 'music', tid + '.json'), tr)
    preview = os.path.join(root, 'tools', 'out', 'preview')
    os.makedirs(preview, exist_ok=True)
    parts = []
    gap = np.zeros(int(0.8 * SR))
    for tid in T.ORDER:
        y = trim(demo(tracks[tid], inst))
        instruments.write_wav(os.path.join(preview, f'music_{tid}.wav'), y / max(1e-9, np.abs(y).max()) * 0.9)
        parts += [y / max(1e-9, np.abs(y).max()) * 0.9, gap]
    full = np.concatenate(parts)
    docs = os.path.join(root, 'docs', 'art')
    os.makedirs(docs, exist_ok=True)
    instruments.write_wav(os.path.join(docs, 'music_ART9.wav'), full)
    rows = []
    t = 0.0
    for tid in T.ORDER:
        tr = tracks[tid]
        L = sorted({c['layer'] for c in tr['channels']})
        n = len(trim(demo(tr, inst))) / SR
        rows.append(f"| {tid} | {TITLES[tid][0]} | {tr['bpm']} | {tr['bars']} | {seconds(tr):.0f} s | {' '.join(L)} | {int(t)//60}:{int(t)%60:02d} | {TITLES[tid][1]} |")
        t += n + 0.8
    with open(os.path.join(docs, 'music_ART9.md'), 'w') as f:
        f.write("# ART9 listening sheet: music\n\n"
                "Listen to `docs/art/music_ART9.wav` (all 14 pieces in a row, about %d:%02d). Stage pieces start with only the beat and "
                "play two bars more of each layer (this is what happens as your Rush rises); boss pieces play 4 bars, then the extra "
                "intensity layers; stingers play in full. The game plays the same note data live (`public/assets/music/*.json`), "
                "so it sounds like this but loops forever.\n\n"
                "| Track | Plays in | BPM | Bars | Loop length | Layers | Starts at | Mood |\n|---|---|---|---|---|---|---|---|\n" % (int(t) // 60, int(t) % 60)
                + "\n".join(rows) + "\n\n"
                "**What to tell me:** which pieces feel wrong for their place (too busy, too sad, too similar), and whether the "
                "beat and bass are loud enough or too loud. Melodies are composed by a seeded generator over chord tones, so "
                "changing one only needs a number tweak in `tools/audio/music/tracks.py`.\n\n"
                "Known limits: the sound is chip-tune and synth only (no real instruments); the preview is mono and has no panning "
                "or reverb.\n")
    return assets


if __name__ == '__main__':
    import sys
    build(sys.argv[1] if len(sys.argv) > 1 else '.')
