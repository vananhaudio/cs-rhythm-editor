"""Vision provider-agnostic, quy tắc hợp nhất, quy tắc fallback (có lý do, ngưỡng là cấu hình), adapter API (không lộ khoá)."""
import json
import unittest
from unittest import mock

import support
from chord_extract import ExtractConfig, FallbackConfig, extract_document
from chord_extract import fallback as fb
from chord_extract.contract import validation_errors
from chord_extract.vision import (VisionError, VisionExtractionProvider, VisionPageResult, VisionResult, parse_vision_json)
from chord_extract.vision.anthropic_api import AnthropicApiProvider
from chord_extract.vision.merge import merge_vision


def vr(**kw):
    base = dict(title="Tinh ca", author="Hoang Viet", time_signature=(2, 4), key_fifths=-2, chord_status="NO_CHORDS_DETECTED",
                pages=[VisionPageResult(index=1, printed_page_number="6", systems=[["xin chao cac ban", "hai hang"]])])
    base.update(kw)
    return VisionResult(**base)


class ParseTests(unittest.TestCase):
    GOOD = {"title": "A", "author": None, "timeSignature": {"beats": 2, "beatType": 4}, "key": {"fifths": -2}, "directions": ["x"],
            "chords": "NO_CHORDS_DETECTED", "chordSymbols": [], "pages": [{"printedPageNumber": 6, "systems": [["a", "b"]]}], "extra": "bỏ qua"}

    def test_good_and_fenced_json(self):
        r = parse_vision_json(self.GOOD)
        self.assertEqual((r.time_signature, r.key_fifths, r.pages[0].printed_page_number), ((2, 4), -2, "6"))
        self.assertEqual(parse_vision_json("```json\n" + json.dumps(self.GOOD) + "\n```").title, "A")

    def test_strict_rejections(self):
        for bad in ({**self.GOOD, "key": {"fifths": 9}}, {**self.GOOD, "timeSignature": {"beats": 2, "beatType": 5}},
                    {**self.GOOD, "chords": "MAYBE"}, {**self.GOOD, "pages": [{"systems": "x"}]}, {**self.GOOD, "chordSymbols": [1]}, "không phải json"):
            with self.assertRaises(VisionError):
                parse_vision_json(bad)


class ProviderInterface(unittest.TestCase):
    def test_non_claude_providers_satisfy_the_interface(self):
        self.assertIsInstance(support.ReplayProvider(VisionResult()), VisionExtractionProvider)

    def test_contract_has_no_provider_specific_fields(self):
        doc = support.scan_doc([["a b", "c d"]], header="x")
        merged, _ = merge_vision(doc, vr(), [1], ExtractConfig())
        text = json.dumps(merged)
        for banned in ("claude", "anthropic", "sonnet", "tesseract"):
            self.assertNotIn(banned, text.lower().replace("local_ocr", ""), f"'{banned}' không được nằm trong contract ngoài pipeline.stages")


class MergeRules(unittest.TestCase):
    def test_matching_rows_replace_text_keep_geometry_and_validate(self):
        doc = support.scan_doc([["xin chao cac bàn", "hai hàng"]], header="Tinh ca")
        before = {ln["id"]: ln["bbox"] for p in doc["pages"] for r in p["regions"] for ln in r["lines"]}
        merged, warns = merge_vision(doc, vr(), [1], ExtractConfig())
        self.assertEqual(warns, [])
        after = {ln["id"]: ln["bbox"] for p in merged["pages"] for r in p["regions"] for ln in r["lines"]}
        self.assertEqual(before, after, "hình học luôn từ local")
        rows = [ln for r in merged["pages"][0]["regions"] if r["kind"] == "lyric_block" for ln in r["lines"]]
        self.assertTrue(all(t["source"] == "vision" and t["bboxEstimated"] and t["confidence"] is None for ln in rows for t in ln["tokens"]))
        self.assertEqual(validation_errors(merged), [])

    def test_text_layer_pages_are_never_rewritten_by_vision(self):
        doc = support.scan_doc([["xin chao cac bàn", "hai hàng"]], header="Tinh ca")
        doc["pages"][0]["method"] = "text_layer"
        for r in doc["pages"][0]["regions"]:
            for ln in r["lines"]:
                for t in ln["tokens"]:
                    t["source"] = "text_layer"
        merged, _ = merge_vision(doc, vr(), [1], ExtractConfig())
        toks = [t for r in merged["pages"][0]["regions"] if r["kind"] == "lyric_block" for ln in r["lines"] for t in ln["tokens"]]
        self.assertEqual(" ".join(t["text"] for t in toks), "xin chao cac bàn hai hàng")
        self.assertTrue(all(t["source"] == "text_layer" for t in toks))

    def test_row_count_mismatch_keeps_local_text_and_warns(self):
        doc = support.scan_doc([["xin chao", "a b", "c d"]], header="Tinh ca")
        merged, warns = merge_vision(doc, vr(), [1], ExtractConfig())
        self.assertIn("VISION_ROW_COUNT_MISMATCH", [w["code"] for w in warns])
        rows = [ln for r in merged["pages"][0]["regions"] if r["kind"] == "lyric_block" for ln in r["lines"]]
        self.assertTrue(all(t["source"] == "local_ocr" for ln in rows for t in ln["tokens"]))

    def test_system_count_mismatch(self):
        doc = support.scan_doc([["a b", "c d"], ["e f", "g h"]], header="Tinh ca")
        _, warns = merge_vision(doc, vr(), [1], ExtractConfig())
        self.assertIn("VISION_SYSTEM_COUNT_MISMATCH", [w["code"] for w in warns])

    def test_metadata_conflict_follows_config_and_records_alt(self):
        doc = support.scan_doc([["a b", "c d"]], header="Linh ca", conf=0.8)   # local 0.8 < 0.9 → Vision thắng
        m, w = merge_vision(doc, vr(), [1], ExtractConfig())
        t = m["interpretation"]["metadata"]["title"]
        self.assertEqual((t["value"], t["source"], t["alt"][0]["source"]), ("Tinh ca", "vision", "local_ocr"))
        self.assertIn("METADATA_CONFLICT", [x["code"] for x in w])
        m2, _ = merge_vision(doc, vr(), [1], ExtractConfig(metadata_prefer_local_conf=0.5))  # ngưỡng là cấu hình
        self.assertEqual(m2["interpretation"]["metadata"]["title"]["source"], "local_ocr")
        self.assertEqual(m2["interpretation"]["metadata"]["title"]["alt"][0]["value"], "Tinh ca")

    def test_notation_fields_come_only_from_vision(self):
        doc = support.scan_doc([["a b", "c d"]], header="Tinh ca")
        self.assertIsNone(doc["interpretation"]["metadata"]["timeSignature"])
        m, _ = merge_vision(doc, vr(), [1], ExtractConfig())
        meta = m["interpretation"]["metadata"]
        self.assertEqual(meta["timeSignature"]["value"], dict(beats=2, beatType=4))
        self.assertEqual(meta["key"]["value"], dict(fifths=-2))

    def test_vision_cannot_inject_chords(self):
        doc = support.scan_doc([["a b", "c d"]], header="Tinh ca")
        m, w = merge_vision(doc, vr(chord_status="DETECTED", chord_symbols=["Am", "G"]), [1], ExtractConfig())
        self.assertEqual(m["interpretation"]["chords"]["status"], "UNKNOWN")
        self.assertEqual(sum(1 for p in m["pages"] for r in p["regions"] for ln in r["lines"] for t in ln["tokens"] if t["kind"] == "chord"), 0)
        self.assertIn("VISION_CHORDS_UNVERIFIED", [x["code"] for x in w])
        self.assertEqual(validation_errors(m), [])


class FallbackRules(unittest.TestCase):
    def codes(self, doc, **cfgkw):
        return [r["code"] for r in fb.decide(doc, FallbackConfig(**cfgkw))[0]]

    def test_clean_scan_without_staff_needs_no_vision(self):
        doc = support.scan_doc([], header="Tinh ca")
        doc["pages"][0]["regions"] = doc["pages"][0]["regions"][:1]
        self.assertEqual(self.codes(doc), [])

    def test_low_confidence_noise_mismatch_metadata_each_explained(self):
        low = support.scan_doc([["a b", "c d"]], header="Tinh ca", conf=0.6)
        self.assertIn(fb.LOW_OCR_CONFIDENCE, self.codes(low))
        noisy = support.scan_doc([["a b", "c d"]], header="Tinh ca", noise_lines=6)
        self.assertIn(fb.HIGH_NOISE_RATIO, self.codes(noisy))
        mismatch = support.scan_doc([["a b", "c d"], ["e f"]], header="Tinh ca")
        self.assertIn(fb.STAFF_LYRIC_MISMATCH, self.codes(mismatch))
        self.assertIn(fb.METADATA_MISSING, self.codes(support.scan_doc([["a b", "c d"]], header=None)))

    def test_thresholds_are_configuration_not_truth(self):
        doc = support.scan_doc([["a b", "c d"]], header="Tinh ca", conf=0.7)
        self.assertIn(fb.LOW_OCR_CONFIDENCE, self.codes(doc, min_mean_lyric_confidence=0.75))
        self.assertNotIn(fb.LOW_OCR_CONFIDENCE, self.codes(doc, min_mean_lyric_confidence=0.6))
        self.assertNotIn(fb.METADATA_MISSING, self.codes(doc, require_notation_fields=False))

    def test_user_requested_and_reasons_carry_metric_value_threshold(self):
        doc = support.scan_doc([["a b", "c d"]], header="Tinh ca", conf=0.6)
        reasons = fb.decide(doc, FallbackConfig(force_vision=True))[0]
        self.assertEqual(reasons[0]["code"], fb.USER_REQUESTED)
        low = next(r for r in reasons if r["code"] == fb.LOW_OCR_CONFIDENCE)
        self.assertEqual((low["metric"], low["threshold"]), ("meanLyricConfidence", 0.75))
        self.assertTrue(all(r["code"] in fb.CODES and r["detail"] for r in reasons))


class PipelineVisionGating(unittest.TestCase):
    def pdf(self):
        return support.write_tmp(support.make_text_pdf([support.lyric_with_chords("Bai thu nghiem", [([(0, "Am"), (2, "Dm")], ["Chieu", "nay", "khong", "co", "em"])])]))

    def test_text_pdf_force_vision_sends_pages_and_records_reason(self):
        spy = support.ReplayProvider(VisionResult(chord_status="DETECTED"))
        doc = extract_document(self.pdf(), ExtractConfig(fallback=FallbackConfig(force_vision=True)), spy)
        self.assertEqual(spy.calls, 1)
        self.assertEqual([r["code"] for r in doc["pipeline"]["fallbackReasons"]], ["USER_REQUESTED"])
        self.assertEqual(doc["pipeline"]["vision"]["status"], "ran")
        self.assertEqual(doc["pipeline"]["stages"][-1], dict(stage="vision", engine="replay-test", version="1", model="recorded-v1"))
        self.assertEqual(validation_errors(doc), [])

    def test_provider_failure_keeps_local_result(self):
        bad = support.RaisingProvider("rate_limited")
        doc = extract_document(self.pdf(), ExtractConfig(fallback=FallbackConfig(force_vision=True)), bad)
        self.assertEqual(doc["pipeline"]["vision"], dict(status="failed", errorCode="rate_limited", pages=[1]))
        self.assertEqual(doc["interpretation"]["chords"]["status"], "DETECTED")

    def test_no_provider_means_vision_off_with_reasons_visible(self):
        doc = extract_document(self.pdf(), ExtractConfig(fallback=FallbackConfig(force_vision=True)), None)
        self.assertEqual(doc["pipeline"]["vision"]["status"], "skipped_no_provider")
        self.assertEqual(doc["pipeline"]["fallbackReasons"][0]["code"], "USER_REQUESTED")


class AnthropicAdapter(unittest.TestCase):
    def provider(self, post):
        return AnthropicApiProvider("model-x", api_key="SECRET-KEY-123", post=post)

    def request(self):
        from chord_extract.vision import VisionPageInput, VisionRequest
        return VisionRequest(pages=[VisionPageInput(index=1, png=b"\x89PNG", width=1, height=1)], reasons=["USER_REQUESTED"])

    def test_key_never_in_repr_body_or_error(self):
        seen = {}

        def post(url, headers, body, timeout):
            seen.update(url=url, headers=headers, body=body)
            return 200, json.dumps({"content": [{"type": "text", "text": json.dumps(ParseTests.GOOD)}], "usage": {"input_tokens": 7, "output_tokens": 3}}).encode()
        p = self.provider(post)
        self.assertNotIn("SECRET", repr(p))
        r = p.extract(self.request())
        self.assertEqual(r.meta, dict(inputTokens=7, outputTokens=3))
        self.assertEqual(seen["headers"]["x-api-key"], "SECRET-KEY-123")
        self.assertNotIn(b"SECRET", seen["body"])
        self.assertTrue(seen["url"].startswith("https://"))
        self.assertEqual(json.loads(seen["body"])["messages"][0]["content"][0]["type"], "image")

    def test_errors_map_to_codes_without_leaking(self):
        for status, code in ((429, "rate_limited"), (500, "provider_failed")):
            with self.assertRaises(VisionError) as cm:
                self.provider(lambda *a, **k: (status, b"SECRET-KEY-123 echoed")).extract(self.request())
            self.assertEqual(cm.exception.code, code)
            self.assertNotIn("SECRET", str(cm.exception))

    def test_missing_key_is_a_clear_error(self):
        with mock.patch.dict("os.environ", {}, clear=True):
            with self.assertRaises(VisionError) as cm:
                AnthropicApiProvider("m")
        self.assertEqual(cm.exception.code, "not_configured")


if __name__ == "__main__":
    unittest.main()
