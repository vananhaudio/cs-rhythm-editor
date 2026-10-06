"""PDF có text layer: phân loại text, KHÔNG gọi OCR, KHÔNG gọi Vision, hợp âm + vị trí tương đối, thứ tự trang."""
import unittest
from unittest import mock

import support
from chord_extract import extract_document, ocr
from chord_extract.contract import validation_errors


def run_no_ocr(path, provider=None):
    """Chạy engine với OCR bị khoá: gọi tesseract = test hỏng."""
    boom = mock.Mock(side_effect=AssertionError("OCR không được gọi cho PDF có text layer"))
    with mock.patch.object(ocr, "tess_tsv", boom), mock.patch.object(ocr, "check_ocr", boom):
        return extract_document(path, provider=provider)


class SyntheticTextPdf(unittest.TestCase):
    def build(self):
        p1 = support.lyric_with_chords("Bai Mot", [([(0, "Am"), (2, "Dm")], ["Chieu", "nay", "khong", "co", "em"]), ([(1, "G7")], ["Mua", "roi", "tren", "pho"])])
        p2 = support.lyric_with_chords("Bai Hai", [([(0, "C"), (1, "F")], ["Troi", "xanh", "may", "trang"])])
        return support.write_tmp(support.make_text_pdf([p1, p2]))

    def test_classified_text_without_ocr_or_vision(self):
        spy = support.CountingProvider()
        doc = run_no_ocr(self.build(), provider=spy)
        self.assertEqual([p["kind"] for p in doc["pages"]], ["text", "text"])
        self.assertEqual([p["method"] for p in doc["pages"]], ["text_layer", "text_layer"])
        self.assertEqual(spy.calls, 0)
        self.assertEqual(doc["pipeline"]["vision"]["status"], "not_needed")
        self.assertEqual(doc["pipeline"]["fallbackReasons"], [])
        self.assertFalse([s for s in doc["pipeline"]["stages"] if s["engine"] == "tesseract"])
        self.assertEqual(validation_errors(doc), [])

    def test_page_order_and_chords_linked_with_relative_x(self):
        doc = run_no_ocr(self.build())
        self.assertEqual([p["index"] for p in doc["pages"]], [1, 2])
        self.assertEqual(doc["interpretation"]["metadata"]["title"]["value"], "Bai Mot")
        tokens = {t["id"]: t for p in doc["pages"] for r in p["regions"] for ln in r["lines"] for t in ln["tokens"]}
        links = [(tokens[l["chordTokenId"]]["text"], tokens[l["lyricTokenId"]]["text"], l) for p in doc["pages"] for l in p["links"]]
        # hợp âm đặt cách chữ đầu 4pt → nối với đúng từ nằm ngay dưới; offset nhỏ (gần đầu từ), x của hợp âm nằm TRONG bbox từ
        got = {(c, w) for c, w, _ in links}
        self.assertTrue({("Am", "Chieu"), ("C", "Troi")} <= got, got)
        for c, w, l in links:
            ct, wt = next(t for t in tokens.values() if t["text"] == c), next(t for t in tokens.values() if t["text"] == w)
            cx = ct["bbox"][0] + ct["bbox"][2] / 2
            self.assertLessEqual(wt["bbox"][0] - 0.02, cx)
            self.assertLessEqual(cx, wt["bbox"][0] + wt["bbox"][2] + 0.02)
        self.assertEqual(doc["interpretation"]["chords"]["status"], "DETECTED")
        self.assertIn("[Am] Chieu", doc["interpretation"]["draft"]["text"])

    def test_single_Em_line_is_a_word_not_a_chord_without_page_evidence(self):
        items = [(72, 700, 22, "Tieu de bai hat"), (72, 600, 11, "Em"), (100, 580, 11, "hay"), (160, 580, 11, "nho"), (220, 580, 11, "loi"), (280, 580, 11, "me"), (340, 580, 11, "day")]
        doc = run_no_ocr(support.write_tmp(support.make_text_pdf([items])))
        kinds = {t["text"]: t["kind"] for p in doc["pages"] for r in p["regions"] for ln in r["lines"] for t in ln["tokens"]}
        self.assertNotEqual(kinds["Em"], "chord")
        self.assertEqual(doc["interpretation"]["chords"]["status"], "NO_CHORDS_DETECTED")

    def test_text_pdf_without_chords_is_NO_CHORDS_DETECTED(self):
        items = [(72, 700, 22, "Chi co loi bai hat"), (72, 600, 11, "Dem"), (120, 600, 11, "nay"), (180, 600, 11, "troi"), (240, 600, 11, "mua"), (300, 600, 11, "lon")]
        doc = run_no_ocr(support.write_tmp(support.make_text_pdf([items])))
        self.assertEqual(doc["interpretation"]["chords"], dict(status="NO_CHORDS_DETECTED", count=0))
        self.assertEqual(validation_errors(doc), [])


class CorpusTextPdfs(unittest.TestCase):
    def check(self, name):
        exp = support.MANIFEST["expect"][name]
        spy = support.CountingProvider()
        doc = run_no_ocr(support.corpus_path(name), provider=spy)
        self.assertEqual(validation_errors(doc), [])
        self.assertEqual(len(doc["pages"]), exp["pages"])
        self.assertEqual([p["index"] for p in doc["pages"]], list(range(1, exp["pages"] + 1)))
        self.assertTrue(all(p["kind"] == "text" and p["method"] == "text_layer" for p in doc["pages"]))
        self.assertEqual(spy.calls, 0, "không gọi Vision khi không cần")
        self.assertEqual(doc["pipeline"]["fallbackReasons"], [])
        self.assertGreaterEqual(doc["interpretation"]["chords"]["count"], exp["chordsMin"])
        links = sum(len(p["links"]) for p in doc["pages"])
        self.assertGreaterEqual(links, exp["linksMin"])
        meta = doc["interpretation"]["metadata"]
        self.assertEqual(meta["title"] and meta["title"]["value"], exp["title"])
        if "bpm" in exp:
            self.assertEqual(meta["bpm"]["value"], exp["bpm"])
        return doc

    def test_thu_ha_noi(self): self.check("thu-ha-noi-text.pdf")
    def test_ha_noi_mua_vang_four_pages(self): self.check("ha-noi-mua-vang-text.pdf")
    def test_cho_dong_long_page(self): self.check("cho-dong-text-longpage.pdf")

    def test_bai_nhieu_trang_every_chord_linked_in_page_order(self):
        doc = self.check("bai-nhieu-trang-synthetic.pdf")
        self.assertEqual(sum(len(p["links"]) for p in doc["pages"]), doc["interpretation"]["chords"]["count"])
        self.assertIn("TITLE_NOT_FOUND", [w["code"] for w in doc["interpretation"]["draft"]["warnings"]])


if __name__ == "__main__":
    unittest.main()
