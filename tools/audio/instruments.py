"""ART9 instrument samples for the music sequencer (08 §14.2). Pure numpy additive/FM/Karplus-Strong synthesis,
deterministic. Mono 16-bit WAV at 22,050 Hz (small files; music is mellow enough that this is plenty)."""
import json
import math
import os
import wave
import zlib

import numpy as np

SR = 22050
# id: (rootMidi, release seconds, sample seconds)
INSTRUMENTS = {
    'kick': (36, 0.25, 2.0), 'snare': (38, 0.20, 2.0), 'hat': (42, 0.03, 2.0), 'hat_open': (46, 0.15, 2.0),
    'tom': (45, 0.25, 2.0), 'bass': (36, 0.08, 2.0), 'lead': (60, 0.10, 2.0), 'pluck': (60, 0.50, 2.0),
    'pad': (60, 0.40, 4.0), 'bell': (72, 0.80, 2.0), 'strings': (60, 0.30, 4.0), 'brass': (60, 0.10, 2.0),
    'arp': (72, 0.06, 2.0),
}


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def _t(sec):
    return np.arange(int(sec * SR)) / SR


def _saw(f0, t, cutoff, detune_cents=0.0):
    """Band-limited saw by additive synthesis with a (possibly time-varying) rolloff."""
    f = f0 * 2 ** (detune_cents / 1200)
    y = np.zeros_like(t)
    cut = np.broadcast_to(np.asarray(cutoff, dtype=float), t.shape)
    k = 1
    while f * k < SR / 2.1:
        y += 1.0 / k / (1 + (f * k / cut) ** 2) * np.sin(2 * math.pi * f * k * t + k * 0.7)
        k += 1
    return y * (2 / math.pi)


def _square(f0, t, duty, vib=None):
    ph = 2 * math.pi * f0 * t if vib is None else 2 * math.pi * f0 * np.cumsum(vib) / SR
    y = np.zeros_like(t)
    k = 1
    while f0 * k < SR / 2.1 and k < 60:
        y += math.sin(math.pi * k * duty) / k * np.cos(k * ph - math.pi * k * duty)
        k += 1
    return y * (4 / math.pi) * 0.5


def _noise(n, seed):
    return np.random.default_rng(zlib.crc32(seed.encode())).uniform(-1, 1, n)


def _fft_filter(x, lo=None, hi=None):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    m = np.ones_like(f)
    if lo:
        m *= 1 / (1 + (lo / np.maximum(f, 1)) ** 4)
    if hi:
        m *= 1 / (1 + (f / hi) ** 4)
    return np.fft.irfft(X * m, len(x))


def make(name):
    root, rel, sec = INSTRUMENTS[name]
    f0 = mtof(root)
    t = _t(sec)
    n = len(t)
    if name == 'kick':
        fr = 45 + 105 * np.exp(-t / 0.045)
        y = np.sin(2 * math.pi * np.cumsum(fr) / SR) * np.exp(-t / 0.18) + 0.5 * _noise(n, 'kickclick') * np.exp(-t / 0.004)
    elif name == 'snare':
        nz = _fft_filter(_noise(n, 'snare'), lo=1000, hi=3500) * np.exp(-t / 0.09) * 2.5
        tri = (2 / math.pi) * np.arcsin(np.sin(2 * math.pi * 190 * t)) * np.exp(-t / 0.06)
        y = nz + 0.6 * tri
    elif name in ('hat', 'hat_open'):
        d = 0.04 if name == 'hat' else 0.2
        y = _fft_filter(_noise(n, name), lo=7000) * np.exp(-t / (d / 3)) * 2.0
    elif name == 'tom':
        fr = 90 + 70 * np.exp(-t / 0.08)
        y = np.sin(2 * math.pi * np.cumsum(fr) / SR) * np.exp(-t / 0.22)
    elif name == 'bass':
        y = _saw(f0, t, 900) + 0.5 * np.sin(2 * math.pi * f0 * t)
        y *= 0.6 + 0.4 * np.exp(-t / 0.25)
    elif name == 'lead':
        vib = 1 + 0.012 * np.sin(2 * math.pi * 5 * t) * np.clip((t - 0.15) / 0.2, 0, 1)
        y = _square(f0, t, 0.25, vib)
    elif name == 'pluck':
        N = int(round(SR / f0))
        buf = _noise(N, 'pluck')
        out = np.zeros(n)
        for i in range(n):
            j = i % N
            out[i] = buf[j]
            buf[j] = 0.4985 * (buf[j] + buf[(j + 1) % N])
        y = out
    elif name == 'pad':
        y = sum(_saw(f0, t, 1200, c) for c in (-7, 0, 7)) / 3
        y *= np.clip(t / 0.3, 0, 1) * np.clip((sec - t) / 0.4, 0, 1)
    elif name == 'bell':
        idx = 3.0 * np.exp(-t / 0.5)
        y = np.sin(2 * math.pi * f0 * t + idx * np.sin(2 * math.pi * f0 * 3.5 * t)) * np.exp(-t / 0.7)
    elif name == 'strings':
        y = (_saw(f0, t, 2500, -6) + _saw(f0, t, 2500, 6)) / 2
        y *= np.clip(t / 0.15, 0, 1) * np.clip((sec - t) / 0.4, 0, 1)
        y *= 1 + 0.03 * np.sin(2 * math.pi * 5.5 * t)
    elif name == 'brass':
        y = _saw(f0, t, 600 + 1800 * np.clip(t / 0.15, 0, 1)) * (0.7 + 0.3 * np.clip(t / 0.08, 0, 1))
    elif name == 'arp':
        y = _square(f0, t, 0.125) * np.exp(-t / 0.12) * np.clip((0.25 - t) / 0.02, 0, 1)
    else:
        raise KeyError(name)
    y = y * np.clip((sec - t) / 0.01, 0, 1)
    return y / max(1e-9, np.abs(y).max()) * 0.85


def write_wav(path, y, sr=SR):
    pcm = np.round(np.clip(y, -1, 1) * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes(pcm.tobytes())


def build(assets):
    d = os.path.join(assets, 'audio', 'inst')
    os.makedirs(d, exist_ok=True)
    meta = []
    for name, (root, rel, sec) in INSTRUMENTS.items():
        write_wav(os.path.join(d, name + '.wav'), make(name))
        meta.append({'id': name, 'file': name + '.wav', 'rootMidi': root, 'release': rel, 'seconds': sec})
    with open(os.path.join(d, 'instruments.json'), 'w') as f:
        json.dump(meta, f, indent=1)
    return meta


def load(assets):
    d = os.path.join(assets, 'audio', 'inst')
    meta = json.load(open(os.path.join(d, 'instruments.json')))
    out = {}
    for m in meta:
        with wave.open(os.path.join(d, m['file'])) as w:
            raw = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(float) / 32767
        out[m['id']] = (m, raw)
    return out
