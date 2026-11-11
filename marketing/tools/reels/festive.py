"""Festive holiday look for YNSG Reels: deep navy-to-pine background, drifting warm bokeh,
pine garland with swinging ornaments, gold glints, and a logo card that swings in like an ornament."""
import math, numpy as np
from PIL import Image, ImageDraw, ImageFilter
import reel
from reel import W, H, ease_out, ease_in_out, star_poly

GOLD = (243, 172, 57); GREEN = (65, 104, 51); NAVY = (4, 36, 64)

def _radial(size, color, alpha=255):
    s = size; yy, xx = np.mgrid[0:s, 0:s] / (s - 1) * 2 - 1
    r = np.sqrt(xx ** 2 + yy ** 2)
    a = np.clip(1 - r, 0, 1) ** 0.6
    img = np.zeros((s, s, 4), np.uint8); img[..., :3] = color; img[..., 3] = (a * alpha).astype(np.uint8)
    return Image.fromarray(img, "RGBA")

def bokeh_layer(seed, n, rmin, rmax, blur, alpha, w=W + 400, h=H + 400):
    rng = np.random.default_rng(seed)
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for _ in range(n):
        x, y, r = rng.uniform(0, w), rng.uniform(0, h * 0.85), rng.uniform(rmin, rmax)
        c = [(255, 205, 120), (255, 226, 170), (243, 172, 57), (150, 200, 120), (255, 244, 220)][rng.integers(0, 5)]
        d.ellipse([x - r, y - r, x + r, y + r], fill=c + (int(alpha * rng.uniform(0.5, 1)),))
        d.ellipse([x - r * 0.82, y - r * 0.82, x + r * 0.82, y + r * 0.82], fill=c + (int(alpha * 0.55),))
    return im.filter(ImageFilter.GaussianBlur(blur))

def ornament(size, color, seed=0):
    S = size * 2
    yy, xx = np.mgrid[0:S, 0:S] / (S - 1) * 2 - 1
    r = np.sqrt(xx ** 2 + yy ** 2)
    inside = r <= 0.98
    shade = np.clip(1.05 - 0.55 * np.sqrt((xx + 0.35) ** 2 + (yy + 0.4) ** 2), 0.35, 1.1)
    spec = np.exp(-(((xx + 0.38) ** 2 + (yy + 0.42) ** 2) / 0.02)) * 0.9
    rim = np.clip((r - 0.8) / 0.18, 0, 1) * 0.25
    col = np.array(color, np.float32)
    rgb = col * shade[..., None] * (1 - rim[..., None]) + 255 * spec[..., None]
    a = np.where(inside, 255, 0).astype(np.uint8)
    img = np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), a])
    im = Image.fromarray(img, "RGBA").resize((size, size), Image.LANCZOS)
    cap = Image.new("RGBA", (size, size + size // 5), (0, 0, 0, 0))
    cap.alpha_composite(im, (0, size // 5))
    d = ImageDraw.Draw(cap)
    cw = size // 4
    d.rounded_rectangle([size / 2 - cw / 2, 2, size / 2 + cw / 2, size // 5 + 6], radius=4, fill=(214, 160, 60, 255))
    return cap

def garland(width, height, seed):
    rng = np.random.default_rng(seed)
    im = Image.new("RGBA", (width, height), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    pts = [(x, 40 + 60 * math.sin(x / width * math.pi) + 10 * math.sin(x / 70)) for x in range(-40, width + 40, 6)]
    greens = [(18, 62, 36), (26, 82, 46), (36, 98, 56), (52, 118, 66), (14, 50, 30)]
    for layer in range(3):
        for (x, y) in pts:
            for _ in range(9):
                ang = rng.uniform(-math.pi, math.pi); L = rng.uniform(26, 58) * (1 - 0.2 * layer)
                c = greens[rng.integers(0, 5)]
                d.line([(x, y), (x + L * math.cos(ang), y + L * 0.75 * math.sin(ang) + 10)], fill=c + (255,), width=4)
    im = im.filter(ImageFilter.GaussianBlur(0.8))
    return im, pts

class Festive:
    def __init__(self, flurry=(0, 0)):
        ys = np.linspace(0, 1, H)[:, None, None]
        top = np.array((6, 28, 52), np.float32); bot = np.array((8, 34, 26), np.float32)
        base = top * (1 - ys) + bot * ys
        xx = np.arange(W)[None, :, None]; yy = np.arange(H)[:, None, None]
        glow = np.exp(-(((xx - 540) / 700) ** 2 + ((yy - 980) / 760) ** 2))
        base = base + glow * np.array((70, 48, 14), np.float32)
        self.base = Image.fromarray(np.clip(base * np.ones((1, W, 1)), 0, 255).astype(np.uint8)).convert("RGBA")
        self.layers = [(bokeh_layer(1, 34, 40, 90, 22, 70), 0.35, 14), (bokeh_layer(2, 40, 18, 40, 8, 120), 0.7, 22), (bokeh_layer(3, 14, 70, 140, 30, 55), 1.1, 9)]
        self.gar, pts = garland(W + 80, 260, 5)
        cols = [GOLD, (200, 40, 50), (235, 238, 242), GREEN, GOLD, (200, 40, 50), (235, 238, 242)]
        self.orns = []
        for i, fx in enumerate([0.07, 0.2, 0.34, 0.66, 0.8, 0.93]):
            ax = fx * W; ay = 40 + 60 * math.sin((ax + 40) / (W + 80) * math.pi) + 18
            size = [86, 64, 74, 78, 62, 90][i]; L = [150, 230, 120, 140, 240, 160][i]
            self.orns.append((ax, ay, L, ornament(size, cols[i]), 0.09 + 0.03 * (i % 3), 1.3 + 0.25 * i, i * 1.1))
        rng = np.random.default_rng(12)
        self.glints = [(rng.uniform(60, W - 60), rng.uniform(300, 1700), rng.uniform(10, 22), rng.uniform(0, 6)) for _ in range(16)]
        self.flurry = flurry
        r2 = np.random.default_rng(9)
        self.flakes = [(r2.uniform(0, W), r2.uniform(0, H), r2.uniform(2, 6), r2.uniform(50, 120), r2.uniform(0, 6)) for _ in range(110)]

    def frame(self, t):
        img = self.base.copy()
        for lay, sp, amp in self.layers:
            ox = int(200 + amp * math.sin(t * 0.25 * sp)); oy = int(200 - t * 8 * sp) % 200 + 100
            img.alpha_composite(lay.crop((ox, oy, ox + W, oy + H)))
        d = ImageDraw.Draw(img)
        for (x, y, r, ph) in self.glints:
            k = max(0, math.sin(t * 1.6 + ph)) ** 6
            if k > 0.02:
                rr = r * (0.5 + k)
                d.polygon(star_poly(x, y, rr), fill=(255, 230, 170, int(220 * k)))
        f0, f1 = self.flurry
        if f0 <= t <= f1:
            a = min(1, (t - f0) / 0.6, (f1 - t) / 0.6)
            for (x, y, r, sp, ph) in self.flakes:
                yy = (y + t * sp) % (H + 20) - 10; xx = x + 16 * math.sin(t * 0.8 + ph)
                d.ellipse([xx - r, yy - r, xx + r, yy + r], fill=(255, 255, 255, int(190 * a)))
        # ornaments swing under the garland
        for (ax, ay, L, im, amp, w, ph) in self.orns:
            th = amp * math.sin(t * w + ph)
            ex, ey = ax + L * math.sin(th), ay + L * math.cos(th)
            d.line([(ax, ay), (ex, ey)], fill=(214, 160, 60, 230), width=3)
            rot = im.rotate(math.degrees(-th) * 0.9, resample=Image.BICUBIC, expand=True)
            img.alpha_composite(rot, (int(ex - rot.width / 2), int(ey - 6)))
        img.alpha_composite(self.gar, (-40, -40))
        return np.asarray(img.convert("RGB"))

class LogoOrnament:
    """Logo card drops in on a gold string, swings and settles, gets a shine sweep, then lifts out."""
    def __init__(self, start, out_at, logo_path, tag_lines=()):
        self.start, self.out_at = start, out_at
        logo = Image.open(logo_path).convert("RGB")
        lw = 680; logo = logo.resize((lw, int(logo.height * lw / logo.width)), Image.LANCZOS)
        cw, ch = lw + 60, logo.height + 50
        card = Image.new("RGBA", (cw, ch), (0, 0, 0, 0)); d = ImageDraw.Draw(card)
        d.rounded_rectangle([0, 0, cw - 1, ch - 1], radius=40, fill=(255, 255, 255, 255), outline=GOLD + (255,), width=6)
        card.paste(logo, (30, 25))
        self.card = card
        self.mask = card.split()[3]
        self.tags = tag_lines
    def draw(self, canvas, t):
        if t < self.start: return
        tau = t - self.start
        drop = ease_out(tau / 0.55)
        bounce = math.exp(-5 * tau) * math.sin(tau * 14) * 30 if tau > 0.55 else 0
        cy = -500 + (720 + 500) * drop + bounce
        th = 0.35 * math.exp(-2.4 * tau) * math.cos(6.5 * tau)
        lift = ease_in_out((t - self.out_at) / 0.7) if t > self.out_at else 0
        cy -= lift * 1500
        card = self.card.copy()
        if 0.9 < tau < 1.6:   # shine sweep
            k = (tau - 0.9) / 0.7
            sh = Image.new("L", card.size, 0); sd = ImageDraw.Draw(sh)
            x = -300 + k * (card.width + 600)
            sd.polygon([(x, 0), (x + 120, 0), (x - 160, card.height), (x - 280, card.height)], fill=150)
            sh = sh.filter(ImageFilter.GaussianBlur(18))
            sh = Image.fromarray(np.minimum(np.asarray(sh), np.asarray(self.mask)))
            white = Image.new("RGBA", card.size, (255, 255, 255, 0)); white.putalpha(sh)
            card.alpha_composite(white)
        rot = card.rotate(math.degrees(th), resample=Image.BICUBIC, expand=True)
        ax, ay = W / 2, 0
        top_x = ax + math.sin(-th) * 0; top_y = cy - card.height / 2
        d = ImageDraw.Draw(canvas)
        d.line([(ax, -10), (ax + (cy - card.height / 2) * math.sin(th) * 0.6, cy - card.height / 2 + 8)], fill=GOLD + (255,), width=4)
        canvas.alpha_composite(rot, (int(ax - rot.width / 2), int(cy - rot.height / 2)))
        for i, (line, y) in enumerate(self.tags):
            q = ease_out((tau - 0.8 - i * 0.25) / 0.5) * (1 - lift)
            if q > 0: reel.place(canvas, line, W / 2, y, q, (1 - q) * 40)

def build_festive():
    from reel import Slam, Card, Line, FadeBlack, HERE, NAVY as NV
    import os
    reel.Icon  # icons from reel.py
    bg = Festive(flurry=(11.6, 15.0))
    GD = GOLD
    o = 0.4
    items = [
        Slam(0, 1.9, [Line("The holidays are", 110, 900), Line("almost here!", 140, 900, GD)], 1000),
        Card(1.9, 4.6, [Line("So much to do", 104, 900), Line("before family arrives.", 78, 800, GD)], 1000, stagger=0.45),
        reel.Icon(4.6, 6.4, "leaf", y=760), Card(4.6, 6.4, [Line("Clearing the leaves", 94, 900)], 1010),
        reel.Icon(6.4, 8.15, "shelves", y=760), Card(6.4, 8.15, [Line("Organizing the", 92, 900), Line("garage or basement", 80, 800, GD)], 1030, stagger=0.25),
        reel.Icon(8.15, 10.1, "truck", y=760), Card(8.15, 10.1, [Line("Hauling away", 100, 900), Line("what you don’t need", 78, 800, GD)], 1030, stagger=0.25),
        reel.Icon(10.1, 11.4, "check", y=760), Card(10.1, 11.4, [Line("We’re glad to help!", 96, 900, GD)], 1010),
        reel.Icon(11.4, 14.8, "snow", y=760), Card(11.4, 14.8, [Line("And if the snow comes,", 84, 900), Line("we can help", 100, 900, GD), Line("with that too.", 100, 900, GD)], 1050, stagger=0.6),
        Card(14.8, 18.1, [Line("At Your Neighborhood", 80, 800), Line("Service Guy,", 116, 900, GD), Line("our goal is simple:", 70, 700)], 1000, gap=6, stagger=0.4),
        reel.Icon(18.1, 21.4, "home", y=760), Card(18.1, 21.4, [Line("More time with", 96, 900), Line("the people who", 96, 900), Line("matter most.", 116, 900, GD)], 1080, stagger=0.5),
        Card(21.4, 24.6, [Line("Request service at", 68, 700), Line("YourNeighborhoodServiceGuy.com", 54, 800, NV, pill=GOLD)], 1000, gap=16, stagger=0.3),
    ]
    logo = LogoOrnament(24.6, 28.6, os.path.join(HERE, "logo.jpg"),
                        tag_lines=[(Line("We’re Here to Help.", 84, 900, GD), 1230), (Line("YourNeighborhoodServiceGuy.com", 50, 700), 1340)])
    for it in items: it.start += o; it.end += o
    logo.start += o; logo.out_at += o
    fade = FadeBlack(29.4, 30.0)
    class Combo:
        def draw(self, canvas, t): logo.draw(canvas, t); fade.draw(canvas, t)
    return bg, items, Combo()


# ---------------- cinematic cut ----------------
import os
from reel import PhotoScene, Slam, Card, Line, HERE, PHOTOS

class SlidePhoto(PhotoScene):
    """Real photo that whips in from the right with motion blur, then slow push-in (inherits PhotoScene)."""
    def __init__(self, *a, whip=0.38, **k):
        super().__init__(*a, **k); self.whip = whip
    def draw(self, canvas, t):
        if t < self.start or t >= self.end: return
        tau = t - self.start
        if tau >= self.whip:
            return super().draw(canvas, t)
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        super().draw(layer, t)
        k = ease_out(tau / self.whip)
        x = int((1 - k) * W)
        arr = np.asarray(layer).astype(np.float32)
        speed = (1 - k) * 90
        if speed > 3:
            acc = np.zeros_like(arr); n = 7
            for i in range(n):
                acc += np.roll(arr, int(-speed * i / n), axis=1)
            arr = acc / n
        moved = Image.fromarray(arr.clip(0, 255).astype(np.uint8), "RGBA")
        canvas.alpha_composite(moved, (x, 0))

class Cine:
    """Hollywood finishing: curtain open/close bars, teal-orange grade, vignette, grain, light-leak sweeps, anamorphic flares."""
    def __init__(self, dur, leaks=(), flares=()):
        self.dur, self.leaks, self.flares = dur, leaks, flares
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        d = np.sqrt(((xx - W / 2) / (W * 0.62)) ** 2 + ((yy - H / 2) / (H * 0.62)) ** 2)
        self.vig = np.clip(1 - 0.55 * np.clip(d - 0.55, 0, 1) ** 1.4, 0.4, 1)[..., None]
        rng = np.random.default_rng(1)
        self.grain = [rng.normal(0, 7, (H // 2, W // 2, 1)).astype(np.float32) for _ in range(6)]
        lut = np.arange(256, dtype=np.float32) / 255
        s = lut + 0.10 * np.sin((lut - 0.5) * np.pi) * 0.9          # gentle S-curve
        self.lut_r = np.clip((s * 1.03 + 0.01) * 255, 0, 255)
        self.lut_g = np.clip((s * 1.00) * 255, 0, 255)
        self.lut_b = np.clip((s * 0.97 + 0.03 * (1 - lut)) * 255, 0, 255)  # cool shadows, warm highs
    def draw(self, canvas, t):
        a = np.asarray(canvas.convert("RGB")).astype(np.float32)
        a = np.stack([self.lut_r[a[..., 0].astype(np.uint8)], self.lut_g[a[..., 1].astype(np.uint8)], self.lut_b[a[..., 2].astype(np.uint8)]], -1)
        a *= self.vig
        # light leaks: warm blob sweeping across
        for (t0, d0, y0) in self.leaks:
            k = (t - t0) / d0
            if 0 <= k <= 1:
                cx = -400 + k * (W + 800); amp = math.sin(k * math.pi)
                xs = np.arange(W, dtype=np.float32)[None, :, None]; ys = np.arange(H, dtype=np.float32)[:, None, None]
                blob = np.exp(-(((xs - cx) / 420) ** 2 + ((ys - y0) / 900) ** 2)) * amp
                a += blob * np.array((150, 80, 20), np.float32)
        # anamorphic flare streak
        for (t0, y0) in self.flares:
            k = (t - t0) / 0.9
            if 0 <= k <= 1:
                amp = math.sin(k * math.pi)
                xs = np.arange(W, dtype=np.float32)[None, :, None]; ys = np.arange(H, dtype=np.float32)[:, None, None]
                cx = W * (0.2 + 0.6 * k)
                streak = np.exp(-((ys - y0) / 6) ** 2) * np.exp(-((xs - cx) / 700) ** 2) * amp
                core = np.exp(-(((xs - cx) / 60) ** 2 + ((ys - y0) / 60) ** 2)) * amp
                a += streak * np.array((120, 170, 255), np.float32) + core * np.array((255, 230, 180), np.float32)
        g = self.grain[int(t * 24) % len(self.grain)]
        a += np.repeat(np.repeat(g, 2, 0), 2, 1)
        a = np.clip(a, 0, 255).astype(np.uint8)
        img = Image.fromarray(a).convert("RGBA")
        # curtain bars: open at the start, close at the end
        op = ease_in_out(t / 0.9); cl = ease_in_out((t - (self.dur - 0.9)) / 0.9)
        bar = int((1 - op) * H / 2 + cl * H / 2)
        if bar > 0:
            d = ImageDraw.Draw(img)
            d.rectangle([0, 0, W, bar], fill=(0, 0, 0, 255)); d.rectangle([0, H - bar, W, H], fill=(0, 0, 0, 255))
        canvas.paste(img, (0, 0))

class LogoHold(LogoOrnament):
    """Drops in small at the top when the last service is offered, holds there, then moves to center for the outro and lifts out."""
    def __init__(self, start, center_at, out_at, logo_path, tag_lines=()):
        super().__init__(start, out_at, logo_path, tag_lines)
        self.center_at = center_at
    def draw(self, canvas, t):
        if t < self.start: return
        tau = t - self.start
        drop = ease_out(tau / 0.6)
        bounce = math.exp(-5 * tau) * math.sin(tau * 14) * 24 if tau > 0.6 else 0
        c = ease_in_out((t - self.center_at) / 0.8) if t > self.center_at else 0
        lift = ease_in_out((t - self.out_at) / 0.7) if t > self.out_at else 0
        scale = 0.6 + 0.4 * c
        y_top = -300 + (300 + 330) * drop + bounce
        cy = y_top + (720 - y_top) * c - lift * 1500
        th = 0.32 * math.exp(-2.4 * tau) * math.cos(6.5 * tau) + (0.12 * math.exp(-3 * (t - self.center_at)) * math.sin(7 * (t - self.center_at)) if c > 0 else 0)
        card = self.card.copy()
        sweep_t = self.center_at + 0.9
        if 0 < t - sweep_t < 0.7:
            k = (t - sweep_t) / 0.7
            sh = Image.new("L", card.size, 0); sd = ImageDraw.Draw(sh)
            x = -300 + k * (card.width + 600)
            sd.polygon([(x, 0), (x + 120, 0), (x - 160, card.height), (x - 280, card.height)], fill=150)
            sh = Image.fromarray(np.minimum(np.asarray(sh.filter(ImageFilter.GaussianBlur(18))), np.asarray(self.mask)))
            white = Image.new("RGBA", card.size, (255, 255, 255, 0)); white.putalpha(sh); card.alpha_composite(white)
        card = card.resize((int(card.width * scale), int(card.height * scale)), Image.LANCZOS)
        rot = card.rotate(math.degrees(th), resample=Image.BICUBIC, expand=True)
        d = ImageDraw.Draw(canvas)
        d.line([(W / 2, -10), (W / 2 + (cy - card.height / 2) * math.sin(th) * 0.6, cy - card.height / 2 + 8)], fill=GOLD + (255,), width=4)
        canvas.alpha_composite(rot, (int(W / 2 - rot.width / 2), int(cy - rot.height / 2)))
        for i, (line, y) in enumerate(self.tags):
            q = ease_out((t - self.center_at - 0.6 - i * 0.25) / 0.5) * (1 - lift)
            if q > 0: reel.place(canvas, line, W / 2, y, q, (1 - q) * 40)

def build_cine():
    bg = Festive(flurry=(11.8, 15.2))
    GD = GOLD; o = 0.4
    P = PHOTOS
    items = [
        Slam(0, 1.9, [Line("The holidays are", 110, 900), Line("almost here!", 140, 900, GD)], 1000),
        Card(1.9, 4.6, [Line("So much to do", 104, 900), Line("before family arrives.", 78, 800, GD)], 1000, stagger=0.45),
        SlidePhoto(4.6, 6.4, P + "ynsg-yard-raking-28.jpg", focus_y=0.45, zoom=0.06),
        Card(4.7, 6.4, [Line("Clearing the leaves", 96, 900)], 1440),
        SlidePhoto(6.4, 8.15, P + "ynsg-home-basement-shelving-build-32.jpg", focus_y=0.45, zoom=0.06),
        Card(6.5, 8.15, [Line("Organizing the", 92, 900), Line("garage or basement", 80, 800, GD)], 1420, stagger=0.2),
        SlidePhoto(8.15, 10.1, P + "ynsg-cleanout-haul-away-truck-37.jpg", focus_y=0.45, zoom=0.06),
        Card(8.25, 10.1, [Line("Hauling away", 100, 900), Line("what you don’t need", 78, 800, GD)], 1420, stagger=0.2),
        SlidePhoto(10.1, 11.4, P + "ynsg-home-exterior-light-22.jpg", focus_y=0.62, zoom=0.05, top=True),
        Card(10.15, 11.4, [Line("We’re glad to help!", 100, 900, GD)], 400),
        reel.Icon(11.4, 14.8, "snow", y=860), Card(11.4, 14.8, [Line("And if the snow comes,", 84, 900), Line("we can help", 100, 900, GD), Line("with that too.", 100, 900, GD)], 1150, stagger=0.6),
        Card(14.8, 18.1, [Line("At Your Neighborhood", 80, 800), Line("Service Guy,", 116, 900, GD), Line("our goal is simple:", 70, 700)], 1100, gap=6, stagger=0.4),
        SlidePhoto(18.1, 21.4, os.path.join(HERE, "photos", "handshake-a.jpg"), focus_y=0.42, zoom=0.07, crop=(260, 0, 1512, 2016)),
        Card(18.2, 21.4, [Line("More time with", 96, 900), Line("the people who", 96, 900), Line("matter most.", 116, 900, GD)], 1430, stagger=0.5),
        Card(21.4, 24.6, [Line("Request service at", 68, 700), Line("YourNeighborhoodServiceGuy.com", 54, 800, NAVY, pill=GOLD)], 1100, gap=16, stagger=0.3),
    ]
    logo = LogoHold(11.4, 24.6, 28.7, os.path.join(HERE, "logo.jpg"),
                    tag_lines=[(Line("We’re Here to Help.", 84, 900, GD), 1230), (Line("YourNeighborhoodServiceGuy.com", 50, 700), 1340)])
    for it in items: it.start += o; it.end += o
    logo.start += o; logo.center_at += o; logo.out_at += o
    cine = Cine(30.0, leaks=[(0.3, 1.6, 700), (4.7, 0.9, 900), (8.3, 0.9, 1100), (11.7, 1.2, 500), (25.0, 1.4, 800)],
                flares=[(12.0, 330), (25.5, 720)])
    class Combo:
        def draw(self, canvas, t): logo.draw(canvas, t); cine.draw(canvas, t)
    return bg, items, Combo()
