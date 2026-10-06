"""Đọc PDF bằng poppler (pdfinfo / pdftotext / pdfimages / pdftoppm) — đã có sẵn ở worker."""
import os
import re
import xml.etree.ElementTree as ET

from PIL import Image

from .errors import ExtractError
from .util import run


def pdf_pages(path):
    info = run(["pdfinfo", "-f", "1", "-l", "9999", path]).stdout
    m = re.search(r"Pages:\s+(\d+)", info)
    if not m:
        raise ExtractError("bad_file", "Không đọc được file PDF.")
    n = int(m.group(1))
    sizes = {}
    for m in re.finditer(r"Page\s+(\d+) size:\s+([\d.]+) x ([\d.]+) pts", info):
        sizes[int(m.group(1))] = (float(m.group(2)), float(m.group(3)))
    if not sizes:
        m = re.search(r"Page size:\s+([\d.]+) x ([\d.]+) pts", info)
        sizes = {i: (float(m.group(1)), float(m.group(2))) for i in range(1, n + 1)}
    return n, sizes


def pdf_words(path, page):
    """Từ + bbox (pt) từ text layer (pdftotext -bbox-layout). Trả (words, W, H).
    Đã thử pdfminer/pdfplumber và ghép theo ký tự: không tốt hơn (PDF Guitar Pro vốn thiếu khoảng hở giữa vài âm tiết)."""
    out = run(["pdftotext", "-bbox-layout", "-f", str(page), "-l", str(page), path, "-"]).stdout
    out = re.sub(r"<!DOCTYPE[^>]*>", "", out)
    root = ET.fromstring(out)
    ns = {"x": "http://www.w3.org/1999/xhtml"}
    pg = root.find(".//x:page", ns)
    W, H = float(pg.get("width")), float(pg.get("height"))
    words = []
    for w in pg.iter("{http://www.w3.org/1999/xhtml}word"):
        words.append(dict(text=w.text or "", x=float(w.get("xMin")), y=float(w.get("yMin")),
                          w=float(w.get("xMax")) - float(w.get("xMin")), h=float(w.get("yMax")) - float(w.get("yMin"))))
    return words, W, H


def pdf_images(path, page, W, H):
    """Ảnh nhúng trên trang + tỉ lệ diện tích phủ trang."""
    out = run(["pdfimages", "-list", "-f", str(page), "-l", str(page), path]).stdout.splitlines()[2:]
    imgs, cover = [], 0.0
    for ln in out:
        p = ln.split()
        if len(p) < 14 or p[2] != "image":
            continue
        wpx, hpx, xppi, yppi = int(p[3]), int(p[4]), float(p[12]), float(p[13])
        imgs.append(dict(w=wpx, h=hpx, ppi=xppi))
        cover += (wpx / xppi * 72) * (hpx / yppi * 72) / (W * H)
    return imgs, min(cover, 1.0)


def text_quality(words):
    """Tỉ lệ ký tự 'đọc được' — text layer hỏng thường đầy � hoặc ký tự lạ."""
    s = "".join(w["text"] for w in words)
    if not s:
        return 0.0
    good = sum(1 for c in s if c.isalnum() or c in ".,;:!?-–'’\"()[]/#♯♭…")
    return good / len(s)


def classify_page(words, imgs, cover, min_chars=20, min_quality=0.85):
    """text | scan | mixed | blank — quyết định cách xử lý TRƯỚC khi đọc nội dung (không OCR trang có text layer tốt)."""
    chars = sum(len(w["text"]) for w in words)
    q = text_quality(words)
    ev = dict(textChars=chars, textWords=len(words), textQuality=round(q, 3), imageCount=len(imgs), imageCoverage=round(cover, 3))
    if chars >= min_chars and q >= min_quality:
        kind = "mixed" if cover > 0.6 and chars < 80 else "text"
    elif cover > 0.5:
        kind = "scan"
    elif chars == 0:
        kind = "blank"
    else:
        kind = "mixed"
    return kind, ev


def render_scan(path, page, tmp):
    """Ảnh trang scan: ưu tiên NGUYÊN ảnh nhúng (không nội suy); không thì render 200 dpi."""
    base = os.path.join(tmp, f"p{page}")
    imgs = run(["pdfimages", "-list", "-f", str(page), "-l", str(page), path]).stdout.splitlines()[2:]
    if len([l for l in imgs if l.split()[2] == "image"]) == 1:
        run(["pdfimages", "-png", "-f", str(page), "-l", str(page), path, base])
        f = sorted(x for x in os.listdir(tmp) if x.startswith(f"p{page}-"))
        if f:
            return Image.open(os.path.join(tmp, f[0])).convert("L"), "embedded"
    run(["pdftoppm", "-r", "200", "-gray", "-png", "-f", str(page), "-l", str(page), "-singlefile", path, base])
    return Image.open(base + ".png").convert("L"), "render200"
