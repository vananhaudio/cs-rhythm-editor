"""Lỗi có MÃ máy đọc được (không thông điệp tự do/stack trace) để worker ghi vào extraction mà không lộ gì."""


class ExtractError(Exception):
    """code ∈ {bad_file, too_large, ocr_unavailable, engine_failed}. `message` chỉ để người vận hành đọc ở log CLI, không lưu DB."""

    def __init__(self, code, message=""):
        super().__init__(message or code)
        self.code = code
