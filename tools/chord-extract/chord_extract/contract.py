import json
import os

SCHEMA_ID = "chord-extraction/1"
ENGINE_VERSION = "chord-extract/1.0.0-slice1"
SCHEMA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "contract", "chord-extraction.schema.json")


def load_schema():
    with open(SCHEMA_PATH, encoding="utf-8") as f:
        return json.load(f)


def validation_errors(doc):
    """Danh sách lỗi theo JSON Schema (cần gói `jsonschema` — chỉ dùng khi test/kiểm, không phải lúc chạy engine)."""
    from jsonschema import Draft202012Validator
    return sorted(Draft202012Validator(load_schema()).iter_errors(doc), key=lambda e: list(e.path))
