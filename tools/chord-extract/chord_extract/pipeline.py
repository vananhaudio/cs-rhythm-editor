"""Điều phối: classify trang → text layer | OCR local (có hình học khuông) → diễn giải → quyết định fallback → (Vision) → hợp nhất."""
import io
import os
import shutil
import tempfile
import uuid
from datetime import datetime, timezone

import numpy as np
from PIL import Image

from . import fallback as fb
from . import ocr, pdfio, staff
from .config import ExtractConfig
from .contract import ENGINE_VERSION, SCHEMA_ID
from .errors import ExtractError
from .interpret import interpret
from .roles import attach_chords, build_lines
from .util import nb, sha256_file
from .vision import VisionPageInput, VisionRequest, stage_of
from .vision.merge import merge_vision
from .vision.provider import VisionError

MIMES = {"pdf": "application/pdf", "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}


class Stages:
    def __init__(self):
        self.items = []

    def add(self, stage, engine, version):
        s = dict(stage=stage, engine=engine, version=version)
        if s not in self.items:
            self.items.append(s)


def _text_page(p, ps, st):
    st.add("extract", "pdftotext-bbox-layout", "poppler")
    page = dict(index=p, kind="text", method="text_layer", kindEvidence=ps["ev"], rotation=0, width=round(ps["W"], 2), height=round(ps["H"], 2),
                unit="pt", dpi=None, regions=[], links=[])
    lines = build_lines(p, ps["words"], ps["W"], ps["H"], "text_layer")
    page["regions"] = [dict(id=f"p{p}-r0", kind="text_body", bbox=[0, 0, 1, 1], lines=lines)]
    page["links"] = attach_chords(lines)
    return page


def _scan_page(p, ps, gray, how, cfg, st, tmp):
    st.add("extract", "tesseract", f"{ocr.tesseract_version()} lang={cfg.lang}")
    if gray.size[0] < cfg.upscale_below_px:  # ~72 dpi: phóng 2× để khuông/chữ đủ nét
        gray = gray.resize((gray.size[0] * 2, gray.size[1] * 2), Image.LANCZOS); how += "+upscale2x"
    W, H = gray.size
    page = dict(index=p, kind=ps["kind"], method="local_ocr", kindEvidence=ps["ev"], rotation=0, width=W, height=H, unit="px", dpi=None,
                imageSource=how, regions=[], links=[])
    staves = staff.find_staves(gray)
    if not staves:
        words = ocr.tess_tsv(gray, cfg, 4, 1.0, tmp)
        lines = build_lines(p, words, W, H, "local_ocr")
        page["regions"] = [dict(id=f"p{p}-r0", kind="unknown", bbox=[0, 0, 1, 1], lines=lines)]
        page["layoutNote"] = "no_staff_found"
        page["links"] = attach_chords(lines)
        return page, gray
    sh = float(np.mean([s["bottom"] - s["top"] for s in staves]))
    regions, li = [], 0
    top_end = int(staves[0]["top"] - 0.6 * sh)
    if top_end > 40:
        lines = build_lines(p, ocr.ocr_rows(gray, 0, top_end, cfg, tmp), W, H, "local_ocr", start_line=li); li += len(lines)
        for ln in lines:
            if ln["role"] == "lyric":
                ln["role"] = "other"  # đầu trang: tiêu đề/tác giả không phải lời hát — việc gán nằm ở interpretation
        regions.append(dict(id=f"p{p}-r0", kind="header", bbox=nb(0, 0, W, top_end, W, H), lines=lines))
    for si, s in enumerate(staves):
        x0, x1 = staff.staff_x_extent(gray, s["top"], s["bottom"])
        bars = staff.staff_barlines(gray, s["top"], s["bottom"], x0, x1)
        regions.append(dict(id=f"p{p}-s{si}", kind="staff_system", bbox=nb(x0, s["top"], x1 - x0, s["bottom"] - s["top"], W, H), systemIndex=si,
                            staff=dict(lineY=[round(y / H, 5) for y in s["lines"]], barlineX=[round(x / W, 5) for x in bars]), lines=[]))
        nxt = staves[si + 1]["top"] if si + 1 < len(staves) else s["bottom"] + 3.4 * sh
        y0, y1 = int(s["bottom"] + 0.4 * sh), int(min(nxt - 0.25 * sh, H))
        if y1 - y0 < 15:
            continue
        lines = build_lines(p, ocr.ocr_band(gray, y0, y1, cfg, tmp), W, H, "local_ocr", start_line=li); li += len(lines)
        regions.append(dict(id=f"p{p}-lb{si}", kind="lyric_block", bbox=nb(0, y0, W, y1 - y0, W, H), systemIndex=si, lines=lines))
    last_end = int(staves[-1]["bottom"] + 3.4 * sh)
    if H - last_end > 40:
        words = ocr.ocr_band(gray, last_end, H, cfg, tmp)
        lines = build_lines(p, words, W, H, "local_ocr", start_line=li); li += len(lines)
        if lines:
            regions.append(dict(id=f"p{p}-rf", kind="footer", bbox=nb(0, last_end, W, H - last_end, W, H), lines=lines))
    page["regions"] = regions
    return page, gray


def _vision_image(gray, cfg):
    g = gray
    side = max(g.size)
    if side > cfg.vision_max_side_px:
        k = cfg.vision_max_side_px / side
        g = g.resize((int(g.size[0] * k), int(g.size[1] * k)), Image.LANCZOS)
    buf = io.BytesIO(); g.save(buf, "PNG")
    return VisionPageInput(index=0, png=buf.getvalue(), width=g.size[0], height=g.size[1])


def extract_document(path, cfg=None, provider=None):
    """→ dict hợp lệ `chord-extraction/1`. `provider`: VisionExtractionProvider hoặc None (Vision tắt).
    Vision CHỈ chạy khi có `fallbackReasons` không rỗng VÀ có provider; mọi trường hợp đều được ghi ở `pipeline.vision`."""
    cfg = cfg or ExtractConfig()
    ext = path.rsplit(".", 1)[-1].lower()
    if ext not in MIMES:
        raise ExtractError("bad_file", "Chỉ nhận PDF, JPEG, PNG hoặc WebP.")
    st = Stages()
    tmp = tempfile.mkdtemp(prefix="chord-extract-")
    try:
        doc = dict(schema=SCHEMA_ID, extractionId=str(uuid.uuid4()), createdAt=datetime.now(timezone.utc).isoformat(timespec="seconds"),
                   input=dict(sha256=sha256_file(path), mime=MIMES[ext], bytes=os.path.getsize(path)), pages=[])
        src = []
        if ext == "pdf":
            n, sizes = pdfio.pdf_pages(path)
            if n > cfg.max_pages:
                raise ExtractError("too_large", f"PDF có {n} trang, tối đa {cfg.max_pages}.")
            st.add("classify", "poppler-pdftotext+pdfimages", "poppler")
            for p in range(1, n + 1):
                words, W, H = pdfio.pdf_words(path, p)
                imgs, cover = pdfio.pdf_images(path, p, *sizes[p])
                kind, ev = pdfio.classify_page(words, imgs, cover, cfg.min_text_chars, cfg.min_text_quality)
                if cfg.force_ocr and kind in ("text", "mixed"):
                    kind = "scan"
                src.append(dict(p=p, W=W, H=H, kind=kind, ev=ev, words=words))
        else:
            try:
                im = Image.open(path)
                im.load()
            except Exception as e:
                raise ExtractError("bad_file", "Không đọc được ảnh.") from e
            src.append(dict(p=1, W=im.width, H=im.height, kind="scan", ev=dict(imageCount=1, imageCoverage=1.0, textChars=0), words=[], img=im.convert("L")))
            n = 1
        doc["input"]["pageCount"] = n
        if any(s["kind"] in ("scan", "mixed") for s in src):
            ocr.check_ocr(cfg)
        grays = {}
        for ps in src:
            if ps["kind"] == "text":
                doc["pages"].append(_text_page(ps["p"], ps, st))
            elif ps["kind"] == "blank":
                doc["pages"].append(dict(index=ps["p"], kind="blank", method="none", kindEvidence=ps["ev"], rotation=0, width=round(ps["W"], 2), height=round(ps["H"], 2),
                                         unit="pt", dpi=None, regions=[], links=[]))
            else:
                gray, how = (ps["img"], "image-input") if "img" in ps else pdfio.render_scan(path, ps["p"], tmp)
                page, gray = _scan_page(ps["p"], ps, gray, how, cfg, st, tmp)
                doc["pages"].append(page)
                grays[ps["p"]] = gray
        doc["pipeline"] = dict(engineVersion=ENGINE_VERSION, stages=st.items, config=cfg.to_dict(), metrics={}, fallbackReasons=[],
                               vision=dict(status="not_needed"))
        doc["interpretation"] = interpret(doc)

        reasons, metrics = fb.decide(doc, cfg.fallback)
        doc["pipeline"]["metrics"], doc["pipeline"]["fallbackReasons"] = metrics, reasons
        if not reasons:
            return doc
        # Gửi trang nào: mặc định chỉ trang scan/mixed; USER_REQUESTED mới gửi mọi trang có hình
        send = sorted(set(grays) | ({p["index"] for p in doc["pages"] if p["kind"] == "text"} if cfg.fallback.force_vision else set()))
        if provider is None:
            doc["pipeline"]["vision"] = dict(status="skipped_no_provider")
            return doc
        if not send or len(send) > cfg.max_vision_pages:
            doc["pipeline"]["vision"] = dict(status="skipped_page_limit" if send else "skipped_no_pages", pages=send, limit=cfg.max_vision_pages)
            return doc
        pages = []
        for idx in send:
            g = grays.get(idx)
            if g is None:  # trang text được yêu cầu gửi: render
                g = Image.open(_render_png(path, idx, tmp)).convert("L")
            vi = _vision_image(g, cfg); vi.index = idx
            pages.append(vi)
        req = VisionRequest(pages=pages, reasons=[r["code"] for r in reasons],
                            hints=dict(systemsPerPage={p["index"]: sum(1 for r in p["regions"] if r["kind"] == "staff_system") for p in doc["pages"]}))
        try:
            result = provider.extract(req)
        except VisionError as e:
            doc["pipeline"]["vision"] = dict(status="failed", errorCode=e.code, pages=send)
            return doc
        merged, warnings = merge_vision(doc, result, send, cfg)
        merged["pipeline"]["stages"] = merged["pipeline"]["stages"] + [stage_of(provider)]
        merged["pipeline"]["vision"] = dict(status="ran", pages=send, warnings=[w["code"] for w in warnings], meta=result.meta)
        return merged
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def _render_png(path, page, tmp):
    base = os.path.join(tmp, f"v{page}")
    pdfio.run(["pdftoppm", "-r", "150", "-gray", "-png", "-f", str(page), "-l", str(page), "-singlefile", path, base])
    return base + ".png"
