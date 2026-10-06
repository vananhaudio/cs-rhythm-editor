"""Scan: Tình ca (khó) và Chuyến Tàu Hoàng Hôn — baseline đã đo, cấu trúc, NO_CHORDS_DETECTED, hybrid. Corpus ở NGOÀI repo; thiếu → SKIP có lý do."""
import copy
import unittest
from unittest import mock

import support
from chord_extract import ExtractConfig, extract_document
from chord_extract import evaluation as ev
from chord_extract.contract import validation_errors

_CACHE = {}


def local_doc(name):
    """Chạy engine local MỘT lần cho mỗi file (OCR mất vài giây)."""
    support.ocr_ready()
    if name not in _CACHE:
        _CACHE[name] = extract_document(support.corpus_path(name), ExtractConfig(), provider=None)
    return _CACHE[name]


def flatten(doc):
    return [(p, r, ln) for p in doc["pages"] for r in p["regions"] for ln in r["lines"]]


class TinhCaLocal(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.exp = support.MANIFEST["expect"]["tinh-ca.pdf"]
        cls.doc = local_doc("tinh-ca.pdf")
        cls.gold = support.load_json("gold/tinh-ca.gold.json")

    def test_classification_pages_and_method(self):
        self.assertEqual([p["kind"] for p in self.doc["pages"]], self.exp["pageKinds"])
        self.assertEqual([p["method"] for p in self.doc["pages"]], ["local_ocr", "local_ocr"])
        self.assertEqual([p["index"] for p in self.doc["pages"]], [1, 2])
        self.assertEqual(self.doc["input"]["pageCount"], 2)

    def test_twelve_staff_systems_with_barlines_and_geometry(self):
        per_page = [sum(1 for r in p["regions"] if r["kind"] == "staff_system") for p in self.doc["pages"]]
        self.assertEqual(per_page, self.exp["staffSystemsPerPage"])
        self.assertEqual(sum(per_page), 12)
        for p in self.doc["pages"]:
            ys = []
            for r in p["regions"]:
                if r["kind"] == "staff_system":
                    self.assertEqual(len(r["staff"]["lineY"]), 5)
                    self.assertTrue(r["staff"]["barlineX"], "mỗi khuông có vạch nhịp")
                    ys.append(r["bbox"][1])
            self.assertEqual(ys, sorted(ys), "khuông theo thứ tự từ trên xuống")

    def test_lyric_structure_two_rows_per_system_and_two_verses(self):
        blocks = [r for p in self.doc["pages"] for r in p["regions"] if r["kind"] == "lyric_block"]
        self.assertEqual(len(blocks), 12)
        for b in blocks:
            self.assertEqual(sum(1 for ln in b["lines"] if ln["role"] == "lyric"), self.exp["rowsPerSystem"], f"khuông {b['id']}")
            ys = [ln["bbox"][1] for ln in b["lines"] if ln["role"] == "lyric"]
            self.assertEqual(ys, sorted(ys), "hàng lời theo thứ tự đọc")
        verses = self.doc["interpretation"]["structure"]["verses"]
        self.assertEqual([(v["row"], len(v["lineIds"])) for v in verses], [(1, 12), (2, 12)])
        self.assertEqual(self.doc["pipeline"]["metrics"]["irregularSystems"], 0)

    def test_vietnamese_ocr_meets_baseline(self):
        rows = [r for pg in self.gold["pages"] for s in pg["systems"] for r in s]
        got = ev.compare_to_gold(self.doc, rows, self.gold["GOLD_NEEDS_OWNER_REVIEW"]["equivalents"])
        b = self.exp["baseline"]
        self.assertLessEqual(got["cer"], b["cerMax"], got)
        self.assertLessEqual(got["wer"], b["werMax"], got)
        self.assertGreaterEqual(got["rowsWithin10pct"], b["rowsWithin10pctMin"], got)

    def test_no_chords_and_Em_in_lyrics_is_not_a_chord(self):
        self.assertEqual(self.doc["interpretation"]["chords"], dict(status="NO_CHORDS_DETECTED", count=0))
        self.assertFalse([t for _, _, ln in flatten(self.doc) for t in ln["tokens"] if t["kind"] == "chord"])
        self.assertTrue(any(t["text"] == "Em" and t["kind"] == "word" for _, r, ln in flatten(self.doc) if r["kind"] == "lyric_block" for t in ln["tokens"]),
                        "từ 'Em' trong lời phải còn là chữ")
        self.assertEqual(sum(len(p["links"]) for p in self.doc["pages"]), 0)

    def test_local_metadata_matches_what_local_can_do(self):
        meta = self.doc["interpretation"]["metadata"]
        self.assertEqual(meta["author"]["value"].upper(), "HOÀNG VIỆT")
        self.assertIsNone(meta["timeSignature"], "local không đọc được ký hiệu trên khuông — không được bịa")
        self.assertIsNone(meta["key"])
        codes = [r["code"] for r in self.doc["pipeline"]["fallbackReasons"]]
        self.assertIn("METADATA_MISSING", codes)
        self.assertEqual(self.doc["pipeline"]["vision"]["status"], "skipped_no_provider")

    def test_validates_contract(self):
        self.assertEqual(validation_errors(self.doc), [])


class TinhCaHybrid(unittest.TestCase):
    """Vision GHI SẴN (replay) từ một lần chạy Claude — chứng minh hợp nhất không phụ thuộc nhà cung cấp và không chạm hình học."""

    @classmethod
    def setUpClass(cls):
        support.ocr_ready()
        cls.exp = support.MANIFEST["expect"]["tinh-ca.pdf"]
        support.corpus_path("vision/tinh-ca.vision.json")
        cls.local = local_doc("tinh-ca.pdf")
        cls.provider = support.ReplayProvider(support.vision_result_from_json(f"{support.CORPUS}/vision/tinh-ca.vision.json"))
        cls.doc = extract_document(support.corpus_path("tinh-ca.pdf"), ExtractConfig(), cls.provider)
        cls.gold = support.load_json("gold/tinh-ca.gold.json")

    def test_vision_ran_because_of_explained_reasons(self):
        self.assertEqual(self.provider.calls, 1)
        self.assertEqual(self.provider.last_request.reasons, [r["code"] for r in self.doc["pipeline"]["fallbackReasons"]])
        self.assertTrue(self.provider.last_request.reasons)
        self.assertEqual(self.doc["pipeline"]["vision"]["status"], "ran")
        self.assertEqual(self.doc["pipeline"]["vision"]["pages"], [1, 2])
        self.assertEqual(self.doc["pipeline"]["stages"][-1]["engine"], "replay-test")

    def test_metadata_notation_and_text(self):
        meta = self.doc["interpretation"]["metadata"]
        self.assertEqual(meta["title"]["value"], self.exp["hybrid"]["title"])
        self.assertEqual(meta["timeSignature"]["value"], dict(beats=2, beatType=4))
        self.assertEqual(meta["key"]["value"], dict(fifths=self.exp["hybrid"]["keyFifths"]))
        rows = [r for pg in self.gold["pages"] for s in pg["systems"] for r in s]
        got = ev.compare_to_gold(self.doc, rows, self.gold["GOLD_NEEDS_OWNER_REVIEW"]["equivalents"])
        self.assertLessEqual(got["cer"], self.exp["hybrid"]["cerMax"], got)

    def test_geometry_identical_to_local_and_chords_untouched(self):
        def geo(doc):
            return [(p["index"], p["width"], r["id"], r["kind"], r["bbox"], r.get("staff"), [(ln["id"], ln["bbox"]) for ln in r["lines"]]) for p in doc["pages"] for r in p["regions"]]
        self.assertEqual(geo(self.local), geo(self.doc))
        self.assertEqual(self.doc["interpretation"]["chords"]["status"], "NO_CHORDS_DETECTED")
        self.assertEqual(validation_errors(self.doc), [])


class ChuyenTau(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.exp = support.MANIFEST["expect"]["golden.pdf"]
        cls.doc = local_doc("golden.pdf")
        support.corpus_path("gold/chuyen-tau.canon.txt")
        with open(f"{support.CORPUS}/gold/chuyen-tau.canon.txt", encoding="utf-8") as fh:
            cls.canon = fh.read()

    def test_scan_pages_and_structure_preserved(self):
        self.assertEqual([p["kind"] for p in self.doc["pages"]], self.exp["pageKinds"])
        self.assertEqual([sum(1 for r in p["regions"] if r["kind"] == "staff_system") for p in self.doc["pages"]], self.exp["staffSystemsPerPage"])
        self.assertEqual([p["index"] for p in self.doc["pages"]], [1, 2])
        self.assertTrue(all(p["imageSource"].endswith("+upscale2x") for p in self.doc["pages"]), "ảnh 72 dpi phải được phóng trước khi OCR")

    def test_not_below_baseline(self):
        got = ev.bag_scores(self.doc, self.canon)
        self.assertGreaterEqual(got["recall"], self.exp["baseline"]["recallMin"], got)
        self.assertGreaterEqual(got["precision"], self.exp["baseline"]["precisionMin"], got)

    def test_validates_and_reports_why_vision_would_be_needed(self):
        self.assertEqual(validation_errors(self.doc), [])
        self.assertTrue(self.doc["pipeline"]["fallbackReasons"], "trang scan chất lượng thấp phải có lý do fallback giải thích được")
        self.assertEqual(self.doc["interpretation"]["chords"]["status"], "NO_CHORDS_DETECTED")


if __name__ == "__main__":
    unittest.main()
