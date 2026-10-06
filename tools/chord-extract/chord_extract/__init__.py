"""chord_extract — đọc PDF/ảnh sheet hợp âm thành `chord-extraction/1` (JSON trung lập engine).

Chỉ là ENGINE: không DB, không mạng (trừ nhà cung cấp Vision được cấu hình rõ ràng), không UI.
Xem README.md.
"""
from .config import ExtractConfig, FallbackConfig
from .contract import ENGINE_VERSION, SCHEMA_ID
from .pipeline import extract_document

__all__ = ["ExtractConfig", "FallbackConfig", "ENGINE_VERSION", "SCHEMA_ID", "extract_document"]
