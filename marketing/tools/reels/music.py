"""Original, royalty-free music bed for the YNSG Veterans Day Reels.
Slow, warm, hopeful: D - Bm - G - A - D at 72 bpm, pad + soft piano + low strings,
with a quiet military snare that builds into the end card."""
import numpy as np, wave, sys

SR = 44100
BPM = float(sys.argv[3]) if len(sys.argv) > 3 else 72
BEAT = 60 / BPM
BAR = BEAT * 4
DUR = float(sys.argv[2]) if len(sys.argv) > 2 else 17.0
OUT = sys.argv[1] if len(sys.argv) > 1 else "bed.wav"
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(11)

def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)

# chords as MIDI notes (low string root, pad voicing)
CHORDS = [
    (38, [62, 66, 69, 74]),  # D
    (35, [62, 66, 71, 74]),  # Bm
    (31, [62, 67, 71, 74]),  # G
    (33, [61, 64, 69, 73]),  # A
    (38, [62, 66, 69, 74, 78]),  # D (final, lift)
]

def onepole(x, a):
    y = np.empty_like(x)
    acc = 0.0
    for i in range(0, len(x), 1):
        acc += a * (x[i] - acc)
        y[i] = acc
    return y

def lowpass(x, cutoff):
    # vectorised-ish: run in blocks via scipy-free IIR (cheap enough at this length)
    a = 1 - np.exp(-2 * np.pi * cutoff / SR)
    return onepole(x, a)

def env(start, length, att, rel):
    e = np.zeros(N)
    s = int(start * SR); L = int(length * SR)
    s2 = min(N, s + L)
    if s >= N: return e
    tt = (np.arange(s2 - s)) / SR
    a = np.clip(tt / att, 0, 1)
    r = np.clip((length - tt) / rel, 0, 1)
    e[s:s2] = np.minimum(a, r)
    return e

mix = np.zeros(N)

# --- pad: soft detuned saw stacks
pad = np.zeros(N)
for ci, (root, notes) in enumerate(CHORDS):
    start = ci * BAR
    length = BAR + 0.6 if ci < 4 else DUR - start
    e = env(start, length, 0.9, 0.9 if ci < 4 else 2.5)
    if not e.any(): continue
    for m in notes:
        for det in (-0.07, 0.0, 0.08):
            f = hz(m + det)
            w = np.zeros(N)
            for h in range(1, 7):
                w += np.sin(2 * np.pi * f * h * t + rng.uniform(0, 6)) / h
            pad += w * e * 0.018
pad = lowpass(pad, 1400)
mix += pad

# --- low strings: root + fifth
for ci, (root, notes) in enumerate(CHORDS):
    start = ci * BAR
    length = BAR + 0.4 if ci < 4 else DUR - start
    e = env(start, length, 0.5, 0.6 if ci < 4 else 2.5)
    for m, g in ((root, 0.10), (root + 7, 0.04), (root + 12, 0.03)):
        f = hz(m)
        vib = 1 + 0.003 * np.sin(2 * np.pi * 5.2 * t)
        ph = 2 * np.pi * np.cumsum(f * vib) / SR
        mix += (np.sin(ph) + 0.3 * np.sin(2 * ph)) * e * g

# --- soft piano arpeggio (8ths), enters bar 1
def piano(start, m, vel):
    s = int(start * SR)
    if s >= N: return
    L = min(N - s, int(2.2 * SR))
    tt = np.arange(L) / SR
    f = hz(m)
    tone = (np.sin(2 * np.pi * f * tt) + 0.45 * np.sin(4 * np.pi * f * tt) * np.exp(-tt * 3)
            + 0.2 * np.sin(6 * np.pi * f * tt) * np.exp(-tt * 6))
    a = np.clip(tt / 0.006, 0, 1)
    mix[s:s + L] += tone * a * np.exp(-tt * 2.4) * vel

for ci, (root, notes) in enumerate(CHORDS[:4]):
    seq = [notes[0] + 12, notes[1] + 12, notes[2] + 12, notes[3] + 12, notes[2] + 12, notes[1] + 12, notes[2] + 12, notes[3] + 12]
    for i, m in enumerate(seq):
        piano(ci * BAR + i * BEAT / 2, m, 0.055 if i % 2 == 0 else 0.04)
# final bell chord
for i, m in enumerate([74, 78, 81, 86]):
    piano(4 * BAR + i * 0.06, m, 0.06)

# --- military snare: quiet in bars 2-3, crescendo roll into bar 4
def snare(start, vel):
    s = int(start * SR)
    if s >= N: return
    L = min(N - s, int(0.18 * SR))
    tt = np.arange(L) / SR
    nz = rng.normal(0, 1, L)
    body = np.sin(2 * np.pi * 190 * tt) * np.exp(-tt * 40)
    mix[s:s + L] += (nz * np.exp(-tt * 28) * 0.7 + body * 0.6) * vel

pattern = [0, 0.5, 0.75, 1, 2, 2.5, 2.75, 3, 3.25, 3.5, 3.75]
for bar in (1, 2):
    for p in pattern:
        snare(bar * BAR + p * BEAT, 0.022 + 0.008 * bar)
# roll into the end card
roll_start = 3 * BAR + 2 * BEAT
steps = int(2 * BEAT / (BEAT / 8))
for i in range(steps):
    snare(roll_start + i * BEAT / 8, 0.012 + 0.05 * (i / steps) ** 1.6)
snare(4 * BAR, 0.09)

# --- gentle swell noise (cymbal-ish) into end card
s0 = int((4 * BAR - 1.6) * SR); s1 = min(N, int(4 * BAR * SR))
if s0 < N:
    L = s1 - s0
    nz = rng.normal(0, 1, L)
    nz = nz - lowpass(nz, 5000)
    mix[s0:s1] += nz * np.linspace(0, 1, L) ** 2 * 0.03

# master: soft clip, fade in/out, normalise
mix = np.tanh(mix * 1.6) / 1.6
fade_in = np.clip(t / 0.25, 0, 1)
fade_out = np.clip((DUR - t) / 1.4, 0, 1)
mix *= fade_in * fade_out
mix /= np.max(np.abs(mix)) + 1e-9
mix *= 0.85
# light stereo widening via tiny delay
left = mix
right = np.concatenate([np.zeros(int(0.012 * SR)), mix[:-int(0.012 * SR)]]) * 0.96 + mix * 0.04
stereo = np.stack([left, right], 1)
pcm = (stereo * 32767).astype(np.int16)
with wave.open(OUT, "wb") as wf:
    wf.setnchannels(2); wf.setsampwidth(2); wf.setframerate(SR)
    wf.writeframes(pcm.tobytes())
print("wrote", OUT, DUR)
