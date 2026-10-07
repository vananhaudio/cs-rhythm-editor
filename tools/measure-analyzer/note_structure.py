"""Loại THÂN NỐT bị nhận nhầm là vạch nhịp (thuần hình học, numpy; không biết lời/anchors).

Tín hiệu đã đo (Chuyến tàu 49 vạch thật, Tình ca 40 vạch thật đã xem bằng mắt, 4 thân nốt giả): thân nốt dính đầu nốt / dầm / cờ ở một đầu
→ mực hai bên nét KHÔNG đối xứng; vạch nhịp thì hai bên giống nhau. Dòng kẻ ngang góp cho cả hai bên như nhau nên triệt tiêu (không cần mặt nạ dòng kẻ,
vốn che mất đầu nốt nằm đúng trên dòng 1 khi dòng kẻ dày).

Đo tại 4 vị trí: đầu trên của thân, đầu dưới của thân, dòng 1, dòng 5. Mỗi vị trí: hộp trái và hộp phải sát nét; asym = |mực trái − mực phải|.
Điểm = max 4 vị trí. Điểm ≥ ASYM_REJECT → loại. Phân tách trong mẫu đo: vạch thật tối đa 0,345; thân giả tối thiểu 0,548.

DOUBLE-BAR GUARD: phần mực lệch một bên có thể là nét thứ hai của vạch kép/vạch dày. Chỉ miễn loại khi có nét dọc ĐỒNG HÀNH thật sự
(gần song song, khoảng cách hợp lý, phủ gần hết chiều cao khuông, lệch x thấp) VÀ khi bỏ cột của nó ra thì điểm bất đối xứng hết (nghĩa là chính nó giải thích phần lệch).
"""
import numpy as np

# ── hằng số có tên (mọi kích thước chuẩn theo gap = khoảng cách dòng kẻ) ──
ASYM_REJECT = 0.45            # loại khi điểm bất đối xứng ≥ mức này (khoảng trống đo được: 0,345 … 0,548)
MIN_STROKE_FILL = 0.4         # mở rộng cột nét: cột liền kề có mật độ ≥ mức này …
STROKE_REL_FILL = 0.75        # … VÀ ≥ tỉ lệ này × mật độ cột tâm (đầu nốt kề thân có mật độ ~0,5, không phải cùng nét)
BOX_WIDTH_GAPS = 0.6          # bề rộng mỗi hộp trái/phải
BOX_HALF_HEIGHT_GAPS = 0.6    # nửa chiều cao hộp quanh vị trí đo
BOX_OFFSET_GAPS = 0.2         # hộp cách mép nét bấy nhiêu gap …
BOX_OFFSET_MIN_PX = 2         # … nhưng tối thiểu 2 px (nét JPEG/scan có quầng 1–2 px; ở ảnh gap≈6 thì 2 px ≈ 0,33 gap, đã đo trên Chuyến tàu)
SHAFT_BRIDGE_ROWS = 2         # thân nét cho phép đứt tối đa 2 hàng khi tìm hai đầu
# double-bar guard
COMPANION_MIN_GAPS = 0.2      # nét đồng hành cách nét chính trong [0,2; 1,6] gap
COMPANION_MAX_GAPS = 1.6
COMPANION_MIN_COVERAGE = 0.8  # phủ ≥ 80% chiều cao khuông (tính theo hàng có mực ở cột của nó)
COMPANION_MAX_JITTER_PX = 1.5
COMPANION_MAX_WIDTH_GAPS = 0.6


def _stroke_columns(dark, y1, y5, x):
    full = dark[y1:y5 + 1].mean(0)
    cx = min(max(int(round(x)), 0), len(full) - 1)
    peak = float(full[max(cx - 1, 0):cx + 2].max())
    thr = max(MIN_STROKE_FILL, STROKE_REL_FILL * peak)
    a = b = cx
    while a > 0 and full[a - 1] >= thr:
        a -= 1
    while b < len(full) - 1 and full[b + 1] >= thr:
        b += 1
    return a, b, full


def _shaft(dark, a, b, y1, y5):
    c0, c1 = max(a - 1, 0), min(b + 1, dark.shape[1] - 1)
    col = dark[:, c0:c1 + 1].any(1)
    mid = (y1 + y5) // 2
    m = None
    for d in range(6):
        for yy in (mid - d, mid + d):
            if 0 <= yy < len(col) and col[yy]:
                m = yy
                break
        if m is not None:
            break
    if m is None:
        return None
    t = m
    while t > 0 and any(col[max(t - k, 0)] for k in range(1, SHAFT_BRIDGE_ROWS + 1)):
        t -= 1
    d = m
    while d < len(col) - 1 and any(col[min(d + k, len(col) - 1)] for k in range(1, SHAFT_BRIDGE_ROWS + 1)):
        d += 1
    return t, d


def _box_ink(dark, r0, r1, c_lo, c_hi, excluded):
    """Tỉ lệ mực trong hộp [r0..r1]×[c_lo..c_hi], bỏ các cột trong `excluded` (tập cột)."""
    if c_hi < c_lo:
        return 0.0
    cols = [c for c in range(max(c_lo, 0), min(c_hi, dark.shape[1] - 1) + 1) if c not in excluded]
    if not cols:
        return 0.0
    return float(dark[r0:r1 + 1][:, cols].mean())


def _asymmetry(dark, a, b, y1, y5, gap, yt, yb, excluded=frozenset()):
    off = max(BOX_OFFSET_MIN_PX, int(round(BOX_OFFSET_GAPS * gap)))
    w = max(2, int(round(BOX_WIDTH_GAPS * gap)))
    half = BOX_HALF_HEIGHT_GAPS * gap
    H = dark.shape[0]
    out = {}
    for name, E in (("shaftTop", yt), ("shaftBottom", yb), ("line1", y1), ("line5", y5)):
        r0, r1 = max(int(E - half), 0), min(int(E + half), H - 1)
        left = _box_ink(dark, r0, r1, a - off - w + 1, a - off, excluded)
        right = _box_ink(dark, r0, r1, b + off, b + off + w - 1, excluded)
        out[name] = {"left": round(left, 3), "right": round(right, 3), "asymmetry": round(abs(left - right), 3)}
    best = max(out, key=lambda k: out[k]["asymmetry"])
    return out, best, out[best]["asymmetry"]


def _companion(dark, a, b, y1, y5, gap, heavy_side, full):
    """Nét dọc đồng hành ở phía nhiều mực: gần song song, phủ gần hết khuông, mảnh/dày vừa phải, lệch x thấp."""
    W = dark.shape[1]
    lo, hi = int(round(COMPANION_MIN_GAPS * gap)), int(round(COMPANION_MAX_GAPS * gap))
    cand_cols = range(b + 1 + max(lo - 1, 0), min(b + hi + 2, W)) if heavy_side == "right" else range(max(a - hi - 1, 0), max(a - lo + 1, 0))
    cols = [c for c in cand_cols if full[c] >= COMPANION_MIN_COVERAGE]
    if not cols:
        return None
    # nhóm cột liền kề thành một nét; lấy nét gần nét chính nhất
    cols = sorted(cols)
    groups, cur = [], [cols[0]]
    for c in cols[1:]:
        if c - cur[-1] <= 1:
            cur.append(c)
        else:
            groups.append(cur)
            cur = [c]
    groups.append(cur)
    groups.sort(key=lambda g: min(abs(g[0] - b), abs(g[-1] - a)))
    g = groups[0]
    width = g[-1] - g[0] + 1
    if width > max(2, COMPANION_MAX_WIDTH_GAPS * gap):
        return None
    rows = np.arange(y1, y5 + 1)
    centers = []
    for y in rows:
        xs = np.where(dark[y, max(g[0] - 2, 0):g[-1] + 3])[0]
        if len(xs) and len(xs) <= width + 3:
            centers.append(xs.mean())
    jitter = float(np.ptp(centers)) if centers else 9.0
    cover = float(dark[y1:y5 + 1][:, g[0]:g[-1] + 1].any(1).mean())
    if cover < COMPANION_MIN_COVERAGE or jitter > COMPANION_MAX_JITTER_PX:
        return None
    dist = (g[0] - b) if heavy_side == "right" else (a - g[-1])
    return {"x0": g[0], "x1": g[-1], "distanceGaps": round(dist / gap, 2), "coverage": round(cover, 2), "jitterPx": round(jitter, 1), "widthPx": width}


def evaluate(dark, L, gap, x):
    """Đánh giá MỘT ứng viên vạch (tâm x). Trả dict chứng cứ: score, atPosition, positions{...}, pairedVertical, companion, reject, reason."""
    y1, y5 = L[0][0], L[4][1]
    a, b, full = _stroke_columns(dark, y1, y5, x)
    sh = _shaft(dark, a, b, y1, y5)
    if sh is None:
        return {"reject": False, "reason": "no_shaft", "score": 0.0, "pairedVertical": False}
    yt, yb = sh
    positions, best, score = _asymmetry(dark, a, b, y1, y5, gap, yt, yb)
    ev = {"score": score, "atPosition": best, "positions": positions, "pairedVertical": False, "reject": False, "reason": "symmetric"}
    if score < ASYM_REJECT:
        return ev
    # double-bar guard: bên nhiều mực hơn tại vị trí tệ nhất có nét dọc đồng hành giải thích được phần lệch không?
    side = "right" if positions[best]["right"] > positions[best]["left"] else "left"
    comp = _companion(dark, a, b, y1, y5, gap, side, full)
    if comp is not None:
        excl = set(range(comp["x0"], comp["x1"] + 1))
        _, _, score2 = _asymmetry(dark, a, b, y1, y5, gap, yt, yb, excl)
        ev["companion"] = comp
        ev["scoreWithoutCompanion"] = score2
        if score2 < ASYM_REJECT:
            ev.update(pairedVertical=True, reason="double_bar_companion")
            return ev
    ev.update(reject=True, reason="note_structure_at_end")
    return ev
