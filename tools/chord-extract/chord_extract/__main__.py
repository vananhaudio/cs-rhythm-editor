"""python3 -m chord_extract <file.pdf|jpg|png|webp> [--out x.json] [--vision none|claude-cli|anthropic-api] [--force-vision] [--validate]"""
import argparse
import json
import sys

from .errors import ExtractError
from .config import ExtractConfig, FallbackConfig
from .pipeline import extract_document


def main(argv=None):
    ap = argparse.ArgumentParser(prog="chord_extract")
    ap.add_argument("path", nargs="?")
    ap.add_argument("--out")
    ap.add_argument("--lang", default="vie")
    ap.add_argument("--tessdata")
    ap.add_argument("--force-ocr", action="store_true")
    ap.add_argument("--vision", choices=["none", "claude-cli", "anthropic-api"], default="none", help="Mặc định TẮT; chỉ chạy khi có lý do fallback (hoặc --force-vision).")
    ap.add_argument("--vision-model", default=None)
    ap.add_argument("--vision-base-url", default=None, help="Endpoint Anthropic (proxy/kiểm thử). Mặc định api.anthropic.com.")
    ap.add_argument("--force-vision", action="store_true", help="USER_REQUESTED: ép phân tích chính xác hơn bằng Vision.")
    ap.add_argument("--max-pages", type=int, default=None)
    ap.add_argument("--json-errors", action="store_true", help="Lỗi → stdout {\"ok\":false,\"error\":{\"code\":…}} (không stack trace), thoát 2. Dành cho worker.")
    ap.add_argument("--version", action="store_true", help="In phiên bản engine rồi thoát.")
    ap.add_argument("--validate", action="store_true", help="Kiểm kết quả với chord-extraction/1 (cần gói jsonschema).")
    a = ap.parse_args(argv)
    if a.version:
        from .contract import ENGINE_VERSION
        print(ENGINE_VERSION)
        return 0

    cfg = ExtractConfig(lang=a.lang, tessdata_dir=a.tessdata, force_ocr=a.force_ocr, fallback=FallbackConfig(force_vision=a.force_vision))
    if a.max_pages:
        cfg.max_pages = a.max_pages
    provider = None
    if a.vision == "claude-cli":
        from .vision.claude_cli import ClaudeCliProvider
        provider = ClaudeCliProvider(model=a.vision_model or "sonnet")
    elif a.vision == "anthropic-api":
        from .vision.anthropic_api import AnthropicApiProvider
        if not a.vision_model:
            ap.error("--vision anthropic-api cần --vision-model")
        provider = AnthropicApiProvider(model=a.vision_model, **({"base_url": a.vision_base_url} if a.vision_base_url else {}))
    try:
        doc = extract_document(a.path, cfg, provider)
    except ExtractError as e:
        if not a.json_errors:
            raise
        print(json.dumps({"ok": False, "error": {"code": e.code}}))
        return 2
    except Exception:  # noqa: BLE001 — chế độ worker: không để stack trace (có thể chứa đường dẫn) ra ngoài
        if not a.json_errors:
            raise
        print(json.dumps({"ok": False, "error": {"code": "engine_failed"}}))
        return 2
    if a.validate:
        from .contract import validation_errors
        errs = validation_errors(doc)
        if errs:
            print("KHÔNG hợp lệ chord-extraction/1:", [(list(e.path)[:6], e.message[:80]) for e in errs[:5]], file=sys.stderr)
            return 2
    s = json.dumps(doc, ensure_ascii=False, indent=1)
    if a.out:
        with open(a.out, "w", encoding="utf-8") as f:
            f.write(s)
    else:
        print(s)
    return 0


if __name__ == "__main__":
    sys.exit(main())
