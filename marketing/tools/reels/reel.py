"""Render YNSG Veterans Day Reels (1080x1920, 30fps) as MP4 with the music bed.
usage: python3 reel.py <tag|rate> <out.mp4> [--frames t1,t2,...]"""
import sys, subprocess, os, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H, FPS = 1080, 1920, 30
DUR = 17.0
BAR = 60 / 72 * 4  # 3.333s, matches the music
HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(HERE, "fonts", "Outfit.ttf")

RED = (178, 34, 52)
RED_BRIGHT = (255, 75, 79)
BLUE = (10, 49, 97)
NAVY = (4, 36, 64)
WHITE = (255, 255, 255)
GREEN = (65, 104, 51)

_fonts = {}
def font(size, weight):
    k = (size, weight)
    if k not in _fonts:
        f = ImageFont.truetype(FONT, size)
        f.set_variation_by_axes([weight])
        _fonts[k] = f
    return _fonts[k]

def ease_out(x):
    x = min(max(x, 0), 1)
    return 1 - (1 - x) ** 3

def ease_in_out(x):
    x = min(max(x, 0), 1)
    return x * x * (3 - 2 * x)

# ---------------- backgrounds ----------------
def star_poly(cx, cy, r):
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5
        rr = r if i % 2 == 0 else r * 0.382
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return pts

def make_flag(fh):
    """Flat U.S. flag image of hoist height fh (13 stripes, 50 stars)."""
    fw = int(fh * 1.9)
    img = Image.new("RGB", (fw, fh), WHITE)
    d = ImageDraw.Draw(img)
    sh = fh / 13
    for i in range(13):
        if i % 2 == 0:
            d.rectangle([0, round(i * sh), fw, round((i + 1) * sh)], fill=RED)
    cw, ch = int(fh * 0.76), int(sh * 7)
    d.rectangle([0, 0, cw, ch], fill=BLUE)
    r = fh * 0.0616 / 2 * 1.0
    gx, gy = cw / 12, ch / 10
    for row in range(9):
        cols = 6 if row % 2 == 0 else 5
        for c in range(cols):
            x = gx * (1 + 2 * c + (0 if row % 2 == 0 else 1))
            y = gy * (1 + row)
            d.polygon(star_poly(x, y, r * 1.25), fill=WHITE)
    return img

class WavingFlag:
    """Full-screen waving flag: a crop of a big flag, displaced and shaded per frame."""
    def __init__(self, x0, scale_h=2300, dim=0.55):
        flag = make_flag(scale_h)
        self.margin = 90
        crop = flag.crop((x0 - self.margin, 0, x0 + W + self.margin, scale_h))
        crop = crop.resize((W + 2 * self.margin, H + 2 * self.margin), Image.LANCZOS)
        self.src = np.asarray(crop).astype(np.float32)
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        self.xx, self.yy = xx, yy
        self.dim = dim
        # vertical dark gradient (top + bottom) for text and UI safe areas
        g = np.ones((H, 1), np.float32)
        ys = np.arange(H) / H
        g[:, 0] = 1 - 0.35 * np.clip((0.18 - ys) / 0.18, 0, 1) - 0.55 * np.clip((ys - 0.55) / 0.45, 0, 1) ** 1.3
        self.grad = g
        d2 = ((xx - W / 2) / 620) ** 2 + ((yy - 880) / 520) ** 2
        self.scrim = (1 - 0.5 * np.exp(-d2 * 1.6))[..., None]

    def frame(self, t):
        ph = self.xx * 0.0062 + self.yy * 0.0021 - t * 2.1
        wave = np.sin(ph) + 0.45 * np.sin(ph * 1.9 + 1.3)
        dy = 34 * wave
        dx = 10 * np.cos(ph)
        sx = np.clip((self.xx + self.margin + dx).astype(np.int32), 0, self.src.shape[1] - 1)
        sy = np.clip((self.yy + self.margin + dy).astype(np.int32), 0, self.src.shape[0] - 1)
        img = self.src[sy, sx]
        shade = 1 + 0.22 * np.cos(ph + 0.6) + 0.08 * np.cos(ph * 1.9 + 1.3)
        img = img * (shade[..., None] * self.dim) * self.grad[..., None] * self.scrim
        # navy wash so white text pops while colors stay red/white/blue
        img = img * 0.82 + np.array(NAVY, np.float32) * 0.18
        return np.clip(img, 0, 255).astype(np.uint8)

class StarField:
    """Deep navy with drifting stars and a slow red/white stripe band."""
    def __init__(self):
        rng = np.random.default_rng(4)
        self.stars = [(rng.uniform(0, W), rng.uniform(0, H), rng.uniform(5, 15), rng.uniform(0.15, 0.6), rng.uniform(10, 30)) for _ in range(70)]
        ys = np.linspace(0, 1, H)[:, None]
        base = np.zeros((H, W, 3), np.float32)
        top = np.array((10, 40, 80), np.float32); bot = np.array((2, 16, 32), np.float32)
        base[:] = top * (1 - ys[..., None]) + bot * ys[..., None]
        self.base = Image.fromarray(base.astype(np.uint8))

    def frame(self, t):
        img = self.base.copy()
        ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(ov)
        for (x, y, r, a, sp) in self.stars:
            yy = (y - t * sp) % (H + 40) - 20
            tw = 0.75 + 0.25 * math.sin(t * 2 + x)
            d.polygon(star_poly(x, yy, r), fill=(255, 255, 255, int(255 * a * tw)))
        # waving stripe band across the lower third
        band = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        bd = ImageDraw.Draw(band)
        for i in range(7):
            col = RED + (235,) if i % 2 == 0 else WHITE + (235,)
            pts_top, pts_bot = [], []
            for xi in range(0, W + 41, 40):
                off = 26 * math.sin(xi * 0.006 - t * 1.8) + xi * -0.18
                y0 = 1470 + i * 34 + off
                pts_top.append((xi, y0)); pts_bot.append((xi, y0 + 34))
            bd.polygon(pts_top + pts_bot[::-1], fill=col)
        img = img.convert("RGBA")
        img.alpha_composite(ov)
        img.alpha_composite(band)
        return np.asarray(img.convert("RGB"))

# ---------------- text ----------------
class Line:
    def __init__(self, text, size, weight=800, color=WHITE, pill=None, track=0):
        f = font(size, weight)
        bbox = f.getbbox(text)
        tw, th = bbox[2] - bbox[0], size
        pad_x, pad_y = (36, 18) if pill else (0, 0)
        w, h = tw + 2 * pad_x + 40, int(th * 1.28) + 2 * pad_y + 40
        img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        if pill:
            d.rounded_rectangle([20, 20, w - 20, h - 20], radius=(h - 40) // 2, fill=pill)
        else:
            sh = Image.new("RGBA", (w, h), (0, 0, 0, 0))
            ImageDraw.Draw(sh).text((20 - bbox[0], 20 + pad_y + 4 - bbox[1] + int(size * 0.08)), text, font=f, fill=(0, 10, 25, 200))
            img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(10)))
        d.text((20 + pad_x - bbox[0], 20 + pad_y - bbox[1] + int(size * 0.08)), text, font=f, fill=color)
        self.img = img

def place(canvas, line, cx, y, alpha, dy=0, scale=1.0):
    im = line.img
    if scale != 1.0:
        im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.LANCZOS)
    if alpha < 1:
        a = np.asarray(im).copy()
        a[..., 3] = (a[..., 3] * alpha).astype(np.uint8)
        im = Image.fromarray(a)
    canvas.alpha_composite(im, (int(cx - im.width / 2), int(y + dy - im.height / 2)))

class Card:
    """Text block: lines appear one by one, hold, then exit together."""
    def __init__(self, start, end, lines, y_center=900, gap=8, stagger=0.22):
        self.start, self.end, self.lines, self.stagger = start, end, lines, stagger
        hs = [l.img.height - 40 + gap for l in lines]
        total = sum(hs)
        y = y_center - total / 2
        self.ys = []
        for h in hs:
            self.ys.append(y + h / 2)
            y += h

    def draw(self, canvas, t):
        if t < self.start or t > self.end:
            return
        out = ease_in_out((t - (self.end - 0.32)) / 0.32)
        for i, (l, y) in enumerate(zip(self.lines, self.ys)):
            p = ease_out((t - self.start - i * self.stagger) / 0.5)
            if p <= 0: continue
            a = p * (1 - out)
            dy = (1 - p) * 60 - out * 40
            place(canvas, l, W / 2, y, a, dy)

class BigWord:
    def __init__(self, start, end, line, y=900):
        self.start, self.end, self.line, self.y = start, end, line, y
    def draw(self, canvas, t):
        if t < self.start or t > self.end: return
        p = ease_out((t - self.start) / 0.6)
        out = ease_in_out((t - (self.end - 0.3)) / 0.3)
        s = 1.25 - 0.25 * p + 0.04 * ((t - self.start) / (self.end - self.start))
        place(canvas, self.line, W / 2, self.y, p * (1 - out), 0, s)

class EndCard:
    def __init__(self, start, sub_lines, logo_path, sub_delay=0.45):
        self.start = start; self.sub_delay = sub_delay
        logo = Image.open(logo_path).convert("RGB")
        lw = 780
        logo = logo.resize((lw, int(logo.height * lw / logo.width)), Image.LANCZOS)
        cw, chh = 900, logo.height + 70
        card = Image.new("RGBA", (cw + 80, chh + 80), (0, 0, 0, 0))
        sh = Image.new("RGBA", card.size, (0, 0, 0, 0))
        ImageDraw.Draw(sh).rounded_rectangle([40, 56, cw + 40, chh + 56], radius=44, fill=(0, 0, 0, 150))
        card.alpha_composite(sh.filter(ImageFilter.GaussianBlur(24)))
        ImageDraw.Draw(card).rounded_rectangle([40, 40, cw + 40, chh + 40], radius=44, fill=WHITE)
        # red / white / blue ribbon along the card bottom
        rd = ImageDraw.Draw(card)
        for i, c in enumerate((RED, WHITE, BLUE)):
            pass
        card.paste(logo, (40 + (cw - lw) // 2, 40 + 35))
        self.card = card
        self.sub = sub_lines

    def draw(self, canvas, t):
        if t < self.start: return
        p = ease_out((t - self.start) / 0.7)
        a = np.asarray(self.card).copy(); a[..., 3] = (a[..., 3] * p).astype(np.uint8)
        im = Image.fromarray(a)
        y = 560 + (1 - p) * 120
        canvas.alpha_composite(im, (int(W / 2 - im.width / 2), int(y - im.height / 2)))
        yy = 560 + im.height / 2 + 30
        for i, l in enumerate(self.sub):
            q = ease_out((t - self.start - self.sub_delay - i * 0.2) / 0.5)
            if q > 0:
                place(canvas, l, W / 2, yy + l.img.height / 2 - 20, q, (1 - q) * 40)
            yy += l.img.height - 40 + 14

# ---------------- reels ----------------
def build(kind):
    B = BAR
    if kind == "tag":
        bg = WavingFlag(x0=1120)
        items = [
            Card(0.25, B - 0.05, [Line("To everyone", 118), Line("who served,", 118)], 860),
            Card(B, 2 * B - 0.05, [Line("you missed birthdays,", 82, 700), Line("holidays,", 82, 700), Line("and quiet Sundays", 82, 700)], 880),
            Card(2 * B, 3 * B - 0.05, [Line("so the rest of us", 96, 700), Line("didn’t have to.", 108, 800)], 880),
            BigWord(3 * B, 3 * B + 1.55, Line("Thank you.", 150, 900), 860),
            Card(3 * B + 1.6, 4 * B - 0.05, [Line("TAG A VETERAN", 62, 800, WHITE, pill=RED), Line("who deserves", 96, 800), Line("to hear it.", 96, 800)], 880, gap=14, stagger=0.15),
        ]
        end = EndCard(4 * B, [
            Line("Veterans always get our", 52, 600),
            Line("Community Rate", 62, 800, WHITE, pill=RED),
            Line("YourNeighborhoodServiceGuy.com", 52, 700),
        ], os.path.join(HERE, "logo.jpg"))
    else:
        bg = StarField()
        items = [
            Card(0.25, B - 0.05, [Line("Veterans,", 156, 900), Line("this one’s for you.", 100, 700)], 820),
            Card(B, 2 * B - 0.05, [Line("Home & yard help", 110, 800), Line("from your neighbor.", 96, 600)], 820),
            Card(2 * B, 3 * B - 0.05, [Line("OUR COMMUNITY RATE", 60, 800, WHITE, pill=RED), Line("$45", 260, 900), Line("per person, per hour", 70, 600)], 800, gap=4, stagger=0.18),
            Card(3 * B, 4 * B - 0.05, [Line("Always.", 150, 900), Line("No proof needed.", 96, 700), Line("Thank you for your service.", 60, 600, (255, 210, 214))], 820, stagger=0.25),
        ]
        end = EndCard(4 * B, [
            Line("Request service at", 52, 600),
            Line("YourNeighborhoodServiceGuy.com", 54, 800),
            Line("VETERANS DAY 2026", 44, 800, WHITE, pill=RED),
        ], os.path.join(HERE, "logo.jpg"))
    return bg, items, end


# ---------------- v2: faster, more engaging pieces ----------------
class Slam:
    """Hard-cut text that punches in (scale 1.35 -> 1.0 in 0.14s)."""
    def __init__(self, start, end, lines, y=900, gap=6):
        self.start, self.end, self.lines, self.y, self.gap = start, end, lines, y, gap
    def draw(self, canvas, t):
        if t < self.start or t >= self.end: return
        p = ease_out((t - self.start) / 0.14)
        s = 1.35 - 0.35 * p + 0.03 * (t - self.start)
        hs = [l.img.height - 40 + self.gap for l in self.lines]
        y = self.y - sum(hs) / 2
        for l, h in zip(self.lines, hs):
            place(canvas, l, W / 2, self.y + (y + h / 2 - self.y) * s, min(1, p * 1.5), 0, s)
            y += h

class Flash:
    """Full-screen color block with one giant word (pattern interrupt)."""
    def __init__(self, start, end, word, bg, fg):
        self.start, self.end, self.bg = start, end, bg
        size = 210 if len(word) <= 6 else (170 if len(word) <= 9 else 150)
        self.line = Line(word, size, 900, fg)
    def draw(self, canvas, t):
        if t < self.start or t >= self.end: return
        canvas.alpha_composite(Image.new("RGBA", (W, H), self.bg + (255,)))
        # thin star row for texture
        d = ImageDraw.Draw(canvas)
        col = (255, 255, 255, 60) if self.bg != WHITE else (10, 49, 97, 40)
        for i in range(9):
            d.polygon(star_poly(60 + i * 120, 560, 22), fill=col)
            d.polygon(star_poly(60 + i * 120, 1360, 22), fill=col)
        p = ease_out((t - self.start) / 0.12)
        place(canvas, self.line, W / 2, 960, 1, 0, 1.3 - 0.3 * p)

class PhotoScene:
    """Real job photo, cover-cropped, slow push-in, darkened toward the bottom for text."""
    def __init__(self, start, end, path, focus_y=0.4, zoom=0.08, top=False, crop=None, fit_y=None):
        self.start, self.end, self.zoom = start, end, zoom
        im = Image.open(path).convert("RGB")
        if crop: im = im.crop(crop)
        self.fit_y = fit_y
        if fit_y is not None:
            bgim = im.resize((W, int(im.height * W / im.width) * 2), Image.BILINEAR).resize((W // 8, H // 8)).filter(ImageFilter.GaussianBlur(3)).resize((W, H), Image.BILINEAR)
            self.blur = Image.blend(bgim, Image.new("RGB", (W, H), (3, 14, 28)), 0.45).convert("RGBA")
            fw = W - 0
            self.fit = im.resize((fw, int(im.height * fw / im.width)), Image.LANCZOS)
        sc = max(W * 1.12 / im.width, H * 1.12 / im.height)
        im = im.resize((int(im.width * sc), int(im.height * sc)), Image.LANCZOS)
        self.im, self.fy = im, focus_y
        g = np.zeros((H, W, 4), np.uint8)
        ys = (np.arange(H) / H)[:, None]
        a = np.clip((ys - 0.45) / 0.55, 0, 1) ** 1.1 * 235 + np.clip((0.12 - ys) / 0.12, 0, 1) * 90
        if top:
            a = np.clip((0.42 - ys) / 0.42, 0, 1) ** 1.1 * 235 + np.clip((ys - 0.85) / 0.15, 0, 1) * 120
        g[..., 0:3] = np.array((3, 14, 28), np.uint8)
        g[..., 3] = a.astype(np.uint8)
        self.grad = Image.fromarray(g, "RGBA")
    def draw(self, canvas, t):
        if t < self.start or t >= self.end: return
        k = (t - self.start) / (self.end - self.start)
        if self.fit_y is not None:
            canvas.alpha_composite(self.blur)
            s2 = 1 + self.zoom * k
            im = self.fit.resize((int(self.fit.width * s2), int(self.fit.height * s2)), Image.BILINEAR)
            x = (W - im.width) // 2
            y = int(self.fit_y - im.height / 2)
            box = im.crop((-x if x < 0 else 0, 0, im.width - (-x if x < 0 else 0), im.height))
            canvas.alpha_composite(box.convert("RGBA"), (max(x, 0), y))
            canvas.alpha_composite(self.grad)
            return
        s = 1 + self.zoom * k
        cw, ch = W / s * 1.0, H / s * 1.0
        sw, sh = self.im.width / 1.12, self.im.height / 1.12  # base cover size
        cx = self.im.width / 2
        cy = self.im.height * self.fy + (self.im.height * 0.5 - self.im.height * self.fy) * 0
        box = (cx - cw * self.im.width / (W * 1.12) * 1.12 / 2 * (W * 1.12 / self.im.width) , 0, 0, 0)
        # simple crop: region of size (W*1.12/s', H*1.12/s') in resized image units
        rw, rh = W * 1.0 / s, H * 1.0 / s
        x0 = max(0, min(self.im.width - rw, cx - rw / 2))
        y0 = max(0, min(self.im.height - rh, self.im.height * self.fy - rh / 2))
        fr = self.im.crop((int(x0), int(y0), int(x0 + rw), int(y0 + rh))).resize((W, H), Image.BILINEAR)
        canvas.alpha_composite(fr.convert("RGBA"))
        canvas.alpha_composite(self.grad)
        # quick white flash-in on the cut
        if t - self.start < 0.12:
            a = int(140 * (1 - (t - self.start) / 0.12))
            canvas.alpha_composite(Image.new("RGBA", (W, H), (255, 255, 255, a)))


class FinalBadge:
    """Small logo card up top + URL under the headline, then a slow fade to black."""
    def __init__(self, start, logo_path):
        self.start = start
        logo = Image.open(logo_path).convert("RGB")
        lw = 420
        logo = logo.resize((lw, int(logo.height * lw / logo.width)), Image.LANCZOS)
        card = Image.new("RGBA", (lw + 100, logo.height + 100), (0, 0, 0, 0))
        sh = Image.new("RGBA", card.size, (0, 0, 0, 0))
        ImageDraw.Draw(sh).rounded_rectangle([40, 52, lw + 60, logo.height + 72], radius=30, fill=(0, 0, 0, 150))
        card.alpha_composite(sh.filter(ImageFilter.GaussianBlur(18)))
        ImageDraw.Draw(card).rounded_rectangle([40, 40, lw + 60, logo.height + 60], radius=30, fill=WHITE)
        card.paste(logo, (50, 50))
        self.card = card
        self.url = Line("YourNeighborhoodServiceGuy.com", 50, 800)
    def draw(self, canvas, t):
        if t < self.start: return
        p = ease_out((t - self.start) / 0.6)
        a = np.asarray(self.card).copy(); a[..., 3] = (a[..., 3] * p).astype(np.uint8)
        q = ease_out((t - self.start - 0.3) / 0.5)
        if q > 0: place(canvas, self.url, W / 2, 1610, q, (1 - q) * 30)
        f = ease_in_out((t - (DUR - 1.3)) / 1.2)
        if f > 0:
            canvas.alpha_composite(Image.new("RGBA", (W, H), (0, 0, 0, int(255 * f))))

PHOTOS = "/home/claude/ynsg/marketing/job-photos/"

def build_vet():
    h = 0.5
    bg = WavingFlag(x0=1120)
    items = [Slam(0, 2.0, [Line("Who’s YOUR", 128, 900), Line("veteran?", 168, 900, (255, 90, 94))], 880)]
    names = ["Dad?", "Mom?", "Grandpa?", "Grandma?", "Brother?", "Sister?", "Son?", "Daughter?"]
    for i, n in enumerate(names):
        items.append(Slam(2.0 + i * h, 2.0 + (i + 1) * h, [Line(n, 190 if len(n) <= 5 else 165, 900)], 900))
    items.append(Slam(6.0, 6.6, [Line("Your neighbor?", 130, 900)], 900))
    branches = [("ARMY", RED, WHITE), ("NAVY", BLUE, WHITE), ("AIR FORCE", WHITE, BLUE),
                ("MARINES", RED, WHITE), ("COAST GUARD", BLUE, WHITE), ("SPACE FORCE", WHITE, RED)]
    for i, (w, bgc, fg) in enumerate(branches):
        items.append(Flash(6.6 + i * h, 6.6 + (i + 1) * h, w, bgc, fg))
    items += [
        Slam(9.6, 10.25, [Line("Which branch?", 128, 900)], 900),
        Card(10.25, 12.0, [Line("COMMENT IT BELOW", 64, 800, WHITE, pill=RED), Line("and tag them", 110, 900), Line("so they hear it today.", 82, 700)], 900, gap=12, stagger=0.15),
        PhotoScene(12.0, 14.0, PHOTOS + "ynsg-brand-sunrise-coffee-silhouette-43.jpg", focus_y=0.5, zoom=0.06),
        Card(12.1, 14.0, [Line("Up early for", 96, 800), Line("our neighbors.", 96, 800), Line("Especially the ones who served.", 52, 600, (255, 214, 216))], 1330, gap=8, stagger=0.2),
        PhotoScene(14.0, 16.0, PHOTOS + "ynsg-home-exterior-light-22.jpg", focus_y=0.62, zoom=0.07, top=True),
        Card(14.1, 16.0, [Line("Veterans always get our", 60, 600), Line("COMMUNITY RATE", 72, 900, WHITE, pill=RED), Line("No proof needed.", 60, 600)], 380, gap=14, stagger=0.16),
        PhotoScene(16.0, 20.0, os.path.join(HERE, "photos", "handshake-a.jpg"), focus_y=0.42, zoom=0.08, crop=(260, 0, 1512, 2016)),
        Card(16.15, 20.1, [Line("Thank you for", 104, 900), Line("your service.", 104, 900, (255, 90, 94))], 1420, stagger=0.25),
    ]
    for it in items:
        it.start += 2.0; it.end += 2.0
    items.insert(0, Slam(0, 2.0, [Line("Happy", 150, 900), Line("Veterans Day!", 140, 900, (255, 90, 94))], 880, gap=4))
    end = FinalBadge(19.0, os.path.join(HERE, "logo.jpg"))
    return bg, items, end

def build_vet3():
    """Story cut (28s) built for a voiceover: hook, sacrifice, roll call, branches, offer, the dad reveal, ask."""
    bg = WavingFlag(x0=1120)
    RB = (255, 90, 94)
    items = [
        Slam(0, 2.0, [Line("Happy", 150, 900), Line("Veterans Day.", 140, 900, RB)], 880, gap=4),
        Card(2.0, 5.0, [Line("They don’t ask", 120, 900), Line("for thanks.", 120, 900, RB)], 900, stagger=0.35),
        Slam(5.0, 6.2, [Line("Birthdays.", 170, 900)], 900),
        Slam(6.2, 7.4, [Line("Holidays.", 170, 900)], 900),
        Slam(7.4, 9.0, [Line("Years.", 210, 900, RB)], 900),
        Card(9.0, 11.0, [Line("So we", 130, 900), Line("didn’t have to.", 120, 900)], 900, stagger=0.3),
    ]
    for i, w in enumerate(["dad.", "mom.", "son.", "daughter."]):
        items.append(Slam(11.0 + i * 0.75, 11.0 + (i + 1) * 0.75, [Line("Somebody’s", 90, 700), Line(w, 190, 900, RB if i % 2 else WHITE)], 900, gap=0))
    branches = [("ARMY", RED, WHITE), ("NAVY", BLUE, WHITE), ("AIR FORCE", WHITE, BLUE),
                ("MARINES", RED, WHITE), ("COAST GUARD", BLUE, WHITE), ("SPACE FORCE", WHITE, RED)]
    for i, (w, bgc, fg) in enumerate(branches):
        items.append(Flash(14.0 + i * 0.5, 14.0 + (i + 1) * 0.5, w, bgc, fg))
    items += [
        PhotoScene(17.0, 18.5, PHOTOS + "ynsg-brand-sunrise-coffee-silhouette-43.jpg", focus_y=0.5, zoom=0.05),
        Card(17.1, 18.5, [Line("Here in our", 96, 800), Line("neighborhood,", 96, 800)], 1330, stagger=0.2),
        PhotoScene(18.5, 20.0, PHOTOS + "ynsg-home-exterior-light-22.jpg", focus_y=0.62, zoom=0.06, top=True),
        Card(18.6, 20.0, [Line("every veteran gets our", 60, 600), Line("COMMUNITY RATE", 72, 900, WHITE, pill=RED), Line("Always.", 70, 800)], 380, gap=14, stagger=0.14),
        PhotoScene(20.0, 28.0, os.path.join(HERE, "photos", "handshake-a.jpg"), focus_y=0.42, zoom=0.10, crop=(260, 0, 1512, 2016)),
        Card(20.3, 22.6, [Line("This is", 110, 900), Line("my dad.", 150, 900, RB)], 1400, stagger=0.45),
        Card(22.6, 25.0, [Line("He served this country.", 76, 800), Line("Now I get to serve him.", 76, 800, RB)], 1400, gap=10, stagger=0.8),
        Card(25.0, 28.2, [Line("Who’s your veteran?", 92, 900), Line("Share their name below.", 66, 700, (255, 214, 216))], 1400, gap=10, stagger=0.3),
    ]
    end = FinalBadge(25.6, os.path.join(HERE, "logo.jpg"))
    return bg, items, end

class FadeBlack:
    def __init__(self, start, end): self.start, self.end = start, end
    def draw(self, canvas, t):
        f = ease_in_out((t - self.start) / (self.end - self.start))
        if f > 0: canvas.alpha_composite(Image.new("RGBA", (W, H), (0, 0, 0, int(255 * min(f, 1)))))

class Nothing:
    def draw(self, canvas, t): pass

class StarScene:
    """Deep navy star field with the red/white stripe band, as an in-between scene."""
    _sf = None
    def __init__(self, start, end):
        self.start, self.end = start, end
        if StarScene._sf is None: StarScene._sf = StarField()
    def draw(self, canvas, t):
        if t < self.start or t >= self.end: return
        canvas.alpha_composite(Image.fromarray(StarScene._sf.frame(t)).convert("RGBA"))

class PanScene:
    """Crowd strip scaled to full height and panned sideways. It's heavily blurred at source resolution
    so no one can be identified, then darkened for text."""
    def __init__(self, start, end, path, crop, blur=7, direction=1):
        self.start, self.end, self.dir = start, end, direction
        im = Image.open(path).convert("RGB").crop(crop)
        if blur: im = im.filter(ImageFilter.GaussianBlur(blur))
        sc = H / im.height
        self.im = im.resize((int(im.width * sc), H), Image.BICUBIC)
        g = np.zeros((H, W, 4), np.uint8)
        ys = (np.arange(H) / H)[:, None]
        a = 110 + np.clip((ys - 0.35) / 0.65, 0, 1) * 110 + np.clip((0.15 - ys) / 0.15, 0, 1) * 60
        g[..., 0:3] = np.array((3, 14, 28), np.uint8); g[..., 3] = np.clip(a, 0, 255).astype(np.uint8)
        self.grad = Image.fromarray(g, "RGBA")
    def draw(self, canvas, t):
        if t < self.start or t >= self.end: return
        k = ease_in_out((t - self.start) / (self.end - self.start))
        span = self.im.width - W
        x = int(span * (0.15 + 0.7 * (k if self.dir > 0 else 1 - k)))
        canvas.alpha_composite(self.im.crop((x, 0, x + W, H)).convert("RGBA"))
        canvas.alpha_composite(self.grad)

def build_vo():
    """Voiceover cut: every scene timed to the Hale voiceover (VO starts at 0.4 s)."""
    bg = WavingFlag(x0=1120)
    RB = (255, 90, 94); PINK = (255, 214, 216)
    P = PHOTOS
    items = [
        Slam(0, 1.78, [Line("Happy", 150, 900), Line("Veterans Day.", 140, 900, RB)], 880, gap=4),
        PanScene(1.78, 5.87, os.path.join(HERE, "photos", "crowd-a.jpg"), (0, 520, 1512, 1165), blur=7),
        Card(1.85, 2.99, [Line("Look around you.", 120, 900)], 900),
        Card(2.99, 5.87, [Line("The person next to you", 84, 800), Line("may be a veteran…", 104, 900, RB)], 900, gap=8, stagger=0.5),
        Card(5.87, 7.56, [Line("…and you may", 110, 900), Line("never know it.", 120, 900, RB)], 900, stagger=0.3),
    ]
    branches = [("ARMY", 7.56, 8.26, RED, WHITE), ("NAVY", 8.26, 9.10, BLUE, WHITE), ("AIR FORCE", 9.10, 9.93, WHITE, BLUE),
                ("MARINES", 9.93, 10.83, RED, WHITE), ("COAST GUARD", 10.83, 11.78, BLUE, WHITE), ("SPACE FORCE", 11.78, 13.14, WHITE, RED)]
    for w, a, b, bgc, fg in branches:
        items.append(Flash(a, b, w, bgc, fg))
    items += [
        Card(13.14, 15.11, [Line("To every one of you", 96, 900), Line("who served,", 120, 900, RB)], 900, stagger=0.35),
        StarScene(15.11, 18.24),
        Card(15.2, 18.24, [Line("Thank you for", 110, 900), Line("your service", 110, 900), Line("and your sacrifice.", 86, 800, PINK)], 840, gap=6, stagger=0.45),
        PhotoScene(18.24, 22.77, P + "ynsg-yard-mowing-12.jpg", focus_y=0.35, zoom=0.08),
        Card(18.35, 22.77, [Line("At Your Neighborhood Service Guy,", 52, 700), Line("we serve the same", 84, 900), Line("neighborhoods", 96, 900), Line("you protected.", 96, 900, RB)], 1300, gap=4, stagger=0.5),
        PhotoScene(22.77, 24.6, P + "ynsg-yard-raking-28.jpg", focus_y=0.45, zoom=0.06),
        Card(22.85, 24.6, [Line("That means", 100, 900), Line("something to us.", 100, 900, RB)], 1350, stagger=0.3),
        PhotoScene(24.6, 27.9, P + "ynsg-home-exterior-light-22.jpg", focus_y=0.62, zoom=0.06, top=True),
        Card(24.7, 27.9, [Line("Every veteran receives our", 58, 600), Line("COMMUNITY RATE", 76, 900, WHITE, pill=RED)], 400, gap=14, stagger=0.3),
        PhotoScene(27.9, 30.17, os.path.join(HERE, "photos", "handshake-a.jpg"), focus_y=0.42, zoom=0.06, crop=(260, 0, 1512, 2016)),
        Card(28.0, 30.17, [Line("Our way of", 100, 900), Line("saying thank you.", 100, 900, RB)], 1400, stagger=0.3),
        Slam(30.17, 31.19, [Line("Know a veteran?", 128, 900)], 900),
        Card(31.19, 34.51, [Line("SHARE THEIR NAME BELOW", 60, 800, WHITE, pill=RED), Line("so they know", 110, 900), Line("they’re appreciated.", 92, 900, RB)], 900, gap=14, stagger=0.4),
    ]
    end = EndCard(34.51, [
        Line("We honor our veterans,", 62, 800),
        Line("today and every day.", 62, 800, RB),
        Line("YourNeighborhoodServiceGuy.com", 50, 700),
    ], os.path.join(HERE, "logo.jpg"), sub_delay=1.9)
    for it in items: it.start += 0.4; it.end += 0.4
    end.start += 0.4
    fade = FadeBlack(41.7, 42.9)
    class Combo:
        def draw(self, canvas, t):
            end.draw(canvas, t); fade.draw(canvas, t)
    return bg, items, Combo()

GOLD = (243, 172, 57); NAVY_D = (3, 18, 36)

class WinterScene:
    """Deep navy night, warm glow from below, a neighborhood roofline with lit windows, gentle snowfall."""
    def __init__(self, heavy=None):
        self.heavy = heavy or (0, 0)
        ys = np.linspace(0, 1, H)[:, None, None]
        top = np.array((8, 30, 58), np.float32); bot = np.array((2, 12, 26), np.float32)
        base = top * (1 - ys) + bot * ys
        xx = np.arange(W)[None, :, None]; yy = np.arange(H)[:, None, None]
        glow = np.exp(-(((xx - 540) / 620) ** 2 + ((yy - 1750) / 520) ** 2))
        base = base + glow * np.array((90, 55, 10), np.float32)
        img = Image.fromarray(np.clip(base[..., :3] * np.ones((1, W, 1)), 0, 255).astype(np.uint8))
        d = ImageDraw.Draw(img)
        # roofline of simple houses along the bottom
        x = -40; rng = np.random.default_rng(3)
        while x < W + 40:
            w = int(rng.uniform(190, 280)); h = int(rng.uniform(150, 230)); base_y = 1920 - 120
            d.polygon([(x, base_y - h), (x + w / 2, base_y - h - w * 0.38), (x + w, base_y - h), (x + w, 1920), (x, 1920)], fill=(4, 16, 30))
            for wx in (x + w * 0.22, x + w * 0.62):
                d.rectangle([wx, base_y - h * 0.62, wx + w * 0.16, base_y - h * 0.62 + w * 0.16], fill=(255, 196, 110))
            x += w + int(rng.uniform(10, 40))
        d.rectangle([0, 1920 - 120, W, 1920], fill=(230, 236, 244))   # snow on the ground
        self.base = img.convert("RGBA")
        r2 = np.random.default_rng(9)
        self.flakes = [(r2.uniform(0, W), r2.uniform(0, H), r2.uniform(2, 7), r2.uniform(40, 120), r2.uniform(0, 6)) for _ in range(160)]
    def frame(self, t):
        img = self.base.copy()
        d = ImageDraw.Draw(img)
        h0, h1 = self.heavy
        n = 160 if h0 <= t <= h1 else 70
        for (x, y, r, sp, ph) in self.flakes[:n]:
            yy = (y + t * sp) % (H + 20) - 10
            xx = x + 18 * math.sin(t * 0.8 + ph)
            d.ellipse([xx - r, yy - r, xx + r, yy + r], fill=(255, 255, 255, 170))
        return np.asarray(img.convert("RGB"))

def icon_image(kind, size=230):
    S = size * 2
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    lw = 14; c = S / 2; WHT = (255, 255, 255, 255); G = GOLD + (255,)
    d.ellipse([lw, lw, S - lw, S - lw], outline=G, width=lw)
    def L(pts): d.line(pts, fill=WHT, width=lw, joint="curve")
    if kind == "leaf":
        pts = [(c - 110 + i * 2.2, c + 110 - i * 2.2 - 70 * math.sin(i / 100 * math.pi)) for i in range(101)]
        pts2 = [(c - 110 + i * 2.2, c + 110 - i * 2.2 + 70 * math.sin(i / 100 * math.pi)) for i in range(101)]
        d.polygon(pts + pts2[::-1], outline=WHT, width=lw)
        L([(c - 140, c + 140), (c + 60, c - 60)])
    elif kind == "shelves":
        d.rectangle([c - 130, c - 130, c + 130, c + 130], outline=WHT, width=lw)
        L([(c - 130, c - 20), (c + 130, c - 20)]); L([(c - 130, c + 70), (c + 130, c + 70)])
        d.rectangle([c - 100, c - 100, c - 30, c - 34], outline=G, width=lw - 4)
        d.rectangle([c + 10, c - 4, c + 100, c + 56], outline=G, width=lw - 4)
    elif kind == "truck":
        d.rectangle([c - 150, c - 80, c + 40, c + 60], outline=WHT, width=lw)
        d.polygon([(c + 40, c - 30), (c + 110, c - 30), (c + 150, c + 10), (c + 150, c + 60), (c + 40, c + 60)], outline=WHT, width=lw)
        for wx in (c - 90, c + 95):
            d.ellipse([wx - 32, c + 40, wx + 32, c + 104], fill=(8, 30, 58, 255), outline=G, width=lw - 2)
    elif kind == "check":
        L([(c - 110, c + 5), (c - 30, c + 85), (c + 120, c - 80)])
    elif kind == "snow":
        for k in range(6):
            a = k * math.pi / 3
            x2, y2 = c + 140 * math.cos(a), c + 140 * math.sin(a)
            L([(c, c), (x2, y2)])
            for f in (0.6,):
                bx, by = c + 140 * f * math.cos(a), c + 140 * f * math.sin(a)
                for s2 in (-1, 1):
                    L([(bx, by), (bx + 45 * math.cos(a + s2 * 0.8), by + 45 * math.sin(a + s2 * 0.8))])
    elif kind == "home":
        d.polygon([(c - 130, c - 10), (c, c - 130), (c + 130, c - 10)], outline=WHT, width=lw)
        d.rectangle([c - 100, c - 10, c + 100, c + 130], outline=WHT, width=lw)
        hx, hy = c, c + 55
        d.polygon([(hx, hy + 45), (hx - 52, hy - 5), (hx - 40, hy - 32), (hx - 14, hy - 34), (hx, hy - 14), (hx + 14, hy - 34), (hx + 40, hy - 32), (hx + 52, hy - 5)], fill=G)
    return im.resize((size, size), Image.LANCZOS)

class Icon:
    def __init__(self, start, end, kind, y=620, size=230):
        self.start, self.end, self.y = start, end, y
        self.im = icon_image(kind, size)
    def draw(self, canvas, t):
        if t < self.start or t >= self.end: return
        p = ease_out((t - self.start) / 0.35); out = ease_in_out((t - (self.end - 0.25)) / 0.25)
        s = 0.7 + 0.3 * p
        im = self.im.resize((int(self.im.width * s), int(self.im.height * s)), Image.LANCZOS)
        a = np.asarray(im).copy(); a[..., 3] = (a[..., 3] * p * (1 - out)).astype(np.uint8)
        canvas.alpha_composite(Image.fromarray(a), (int(W / 2 - im.width / 2), int(self.y - im.height / 2)))

def build_holiday():
    """Holiday-prep Reel timed to the Clara voiceover (VO starts at 0.4 s). Designed scenes, brand navy and gold."""
    bg = WinterScene(heavy=(13.4, 17.4))
    GD = GOLD
    items = [
        Slam(0, 2.1, [Line("The holidays are", 110, 900), Line("almost here.", 130, 900, GD)], 900),
        Card(2.1, 5.6, [Line("So much to do", 100, 900), Line("before family arrives.", 76, 800, GD)], 900, stagger=0.4),
        Icon(5.6, 7.35, "leaf"), Card(5.6, 7.35, [Line("Clearing the leaves", 92, 900)], 900),
        Icon(7.35, 9.65, "shelves"), Card(7.35, 9.65, [Line("Organizing the", 92, 900), Line("garage or basement", 80, 800, GD)], 920, stagger=0.25),
        Icon(9.65, 11.85, "truck"), Card(9.65, 11.85, [Line("Hauling away", 100, 900), Line("what you don’t need", 76, 800, GD)], 920, stagger=0.25),
        Icon(11.85, 13.3, "check"), Card(11.85, 13.3, [Line("We’re glad to help.", 96, 900)], 900),
        Icon(13.3, 17.2, "snow"), Card(13.3, 17.2, [Line("And if the snow comes,", 84, 900), Line("we can help", 100, 900, GD), Line("with that too.", 100, 900, GD)], 940, stagger=0.6),
        Card(17.2, 20.8, [Line("At Your Neighborhood", 80, 800), Line("Service Guy,", 110, 900, GD), Line("our goal is simple:", 70, 700)], 900, gap=6, stagger=0.4),
        Icon(20.8, 25.2, "home"), Card(20.8, 25.2, [Line("More time with", 96, 900), Line("the people who", 96, 900), Line("matter most.", 110, 900, GD)], 960, stagger=0.55),
        Card(25.2, 28.9, [Line("Request service at", 66, 700), Line("YourNeighborhoodServiceGuy.com", 54, 800, NAVY, pill=GOLD)], 900, gap=16, stagger=0.3),
    ]
    end = EndCard(28.9, [Line("We’re Here to Help.", 76, 900, GD), Line("YourNeighborhoodServiceGuy.com", 50, 700)], os.path.join(HERE, "logo.jpg"), sub_delay=1.2)
    for it in items: it.start += 0.4; it.end += 0.4
    end.start += 0.4
    fade = FadeBlack(33.2, 34.4)
    class Combo:
        def draw(self, canvas, t): end.draw(canvas, t); fade.draw(canvas, t)
    return bg, items, Combo()

def render_frame(bg, items, end, t):
    base = Image.fromarray(bg.frame(t)).convert("RGBA")
    for it in items:
        it.draw(base, t)
    end.draw(base, t)
    # thin red/white/blue progress-style rule at top safe area
    return base.convert("RGB")

def main():
    kind, out = sys.argv[1], sys.argv[2]
    builders = {"vet": (build_vet, 22.0, "march22.wav"), "vet3": (build_vet3, 28.0, "bed28.wav"), "vo": (build_vo, 43.0, "mix-vo.wav"), "holiday": (build_holiday, 34.5, "mix-holiday.wav"), "festive": (None, 30.0, "mix-festive.wav"), "cine": ("cine", 30.0, "mix-festive.wav")}
    global DUR
    if kind in builders:
        fnb, DUR, music = builders[kind]
        if fnb is None:
            import festive; fnb = festive.build_festive
        elif fnb == "cine":
            import festive; fnb = festive.build_cine
        bg, items, end = fnb()
    else:
        bg, items, end = build(kind); music = "bed.wav"
    if "--frames" in sys.argv:
        ts = [float(x) for x in sys.argv[sys.argv.index("--frames") + 1].split(",")]
        for t in ts:
            render_frame(bg, items, end, t).save(f"{out}_{t:05.2f}.jpg", quality=88)
        return
    tmp = out[:-4] + ".part.mp4"
    n = int(DUR * FPS)
    p = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                          "-i", os.path.join(HERE, music), "-map", "0:v", "-map", "1:a",
                          "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-pix_fmt", "yuv420p", "-profile:v", "high",
                          "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", tmp], stdin=subprocess.PIPE)
    for i in range(n):
        p.stdin.write(render_frame(bg, items, end, i / FPS).tobytes())
    p.stdin.close()
    if p.wait() == 0:
        os.replace(tmp, out)
        print("done", out)
    else:
        print("ffmpeg failed"); sys.exit(1)

if __name__ == "__main__":
    main()
