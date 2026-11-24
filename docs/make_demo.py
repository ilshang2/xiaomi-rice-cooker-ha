"""Generate the demo video (about 42 s, 1080p, bilingual captions).
產生示範影片（約 43 秒、1080p、中英雙語字幕）。
Needs / 需要: pip install pillow imageio-ffmpeg ; Windows fonts msjh*.ttc (change BOLD/REG on other OS)
Assets: docs/img/card-*.png (screenshots), data/hold-55c.csv (measured 55 C hold).
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
    phone(im, "card-cook-running.png", 200, 120, 840)
    callouts(im, t, [
        ("6 種原廠模式，按兩下確認", "6 native modes, two-tap confirm", 0.6, ACC),
        ("「自選」顯示 App 裡的食譜名", "Custom slot shows the app's recipe name", 1.6, GOOD),
        ("烹飪中顯示食譜、剩餘時間", "Running recipe and time left", 3.2, WARN),
        ("最近 90 分鐘的溫度走勢", "90-minute temperature trace", 4.4, MUTED)], 44)
    return im


def s3(t):
    im = base()
    phone(im, "card-recipes.png", 200, 150, 800)
    callouts(im, t, [
        ("另外 11 種 App 專屬食譜，含優格", "11 more app-only recipes, incl. yogurt", 0.6, ACC),
        ("可調時間、預約開始、煮好自動保溫", "Adjustable time, scheduled start, auto keep-warm", 1.6, GOOD),
        ("優格發酵溫度 30–50°C 可自訂", "Yogurt fermentation temperature 30–50 °C", 2.8, WARN),
        ("封包在瀏覽器組好，區網直送，不經雲端", "Built in the browser, sent locally, no cloud", 4.0, MUTED)], 40)
    return im


def s4(t):
    im = base()
    phone(im, "card-custom.png", 200, 40, 1000)
    callouts(im, t, [
        ("舒肥分頁：自己設計恆溫食譜", "Sous-vide tab: design your own hold", 0.6, ACC),
        ("30–90°C、最長 24 小時、最多 8 段", "30–90 °C, up to 24 h, up to 8 steps", 1.6, GOOD),
        ("溫泉蛋、雞胸、牛排、鮭魚…一鍵載入", "Presets: egg, chicken, steak, salmon…", 2.8, WARN),
        ("估計水溫、溫度走勢、存成常用 ★", "Water estimate, trace, saved favourites ★", 4.0, MUTED)], 40)
    return im


def hold_curve():
    rows = list(csv.reader(open(DATA("hold-55c.csv"), encoding="utf-8")))[1:]
    return [(int(r[0]) / 60.0, float(r[3]), int(r[2])) for r in rows]


HOLD = None


def s5(t):
    global HOLD
    if HOLD is None:
        HOLD = hold_curve()
    im = base()
    bi(im, (W // 2, 100), "實測：55°C 恆溫 42 分鐘", "Measured: a 55 °C hold for 42 minutes", 66, FG, ease(seg(t, 0, .5)))
    x0, y0, x1, y1 = 260, 230, 1660, 780
    rrect(im, (x0 - 60, y0 - 40, x1 + 40, y1 + 90), 28, PANEL)
    d = ImageDraw.Draw(im)
    Y = lambda v: y1 - (v - 40) / 30.0 * (y1 - y0)
    X = lambda m: x0 + m / 43.0 * (x1 - x0)
    for temp in (40, 50, 60, 70):
        d.line((x0, Y(temp), x1, Y(temp)), fill=(71, 85, 105, 255), width=2)
        text(im, (x0 - 14, Y(temp)), f"{temp}°", 30, MUTED, False, anchor="rm")
    d.line((x0, Y(55), x1, Y(55)), fill=WARN + (255,), width=4)
    text(im, (x1 - 10, Y(55) + 36), "目標 target 55°C", 32, WARN, False, anchor="rm")
    prog = seg(t, .6, 5.6) * 43.0
    line = [(X(m), Y(v)) for m, v, p in HOLD if m <= prog and v >= 40]
    if len(line) > 1:
        d.line(line, fill=ACC + (255,), width=7)
    ks = ease(seg(t, 5.6, 6.2))
    if ks > 0:
        xs = X(30.6)
        d.line((xs, y0, xs, y1), fill=GOOD + (int(255 * ks),), width=3)
        text(im, (xs - 16, y0 + 24), "30 分：階段 1 → 8，溫度不掉　Phase 1 → 8, no drop", 32, GOOD, anchor="rm", alpha=ks)
    text(im, (x0 + 40, y1 + 45), "minutes 分鐘 →", 32, MUTED, False, anchor="lm")
    bi(im, (W // 2, 930), "電鍋自己控溫；時間到停機，感測器比水溫高約 2–4°C", "The cooker thermostats itself and stops at the end (sensor reads 2–4 °C high)", 38, MUTED, ease(seg(t, 6.2, 7.0)))
    return im


def s6(t):
    im = base()
    bi(im, (W // 2, 120), "多段程式：HA 幫你換段", "Multi-step programs: Home Assistant switches the steps", 62, FG, ease(seg(t, 0, .5)))
    boxes = [("① 55°C 吸水 30 分", "Soak at 55 °C, 30 min", "送出封包，電鍋自己控溫", "one packet, the cooker holds it", ACC),
             ("② 85°C 慢燉 30 分", "Simmer at 85 °C, 30 min", "HA 取消、等待機、送下一段", "HA cancels, waits, sends the next", GOOD)]
    for i, (zh, en, a, b, c) in enumerate(boxes):
        k = ease(seg(t, .8 + i * 1.2, 1.5 + i * 1.2))
        x = 230 + i * 760; y = 310; off = (1 - k) * 40
        rrect(im, (x, y + off, x + 680, y + 340 + off), 36, PANEL, c, 6, k)
        bi(im, (x + 340, y + 90 + off), zh, en, 50, FG, k)
        bi(im, (x + 340, y + 245 + off), a, b, 36, c, k)
    ka = ease(seg(t, 1.8, 2.4)); d = ImageDraw.Draw(im)
    d.line((925, 480, 925 + 50 * ka, 480), fill=ACC + (255,), width=10)
    if ka > .9:
        d.polygon([(965, 450), (965, 510), (1000, 480)], fill=ACC + (255,))
    bi(im, (W // 2, 790), "安全：逾時保險（時間到還在煮就自動取消並通知）", "Safety: a watchdog cancels and notifies if it keeps running", 44, WARN, ease(seg(t, 3.2, 3.9)))
    bi(im, (W // 2, 930), "完成、中止都會推播到手機", "Push notification when it finishes or is aborted", 42, MUTED, ease(seg(t, 4.2, 4.9)))
    return im


def s7(t):
    im = base()
    text(im, (W // 2, 330), "開源 · MIT · HACS", 110, FG, alpha=ease(seg(t, 0, .6)))
    text(im, (W // 2, 470), "Open source · MIT · one-click HACS install", 56, ACC, alpha=ease(seg(t, .3, .9)))
    text(im, (W // 2, 660), "github.com/ilshang2/xiaomi-rice-cooker-ha", 58, FG, alpha=ease(seg(t, .8, 1.4)))
    bi(im, (W // 2, 820), "中文／英文說明、安裝步驟、通訊協定筆記", "Bilingual docs, install steps, protocol notes", 40, MUTED, ease(seg(t, 1.2, 1.8)))
    bi(im, (W // 2, 960), "與小米無關．請內鍋放水測試，並留在附近", "Not affiliated with Xiaomi. Test with water and stay nearby", 34, MUTED, ease(seg(t, 1.8, 2.4)))
    return im


SCENES = [(4.5, s1), (6.5, s2), (6.0, s3), (6.5, s4), (8.0, s5), (6.0, s6), (4.0, s7)]


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
