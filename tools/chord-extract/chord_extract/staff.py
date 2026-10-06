"""Hình học khuông nhạc trên ảnh scan (vạch có thể đứt nét): khuông 5 vạch, x vạch nhịp, các dải mực."""
import numpy as np


def find_staves(gray):
    """Chọn các cửa sổ 5 cụm hàng đều nhau nhất, thử nhiều ngưỡng; nền giấy thích ứng (giấy ngả vàng/xám)."""
    g = np.array(gray)
    bg = float(np.percentile(g, 85))
    a = g < max(60.0, min(128.0, bg - 70.0))
    H, W = a.shape
    a[:6] = False
    rows = a.sum(1) / W
    best = {}
    for thr in (0.16, 0.13, 0.10, 0.08):
        cand = np.where(rows > thr)[0]
        if len(cand) < 5:
            continue
        cl, cur = [], [cand[0]]
        for y in cand[1:]:
            if y - cur[-1] <= 2:
                cur.append(y)
            else:
                cl.append(cur); cur = [y]
        cl.append(cur)
        cen = [float(np.mean(c)) for c in cl]
        for i in range(len(cen) - 4):
            d = np.diff(cen[i:i + 5])
            if d.min() >= 5 and d.max() <= 22 and d.max() - d.min() <= 3.5:
                top, bot = cen[i], cen[i + 4]
                key = round((top + bot) / 2 / 12)
                spread = float(d.max() - d.min())
                if key not in best or spread < best[key][2]:
                    best[key] = (top, bot, spread, [round(c, 1) for c in cen[i:i + 5]])
    merged = []
    for s in sorted(best.values()):
        if not merged or s[0] - merged[-1][1] > 20:
            merged.append(s)
    return [dict(top=s[0], bottom=s[1], lines=s[3]) for s in merged]


def staff_x_extent(gray, top, bottom):
    a = np.array(gray)[int(top):int(bottom) + 1] < 128
    cols = np.where(a.sum(0) > 0.5 * a.shape[0] * 0.3)[0]
    return (int(cols.min()), int(cols.max())) if len(cols) else (0, gray.size[0])


def staff_barlines(gray, top, bottom, x0, x1):
    """x của các vạch nhịp: cột có mực liên tục gần hết chiều cao khuông."""
    a = np.array(gray)[int(top) - 2:int(bottom) + 3] < 128
    frac = a.sum(0) / a.shape[0]
    xs, grp = [], []
    for c in np.where(frac > 0.8)[0]:
        if c < x0 - 4 or c > x1 + 4:
            continue
        if grp and c - grp[-1] > 3:
            xs.append(float(np.mean(grp))); grp = []
        grp.append(c)
    if grp:
        xs.append(float(np.mean(grp)))
    return xs


def ink_rows(gray, y0, y1, x0=0, x1=None, min_h=12, gap=5, thr=0.004):
    """Các dải mực nằm ngang (≈ một dòng chữ) trong [y0,y1). Dùng cho vùng đầu trang (khoảng trắng lớn giữa các dòng)."""
    a = np.array(gray)[y0:y1, x0:x1] < 128
    on = (a.sum(1) / a.shape[1]) > thr
    rows, start, last = [], None, None
    for i, v in enumerate(on):
        if v:
            if start is None:
                start = i
            last = i
        elif start is not None and i - last > gap:
            if last - start + 1 >= min_h:
                rows.append((y0 + start, y0 + last + 1))
            start = None
    if start is not None and last - start + 1 >= min_h:
        rows.append((y0 + start, y0 + last + 1))
    return rows
