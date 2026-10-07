"""A1 — kiểm chứng cửa sổ 5 dòng kẻ (tools/measure-analyzer/staff_window.py). Ảnh tổng hợp, KHÔNG bản quyền."""
import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "tools", "measure-analyzer"))
import staff_window as sw  # noqa: E402

GAP = 10
W, H = 520, 260


def staff_image(line_ys, x0=50, x1=470, thick=2, broken=0.0, extra=None):
    img = np.zeros((H, W), bool)
    rng = np.random.default_rng(1)
    for y in line_ys:
        row = np.ones(x1 - x0, bool)
        if broken:
            row &= rng.random(x1 - x0) > broken
        img[y:y + thick, x0:x1] = row
    for (y0, y1, xa, xb) in (extra or []):
        img[y0:y1, xa:xb] = True
    return img


def system(line_ys, thick=2):
    return {"lines": [(y, y + thick - 1) for y in line_ys], "gap": float(GAP)}


TRUE = [100, 110, 120, 130, 140]


class Window(unittest.TestCase):
    def test_cua_so_dung_khong_dich(self):
        out = sw.validate_window(staff_image(TRUE), system(TRUE))
        self.assertEqual(out["windowShift"], 0)
        self.assertEqual(out["lines"], system(TRUE)["lines"])

    def test_cua_so_lech_mot_gap_len_tren_thi_sua(self):
        # cửa sổ [90 (không có dòng kẻ), 100, 110, 120, 130] — thiếu dòng thật dưới cùng (140)
        wrong = [90] + TRUE[:4]
        img = staff_image(TRUE, extra=[(88, 92, 200, 260)])      # vệt mực ngắn ngoài khuông ở y≈90
        out = sw.validate_window(img, system(wrong))
        self.assertEqual(out["windowShift"], 1)
        self.assertEqual([a for a, _ in out["lines"]], TRUE)

    def test_cua_so_lech_mot_gap_xuong_duoi_thi_sua(self):
        wrong = TRUE[1:] + [150]
        out = sw.validate_window(staff_image(TRUE), system(wrong))
        self.assertEqual(out["windowShift"], -1)
        self.assertEqual([a for a, _ in out["lines"]], TRUE)

    def test_vet_muc_phia_tren_khong_duoc_nhan_lam_dong_ke(self):
        # cửa sổ đúng, nhưng có vệt dầm dày ngay trên khuông (ngắn) — KHÔNG được dịch lên để ôm vệt đó
        img = staff_image(TRUE, extra=[(88, 94, 150, 230)])
        out = sw.validate_window(img, system(TRUE))
        self.assertEqual(out["windowShift"], 0)
        self.assertEqual([a for a, _ in out["lines"]], TRUE)

    def test_chung_cu_gan_bang_nhau_giu_cua_so_cu(self):
        # 6 dòng đều nhau (như khuông tab): cửa sổ trên 5 dòng đầu và dưới 5 dòng sau có chứng cứ NGANG nhau → không dịch (hysteresis)
        six = [100, 110, 120, 130, 140, 150]
        out = sw.validate_window(staff_image(six), system(six[:5]))
        self.assertEqual(out["windowShift"], 0)

    def test_dong_ke_dut_nhung_van_giu_dung(self):
        img = staff_image(TRUE, broken=0.45)
        out = sw.validate_window(img, system(TRUE))
        self.assertEqual(out["windowShift"], 0)

    def test_dong_ke_day_va_dut_lech_mot_gap_van_sua(self):
        wrong = [90] + TRUE[:4]
        img = staff_image(TRUE, thick=5, broken=0.4, extra=[(88, 92, 200, 260)])
        out = sw.validate_window(img, system(wrong, thick=5), )
        self.assertEqual(out["windowShift"], 1)


if __name__ == "__main__":
    unittest.main()
