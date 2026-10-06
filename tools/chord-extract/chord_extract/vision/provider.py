"""Hợp đồng Vision TRUNG LẬP nhà cung cấp. Engine chỉ biết `VisionExtractionProvider`; Claude/model khác/tắt Vision thay được
mà không đổi canonical contract. Tên provider/model/version chỉ xuất hiện trong `pipeline.stages`."""
import json
import re
from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable


class VisionError(RuntimeError):
    """Lỗi nhà cung cấp (mạng, hạn mức, trả về sai khuôn…). `code` ổn định để ghi vào pipeline."""

    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


@dataclass
class VisionPageInput:
    index: int        # chỉ số trang 1-based trong tài liệu
    png: bytes        # ảnh xám đã giới hạn cạnh dài
    width: int
    height: int


@dataclass
class VisionRequest:
    pages: list
    reasons: list = field(default_factory=list)   # mã lý do fallback (để provider/ log biết vì sao gọi)
    hints: dict = field(default_factory=dict)     # vd {"systemsPerPage": {1: 6, 2: 6}} — gợi ý bố cục từ local, không bắt buộc


@dataclass
class VisionPageResult:
    index: int
    printed_page_number: str | None
    systems: list     # list[list[str]] — khuông từ trên xuống, mỗi khuông các hàng lời từ trên xuống


@dataclass
class VisionResult:
    title: str | None = None
    author: str | None = None
    time_signature: tuple | None = None      # (beats, beat_type)
    key_fifths: int | None = None            # âm = giáng, dương = thăng
    directions: list = field(default_factory=list)
    chord_status: str = "UNKNOWN"            # DETECTED | NO_CHORDS_DETECTED | UNKNOWN
    chord_symbols: list = field(default_factory=list)
    pages: list = field(default_factory=list)
    meta: dict = field(default_factory=dict)  # số liệu nhà cung cấp (chi phí, token…) — chỉ để ghi vết


@runtime_checkable
class VisionExtractionProvider(Protocol):
    name: str      # vd "claude-api"
    model: str     # vd "claude-sonnet-5-5"
    version: str   # phiên bản adapter/CLI

    def extract(self, request: VisionRequest) -> VisionResult: ...


def stage_of(provider):
    return dict(stage="vision", engine=provider.name, version=provider.version, model=provider.model)


def json_from_text(text):
    """Lấy khối JSON đầu tiên từ phản hồi (hay có ```json … ```)."""
    m = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.S)
    raw = m.group(1) if m else text[text.find("{"): text.rfind("}") + 1]
    try:
        return json.loads(raw)
    except Exception as e:
        raise VisionError("bad_response", "Vision không trả JSON hợp lệ.") from e


def _s(v):
    return v.strip() if isinstance(v, str) and v.strip() else None


def parse_vision_json(data):
    """Kiểm tra NGHIÊM khuôn trả về (provider nào cũng phải ra khuôn này); trường lạ bị bỏ, sai kiểu → VisionError."""
    if isinstance(data, str):
        data = json_from_text(data)
    if not isinstance(data, dict):
        raise VisionError("bad_response", "Phản hồi Vision không phải đối tượng.")
    ts = data.get("timeSignature")
    if ts is not None:
        if not (isinstance(ts, dict) and isinstance(ts.get("beats"), int) and isinstance(ts.get("beatType"), int)
                and 1 <= ts["beats"] <= 32 and ts["beatType"] in (1, 2, 4, 8, 16)):
            raise VisionError("bad_response", "timeSignature sai khuôn.")
        ts = (ts["beats"], ts["beatType"])
    key = data.get("key")
    fifths = None
    if key is not None:
        if not (isinstance(key, dict) and isinstance(key.get("fifths"), int) and -7 <= key["fifths"] <= 7):
            raise VisionError("bad_response", "key.fifths phải là số nguyên −7..7.")
        fifths = key["fifths"]
    status = data.get("chords", "UNKNOWN")
    if status not in ("DETECTED", "NO_CHORDS_DETECTED", "UNKNOWN"):
        raise VisionError("bad_response", "chords sai giá trị.")
    symbols = data.get("chordSymbols") or []
    if not (isinstance(symbols, list) and all(isinstance(x, str) for x in symbols)):
        raise VisionError("bad_response", "chordSymbols sai khuôn.")
    pages = []
    for i, p in enumerate(data.get("pages") or [], start=1):
        systems = p.get("systems") if isinstance(p, dict) else None
        if not (isinstance(systems, list) and all(isinstance(s, list) and all(isinstance(r, str) for r in s) for s in systems)):
            raise VisionError("bad_response", f"pages[{i - 1}].systems sai khuôn.")
        ppn = p.get("printedPageNumber")
        pages.append(VisionPageResult(index=i, printed_page_number=str(ppn) if ppn not in (None, "") else None, systems=systems))
    dirs = data.get("directions") or []
    return VisionResult(title=_s(data.get("title")), author=_s(data.get("author")), time_signature=ts, key_fifths=fifths,
                        directions=[d for d in dirs if isinstance(d, str)], chord_status=status, chord_symbols=symbols, pages=pages)
