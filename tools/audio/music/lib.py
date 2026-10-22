"""Composition helpers for ART9: scales, chords, drum strings, a seeded phrase generator, and the JSON exporter.
Everything is deterministic (numpy default_rng seeded by crc32 of the track id)."""
import json
import os
import zlib

import numpy as np

SCALES = {'minor': [0, 2, 3, 5, 7, 8, 10], 'harm': [0, 2, 3, 5, 7, 8, 11], 'major': [0, 2, 4, 5, 7, 9, 11]}
SPB = 16     # steps per bar


def deg(root, scale, d):
    """MIDI note of scale degree d (0 = tonic, 7 = tonic an octave up, negative allowed)."""
    o, i = divmod(d, 7)
    return root + 12 * o + SCALES[scale][i]


def triad(root, scale, d):
    return [deg(root, scale, d), deg(root, scale, d + 2), deg(root, scale, d + 4)]


class Track:
    def __init__(self, tid, bpm, bars, loop=True):
        self.id, self.bpm, self.bars, self.loop = tid, bpm, bars, loop
        self.channels = {}
        self.rng = np.random.default_rng(zlib.crc32(tid.encode()))

    def ch(self, name, inst, layer, gain, pan=0.0):
        self.channels[name] = {'inst': inst, 'layer': layer, 'gain': gain, 'pan': pan, 'notes': []}

    def note(self, name, bar, step, midi, length, vel=0.8):
        s = bar * SPB + step
        if s >= self.bars * SPB:
            return
        self.channels[name]['notes'].append([s, int(midi), max(1, int(length)), round(float(vel), 2)])

    def drums(self, name, bar, pattern, midi, vel=0.9, soft=0.5):
        for i, c in enumerate(pattern):
            if c == 'x':
                self.note(name, bar, i, midi, 1, vel)
            elif c == 'o':
                self.note(name, bar, i, midi, 1, vel * soft)

    def export(self):
        chans = [{'inst': c['inst'], 'layer': c['layer'], 'gain': c['gain'], 'pan': c['pan'], 'notes': sorted(c['notes'])}
                 for c in self.channels.values() if c['notes']]
        d = {'id': self.id, 'bpm': self.bpm, 'bars': self.bars, 'loopStartBar': 1, 'channels': chans}
        if not self.loop:
            d['loop'] = False
        return d


def phrase(rng, chord_degs, bars=2, density=1.0, lo=-2, hi=9, start=7, end=None, cells=None):
    """One melodic phrase over `bars` bars: [(step_in_phrase, scale_degree, length_steps)].
    Strong beats land on chord tones of the chord sounding there; weak onsets step by 1-2 degrees."""
    cells = cells or [[0, 3, 6], [0, 4, 6], [0, 2, 4, 6], [0, 6], [0, 3, 4, 7], [0, 4], [0, 3, 6, 7], [0, 2, 3, 6]]
    onsets = []
    for c in range(bars * 2):
        cell = cells[int(rng.integers(len(cells)))]
        if rng.random() > density:
            cell = cell[:max(1, len(cell) // 2)]
        onsets += [c * 8 + s for s in cell]
    notes, prev = [], start
    for i, s in enumerate(onsets):
        cd = chord_degs[min(s // SPB, len(chord_degs) - 1)]
        if s % 8 == 0:
            cand = sorted([t for t in (cd, cd + 2, cd + 4, cd + 7) if lo <= t <= hi], key=lambda t: abs(t - prev))
            d = cand[int(rng.integers(min(2, len(cand))))]
        else:
            d = min(hi, max(lo, prev + int(rng.choice([-2, -1, -1, 1, 1, 2]))))
        if i == len(onsets) - 1 and end is not None:
            d = end
        nxt = onsets[i + 1] if i + 1 < len(onsets) else bars * SPB
        notes.append((s, d, min(nxt - s, 6)))
        prev = d
    return notes


def melody_period(rng, prog8, **kw):
    """An 8-bar melody: A, A' (A with a new ending), B, A'' ending on the tonic -> [(step, degree, length)]."""
    ch = lambda i: [prog8[(2 * i) % 8], prog8[(2 * i + 1) % 8]]
    A = phrase(rng, ch(0), start=7, **kw)
    A2 = A[:-3] + phrase(rng, ch(1), start=A[-4][1], end=4, **kw)[-3:]
    B = phrase(rng, ch(2), start=9, **kw)
    A3 = A[:-1] + [(A[-1][0], 7, A[-1][2])]
    out = []
    for i, ph in enumerate([A, A2, B, A3]):
        out += [(i * 32 + s, d, l) for s, d, l in ph]
    return out


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        json.dump(data, f, separators=(',', ':'))
