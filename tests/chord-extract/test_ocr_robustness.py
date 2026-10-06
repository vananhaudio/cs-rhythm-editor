"""OCR không được nuốt lỗi: thiếu thư mục configs/ (như Mac mini), tesseract in rác/mã lỗi, scan không nhận ra chữ nào."""
import os
import shutil
import stat
import tempfile
import unittest

import support
from chord_extract import ExtractConfig, FallbackConfig, ocr
from chord_extract import fallback as fb
from chord_extract.errors import ExtractError
from PIL import Image


class OcrRobustness(unittest.TestCase):
    def test_tsv_works_with_tessdata_dir_that_has_no_configs_folder(self):
        vie = os.path.join(support.TESSDATA, "vie.traineddata")
        if not os.path.exists(vie):
            self.skipTest("thiếu gói vie")
        d = tempfile.mkdtemp()
        try:
            os.symlink(vie, os.path.join(d, "vie.traineddata"))
            self.assertFalse(os.path.exists(os.path.join(d, "configs")))
            img = Image.new("L", (300, 80), 255)
            words = ocr.tess_tsv(img, ExtractConfig(tessdata_dir=d), 7)  # TSV hợp lệ (tesseract có thể 'nhìn' ra rác trên ảnh trắng) — KHÔNG ném lỗi
            self.assertIsInstance(words, list)
            self.assertTrue(all(isinstance(w['conf'], float) and 0 <= w['conf'] <= 1 for w in words))
        finally:
            shutil.rmtree(d, ignore_errors=True)

    def _fake_tesseract(self, body):
        d = tempfile.mkdtemp()
        p = os.path.join(d, "tesseract")
        open(p, "w").write("#!/bin/sh\n" + body)
        os.chmod(p, os.stat(p).st_mode | stat.S_IEXEC)
        return d

    def test_non_tsv_output_or_error_exit_is_a_failure_not_empty_text(self):
        old = os.environ["PATH"]
        try:
            for body in ('echo "plain text, rc 0"', "echo boom >&2; exit 1"):
                d = self._fake_tesseract(body)
                os.environ["PATH"] = d + os.pathsep + old
                with self.assertRaises(ExtractError) as cm:
                    ocr.tess_tsv(Image.new("L", (50, 50), 255), ExtractConfig(), 6)
                self.assertEqual(cm.exception.code, "engine_failed")
                shutil.rmtree(d, ignore_errors=True)
        finally:
            os.environ["PATH"] = old

    def test_scan_with_no_recognised_text_gets_a_fallback_reason(self):
        doc = support.scan_doc([], header=None)
        doc["pages"][0]["regions"] = []
        codes = [r["code"] for r in fb.decide(doc, FallbackConfig())[0]]
        self.assertIn(fb.NO_TEXT_RECOGNIZED, codes)


if __name__ == "__main__":
    unittest.main()
