"""Phục hồi vạch nhịp BỊ ĐỨT NÉT (đường phụ — chỉ chạy khi ứng viên rớt bộ lọc thường vì mật độ/độ phủ khe).

Đo trên Chuyến tàu (49 vạch đã duyệt) + Tình ca: vạch thật bị đứt là nét dọc THẲNG HÀNG, gần như liền (chỗ đứt ≤ ~1 hàng), phủ ≥ 3/4
khe, mảnh, không thò ra ngoài khuông. Thân nốt/nhiễu thì lệch x theo hàng (đầu nốt, dầm, cờ) hoặc thò ra ngoài, hoặc đứt dài.
Phân tách trong mẫu đo: vạch đứt thật có độ lệch x ≤ 1,5 px; ứng viên giả gần nhất ≥ 3,0 px.

KHÔNG dùng "gần cuối khuông" làm chứng cứ. KHÔNG hạ ngưỡng đường thường. Thuần numpy, test riêng.
"""
import numpy as np

TOL = 1                 # px: nét đứt có thể lệch ±TOL khi dò từng hàng
MAX_MISS = 0.12         # chỗ đứt liền nhau lớn nhất TRONG khe, tính theo gap
MAX_JITTER = 1.5        # px: độ lệch x của tâm nét giữa các hàng
MIN_MEAN_COV = 0.8      # trung bình tỉ lệ phủ 4 khe
MIN_SPACES = 3          # số khe có ≥ 50% hàng có mực
MAX_OUT = 0.2           # gap: được thò ra ngoài khuông tối đa
MAX_WIDTH = 2           # px
MIN_COLUMN_FILL = 0.4   # chỉ xét cột có mật độ ≥ mức này (ứng viên yếu hơn đường thường)


def evidence(dark, L, gap, a, b):
    """Đo cấu trúc dọc của ứng viên (cột a..b). Trả dict chứng cứ (luôn có), kèm 'ok'."""
    y1, y5 = L[0][0], L[4][1]
    H, W = dark.shape
    spaces = [(L[k][1] + 1, L[k + 1][0]) for k in range(4)]
    c0, c1 = max(a - TOL, 0), min(b + TOL, W - 1)
    col = dark[:, c0:c1 + 1].any(1)
    cov, miss = [], []
    for s0, s1 in spaces:
        seg = col[s0:s1]
        cov.append(float(seg.mean()) if len(seg) else 1.0)
        run = worst = 0
        for v in seg:
            run = 0 if v else run + 1
            worst = max(worst, run)
        miss.append(worst)
    cx = int(round((a + b) / 2))
    centers = []
    for y in range(y1, y5 + 1):
        xs = np.where(dark[y, max(cx - 3, 0):cx + 4])[0]
        if len(xs) and len(xs) <= 5:
            centers.append(xs.mean() - min(cx, 3))
    jitter = float(np.ptp(centers)) if centers else 9.0

    def reach(y0, step):
        n, y, lim = 0, y0, int(4 * gap)
        while 0 <= y < H and n < lim and dark[y, c0:c1 + 1].any():
            n += 1
            y += step
        return n / gap
    up, dn = reach(y1 - 1, -1), reach(y5 + 1, 1)
    ev = {"cov": [round(c, 2) for c in cov], "meanCov": round(sum(cov) / 4, 2), "spacesGe50": sum(c >= 0.5 for c in cov),
          "maxMissGaps": round(max(miss) / gap, 2), "jitterPx": round(jitter, 1), "upGaps": round(up, 2), "downGaps": round(dn, 2), "widthPx": b - a + 1}
    ev["ok"] = bool(ev["maxMissGaps"] <= MAX_MISS and ev["jitterPx"] <= MAX_JITTER and ev["meanCov"] >= MIN_MEAN_COV
                    and ev["spacesGe50"] >= MIN_SPACES and ev["upGaps"] <= MAX_OUT and ev["downGaps"] <= MAX_OUT and ev["widthPx"] <= MAX_WIDTH)
    return ev
