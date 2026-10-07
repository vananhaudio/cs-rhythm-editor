"""Loại thân nốt giả (tools/measure-analyzer/note_structure.py) — ảnh tổng hợp, KHÔNG bản quyền.
Mỗi ca 'loại' còn chứng minh rằng NẾU tắt bước kiểm này thì nét đó đã được nhận là vạch (test thật sự chạm vào bước kiểm)."""
import os
import sys
import unittest
from unittest import mock

import numpy as np

HERE = os.path.join(os.path.dirname(__file__), "..", "..", "tools", "measure-analyzer")
sys.path.insert(0, HERE)
import measure_analyzer as ma  # noqa: E402
import note_structure as ns  # noqa: E402

H, W = 280, 720


def staff(gap=10, thick=2, y0=110, x0=60, x1=660):
    img = np.zeros((H, W), bool)
    ys = [y0 + k * gap for k in range(5)]
    for y in ys:
        img[y:y + thick, x0:x1] = True
    img[ys[0]:ys[4] + thick, x0:x0 + 2] = True
    return img, {"lines": [(y, y + thick - 1) for y in ys], "gap": float(gap)}, ys


def vline(img, x, ys, dash=None, width=1):
    top, bot = ys[0], ys[4] + 1
    y = top
    while y <= bot:
        on, off = dash if dash else (bot - top + 2, 0)
        img[y:min(y + on, bot + 1), x:x + width] = True
        y += on + off


def ellipse(img, cx, cy, rx, ry):
    yy, xx = np.ogrid[:img.shape[0], :img.shape[1]]
    img[((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1.0] = True


def stem(img, x, ys, head_y, gap=10, beam=False, flag=False):
    """Thân nốt chạy trọn khuông (qua đủ 4 khe → vượt bộ lọc thường), đầu nốt đặc bên phải ở đầu trên."""
    img[ys[0]:ys[4] + 1, x:x + 1] = True
    ellipse(img, x + int(0.6 * gap), head_y, int(0.7 * gap), int(0.5 * gap))     # đầu nốt ≈ 1,4 × 1,0 gap như trên sheet thật
    if beam:
        img[ys[4] - int(0.35 * gap):ys[4] + 1, x:x + 4 * gap] = True
    if flag:
        for k in range(int(1.4 * gap)):
            img[ys[4] - k, x + int(0.45 * k):x + int(0.45 * k) + 2] = True


def bars_of(img, system, check=True):
    """Luật đầu-nốt-kề CŨ (`notehead_beside`) bị vô hiệu ở cả hai chế độ: trên ảnh thật, dòng kẻ dày che đầu nốt khỏi luật cũ (đo: 0,26–0,41 < 0,55) nên thân nốt
    lọt qua; fixture sạch thì luật cũ bắt được nên không chạm vào bước kiểm mới. Vô hiệu nó để mô phỏng đúng tình huống đó."""
    with mock.patch.object(ma, "notehead_beside", return_value=False):
        if check:
            out = ma.find_bars(img, system, ma.DEFAULTS)
        else:
            with mock.patch.object(ma.note_structure, "evaluate", return_value={"reject": False, "score": 0.0, "pairedVertical": False, "reason": "off"}):
                out = ma.find_bars(img, system, ma.DEFAULTS)
    return [round(b["x"]) for b in out["bars"]], out


def score(img, system, x):
    return ns.evaluate(img, system["lines"], system["gap"], x)


class Reject(unittest.TestCase):
    def check_rejected(self, img, system, x):
        on, _ = bars_of(img, system, check=False)
        self.assertIn(x, on, "không có bước kiểm thì nét này đã được nhận là vạch")
        got, out = bars_of(img, system)
        self.assertNotIn(x, got)
        self.assertEqual([r["rejectedAs"] for r in out["rejected"]], ["note_structure_at_end"])
        self.assertGreaterEqual(out["rejected"][0]["asymmetry"], ns.ASYM_REJECT)

    def test_than_not_va_dau_not(self):
        img, sy, ys = staff()
        vline(img, 300, ys); vline(img, 659, ys)
        stem(img, 450, ys, head_y=ys[0] + 2)
        self.check_rejected(img, sy, 450)
        self.assertEqual(bars_of(img, sy)[0], [300, 659])

    def test_than_not_dau_not_va_dam(self):
        img, sy, ys = staff()
        vline(img, 300, ys); vline(img, 659, ys)
        stem(img, 450, ys, head_y=ys[0] + 2, beam=True)
        self.check_rejected(img, sy, 450)

    def test_than_not_va_co(self):
        img, sy, ys = staff()
        vline(img, 300, ys); vline(img, 659, ys)
        stem(img, 450, ys, head_y=ys[0] + 2, flag=True)
        self.check_rejected(img, sy, 450)

    def test_dau_not_nam_dung_tren_dong_ke(self):
        img, sy, ys = staff()
        vline(img, 300, ys); vline(img, 659, ys)
        stem(img, 450, ys, head_y=ys[0])                      # tâm đầu nốt TRÙNG dòng 1
        self.check_rejected(img, sy, 450)

    def _rate(self, thick, drop, seeds=40):
        rejected = clean_rejected = 0
        for seed in range(seeds):
            rng = np.random.default_rng(seed)
            img, sy, ys = staff(thick=thick)
            for y in ys:
                img[y:y + thick, 60:660] &= (rng.random(600) > drop)[None, :]
            vline(img, 300, ys)
            stem(img, 450, ys, head_y=ys[0])
            rejected += bool(score(img, sy, 450)["reject"])
            clean_rejected += bool(score(img, sy, 300)["reject"])
        return rejected / seeds, clean_rejected / seeds

    def test_dong_ke_day_4px_dut_giong_scan_van_nhan_ra_than_not(self):
        # dòng kẻ dày 4 px (gap 10) đứt ~40% như scan thật: thân nốt bị loại (đo 39/40 hạt giống), vạch sạch KHÔNG bao giờ bị loại nhầm
        rate, clean = self._rate(4, 0.4)
        self.assertGreaterEqual(rate, 0.9)
        self.assertEqual(clean, 0.0)

    def test_dong_ke_day_6px_dut_chi_loai_mot_phan_nhung_khong_loai_nham(self):
        # đo: 6 px đứt 40% → loại 24/40 thân nốt (recall một phần, ghi nhận trung thực); QUAN TRỌNG: 0/40 vạch sạch bị loại nhầm
        rate, clean = self._rate(6, 0.4)
        self.assertGreaterEqual(rate, 0.5)
        self.assertEqual(clean, 0.0)

    @unittest.expectedFailure
    def test_GIOI_HAN_dong_ke_day_va_LIEN_nhet_che_dau_not(self):
        # Giới hạn đã biết (đo): dòng kẻ ≥4 px (gap 10) và LIỀN nét cộng mực đều cho hai bên → chênh lệch của đầu nốt chỉ còn ≈0,32 < 0,45.
        # Ảnh thật trong mẫu đo (Tình ca trang 0) có dòng kẻ dày nhưng ĐỨT nên không gặp. Ghi lại để không ai tưởng rule bao phủ ca này.
        img, sy, ys = staff(thick=6)
        vline(img, 300, ys); vline(img, 659, ys)
        stem(img, 450, ys, head_y=ys[0])
        self.assertTrue(score(img, sy, 450)["reject"])


class Keep(unittest.TestCase):
    def test_vach_sach(self):
        img, sy, ys = staff()
        vline(img, 300, ys)
        got, out = bars_of(img, sy)
        self.assertEqual(got, [300])
        self.assertLess(out["bars"][0]["noteAsym"], ns.ASYM_REJECT)
        self.assertEqual(out["rejected"], [])

    def test_vach_ket_sach(self):
        img, sy, ys = staff()
        vline(img, 300, ys); vline(img, 659, ys)
        got, out = bars_of(img, sy)
        self.assertEqual(got, [300, 659])
        self.assertEqual(out["rejected"], [])

    def test_vach_kep_mong(self):
        img, sy, ys = staff()
        vline(img, 300, ys); vline(img, 640, ys); vline(img, 646, ys)      # hai nét mảnh cách 0,6 gap
        got, out = bars_of(img, sy)
        self.assertEqual(out["rejected"], [])
        self.assertEqual(len(got), 2)                                        # 300 và một ranh giới kép (đã gộp)

    def test_vach_ket_day_van_giu_ngay_ca_khong_can_guard(self):
        # thực đo: nét dày/kép đồng hành làm chênh lệch tối đa ≈0,39 (<0,45) vì nét chỉ phủ nửa hộp đo ở hai đầu → giữ nhờ ngưỡng
        img, sy, ys = staff()
        vline(img, 300, ys); vline(img, 630, ys); vline(img, 632, ys, width=6)
        e = score(img, sy, 630)
        self.assertLess(e["score"], ns.ASYM_REJECT)
        self.assertFalse(e["reject"])
        got, out = bars_of(img, sy)
        self.assertEqual(out["rejected"], [])

    def test_double_bar_guard_nhan_net_dong_hanh_that(self):
        # Guard chưa bao giờ cần trên dữ liệu thật; kiểm logic bằng cách hạ ngưỡng TẠM trong test (mock) để điểm lệch vượt ngưỡng.
        img, sy, ys = staff()
        vline(img, 300, ys); vline(img, 630, ys); vline(img, 632, ys, width=6)
        with mock.patch.object(ns, "ASYM_REJECT", 0.3):
            e = score(img, sy, 630)
        self.assertGreaterEqual(e["score"], 0.3)
        self.assertTrue(e["pairedVertical"])
        self.assertFalse(e["reject"])
        self.assertEqual(e["reason"], "double_bar_companion")
        self.assertGreater(e["companion"]["coverage"], 0.8)

    def test_guard_khong_mien_loai_cho_dau_not_hay_nua_net(self):
        with mock.patch.object(ns, "ASYM_REJECT", 0.3):
            img, sy, ys = staff()
            vline(img, 630, ys)
            img[ys[0]:ys[2], 632:638] = True                                 # khối chỉ phủ nửa chiều cao khuông (không phải nét đồng hành)
            half = score(img, sy, 630)
            img2, sy2, ys2 = staff()
            vline(img2, 300, ys2)
            stem(img2, 450, ys2, head_y=ys2[0] + 2)                         # đầu nốt
            head = score(img2, sy2, 450)
        for e in (half, head):
            self.assertFalse(e["pairedVertical"])
            self.assertTrue(e["reject"])

    def test_vach_dut_a3_van_giu(self):
        img, sy, ys = staff()
        vline(img, 300, ys); vline(img, 450, ys, dash=(6, 1)); vline(img, 659, ys)
        got, out = bars_of(img, sy)
        self.assertEqual(got, [300, 450, 659])
        self.assertEqual([b.get("how", "normal") for b in out["bars"]], ["normal", "broken_bar_rescue", "normal"])
        self.assertEqual(out["rejected"], [])

    def test_vach_ket_dut_va_kep_van_giu(self):
        img, sy, ys = staff()
        vline(img, 300, ys)
        vline(img, 651, ys, dash=(7, 1)); vline(img, 657, ys)
        got, out = bars_of(img, sy)
        self.assertEqual(out["rejected"], [])
        self.assertEqual(len(got), 2)

    def test_khuong_do_phan_giai_thap_kieu_chuyen_tau(self):
        img, sy, ys = staff(gap=6, thick=1)
        vline(img, 250, ys); vline(img, 659, ys)
        got, out = bars_of(img, sy)
        self.assertEqual(got, [250, 659])
        self.assertEqual(out["rejected"], [])
        self.assertTrue(all(b["noteAsym"] < ns.ASYM_REJECT for b in out["bars"]))


if __name__ == "__main__":
    unittest.main()
