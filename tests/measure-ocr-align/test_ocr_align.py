"""Ghép OCR lời gần đúng ↔ lời chuẩn (tools/measure-analyzer/ocr_align.py). Lời tự soạn, KHÔNG bản quyền."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "tools", "measure-analyzer"))
import ocr_align as oa  # noqa: E402

LINES = [
    ["Sáng", "nay", "mình", "cùng", "đi", "qua", "bao", "con", "phố"],
    ["Nắng", "vàng", "rơi", "trên", "vai", "người", "ở", "lại"],
    ["Gửi", "về", "người", "yêu", "quê", "xa", "xôi", "lắm"],
    ["1:", "Hát", "lên", "tiếng", "ca", "của", "lòng", "mình"],
    ["Em", "ơi", "em", "ơi", "hãy", "về", "đây"],      # lặp "em ơi"
]
CANON = oa.Canon(LINES)


def row(words, x0=100, step=40):
    return [(w, x0 + i * step) for i, w in enumerate(words)]


class Normalize(unittest.TestCase):
    def test_bo_dau_hoa_thuong_dau_cau(self):
        self.assertEqual(oa.norm("Chiều,"), "chieu")
        self.assertEqual(oa.norm("ĐÊM."), "dem")
        self.assertEqual(oa.norm("Gởi!"), "goi")

    def test_chu_ngan_phai_trung_hệt(self):
        self.assertEqual(oa.similarity("em", "om"), 0.0)
        self.assertEqual(oa.similarity("em", "em"), 1.0)

    def test_gui_goi_edit_distance(self):
        self.assertGreaterEqual(oa.similarity(oa.norm("gửi"), oa.norm("gởi")), oa.MATCH_MIN)


class AlignRow(unittest.TestCase):
    def test_ocr_typo(self):
        r = oa.align_row(row(["Sáng", "nai", "mình", "cùng", "dị", "qua", "bao", "con", "phố"]), CANON)
        self.assertEqual(r["status"], "MATCH")
        self.assertEqual(CANON.at(r["span"][0]), {"line": 0, "token": 0})

    def test_bo_dau_hoan_toan(self):
        r = oa.align_row(row("Nang vang roi tren vai nguoi o lai".split()), CANON)
        self.assertEqual(r["status"], "MATCH")
        self.assertEqual(CANON.at(r["span"][0]), {"line": 1, "token": 0})

    def test_gui_goi_khop_chu_chuan_khong_sua_loi(self):
        r = oa.align_row(row(["Gởi", "về", "người", "yêu", "quê", "xa"]), CANON)
        self.assertEqual(r["status"], "MATCH")
        # đầu ra là chỉ số vào lời CHUẨN ("Gửi"), không phải chữ OCR
        self.assertEqual(CANON.flat[r["span"][0]][2], "Gửi")

    def test_hang_keo_qua_hai_dong_chuan(self):
        r = oa.align_row(row(["người", "ở", "lại", "Gửi", "về", "người", "yêu"]), CANON)
        self.assertEqual(r["status"], "MATCH")
        self.assertEqual((CANON.at(r["span"][0])["line"], CANON.at(r["span"][1])["line"]), (1, 2))

    def test_cau_lap_lai_la_ambiguous_khong_doan(self):
        canon = oa.Canon([["la", "lay", "mua", "rơi", "nhẹ", "nhàng"], ["đi", "đâu", "về", "đâu"], ["la", "lay", "mua", "rơi", "nhẹ", "nhàng"]])
        r = oa.align_row(row(["la", "lay", "mua", "rơi", "nhẹ", "nhàng"]), canon)
        self.assertEqual(r["status"], "AMBIGUOUS")
        self.assertAlmostEqual(r["best"], r["second"], places=1)

    def test_nhieu_la_unmatched(self):
        r = oa.align_row(row(["xz", "qqq", "rftt", "pwk"]), CANON)
        self.assertEqual(r["status"], "UNMATCHED")


class Labels(unittest.TestCase):
    def test_nhan_khoi_day_ghep_nhung_giu_chi_so(self):
        self.assertTrue(CANON.label[CANON.line_start[3]])            # "1:" là nhãn khổ
        self.assertNotIn(CANON.line_start[3], CANON.stream)
        self.assertEqual(CANON.flat[CANON.line_start[3] + 1][:2], (3, 1))   # "Hát" vẫn là token 1 theo tokenizer của app
        r = oa.align_row(row(["Hát", "lên", "tiếng", "ca", "của", "lòng", "mình"]), CANON)
        self.assertEqual(r["status"], "MATCH")
        self.assertEqual(CANON.at(r["span"][0]), {"line": 3, "token": 1})

    def test_snap_ve_dau_dong_khi_chi_co_nhan_dung_truoc(self):
        self.assertEqual(CANON.snap(CANON.line_start[3] + 1), CANON.line_start[3])
        self.assertEqual(CANON.snap(CANON.line_start[3] + 2), CANON.line_start[3] + 2)   # giữa dòng: không đổi

    def test_so_trong_cau_khong_phai_nhan(self):
        canon = oa.Canon([["Anh", "1:", "2"]])
        self.assertFalse(any(canon.label))


class BarToToken(unittest.TestCase):
    def setUp(self):
        self.r = oa.align_row(row(["Sáng", "nay", "mình", "cùng", "đi", "qua", "bao", "con", "phố"], 100, 40), CANON)
        self.r["resolved"] = oa.resolve_tokens(self.r, CANON)
        self.r["xs"] = [x for _, x in row(["a"] * 9, 100, 40)]

    def test_vach_giua_hai_chu(self):
        idx, how = oa.bar_token(self.r["resolved"], self.r["xs"], 215)      # giữa token 2 (x=180) và 3 (x=220)
        self.assertEqual((CANON.at(idx), how), ({"line": 0, "token": 3}, "direct"))

    def test_vach_cuoi_hang_la_row_end(self):
        self.assertEqual(oa.bar_token(self.r["resolved"], self.r["xs"], 9999), (None, "row_end"))

    def test_chu_ocr_hong_duoc_noi_suy_hai_phia(self):
        toks = row(["Sáng", "nay", "xxxx", "cùng", "đi", "qua", "bao", "con", "phố"])      # "mình" bị đọc hỏng hẳn
        r = oa.align_row(toks, CANON)
        self.assertEqual(r["status"], "MATCH")
        res = oa.resolve_tokens(r, CANON)
        self.assertEqual(res[2], (2, "interpolated"))                     # token chuẩn 2 = "mình"
        idx, how = oa.bar_token(res, [x for _, x in toks], 175)              # vạch ngay trước chữ hỏng
        self.assertEqual((CANON.at(idx), how), ({"line": 0, "token": 2}, "interpolated"))

    def test_khong_du_chac_thi_unresolved_khong_doan(self):
        # OCR thiếu chữ: "xxxx" nằm giữa hai neo nhưng lời chuẩn còn NHIỀU token hơn số chữ OCR giữa hai neo → không biết là chữ nào
        toks = row(["Sáng", "nay", "xxxx", "qua", "bao", "con", "phố"])
        r = oa.align_row(toks, CANON)
        res = oa.resolve_tokens(r, CANON)
        self.assertEqual(res[2], (None, None))
        self.assertEqual(oa.bar_token(res, [x for _, x in toks], 175), (None, "unresolved"))


class NoiseRule(unittest.TestCase):
    """Chữ OCR thừa chỉ bị bỏ khi lời chuẩn KHÔNG còn chỗ nào để nó là lời thật (ngoài biên bài, hoặc giữa hai neo liền nhau)."""

    def setUp(self):
        self.end = oa.Canon([["a1", "bbbb", "cccc"], ["dddd", "eeee", "ffff", "gggg"]])    # dòng cuối là hết bài
        self.tail_ids = {"dddd": 3, "eeee": 4, "ffff": 5, "gggg": 6}

    def resolve(self, canon, words):
        toks = row(words)
        r = oa.align_row(toks, canon)
        return r, oa.resolve_tokens(r, canon), [x for _, x in toks]

    def test_noise_sau_chu_cuoi_cua_bai(self):
        r, res, xs = self.resolve(self.end, ["dddd", "eeee", "ffff", "gggg", "zq"])
        self.assertEqual(r["status"], "MATCH")
        self.assertEqual(res[4], (None, "noise"))
        # vạch đứng ngay trước chữ thừa: không còn chữ hát nào → hết hàng (không "unresolved")
        self.assertEqual(oa.bar_token(res, xs, xs[4] - 1), (None, "row_end"))

    def test_noise_truoc_chu_dau_cua_bai(self):
        r, res, _ = self.resolve(self.end, ["zq", "a1", "bbbb", "cccc", "dddd"])
        self.assertEqual(r["pairs"][1], 0)                                    # "a1" = token chuẩn đầu tiên của cả bài
        self.assertEqual(res[0], (None, "noise"))

    def test_noise_giua_hai_neo_chac_chan_va_lien_nhau(self):
        canon = oa.Canon([["alpha", "bravo", "charlie", "delta", "echo"]])
        r, res, xs = self.resolve(canon, ["alpha", "bravo", "zzq", "charlie", "delta", "echo"])
        self.assertEqual(res[2], (None, "noise"))                             # bravo(1) và charlie(2) liền nhau → chữ giữa là thừa
        self.assertEqual(oa.bar_token(res, xs, xs[2] - 1), (2, "direct"))      # vạch trước chữ thừa → chữ hát thật kế tiếp = "charlie"

    def test_chu_hong_nhung_co_the_la_loi_that_KHONG_bi_bo(self):
        # cuối một dòng chuẩn mà còn dòng sau: "zzzz" có thể là chữ đầu dòng sau bị OCR hỏng → không được coi là nhiễu
        canon = oa.Canon([["alpha", "bravo", "charlie"], ["delta", "echo", "foxtrot"]])
        r, res, xs = self.resolve(canon, ["alpha", "bravo", "charlie", "zzzz"])
        self.assertEqual(res[3], (None, None))
        self.assertEqual(oa.bar_token(res, xs, xs[3] - 1), (None, "unresolved"))
        # giữa hai neo mà lời chuẩn còn NHIỀU token hơn số chữ OCR ở giữa (OCR rớt chữ): không biết "zzzz" là chữ nào → không bỏ, không đoán
        canon2 = oa.Canon([["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golfball"]])
        r2, res2, _ = self.resolve(canon2, ["alpha", "bravo", "zzzz", "echo", "foxtrot", "golfball"])
        self.assertEqual(r2["pairs"][3], 4)                                   # "echo" ghép đúng token 4: giữa hai neo có 2 token chuẩn (charlie, delta)
        self.assertEqual(res2[2], (None, None))

    def test_nhieu_noise_lien_tiep_o_bien(self):
        _, res, xs = self.resolve(self.end, ["dddd", "eeee", "ffff", "gggg", "zq", "xw", "vv"])
        self.assertEqual([h for _, h in res[4:]], ["noise", "noise", "noise"])
        self.assertEqual(oa.bar_token(res, xs, xs[4] - 1), (None, "row_end"))
        _, res_l, _ = self.resolve(self.end, ["zq", "xw", "a1", "bbbb", "cccc", "dddd"])
        self.assertEqual([h for _, h in res_l[:2]], ["noise", "noise"])

    def test_noise_khong_doi_chi_so_chuan(self):
        canon = oa.Canon([["alpha", "bravo", "charlie", "delta", "echo"]])
        clean_toks = row(["alpha", "bravo", "charlie", "delta", "echo"])
        noisy_toks = row(["alpha", "bravo", "zzq", "charlie", "delta", "echo"])
        rc, rn = oa.align_row(clean_toks, canon), oa.align_row(noisy_toks, canon)
        resc, resn = oa.resolve_tokens(rc, canon), oa.resolve_tokens(rn, canon)
        real = [idx for idx, h in resn if h != "noise"]
        self.assertEqual(real, [idx for idx, _ in resc])                       # chỉ số chuẩn của chữ thật y hệt khi có/không có nhiễu
        self.assertEqual(rn["span"], rc["span"])                               # nhiễu không làm đổi span


class PlanMultiRow(unittest.TestCase):
    def test_hai_hang_duoi_mot_khuong_ra_hai_span_khac_nhau(self):
        rows_by_page = [[
            {"y": 210, "tokens": row("Sáng nay mình cùng đi qua bao con phố".split())},
            {"y": 235, "tokens": row("Hát lên tiếng ca của lòng mình".split())},
        ]]
        geos = [[{"y1": 100, "y5": 180, "gap": 10, "bars": [220, 400]}]]
        plan = oa.plan_alignment(CANON, rows_by_page, geos)
        sy = plan[(0, 0)]
        self.assertEqual([r["status"] for r in sy["rows"]], ["MATCH", "MATCH"])
        self.assertEqual(sy["primary"], 0)                                   # hàng TRÊN CÙNG là hàng chính
        spans = [(CANON.at(r["span"][0])["line"], CANON.at(r["span"][1])["line"]) for r in sy["rows"]]
        self.assertEqual(spans, [(0, 0), (3, 3)])
        cands = [oa.row_bar_candidates(CANON, r, [220, 400]) for r in sy["rows"]]
        self.assertEqual(cands[0][0]["anchor"], {"line": 0, "token": 3})
        self.assertEqual(cands[1][0]["anchor"]["line"], 3)

    def test_page_order_theo_noi_dung(self):
        r_early = {"y": 210, "tokens": row("Sáng nay mình cùng đi qua bao con phố".split())}
        r_late = {"y": 210, "tokens": row("Em ơi em ơi hãy về đây".split())}
        geos = [[{"y1": 100, "y5": 180, "gap": 10, "bars": []}], [{"y1": 100, "y5": 180, "gap": 10, "bars": []}]]
        plan = oa.plan_alignment(CANON, [[r_late], [r_early]], geos)
        self.assertEqual(oa.page_order(plan, 2), [1, 0])


if __name__ == "__main__":
    unittest.main()
