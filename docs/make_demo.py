"""Generate the demo video (about 43 s, 1080p, bilingual captions).
產生示範影片（約 43 秒、1080p、中英雙語字幕）。
Needs / 需要: pip install pillow imageio-ffmpeg ; Windows fonts msjh*.ttc (change BOLD/REG on other OS)
Assets: docs/img/card-*.png (screenshots), data/recipe-*.csv (measured curves).
Screenshots of the running states use sample values (rendered from the real card with overridden states).
Run: python make_demo.py  ->  demo.mp4
"""
import csv, os, subprocess
from PIL import Image, ImageDraw, ImageFont
import imageio_ffmpeg

HERE = os.path.dirname(os.path.abspath(__file__))
IMG = lambda n: os.path.join(HERE, "img", n)
DATA = lambda n: os.path.join(HERE, "..", "data", n)
OUT = os.path.join(HERE, "demo.mp4")
W, H, FPS = 1920, 1080, 30
BOLD, REG = r"C:\Windows\Fonts\msjhbd.ttc", r"C:\Windows\Fonts\msjh.ttc"
_f = {}


def font(sz, bold=True):
    k = (sz, bold)
    if k not in _f:
        _f[k] = ImageFont.truetype(BOLD if bold else REG, sz)
    return _f[k]


BG = (15, 23, 42); FG = (241, 245, 249); MUTED = (148, 163, 184)
ACC = (56, 189, 248); GOOD = (74, 222, 128); WARN = (251, 146, 60); PANEL = (30, 41, 59)
clamp = lambda x, a=0.0, b=1.0: max(a, min(b, x))
ease = lambda t: 1 - (1 - clamp(t)) ** 3
seg = lambda t, a, b: clamp((t - a) / (b - a))


def text(img, xy, s, sz, fill=FG, bold=True, anchor="mm", alpha=1.0):
    if alpha <= 0:
        return
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).text(xy, s, font=font(sz, bold), fill=fill + (int(255 * alpha),), anchor=anchor)
    img.alpha_composite(layer)


def rrect(img, box, r, fill, outline=None, width=0, alpha=1.0):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).rounded_rectangle(
        box, r, fill=fill + (int(255 * alpha),),
        outline=(outline + (int(255 * alpha),)) if outline else None, width=width)
    img.alpha_composite(layer)


def base():
    return Image.new("RGBA", (W, H), BG + (255,))


def bi(img, xy, zh, en, sz=46, c=FG, alpha=1.0, anchor="mm"):
    """Bilingual two-line label (Chinese on top, English below)."""
    text(img, xy, zh, sz, c, alpha=alpha, anchor=anchor)
    text(img, (xy[0], xy[1] + int(sz * 0.95)), en, int(sz * 0.6), MUTED, False, alpha=alpha, anchor=anchor)


def phone(img, name, x, y, hgt=900, name2=None, mix=0.0):
    a = Image.open(IMG(name)).convert("RGB")
    a = a.resize((int(a.width * hgt / a.height), hgt), Image.LANCZOS)
    if name2:
        b = Image.open(IMG(name2)).convert("RGB").resize(a.size, Image.LANCZOS)
        a = Image.blend(a, b, mix)
    rrect(img, (x - 16, y - 16, x + a.width + 16, y + a.height + 16), 40, (2, 6, 23), (71, 85, 105), 6)
    img.alpha_composite(a.convert("RGBA"), (x, y))


def callouts(im, t, items, size):
    for i, (zh, en, t0, c) in enumerate(items):
        k = ease(seg(t, t0, t0 + .5))
        y = 250 + i * 210
        rrect(im, (800, y - 80, 1800, y + 80), 28, PANEL, c, 4, k)
        bi(im, (1300 + (1 - k) * 60, y - 14), zh, en, size, FG, k)


def s1(t):
    im = base()
    k = ease(seg(t, 0, .8)); k2 = ease(seg(t, .8, 1.6)); k3 = ease(seg(t, 1.8, 2.6))
    text(im, (W // 2, 330 + (1 - k) * 40), "電子鍋變舒肥鍋", 120, FG, alpha=k)
    text(im, (W // 2, 460 + (1 - k) * 40), "Rice cooker → sous-vide cooker", 66, ACC, alpha=k)
    bi(im, (W // 2, 660), "米家電子鍋 mini × Home Assistant", "Xiaomi Mijia rice cooker mini × Home Assistant", 56, FG, k2)
    bi(im, (W // 2, 850), "純區網 · 開源 · 免雲端", "Local only · open source · no cloud", 44, MUTED, k3)
    return im


def s2(t):
    im = base()
    phone(im, "card-cook-idle.png", 150, 90, 900, "card-cook-running.png", ease(seg(t, 3.0, 3.8)))
    callouts(im, t, [
        ("6 種原廠模式，按兩下確認", "6 native modes, two-tap confirm", 0.6, ACC),
        ("「自選」自動顯示 App 的食譜名", "Custom slot shows the app's recipe name", 1.6, GOOD),
        ("烹飪中顯示食譜與剩餘時間", "Running recipe + time left", 3.0, WARN),
        ("其餘 App 食譜列出原廠時間", "Other app recipes listed (read-only)", 4.4, MUTED)], 44)
    return im


def s3(t):
    im = base()
    phone(im, "card-sousvide-recipes.png", 150, 90, 900, "card-sousvide-running.png", ease(seg(t, 4.0, 4.8)))
    callouts(im, t, [
        ("舒肥：任意溫度、時間最長 24 小時", "Any target temperature, up to 24 h", 0.6, ACC),
        ("食譜預設：優格、溫泉蛋、鮭魚、牛排…", "Presets: yogurt, eggs, salmon, steak…", 1.6, GOOD),
        ("一般 ±1°C ／ 安靜模式提示音少 3/4", "Normal ±1 °C / quiet mode: ~1/4 of the beeps", 2.8, WARN),
        ("過溫與感測離線自動保護", "Over-temperature & sensor-loss protection", 4.6, MUTED)], 40)
    return im


def s4(t):
    im = base()
    bi(im, (W // 2, 120), "嬰兒粥：兩段式食譜", "Baby porridge: a two-step recipe", 70, FG, ease(seg(t, 0, .5)))
    boxes = [("① 55°C 吸水 30 分", "Soak at 55 °C, 30 min", "我們的外部控溫", "our thermostat", ACC),
             ("② 原廠煮粥程式", "Native congee program", "煮滾 → 微滾 → 保溫", "boil → simmer → keep warm", GOOD)]
    for i, (zh, en, a, b, c) in enumerate(boxes):
        k = ease(seg(t, .8 + i * 1.4, 1.5 + i * 1.4))
        x = 230 + i * 760; y = 360; off = (1 - k) * 40
        rrect(im, (x, y + off, x + 680, y + 360 + off), 36, PANEL, c, 6, k)
        bi(im, (x + 340, y + 90 + off), zh, en, 52, FG, k)
        bi(im, (x + 340, y + 250 + off), a, b, 40, c, k)
    ka = ease(seg(t, 2.0, 2.6)); d = ImageDraw.Draw(im)
    d.line((925, 540, 925 + 50 * ka, 540), fill=ACC + (255,), width=10)
    if ka > .9:
        d.polygon([(965, 510), (965, 570), (1000, 540)], fill=ACC + (255,))
    bi(im, (W // 2, 880), "時間到，自動接著啟動，不用人在旁邊按", "When the time is up it starts the next step by itself", 46, MUTED, ease(seg(t, 3.5, 4.2)))
    return im


def s5(t):
    im = base()
    bi(im, (W // 2, 110), "怎麼控溫？反覆開關「保溫」", "How? Toggle the built-in “keep warm” mode", 66, FG, ease(seg(t, 0, .5)))
    x0, y0, x1, y1 = 260, 260, 1660, 800
    rrect(im, (x0 - 40, y0 - 40, x1 + 40, y1 + 90), 28, PANEL)
    tgt_y = y0 + 200
    d = ImageDraw.Draw(im)
    d.line((x0, tgt_y, x1, tgt_y), fill=WARN + (255,), width=4)
    text(im, (x1 - 10, tgt_y - 30), "target 目標", 34, WARN, False, anchor="rm")
    pts = []
    for i in range(int(1400 * seg(t, .8, 6.5))):
        ph = (i / 140.0) % 1.0           # sawtooth: heat up 40 %, cool down 60 %
        off = -ph / .4 * 110 if ph < .4 else -110 + (ph - .4) / .6 * 110
        pts.append((x0 + i, tgt_y + 60 + off))
    if len(pts) > 1:
        d.line(pts, fill=ACC + (255,), width=6)
    text(im, (x0 + 10, y1 + 45), "加熱到 目標-1.5°C 就停、降到 目標-2°C 再開　Stop at -1.5 °C, restart at -2 °C", 36, MUTED, False, anchor="lm")
    return im


def curve(csvname):
    rows = [r for r in list(csv.reader(open(DATA(csvname), encoding="utf-8")))[1:] if r[1] == "busy"]
    t0 = None; pts = []
    for r in rows:
        h, m, s = map(int, r[0].split(":"))
        sec = h * 3600 + m * 60 + s
        t0 = sec if t0 is None else t0
        pts.append(((sec - t0) / 60.0, float(r[6])))
    return pts


CURVES = None


def s6(t):
    global CURVES
    if CURVES is None:
        CURVES = [(curve("recipe-cake.csv"), WARN), (curve("recipe-noodle.csv"), ACC)]
    im = base()
    bi(im, (W // 2, 100), "煮滾型食譜無法模擬", "Boil-type recipes can't be imitated", 66, FG, ease(seg(t, 0, .5)))
    x0, y0, x1, y1 = 260, 230, 1660, 780
    rrect(im, (x0 - 60, y0 - 40, x1 + 40, y1 + 90), 28, PANEL)
    d = ImageDraw.Draw(im)
    for temp in (40, 60, 80, 100):
        y = y1 - (temp - 20) / 100 * (y1 - y0)
        d.line((x0, y, x1, y), fill=(71, 85, 105, 255), width=2)
        text(im, (x0 - 14, y), f"{temp}°", 30, MUTED, False, anchor="rm")
    prog = seg(t, .6, 5.0)
    for pts, c in CURVES:
        line = [(x0 + m / 16.0 * (x1 - x0), y1 - (v - 20) / 100 * (y1 - y0)) for m, v in pts if m / 16.0 <= prog]
        if len(line) > 1:
            d.line(line, fill=c + (255,), width=7)
    text(im, (x0 + 40, y1 + 45), "minutes 分鐘 →", 32, MUTED, False, anchor="lm")
    text(im, (x1 - 20, y0 + 20), "蛋糕 cake", 36, WARN, anchor="rm")
    text(im, (x1 - 20, y0 + 62), "泡麵 noodles", 36, ACC, anchor="rm")
    bi(im, (W // 2, 930), "全力加熱到約 105°C；開關式控溫做不到", "They heat flat-out to ~105 °C; an on/off thermostat can't do that", 40, MUTED, ease(seg(t, 5.0, 5.8)))
    return im


def s7(t):
    im = base()
    text(im, (W // 2, 380), "開源 · MIT", 110, FG, alpha=ease(seg(t, 0, .6)))
    text(im, (W // 2, 520), "Open source · MIT", 60, ACC, alpha=ease(seg(t, .3, .9)))
    text(im, (W // 2, 700), "github.com/ilshang2/xiaomi-rice-cooker-ha", 58, FG, alpha=ease(seg(t, .8, 1.4)))
    bi(im, (W // 2, 860), "中文／英文說明、安裝步驟、通訊協定筆記", "Bilingual docs, install steps, protocol notes", 40, MUTED, ease(seg(t, 1.2, 1.8)))
    return im


SCENES = [(4.5, s1), (7.0, s2), (8.0, s3), (6.0, s4), (7.0, s5), (7.0, s6), (4.0, s7)]


def main():
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    p = subprocess.Popen([ff, "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                          "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "medium", OUT],
                         stdin=subprocess.PIPE, stderr=subprocess.DEVNULL)
    prev = None
    for dur, fn in SCENES:
        for i in range(int(dur * FPS)):
            fr = fn(i / FPS)
            if i < 6 and prev is not None:       # 0.2 s cross-fade between scenes
                fr = Image.blend(prev.convert("RGBA"), fr.convert("RGBA"), (i + 1) / 7)
            p.stdin.write(fr.convert("RGB").tobytes())
        prev = fn(dur - 1 / FPS)
    p.stdin.close()
    p.wait()
    print("done:", OUT)


if __name__ == "__main__":
    main()
