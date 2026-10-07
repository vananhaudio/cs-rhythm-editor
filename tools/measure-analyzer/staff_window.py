"""Kiểm chứng cửa sổ 5 dòng kẻ của một khuông TRƯỚC khi đo vạch nhịp (thuần numpy, test riêng).

Lỗi đã đo: khi dòng kẻ bị đứt/dày (scan mờ), bộ tìm khuông có thể chọn cửa sổ LỆCH MỘT DÒNG — dòng "trên cùng" thực ra là vệt mực
ngoài khuông (dầm/chữ/hoa văn) còn dòng kẻ thật dưới cùng bị bỏ sót → mọi vạch thật đo sai (mật độ tụt dưới ngưỡng).

Chứng cứ "dòng kẻ": mật độ mực của HÀNG đó trên suốt chiều ngang khuông (dòng kẻ dài, nên mật độ cao; vệt/chữ thì ngắn).
Điểm của một cửa sổ = chứng cứ của dòng YẾU NHẤT trong 5 dòng (mắt xích yếu nhất — một vệt mực không thể đóng vai dòng kẻ).
Thử dịch ±1 khe; CHỈ dịch khi cửa sổ mới hơn hẳn (biên + khoảng cách đều) — không thì giữ nguyên hình học cũ.
"""
import numpy as np

SHIFT_MARGIN = 1.5      # điểm cửa sổ mới phải ≥ biên × điểm cũ …
SHIFT_MIN_GAIN = 0.05   # … và hơn ít nhất ngần này (tuyệt đối)
SPACING_TOL = 0.3       # 5 dòng của cửa sổ mới cách đều: chênh lệch khoảng cách ≤ 2 × tỉ lệ này × gap


def _runs(mask):
    out, start = [], None
    for i, v in enumerate(mask):
        if v and start is None:
            start = i
        elif not v and start is not None:
            out.append((start, i - 1)); start = None
    if start is not None:
        out.append((start, len(mask) - 1))
    return out


def _x_range(dark, lines, gap):
    """Phạm vi ngang của khuông: đoạn liền dài nhất mà ≥ 3/5 dòng có mực (như find_bars)."""
    band = sum(dark[max(a - 1, 0):b + 2].any(0).astype(int) for a, b in lines) >= 3
    segs = []
    for a, b in _runs(band):
        if segs and a - segs[-1][1] <= 3 * gap:
            segs[-1][1] = b
        else:
            segs.append([a, b])
    if not segs:
        return 0, dark.shape[1] - 1
    x0, x1 = max(segs, key=lambda s: s[1] - s[0])
    return int(x0), int(x1)


def _extent(row, center):
    c = int(round(center))
    peak = row[c]
    a = b = c
    while a > 0 and row[a - 1] >= 0.5 * peak:
        a -= 1
    while b < len(row) - 1 and row[b + 1] >= 0.5 * peak:
        b += 1
    return (a, b)


def _window(row, centers, gap):
    """Chụm mỗi tâm dự kiến về đỉnh mật độ gần nhất (±0,3 khe). Trả (tâm đã chụm, điểm = chứng cứ dòng yếu nhất) hoặc None nếu không đều."""
    reach = max(2, int(round(0.3 * gap)))
    snapped = []
    for c in centers:
        lo, hi = max(int(round(c)) - reach, 0), min(int(round(c)) + reach, len(row) - 1)
        if hi < lo:
            return None
        snapped.append(lo + int(np.argmax(row[lo:hi + 1])))
    diffs = np.diff(snapped)
    if len(diffs) and (diffs.min() < 0.5 * gap or diffs.max() - diffs.min() > SPACING_TOL * gap * 2):
        return None
    return snapped, float(min(row[max(c - 1, 0):c + 2].max() for c in snapped))


def validate_window(dark, system):
    """system = {"lines": 5×(hàng đầu, hàng cuối), "gap"}. Trả system (có thể đã dịch ±1 khe) + "windowShift": -1|0|+1."""
    lines, gap = system["lines"], system["gap"]
    x0, x1 = _x_range(dark, lines, gap)
    row = dark[:, x0:x1 + 1].mean(1)
    cur_centers = [(a + b) / 2 for a, b in lines]
    cur = _window(row, cur_centers, gap)
    cur_score = cur[1] if cur else 0.0
    best = None
    for shift in (-1, 1):
        cand = _window(row, [c + shift * gap for c in cur_centers], gap)
        if cand and (best is None or cand[1] > best[1][1]):
            best = (shift, cand)
    if best is not None and best[1][1] >= SHIFT_MARGIN * cur_score and best[1][1] - cur_score >= SHIFT_MIN_GAIN:
        shift, (centers, _) = best
        out = dict(system)
        out["lines"] = [_extent(row, c) for c in centers]
        out["gap"] = float(np.median(np.diff(centers)))
        out["windowShift"] = shift
        return out
    return {**system, "windowShift": 0}
