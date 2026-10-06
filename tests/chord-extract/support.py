"""Hạ tầng test chung: đường dẫn, corpus NGOÀI git, PDF tổng hợp, nhà cung cấp Vision giả, dựng tài liệu scan tối thiểu."""
import hashlib
import json
import os
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "tools", "chord-extract"))

from chord_extract.vision import VisionError, VisionPageResult, VisionResult  # noqa: E402

WIP = os.path.expanduser("~/Documents/VAA-Work-In-Progress/chord-library-pdf-extract")
CORPUS = os.environ.get("CHORD_EXTRACT_CORPUS", os.path.join(WIP, "corpus"))
TESSDATA = os.environ.get("CHORD_EXTRACT_TESSDATA", os.path.join(WIP, "tessdata"))
os.environ.setdefault("CHORD_EXTRACT_TESSDATA", TESSDATA)
MANIFEST = json.load(open(os.path.join(HERE, "corpus.manifest.json"), encoding="utf-8"))


def corpus_path(name):
    """Đường dẫn file corpus đã KIỂM sha256 theo manifest; thiếu/khác → skip có lý do rõ (corpus là sách/bản nhạc có bản quyền, ở NGOÀI repo công khai)."""
    p = os.path.join(CORPUS, name)
    if not os.path.exists(p):
        raise unittest.SkipTest(f"corpus thiếu: {p} (đặt CHORD_EXTRACT_CORPUS)")
    want = MANIFEST["files"][name]["sha256"]
    h = hashlib.sha256(open(p, "rb").read()).hexdigest()
    if h != want:
        raise AssertionError(f"{name}: sha256 khác manifest — corpus đã đổi, cập nhật manifest có chủ đích.")
    return p


def ocr_ready():
    from chord_extract import ocr
    from chord_extract.config import ExtractConfig
    try:
        return ocr.check_ocr(ExtractConfig())
    except ocr.OcrUnavailable as e:
        raise unittest.SkipTest(f"OCR local chưa sẵn sàng: {e}")


def load_json(name):
    with open(os.path.join(CORPUS, name), encoding="utf-8") as f:
        return json.load(f)


# ── PDF text tổng hợp (Helvetica, chỉ ASCII) ─────────────────────────────────────────────
def make_text_pdf(pages):
    """pages: list[list[(x, y, size, text)]] (toạ độ pt, gốc dưới-trái như PDF). Mỗi mục = một đoạn chữ độc lập."""
    objs = []

    def add(b):
        objs.append(b); return len(objs)

    add(b"<< /Type /Catalog /Pages 2 0 R >>")
    add(b"")  # Pages — điền sau
    font = add(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
    kids = []
    for items in pages:
        stream = "".join(f"BT /F1 {s} Tf {x} {y} Td ({t}) Tj ET\n" for x, y, s, t in items).encode("latin-1")
        c = add(b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"endstream")
        kids.append(add(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 {font} 0 R >> >> /Contents {c} 0 R >>".encode()))
    objs[1] = f"<< /Type /Pages /Kids [{' '.join(f'{k} 0 R' for k in kids)}] /Count {len(kids)} >>".encode()
    out = bytearray(b"%PDF-1.4\n")
    offs = []
    for i, o in enumerate(objs, 1):
        offs.append(len(out)); out += b"%d 0 obj\n" % i + o + b"\nendobj\n"
    x = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1)
    for o in offs:
        out += b"%010d 00000 n \n" % o
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, x)
    return bytes(out)


def write_tmp(data, suffix=".pdf"):
    f = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    f.write(data); f.close()
    return f.name


def lyric_with_chords(title, rows, y0=700):
    """rows: [(chords[(word_index, 'Am')], [words])] — dòng hợp âm cách dòng lời 14pt; mỗi từ cách nhau 60pt từ x=72."""
    items = [(72, y0 + 60, 22, title)]
    y = y0
    for chords, words in rows:
        for wi, c in chords:
            items.append((72 + 60 * wi + 4, y + 14, 11, c))
        for wi, w in enumerate(words):
            items.append((72 + 60 * wi, y, 11, w))
        y -= 48
    return items


# ── Vision giả (không phải Claude: chứng minh engine không phụ thuộc nhà cung cấp) ─────────
class ReplayProvider:
    name, model, version = "replay-test", "recorded-v1", "1"

    def __init__(self, result):
        self.result, self.calls = result, 0

    def extract(self, request):
        self.calls += 1
        self.last_request = request
        return self.result


class RaisingProvider:
    name, model, version = "raising-test", "none", "1"

    def __init__(self, code="provider_failed"):
        self.code, self.calls = code, 0

    def extract(self, request):
        self.calls += 1
        raise VisionError(self.code, "lỗi giả lập")


class CountingProvider(ReplayProvider):
    def __init__(self):
        super().__init__(VisionResult())


def vision_result_from_json(path):
    from chord_extract.vision import parse_vision_json
    return parse_vision_json(json.load(open(path, encoding="utf-8")))


# ── tài liệu scan tối thiểu hợp lệ contract (cho test fallback/merge không cần OCR) ───────────
def scan_doc(systems, header=None, conf=0.9, noise_lines=0):
    """systems: list[list[str]] — các hàng lời từng khuông của MỘT trang. header: tiêu đề OCR (hoặc None)."""
    page_regions, li = [], 0

    def line(text, role, region_y, h=0.01):
        nonlocal li
        toks = [dict(id=f"p1-l{li}-t{i}", text=w, bbox=[0.1 + 0.05 * i, region_y, 0.04, h], confidence=conf, kind="word", source="local_ocr") for i, w in enumerate(text.split())]
        ln = dict(id=f"p1-l{li}", role=role, bbox=[0.1, region_y, max(0.04 * len(toks), 0.04), h], confidence=conf, tokens=toks)
        li += 1
        return ln

    if header:
        page_regions.append(dict(id="p1-r0", kind="header", bbox=[0, 0, 1, 0.1], lines=[line(header, "other", 0.05, 0.03)]))
    for si, rows in enumerate(systems):
        page_regions.append(dict(id=f"p1-s{si}", kind="staff_system", bbox=[0.1, 0.2 + 0.1 * si, 0.8, 0.03], systemIndex=si,
                                 staff=dict(lineY=[0.2, 0.21, 0.22, 0.23, 0.24], barlineX=[0.5]), lines=[]))
        page_regions.append(dict(id=f"p1-lb{si}", kind="lyric_block", bbox=[0, 0.24 + 0.1 * si, 1, 0.05], systemIndex=si,
                                 lines=[line(r, "lyric", 0.25 + 0.1 * si + 0.015 * k) for k, r in enumerate(rows)]))
    for k in range(noise_lines):
        page_regions.append(dict(id=f"p1-n{k}", kind="footer", bbox=[0, 0.9, 1, 0.01], lines=[line("~ ^ .", "other", 0.9)]))
    doc = dict(schema="chord-extraction/1", extractionId="00000000-0000-4000-8000-000000000001", input=dict(sha256="0" * 64, mime="application/pdf", bytes=1, pageCount=1),
               pages=[dict(index=1, kind="scan", method="local_ocr", kindEvidence={}, rotation=0, width=1000, height=1400, unit="px", dpi=None, regions=page_regions, links=[])],
               pipeline=dict(engineVersion="t", stages=[], config={}, metrics={}, fallbackReasons=[], vision=dict(status="not_needed")))
    from chord_extract.interpret import interpret
    doc["interpretation"] = interpret(doc)
    return doc
