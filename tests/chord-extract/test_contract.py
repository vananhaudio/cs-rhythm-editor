import unittest

import support  # noqa: F401  (đặt sys.path)
from chord_extract.contract import SCHEMA_ID, load_schema, validation_errors
from jsonschema import Draft202012Validator


class ContractTests(unittest.TestCase):
    def test_schema_itself_is_valid(self):
        Draft202012Validator.check_schema(load_schema())
        self.assertEqual(load_schema()["properties"]["schema"]["const"], SCHEMA_ID)

    def test_synthetic_scan_doc_validates(self):
        doc = support.scan_doc([["a b c", "d e f"]], header="Tieu de")
        self.assertEqual(validation_errors(doc), [])

    def test_schema_rejects_engine_specific_fields_on_tokens(self):
        doc = support.scan_doc([["a b"]])
        doc["pages"][0]["regions"][1]["lines"][0]["tokens"][0]["tesseractBlockNum"] = 3
        self.assertTrue(validation_errors(doc), "token không được mang dữ liệu riêng của engine")

    def test_schema_rejects_unknown_token_source_and_bad_bbox(self):
        doc = support.scan_doc([["a b"]])
        tok = doc["pages"][0]["regions"][1]["lines"][0]["tokens"][0]
        tok["source"] = "tesseract"
        self.assertTrue(validation_errors(doc))
        tok["source"] = "local_ocr"; tok["bbox"] = [0, 0, 2, 0.1]
        self.assertTrue(validation_errors(doc))


if __name__ == "__main__":
    unittest.main()
