"""OCR local (tesseract). Không phụ thuộc gói Python — gọi CLI, đọc TSV có bbox + confidence."""
import os
import subprocess
import tempfile

from PIL import Image

from .errors import ExtractError
from .staff import ink_rows


class OcrUnavailable(ExtractError):
    def __init__(self, message=""):
        super().__init__("ocr_unavailable", message)


def tessdata_dir(cfg):
    return cfg.tessdata_dir or os.environ.get("CHORD_EXTRACT_TESSDATA") or None


def check_ocr(cfg):
    """Báo lỗi RÕ nếu thiếu tesseract hoặc gói ngôn ngữ — không âm thầm OCR bằng tiếng khác (eng làm CER 31% trên Tình ca)."""
    args = ["tesseract", "--list-langs"]
    td = tessdata_dir(cfg)
    if td:
        args += ["--tessdata-dir", td]
    try:
        r = subprocess.run(args, capture_output=True, text=True)
    except FileNotFoundError as e:
        raise OcrUnavailable("Không tìm thấy tesseract.") from e
    langs = set(r.stdout.split()[1:]) if r.returncode == 0 else set()
    if cfg.lang not in langs:
        raise OcrUnavailable(f"Thiếu gói ngôn ngữ OCR '{cfg.lang}' (có: {sorted(langs)}).")
    return True


def tesseract_version():
    try:
        r = subprocess.run(["tesseract", "--version"], capture_output=True, text=True)
        return (r.stdout or r.stderr).splitlines()[0].strip()
    except Exception:
        return "unknown"


def tess_tsv(img, cfg, psm, scale=1.0, tmp=None):
    im = img if scale == 1.0 else img.resize((int(img.width * scale), int(img.height * scale)), Image.LANCZOS)
    f = tempfile.NamedTemporaryFile(suffix=".png", delete=False, dir=tmp)
    im.save(f.name); f.close()
    cmd = ["tesseract", f.name, "stdout", "-l", cfg.lang, "--psm", str(psm)]
    td = tessdata_dir(cfg)
    if td:
        cmd += ["--tessdata-dir", td]
    cmd += ["tsv"]
    env = dict(os.environ)
    if td:
        env["TESSDATA_PREFIX"] = td
    r = subprocess.run(cmd, capture_output=True, text=True, errors="replace", env=env)
    os.unlink(f.name)
    words = []
    for ln in r.stdout.splitlines()[1:]:
        p = ln.split("\t")
        if len(p) < 12 or p[0] != "5" or not p[11].strip():
            continue
        words.append(dict(lk=(p[2], p[3], p[4]), text=p[11].strip(), x=int(p[6]) / scale, y=int(p[7]) / scale,
                          w=int(p[8]) / scale, h=int(p[9]) / scale, conf=max(0.0, float(p[10])) / 100.0))
    return words


def ocr_band(gray, y0, y1, cfg, tmp):
    """OCR một dải ngang (vd. các hàng lời dưới một khuông), psm theo cấu hình; toạ độ trả về là toạ độ trang."""
    words = tess_tsv(gray.crop((0, y0, gray.size[0], y1)), cfg, cfg.ocr_psm, cfg.ocr_scale, tmp)
    for w in words:
        w["y"] += y0
    return words


def ocr_rows(gray, y0, y1, cfg, tmp, pad=6):
    """OCR từng dải mực bằng psm 7 (vùng đầu trang: tiêu đề, tác giả)."""
    W = gray.size[0]
    words = []
    for ra, rb in ink_rows(gray, y0, y1):
        ya, yb = max(0, ra - pad), min(gray.size[1], rb + pad)
        for w in tess_tsv(gray.crop((0, ya, W, yb)), cfg, 7, cfg.ocr_scale, tmp):
            w["y"] += ya
            w["band"] = ra
            words.append(w)
    return words
