"""A3 — phục hồi vạch nhịp bị đứt nét (broken_bar.py + find_bars). Ảnh tổng hợp, KHÔNG bản quyền."""
import os
import sys
import unittest

import numpy as np

HERE = os.path.join(os.path.dirname(__file__), "..", "..", "tools", "measure-analyzer")
sys.path.insert(0, HERE)
import measure_analyzer as ma  # noqa: E402

H, W = 260, 700


def staff(gap=10, thick=2, y0=100, x0=60, x1=640):
    img = np.zeros((H, W), bool)
    ys = [y0 + k * gap for k in range(5)]
    for y in ys:
        img[y:y + thick, x0:x1] = True
    img[ys[0]:ys[4] + thick, x0:x0 + 2] = True            # nét mở đầu khuông
    return img, {"lines": [(y, y + thick - 1) for y in ys], "gap": float(gap)}, ys


def bars_of(img, system):
    out = ma.find_bars(img, system, ma.DEFAULTS)
    return [(round(b["x"]), b.get("how", "normal")) for b in out["bars"]]


def vline(img, x, ys, dash=None, jitter=0, width=1):
    """Vạch dọc từ dòng 1 đến dòng 5. dash=(on, off) hàng: nét đứt. jitter: lệch x luân phiên giữa các đoạn."""
    top, bot = ys[0], ys[4] + 1
    y = top
    seg = 0
    while y <= bot:
        on, off = dash if dash else (bot - top + 2, 0)
        dx = (jitter if seg % 2 else 0)
        img[y:min(y + on, bot + 1), x + dx:x + dx + width] = True
        y += on + off
        seg += 1


class BrokenBar(unittest.TestCase):
    def test_vach_sach_di_duong_thuong(self):
        img, sy, ys = staff()
        vline(img, 300, ys)
        vline(img, 639, ys)
        self.assertEqual(bars_of(img, sy), [(300, "normal"), (639, "normal")])

    def test_vach_dut_qua_nhieu_khe_duoc_cuu(self):
        img, sy, ys = staff()
        vline(img, 300, ys)
        vline(img, 450, ys, dash=(6, 1))                      # đứt 1 hàng sau mỗi 6 hàng
        vline(img, 639, ys)
        got = bars_of(img, sy)
        self.assertIn((450, "broken_bar_rescue"), got)
        self.assertEqual([x for x, _ in got], [300, 450, 639])

    def test_cho_dut_qua_lon_bi_loai(self):
        img, sy, ys = staff()
        vline(img, 300, ys)
        vline(img, 450, ys, dash=(4, 4))                      # đứt 4 hàng (0,4 khe) — quá lớn
        vline(img, 639, ys)
        self.assertEqual([x for x, _ in bars_of(img, sy)], [300, 639])

    def test_cac_doan_lech_x_bi_loai(self):
        img, sy, ys = staff()
        vline(img, 300, ys)
        vline(img, 450, ys, dash=(6, 1), jitter=4)            # các đoạn lệch 4 px — không thẳng hàng
        vline(img, 639, ys)
        self.assertEqual([x for x, _ in bars_of(img, sy)], [300, 639])

    def test_than_not_co_dau_not_va_dam_bi_loai(self):
        img, sy, ys = staff()
        vline(img, 300, ys)
        # thân nốt: từ đầu nốt (elip ở dòng 4) kéo lên TRÊN khuông tới dầm → thò ra ngoài + có đầu nốt
        x = 450
        img[ys[0] - 25:ys[3] + 2, x:x + 1] = True
        img[ys[3] - 4:ys[3] + 5, x - 11:x + 1] = True
        img[ys[0] - 26:ys[0] - 22, x:x + 40] = True
        # thân nốt nằm TRỌN trong khuông, đứt nhẹ, có đầu nốt sát bên (nốt ở giữa khuông)
        x2 = 520
        img[ys[1]:ys[4] + 1, x2:x2 + 1] = True
        img[ys[2] - 4:ys[2] + 5, x2 - 11:x2 + 1] = True
        vline(img, 639, ys)
        self.assertEqual([x for x, _ in bars_of(img, sy)], [300, 639])

    def test_vach_ket_dut_nhe_duoc_cuu(self):
        img, sy, ys = staff()
        vline(img, 300, ys)
        vline(img, 639, ys, dash=(7, 1))                      # vạch cuối khuông đứt nhẹ (phủ khe < 1,0)
        got = bars_of(img, sy)
        self.assertEqual(got[-1], (639, "broken_bar_rescue"))

    def test_nhieu_gan_cuoi_khuong_bi_loai(self):
        img, sy, ys = staff()
        vline(img, 300, ys)
        vline(img, 639, ys)
        img[ys[1]:ys[2], 600:601] = True                      # vệt dọc ngắn (1 khe) gần cuối khuông
        img[ys[2] + 3:ys[3] - 2, 612:613] = True
        self.assertEqual([x for x, _ in bars_of(img, sy)], [300, 639])

    def test_khuong_do_phan_giai_thap_khong_them_vach(self):
        # kiểu Chuyến tàu: gap 6, dòng kẻ 1 px, vạch sạch + nhiều thân nốt (đầu nốt kề) → số vạch không đổi
        img, sy, ys = staff(gap=6, thick=1, y0=100, x1=640)
        vline(img, 250, ys)
        vline(img, 639, ys)
        for x in (320, 380, 440, 500):
            img[ys[0] - 14:ys[3] + 1, x:x + 1] = True
            img[ys[3] - 2:ys[3] + 3, x - 6:x + 1] = True
        self.assertEqual([x for x, _ in bars_of(img, sy)], [250, 639])
        self.assertTrue(all(h == "normal" for _, h in bars_of(img, sy)))


if __name__ == "__main__":
    unittest.main()
