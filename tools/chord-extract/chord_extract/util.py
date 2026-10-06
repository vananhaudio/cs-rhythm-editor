import hashlib
import subprocess
import unicodedata


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=kw.pop("text", True), **kw)


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def fold(s):
    """Bỏ dấu tiếng Việt (đ→d)."""
    return "".join(c for c in unicodedata.normalize("NFD", s.replace("đ", "d").replace("Đ", "D")) if unicodedata.category(c) != "Mn")


def nb(x, y, w, h, W, H):
    """bbox chuẩn hoá [x,y,w,h] theo trang, gốc trên-trái, 0..1."""
    x0, y0 = max(0.0, x / W), max(0.0, y / H)
    x1, y1 = min(1.0, (x + w) / W), min(1.0, (y + h) / H)
    return [round(x0, 5), round(y0, 5), round(x1 - x0, 5), round(y1 - y0, 5)]


def union(boxes):
    x0 = min(b[0] for b in boxes); y0 = min(b[1] for b in boxes)
    x1 = max(b[0] + b[2] for b in boxes); y1 = max(b[1] + b[3] for b in boxes)
    return [round(x0, 5), round(y0, 5), round(x1 - x0, 5), round(y1 - y0, 5)]
