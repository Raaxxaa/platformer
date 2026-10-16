"""A small sfxr-style synth in numpy (08 §13.1). Same recipe + seed = same bytes."""
import math
import wave
from dataclasses import dataclass, field, replace

import numpy as np

SR = 44100
PEAK = 10 ** (-1 / 20)          # −1 dBFS


@dataclass
class Layer:
    wave: str                    # 'sq', 'saw', 'tri', 'sin', 'nz'
    f0: float | None             # start frequency (Hz); for 'nz', the sample-and-hold rate (None = white)
    f1: float | None             # end frequency (exponential slide)
    attack: float
    sustain: float
    decay: float
    duty: float = 0.5
    vib: tuple = (0.0, 0.0)      # (depth in semitones, rate Hz)
    arp: list = field(default_factory=list)   # [(time s, semitones)] step changes
    lp: tuple | None = None      # (start cutoff, end cutoff) Hz
    hp: tuple | None = None
    crush: int | None = None     # bits
    level: float = 1.0
    delay: float = 0.0           # start time inside the sound


def _length(L):
    return L.delay + L.attack + L.sustain + L.decay


def _env(L, n):
    a, s, d = (int(round(v * SR)) for v in (L.attack, L.sustain, L.decay))
    e = np.zeros(n)
    i = 0
    if a:
        e[:a] = np.linspace(0, 1, a, endpoint=False)
    i = a
    e[i:i + s] = 1
    i += s
    if d:
        e[i:i + d] = np.linspace(1, 0, d, endpoint=False) ** 1.6
    return e


def _onepole(x, cut):
    """One-pole low-pass with a per-sample cutoff array."""
    a = 1 - np.exp(-2 * math.pi * np.clip(cut, 10, SR / 2.2) / SR)
    y = np.empty_like(x)
    acc = 0.0
    al = a.tolist()
    xl = x.tolist()
    for i in range(len(xl)):
        acc += al[i] * (xl[i] - acc)
        y[i] = acc
    return y


def _sweep(pair, n):
    s, e = pair
    return s * (e / s) ** (np.arange(n) / max(n - 1, 1))


def _layer(L, rng):
    n = int(round((L.attack + L.sustain + L.decay) * SR))
    if n <= 0:
        return np.zeros(0)
    t = np.arange(n) / SR
    if L.wave == 'nz':
        noise = rng.uniform(-1, 1, n)
        if L.f0:
            f = _sweep((L.f0, L.f1 or L.f0), n)
            idx = np.floor(np.cumsum(f / SR)).astype(int)
            vals = rng.uniform(-1, 1, idx.max() + 2)
            noise = vals[idx]
        x = noise
    else:
        f = _sweep((L.f0, L.f1 if L.f1 else L.f0), n)
        if L.vib[0]:
            f = f * 2 ** (L.vib[0] * np.sin(2 * math.pi * L.vib[1] * t) / 12)
        for at, semis in L.arp:
            f[t >= at] *= 2 ** (semis / 12)
        ph = np.cumsum(f / SR) % 1.0
        if L.wave == 'sin':
            x = np.sin(2 * math.pi * ph)
        elif L.wave == 'sq':
            x = np.where(ph < L.duty, 1.0, -1.0)
        elif L.wave == 'saw':
            x = 2 * ph - 1
        elif L.wave == 'tri':
            x = 1 - 4 * np.abs(ph - 0.5)
        else:
            raise ValueError(L.wave)
    if L.lp:
        x = _onepole(x, _sweep(L.lp, n))
    if L.hp:
        x = x - _onepole(x, _sweep(L.hp, n))
    if L.crush:
        q = 2 ** (L.crush - 1)
        x = np.round(x * q) / q
    return x * _env(L, n) * L.level


def render(recipe, seed=0):
    rng = np.random.default_rng(seed)
    total = int(round(max(_length(L) for L in recipe) * SR))
    out = np.zeros(total)
    for L in recipe:
        x = _layer(L, rng)
        s = int(round(L.delay * SR))
        out[s:s + len(x)] += x[:max(0, total - s)]
    return out.astype(np.float32)


def variant(recipe, k):
    """Variant k: new seed and every frequency shifted by the same ±4% (never exactly 0)."""
    rng = np.random.default_rng(1000 + k)
    m = 1 + rng.uniform(0.01, 0.04) * (1 if rng.integers(0, 2) else -1)

    def sh(L):
        kw = {}
        for name in ('f0', 'f1'):
            v = getattr(L, name)
            if v:
                kw[name] = v * m
        for name in ('lp', 'hp'):
            v = getattr(L, name)
            if v:
                kw[name] = (v[0] * m, v[1] * m)
        return replace(L, **kw)
    return [sh(L) for L in recipe], 7919 * (k + 1)


def finalize(x):
    """Peak −1 dBFS, 1 ms fade-in, 5 ms fade-out, int16."""
    x = np.asarray(x, dtype=np.float64)
    if len(x) > 2.0 * SR:
        x = x[:int(2.0 * SR)]
    fi, fo = int(0.001 * SR), int(0.005 * SR)
    x[:fi] *= np.linspace(0, 1, fi)
    x[-fo:] *= np.linspace(1, 0, fo)
    pk = np.abs(x).max()
    if pk > 0:
        x = x / pk * PEAK
    return np.round(x * 32767).astype('<i2')


def write_wav(path, samples):
    data = finalize(samples)
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())
    return data
