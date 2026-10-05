#!/usr/bin/env python3
"""Phân tích vạch nhịp từ ảnh/PDF sheet — POC LOCAL (Slice 5B). Chỉ numpy + Pillow; PDF qua `pdftoppm` nếu có.

Vào (stdin, JSON):
  { "sources": [{"path": "...", "mime": "image/png"|"image/jpeg"|"image/webp"|"application/pdf"}],
    "lineTokenCounts": [5, 4, 0, ...],   # số chữ hát mỗi dòng — do TOKENIZER CỦA APP (TS) tính, không tách chữ lại ở đây
    "meter": {"beats": 4, "beatType": 4} | null, "traceId": "..." | null, "options": {...} | null }
Ra (stdout, JSON): MeasureAnalysisResult — xem src/thuvien/measureAnalysis.ts.

Phương pháp (hybrid, không OCR làm nguồn sự thật):
  1. xám → ngưỡng; hàng gần như kín mực = dòng kẻ; gom 5 dòng cách đều = một khuông (system)
  2. cột kín mực suốt từ dòng 1 tới dòng 5 VÀ lấp đầy cả 4 khe = vạch nhịp (đuôi nốt không lấp đủ 4 khe / quá dày)
  3. băng lời = dải hàng nhiều mực nhất ngay dưới khuông
  4. chữ = cụm mực tách bằng khoảng trắng (ngưỡng tự tính theo phân bố khoảng trắng — Otsu trên log khoảng cách)
  5. ghép THỨ TỰ chữ trên sheet ↔ thứ tự token chuẩn; vạch = số chữ đứng trước nó
Không chắc thì hạ độ tin cậy + ghi lý do — không im lặng ép cho khớp.
"""
import itertools
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageFilter

DEFAULTS = {
    "darkThreshold": 185,      # điểm ảnh tối hơn mức này = mực (dòng kẻ, vạch)
    "inkThreshold": 150,       # mực chữ (chặt hơn để bỏ hình mờ/watermark)
    "staffRowFill": 0.22,      # hàng có ≥ tỉ lệ này mực theo chiều ngang = ứng viên dòng kẻ
    "barColumnFill": 0.72,     # cột phủ ≥ tỉ lệ này chiều cao khuông = ứng viên vạch
    "noteheadFill": 0.55,      # mực sát bên nét dọc > mức này = đầu nốt → nét là đuôi nốt, không phải vạch
    "barSpaceFill": 1.0,       # ứng viên phải lấp kín cả 4 khe (1.0 = kín hoàn toàn ở ít nhất một cột)
    "pdfDpi": 150,
    "pdfStaffGap": 10.0,       # PDF vector: render lại ở DPI cho khoảng cách dòng kẻ ≈ giá trị này
    "pickupRatio": 0.75,
    "letterGapRatio": 0.3,
    "gapCost": 1.0,            # căn chỉnh: giá bỏ qua một cụm chữ / một token
    "maxMatchCost": 2.0,       # căn chỉnh: trần chi phí khớp một cặp
    "maxSkewDegrees": 2.0,     # xoay thẳng ảnh nghiêng tối đa ± độ (0 = tắt)
    "normalize": "off",        # "off" = phân tích ở cỡ gốc (ngưỡng đã tỉ lệ theo khoảng cách dòng kẻ); "on" = đổi cỡ về targetStaffGap
    "targetStaffGap": 6.0,     # chuẩn hoá: khoảng cách dòng kẻ sau khi đổi cỡ (px)     # khe ≤ tỉ lệ này × chiều cao dải chữ = cùng một từ       # ô đầu ngắn hơn tỉ lệ này × độ rộng ô trung vị → nhịp lấy đà
}


def load_pages(sources, work, opts):
    pages, warnings = [], []
    for si, src in enumerate(sources):
        path, mime = src["path"], src.get("mime", "")
        if mime == "application/pdf" or path.lower().endswith(".pdf"):
            exe = shutil.which("pdftoppm")
            if not exe:
                warnings.append({"code": "pdf_renderer_missing", "source": si, "message": "Chưa có pdftoppm — bỏ qua PDF, dùng ảnh."})
                continue
            scanned = extract_scanned(path, work, si)
            if scanned:
                pages.extend((si, page) for page in scanned)
                continue
            # lượt 1: render thấp để đo khoảng cách dòng kẻ; lượt 2: render ĐÚNG DPI cho cỡ chuẩn — không phải đổi cỡ ảnh
            def render(dpi, tag):
                prefix = os.path.join(work, f"src{si}{tag}")
                subprocess.run([exe, "-r", str(dpi), "-gray", "-png", path, prefix], check=True, capture_output=True)
                return [np.asarray(Image.open(os.path.join(work, n)).convert("L")).astype(np.int16)
                        for n in sorted(f for f in os.listdir(work) if f.startswith(f"src{si}{tag}-") and f.endswith(".png"))]
            first = render(opts["pdfDpi"], "a")
            for page_index, page in enumerate(first):
                found = find_systems(page, opts)[1]
                if found:
                    gap = float(np.median([x["gap"] for x in found]))
                    dpi = max(36, int(round(opts["pdfDpi"] * opts["pdfStaffGap"] / gap)))
                    again = render(dpi, f"b{page_index}_") if abs(dpi - opts["pdfDpi"]) > 3 else [page]
                    pages.append((si, again[page_index] if len(again) > page_index else page))
                else:
                    pages.append((si, page))
        else:
            pages.append((si, np.asarray(Image.open(path).convert("L")).astype(np.int16)))
    return pages, warnings


def runs(mask):
    """[(start, end)] các đoạn True liên tiếp (end gồm)."""
    out, start = [], None
    for i, v in enumerate(mask):
        if v and start is None:
            start = i
        elif not v and start is not None:
            out.append((start, i - 1)); start = None
    if start is not None:
        out.append((start, len(mask) - 1))
    return out


def extract_scanned(path, work, si):
    """PDF scan (mỗi trang đúng MỘT ảnh): lấy nguyên ảnh nhúng — render lại sẽ nội suy làm nhoè vạch mảnh."""
    exe = shutil.which("pdfimages")
    if not exe:
        return None
    listing = subprocess.run([exe, "-list", path], capture_output=True, text=True)
    if listing.returncode != 0:
        return None
    rows = [line.split() for line in listing.stdout.splitlines()[2:] if line.strip()]
    per_page = {}
    for row in rows:
        if len(row) > 2 and row[2] == "image":
            per_page[row[0]] = per_page.get(row[0], 0) + 1
    if not per_page or any(n != 1 for n in per_page.values()):
        return None
    prefix = os.path.join(work, f"scan{si}")
    subprocess.run([exe, "-all", path, prefix], check=True, capture_output=True)
    names = sorted(f for f in os.listdir(work) if f.startswith(f"scan{si}-"))
    return [np.asarray(Image.open(os.path.join(work, n)).convert("L")).astype(np.int16) for n in names]


def find_systems(gray, opts):
    dark = gray < opts["darkThreshold"]
    H, W = dark.shape
    rows = runs(dark.sum(1) > W * opts["staffRowFill"])
    mids = [(a + b) / 2 for a, b in rows]
    systems, tabs, i = [], [], 0
    while i + 4 < len(rows):
        d = np.diff(mids[i:i + 5])
        gap = float(np.median(d))
        if gap >= 3 and d.max() - d.min() <= max(2.0, 0.25 * gap):
            # dòng thứ 6 cách đều → khuông TAB guitar (6 dây): không phải khuông nhạc, bỏ qua cả 6 dòng
            if i + 5 < len(rows) and abs((mids[i + 5] - mids[i + 4]) - gap) <= max(2.0, 0.25 * gap):
                tabs.append(rows[i:i + 6]); i += 6; continue
            systems.append({"lines": rows[i:i + 5], "gap": gap}); i += 5
        else:
            i += 1
    return dark, systems


def deskew(gray, opts):
    """Ảnh chụp/scan hơi nghiêng làm dòng kẻ trải qua nhiều hàng → không đủ đậm để nhận. Tìm góc làm chiếu ngang
    "nhọn" nhất (phương sai lớn nhất) trong ±maxSkew độ, xoay ảnh về thẳng."""
    limit = opts["maxSkewDegrees"]
    if limit <= 0:
        return gray, 0.0
    small = Image.fromarray(gray.clip(0, 255).astype(np.uint8))
    factor = min(1.0, 800 / max(small.size))
    small = small.resize((max(1, int(small.width * factor)), max(1, int(small.height * factor))))

    def sharpness(angle):
        rotated = np.asarray(small.rotate(angle, resample=Image.BILINEAR, fillcolor=255)).astype(np.int16)
        return float(np.var((rotated < opts["darkThreshold"]).sum(1)))

    best = max((sharpness(a / 10), a / 10) for a in range(int(-limit * 10), int(limit * 10) + 1, 2))[1]
    best = max((sharpness(best + d / 100), best + d / 100) for d in range(-10, 11, 2))[1]
    if abs(best) < 0.05:
        return gray, 0.0
    img = Image.fromarray(gray.clip(0, 255).astype(np.uint8)).rotate(best, resample=Image.BICUBIC, fillcolor=255)
    return np.asarray(img).astype(np.int16), round(best, 2)


def normalize_scale(gray, opts):
    """Đưa trang về cỡ chuẩn (khoảng cách dòng kẻ ≈ targetStaffGap px) để mọi ngưỡng pixel dùng chung cho ảnh chụp,
    scan và PDF render ở độ phân giải bất kỳ. Thử cả bản thu nhỏ khi ở cỡ gốc không thấy khuông."""
    found = find_systems(gray, opts)[1]
    if not found:
        small = resize(gray, 0.5)
        found = find_systems(small, opts)[1]
        if not found:
            return gray, None, 1.0
        gap, base = float(np.median([s["gap"] for s in found])) * 2, gray
    else:
        gap, base = float(np.median([s["gap"] for s in found])), gray
    scale = opts["targetStaffGap"] / gap
    if opts["normalize"] == "off" or 0.85 <= scale <= 1.15:
        return base, None, 1.0
    return resize(base, scale, keep_strokes=False), (resize(base, scale, keep_strokes=True) if scale < 1 else None), scale


def resize(gray, scale, keep_strokes=False):
    h, w = gray.shape
    img = Image.fromarray(gray.clip(0, 255).astype(np.uint8))
    if scale < 1 and keep_strokes:
        # bản riêng để dò VẠCH: giữ nét mảnh (vạch nhịp 1 px) — lọc min (mực lan) rồi lấy trung bình ô, không để nét nhạt đi
        k = max(1, int(round(1 / scale)))
        if k > 1:
            img = img.filter(ImageFilter.MinFilter(k if k % 2 else k + 1))
        return np.asarray(img.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.BOX)).astype(np.int16)
    return np.asarray(img.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.LANCZOS)).astype(np.int16)


def find_bars(dark, system, opts):
    L, gap = system["lines"], system["gap"]
    y1, y5 = L[0][0], L[4][1]
    # mép khuông = đoạn mực LIỀN dài nhất của các dòng kẻ (cho phép đứt ≤ 3 khe — JPEG làm dòng kẻ lấm tấm) — không lấy mực bất kỳ (mép giấy scan tối)
    # cột thuộc khuông khi có mực ở ≥ 3/5 dòng kẻ (một dòng có thể nhạt từng đoạn; mép giấy chỉ tối rời rạc)
    band = sum(dark[l0 - 1:l1 + 2].any(0).astype(int) for l0, l1 in L) >= 3
    segs = []
    for a, b in runs(band):
        if segs and a - segs[-1][1] <= 3 * gap:
            segs[-1][1] = b
        else:
            segs.append([a, b])
    x0, x1 = (int(v) for v in max(segs, key=lambda seg: seg[1] - seg[0]))
    full = dark[y1:y5 + 1].mean(0)
    spaces = [(L[k][1] + 1, L[k + 1][0]) for k in range(4)]
    cands = []
    for a, b in runs(full >= opts["barColumnFill"]):
        # vạch kết có thể nằm hơi quá đoạn dòng kẻ dò được (dòng kẻ nhạt ở ô cuối) — nhận thêm trong 6 khe
        if a < x0 or b > x1 + 6 * gap:
            continue
        width = b - a + 1
        cov = [max(dark[s0:s1, c].mean() for c in range(max(a - 1, 0), min(b + 2, dark.shape[1]))) if s1 > s0 else 1.0 for s0, s1 in spaces]
        if min(cov) < opts["barSpaceFill"] or width > max(4, 0.6 * gap):
            continue
        # đuôi nốt / gạch nối thò ra ngoài khuông; vạch nhịp dừng đúng ở dòng 1 và dòng 5
        cols = slice(max(a - 1, 0), b + 2)
        above = dark[max(int(y1 - 1.5 * gap), 0):int(y1 - 0.4 * gap), cols].mean(0).max() if y1 - 0.4 * gap > 0 else 0
        below = dark[int(y5 + 0.4 * gap):int(y5 + 1.5 * gap), cols].mean(0).max()
        # …trừ khi nét chạy LIỀN rất dài (> 4 khe) ra ngoài: đó là vạch nối hệ khuông (vd. xuống khuông tab), đuôi nốt không dài thế
        if (above > 0.6 and reach(dark, cols, y1, -1) < 4 * gap) or (below > 0.6 and reach(dark, cols, y5, 1) < 4 * gap):
            continue
        # vạch ở đúng mép phải khuông: bên phải là lề giấy (scan ố có thể tối) — không xét đầu nốt
        if b < x1 - gap and notehead_beside(dark, L, gap, a, b, opts):
            continue
        cands.append({"x": (a + b) / 2, "width": width, "fill": float(full[a:b + 1].max())})
    # gộp vạch kép / vạch + dấu nhắc lại thành một ranh giới
    merged = []
    for c in cands:
        if merged and c["x"] - merged[-1]["xs"][-1] <= 1.6 * gap:
            merged[-1]["xs"].append(c["x"]); merged[-1]["fill"] = min(merged[-1]["fill"], c["fill"])
        else:
            merged.append({"xs": [c["x"]], "fill": c["fill"]})
    bars = []
    for m in merged:
        x = m["xs"][-1] if len(m["xs"]) > 1 else m["xs"][0]
        if x - x0 <= 1.5 * gap:      # nét mở đầu khuông (không phải vạch nhịp)
            continue
        bars.append({"x": float(x), "double": len(m["xs"]) > 1, "fill": m["fill"],
                     "repeatDots": has_repeat_dots(dark, L, gap, m["xs"])})
    if bars:
        x1 = max(x1, int(bars[-1]["x"]) + 1)
    return {"y1": int(y1), "y5": int(y5), "x0": x0, "x1": x1, "bars": bars}


def reach(dark, cols, y, step):
    """Số hàng mực liền mạch từ y đi lên (step=-1) / xuống (step=1) trong các cột của nét."""
    n, yy = 0, y + step
    while 0 <= yy < dark.shape[0] and dark[yy, cols].any():
        n += 1; yy += step
    return n


def notehead_beside(dark, L, gap, a, b, opts):
    """Đuôi nốt luôn dính một ĐẦU NỐT đặc ngay sát bên (trái hoặc phải); vạch nhịp thì không. Đo mực trong ô vuông
    cỡ một khe sát hai bên nét, bỏ các hàng dòng kẻ."""
    y1, y5 = L[0][0], L[4][1]
    staff_rows = np.zeros(dark.shape[0], bool)
    for l0, l1 in L:
        staff_rows[l0:l1 + 1] = True
    w = max(2, int(round(1.1 * gap)))
    top, bottom = max(int(y1 - 1.2 * gap), 0), min(int(y5 + 1.2 * gap), dark.shape[0] - 1)
    for c0, c1 in ((max(a - w - 1, 0), a - 1), (b + 2, min(b + w + 2, dark.shape[1]))):
        if c1 <= c0:
            continue
        rows = [y for y in range(top, bottom + 1) if not staff_rows[y]]
        win = max(2, int(round(0.8 * gap)))
        for i in range(0, max(1, len(rows) - win + 1)):
            block = dark[rows[i:i + win], c0:c1]
            if block.size and block.mean() > opts["noteheadFill"]:
                return True
    return False


def has_repeat_dots(dark, L, gap, xs):
    """Chấm nhắc lại: mực nhỏ ở khe 2 và khe 3, sát vạch."""
    hits = 0
    for k in (1, 2):
        s0, s1 = L[k][1] + 1, L[k + 1][0]
        for x in xs:
            for side in (-1, 1):
                c0 = int(x + side * 0.6 * gap); c1 = int(x + side * 1.4 * gap)
                lo, hi = sorted((c0, c1))
                if hi > lo and dark[s0:s1, max(lo, 0):hi].mean() > 0.35:
                    hits += 1
    return hits >= 2


def find_words(gray, system, next_top, opts):
    ink = gray < opts["inkThreshold"]
    gap = system["gap"]
    y5, x0, x1 = system["y5"], system["x0"], system["x1"]
    top = int(y5 + 2 * gap)
    bottom = int(min(next_top - gap, y5 + 12 * gap)) if next_top else int(y5 + 12 * gap)
    bottom = min(bottom, gray.shape[0])
    if bottom - top < 4:
        return None
    prof = ink[top:bottom, x0:x1 + 1].sum(1)
    rr = runs(prof > max(3, 0.01 * (x1 - x0)))
    if not rr:
        return None
    # dải chữ = cụm hàng (gộp khe nhỏ cỡ dấu thanh) có nhiều mực nhất
    groups = []
    for a, b in rr:
        if groups and a - groups[-1][1] <= max(2, 0.6 * gap):
            groups[-1][1] = b
        else:
            groups.append([a, b])
    # dải lời = dải GẦN khuông nhất mà đủ đậm (≥ 35% dải đậm nhất) — không lấy dải đậm nhất, vì chữ chân trang/tiêu đề
    # dưới khuông cuối có thể đậm hơn lời
    masses = [prof[g[0]:g[1] + 1].sum() for g in groups]
    a, b = next(g for g, m in zip(groups, masses) if m >= 0.35 * max(masses))
    b0, b1 = top + a - 1, top + b + 2
    col = ink[b0:b1, x0:x1 + 1].sum(0) > 0
    pieces = [(x0 + s, x0 + e) for s, e in runs(col)]
    if not pieces:
        return {"band": [int(b0), int(b1)], "words": [], "joinGap": None}
    # Khe giữa chữ cái trong một từ nhỏ hơn hẳn khe giữa hai từ; ngưỡng tỉ lệ theo chiều cao dải chữ (độc lập độ phân giải).
    height = b1 - b0
    join = max(2.0, math.floor(opts["letterGapRatio"] * height))
    words = []
    for p in pieces:
        if words and p[0] - words[-1][1] - 1 <= join:
            words[-1][1] = p[1]
        else:
            words.append([p[0], p[1]])
    # bỏ dấu chấm/phẩy đứng riêng (rất hẹp + ít mực)
    widths = [w[1] - w[0] + 1 for w in words]
    med = float(np.median(widths)) if widths else 0
    kept = []
    for w in words:
        mass = int(ink[b0:b1, w[0]:w[1] + 1].sum())
        if (w[1] - w[0] + 1) < 0.25 * med and mass < 0.15 * med * height:
            continue
        kept.append(w)
    return {"band": [int(b0), int(b1)], "words": kept, "joinGap": round(join, 2)}


def analyze(payload):
    opts = {**DEFAULTS, **(payload.get("options") or {})}
    counts = [int(c) for c in payload["lineTokenCounts"]]
    total = sum(counts)
    with tempfile.TemporaryDirectory() as work:
        pages, warnings = load_pages(payload["sources"], work, opts)
    if not pages:
        return fail("no_pages", "Không có trang ảnh nào để phân tích.", warnings)
    if total == 0:
        return fail("no_lyrics", "Lời chuẩn không có chữ hát nào.", warnings)

    lengths = payload.get("lineTokenLengths")
    flat_len = [max(1, int(n)) for row in lengths for n in row] if lengths and [len(r) for r in lengths] == counts else [1] * total

    page_geos, scales, angles = [], [], []
    for pi, (src, gray) in enumerate(pages):
        gray, angle = deskew(gray, opts)
        angles.append(angle)
        gray, bar_gray, scale = normalize_scale(gray, opts)
        scales.append(round(scale, 3))
        dark, found = find_systems(gray, opts)
        if bar_gray is not None:
            dark = bar_gray < opts["darkThreshold"]
        geos_p = []
        for si, s in enumerate(found):
            geo = find_bars(dark, s, opts)
            geo.update({"page": pi, "source": src, "index": si, "gap": s["gap"]})
            geos_p.append(geo)
        for i, geo in enumerate(geos_p):
            nxt = geos_p[i + 1] if i + 1 < len(geos_p) else None
            geo["lyrics"] = find_words(gray, geo, nxt["y1"] if nxt else None, opts)
        page_geos.append(geos_p)
    if not any(page_geos):
        return fail("no_staff", "Không tìm thấy khuông nhạc nào.", warnings)

    # ── Ghép HÌNH HỌC: mỗi cụm chữ trên sheet ↔ một token chuẩn, bằng căn chỉnh chuỗi (Needleman–Wunsch) theo
    # độ rộng mực ↔ độ dài chữ. Cho phép chữ thừa trên sheet / token không thấy trên sheet ở ĐÚNG chỗ của nó, thay vì
    # đếm dồn (một chữ lệch là cả bài lệch). Thứ tự trang = thứ tự cho chi phí căn chỉnh thấp nhất (tên file có thể
    # xếp sai: "...-1.jpg" đứng trước "....jpg").
    def flatten(order):
        geos_o = [g for pi in order for g in page_geos[pi]]
        blobs = [(gi, wi, w[1] - w[0] + 1) for gi, g in enumerate(geos_o) if g["lyrics"] for wi, w in enumerate(g["lyrics"]["words"])]
        return geos_o, blobs

    order0 = list(range(len(page_geos)))
    candidates = list(itertools.permutations(order0)) if 1 < len(page_geos) <= 4 else [tuple(order0)]
    best = None
    for order in candidates:
        geos_o, blobs = flatten(order)
        match, cost = align_widths([b[2] for b in blobs], flat_len, opts)
        if best is None or cost < best[0] - 1e-9:
            best = (cost, order, geos_o, blobs, match)
    cost, order, geos, blobs, match = best
    reordered = list(order) != order0
    if not geos:
        return fail("no_staff", "Không tìm thấy khuông nhạc nào.", warnings)
    token_of = {}                                   # (system, word) → token chuẩn
    for bi, ti in enumerate(match):
        if ti is not None:
            token_of[(blobs[bi][0], blobs[bi][1])] = ti
    sheet_total = len(blobs)
    unmatched_sheet = sum(1 for t in match if t is None)
    unmatched_canon = total - len(token_of)
    count_match = unmatched_sheet == 0 and unmatched_canon == 0

    def token_after(gi, x):
        """Token chuẩn của cụm chữ ĐẦU TIÊN nằm sau vạch (cùng khuông, rồi sang khuông sau nếu hết khuông)."""
        for gj in range(gi, len(geos)):
            words = geos[gj]["lyrics"]["words"] if geos[gj]["lyrics"] else []
            for wi, w in enumerate(words):
                if gj == gi and (w[0] + w[1]) / 2 < x:
                    continue
                if (gj, wi) in token_of:
                    return token_of[(gj, wi)], gj, wi
        return total, gi, None

    boundaries = []
    for gi, g in enumerate(geos):
        words = g["lyrics"]["words"] if g["lyrics"] else []
        for bar in g["bars"]:
            token, gj, wi = token_after(gi, bar["x"])
            crossed = gj != gi
            left = min([bar["x"] - w[1] for w in words if (w[0] + w[1]) / 2 < bar["x"]] or [99 * g["gap"]])
            right = min([w[0] - bar["x"] for w in words if (w[0] + w[1]) / 2 >= bar["x"]] or [99 * g["gap"]])
            margin = min(left, right) / g["gap"]
            reasons, score = [], 1.0
            if bar["fill"] < 0.85:
                reasons.append("vạch mờ"); score -= 0.25
            if margin < 0.2:
                reasons.append("vạch sát chữ"); score -= 0.5
            elif margin < 1.0:
                reasons.append("vạch khá gần chữ"); score -= 0.2
            # chữ ngay sau vạch phải là chữ GHÉP ĐƯỢC; nếu chữ sát sau vạch là chữ thừa/không khớp → không chắc
            nearest = next((k for k, w in enumerate(words) if (w[0] + w[1]) / 2 >= bar["x"]), None)
            if nearest is not None and (gi, nearest) not in token_of:
                reasons.append("chữ ngay sau vạch không khớp lời chuẩn"); score -= 0.5
            if bar["repeatDots"]:
                reasons.append("dấu nhắc lại — dòng thời gian cần thầy dựng")
            boundaries.append({"index": len(boundaries), "page": g["page"], "system": gi, "x": round(bar["x"], 1),
                               "token": token, "crossesSystem": crossed,
                               "nextWord": (geos[gj]["lyrics"]["words"][wi] if wi is not None else None),
                               "marginGaps": round(margin, 2), "double": bar["double"], "repeat": bar["repeatDots"],
                               "score": round(max(0.0, score), 2), "confidence": level(score), "reasons": reasons or ["vạch rõ, chữ sau vạch khớp lời"]})

    # ── Dựng anchors theo đúng contract 5A ──
    def at(g):
        if g >= total:
            last = max(i for i, c in enumerate(counts) if c > 0)
            return {"line": last, "token": counts[last]}
        run = 0
        for li, c in enumerate(counts):
            if g < run + c:
                return {"line": li, "token": g - run}
            run += c
    diagnostics_warn = list(warnings)
    if boundaries:
        final = boundaries[-1]
        final["reasons"].append("vạch kết bài — không mở ô mới")
    starts = boundaries[:-1] if len(boundaries) > 1 else boundaries
    pickup = None
    measure_bounds = list(starts)
    first = starts[0] if starts else None
    implicit_first = False
    if first and first["token"] > 0:
        g0 = geos[first["system"]]
        widths = []
        for g in geos:
            xs = [g["x0"]] + [b["x"] for b in g["bars"]]
            widths += list(np.diff(xs))
        med = float(np.median(widths[1:] if len(widths) > 1 else widths)) if widths else 0
        content_start = g0["lyrics"]["words"][0][0] if g0["lyrics"] and g0["lyrics"]["words"] else g0["x0"]
        lead = first["x"] - content_start
        if first["system"] == 0 and med and lead < opts["pickupRatio"] * med:
            pickup = at(0)
        else:
            implicit_first = True
    measures = ([{"line": at(0)["line"], "token": 0}] if implicit_first else []) + [at(b["token"]) for b in measure_bounds]
    measure_conf = ([{"measure": 1, "confidence": "MEDIUM", "score": 0.6, "reasons": ["ô 1 mở đầu bài (không có vạch) — suy ra"]}] if implicit_first else [])
    for b in measure_bounds:
        measure_conf.append({"measure": len(measure_conf) + 1, "confidence": b["confidence"], "score": b["score"], "reasons": list(b["reasons"]), "boundary": b["index"]})
    for i in range(1, len(measures)):
        if measures[i] == measures[i - 1]:
            mc = measure_conf[i]
            mc["reasons"].append("ô không có chữ mới — ô ngân hay ô không lời? cần thầy chọn")
            mc["confidence"], mc["score"] = "LOW", min(mc["score"], 0.3)
    review = [m["measure"] for m in measure_conf if m["confidence"] == "LOW"]
    notes = []
    if unmatched_sheet:
        notes.append(f"Sheet có {unmatched_sheet} cụm chữ không khớp lời chuẩn (chữ thừa / nhắc lại) — đã bỏ qua đúng chỗ.")
    if unmatched_canon:
        notes.append(f"{unmatched_canon} token lời chuẩn không thấy trên sheet.")
    if reordered:
        notes.append(f"Đã xếp lại thứ tự trang theo nội dung: {', '.join(str(i + 1) for i in order)} — cần kiểm.")
    if any(b["repeat"] for b in boundaries):
        notes.append("Có dấu nhắc lại — máy chưa dựng đoạn hát lại; dòng thời gian cần thầy kiểm.")
    result = {
        "ok": True,
        "anchors": {**({"pickup": pickup} if pickup else {}), "measures": measures},
        "confidence": {"overall": level(min([m["score"] for m in measure_conf] or [0]) if not review else 0.3),
                       "measures": measure_conf},
        "review": {"needsReview": bool(review) or not count_match or reordered or any(b["repeat"] for b in boundaries),
                   "measures": review, "notes": notes},
        "diagnostics": {
            "engine": "numpy-pillow-v2-align",
            "pages": len(pages), "scales": scales, "deskewDegrees": angles,
            "systems": [{"page": g["page"], "index": g["index"], "staffGap": round(g["gap"], 2), "y": [g["y1"], g["y5"]], "lyricBand": g["lyrics"]["band"] if g["lyrics"] else None,
                         "bars": [round(b["x"], 1) for b in g["bars"]],
                         "words": len(g["lyrics"]["words"]) if g["lyrics"] else 0,
                         "splitWords": 0} for g in geos],
            "pageOrder": list(order), "alignmentCost": round(cost, 3),
            "boundaries": boundaries,
            "sheetTokens": sheet_total, "canonicalTokens": total,
            "pickupDetected": pickup is not None, "implicitFirstMeasure": implicit_first,
            "warnings": diagnostics_warn,
            "traceId": payload.get("traceId"),
        },
    }
    return result


def align_widths(widths, lengths, opts):
    """Căn chỉnh chuỗi độ rộng cụm mực (px) với chuỗi độ dài token (số chữ cái). Trả về (match, cost):
    match[i] = chỉ số token của cụm i, hoặc None (cụm thừa). Chi phí khớp = |ln(rộng / (tỉ lệ × độ dài))|,
    bỏ một cụm hay một token = gapCost. Tỉ lệ px/chữ cái ước lượng rồi tinh chỉnh một lần."""
    n, m = len(widths), len(lengths)
    if not n or not m:
        return [None] * n, float(n + m) * opts["gapCost"]
    scale = float(np.median(widths)) / max(1.0, float(np.median(lengths)))
    match = None
    for _ in range(2):
        g = opts["gapCost"]
        D = np.zeros((n + 1, m + 1)); P = np.zeros((n + 1, m + 1), dtype=np.int8)
        D[1:, 0] = np.arange(1, n + 1) * g; P[1:, 0] = 1
        D[0, 1:] = np.arange(1, m + 1) * g; P[0, 1:] = 2
        lw = np.log(np.maximum(widths, 1)); ll = np.log(np.maximum(lengths, 1) * scale)
        for i in range(1, n + 1):
            c = np.minimum(np.abs(lw[i - 1] - ll), opts["maxMatchCost"])
            for j in range(1, m + 1):
                d, u, l = D[i - 1, j - 1] + c[j - 1], D[i - 1, j] + g, D[i, j - 1] + g
                if d <= u and d <= l:
                    D[i, j], P[i, j] = d, 0
                elif u <= l:
                    D[i, j], P[i, j] = u, 1
                else:
                    D[i, j], P[i, j] = l, 2
        match, i, j = [None] * n, n, m
        while i > 0 or j > 0:
            step = P[i, j]
            if i > 0 and j > 0 and step == 0:
                match[i - 1] = j - 1; i -= 1; j -= 1
            elif i > 0 and (j == 0 or step == 1):
                i -= 1
            else:
                j -= 1
        ratios = [widths[i] / lengths[t] for i, t in enumerate(match) if t is not None]
        if ratios:
            scale = float(np.median(ratios))
    return match, float(D[n, m]) / max(n, m)


def level(score):
    return "HIGH" if score >= 0.8 else "MEDIUM" if score >= 0.5 else "LOW"


def fail(code, message, warnings):
    return {"ok": False, "error": {"code": code, "message": message}, "diagnostics": {"warnings": warnings}}


if __name__ == "__main__":
    try:
        print(json.dumps(analyze(json.load(sys.stdin)), ensure_ascii=False))
    except Exception as error:  # noqa: BLE001 — trả lỗi có cấu trúc, không làm sập cầu
        print(json.dumps(fail("analyzer_crash", f"{type(error).__name__}: {error}", []), ensure_ascii=False))
