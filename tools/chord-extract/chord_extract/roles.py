"""Từ → dòng → vai trò (lời / hợp âm / tab / chỉ dẫn / khác) và nối hợp âm với chữ bên dưới.
Thuần hình thức + vị trí. KHÔNG suy hợp âm từ giai điệu hay kiến thức hoà âm: hợp âm chỉ là chữ ĐƯỢC IN trên trang."""
import re

import numpy as np

from .util import nb, union

CHORD_RE = re.compile(
    r"^[A-G][#b♯♭]?(?:maj|min|m|M|dim|aug|sus|add|°|ø|\+)?\d{0,2}(?:(?:sus|add|b|#|♯|♭)\d{1,2})*(?:/[A-G][#b♯♭]?)?$")
# Chỉ dẫn/nhãn của phần mềm soạn nhạc (Guitar Pro…) — không phải lời. Danh sách heuristic, mở rộng khi có mẫu mới.
DIRECTION_RE = re.compile(r"(standard\s*tuning|steel\s*guitar|\bs\.?\s*guit|words\s*&\s*music|music\s*by|\bcapo\b|^guitar$|^\W*=\s*\d+)", re.I)
VOWELS = set("aeiouyăâêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ")


def is_chord(t):
    return bool(CHORD_RE.match(t.strip(",.;:")))


def looks_vi(t):
    """Âm tiết/chữ tiếng Việt hợp lệ về hình thức: toàn chữ, có nguyên âm, không quá dài."""
    w = re.sub(r"^[^\w]+|[^\w]+$", "", t.lower())
    return 1 <= len(w) <= 8 and w.isalpha() and any(c in VOWELS for c in w)


def line_role(toks):
    texts = [t["text"] for t in toks]
    if not texts:
        return "other"
    if DIRECTION_RE.search(" ".join(texts)):
        return "direction"
    chords = sum(is_chord(t) for t in texts)
    nums = sum(bool(re.fullmatch(r"[\d\-–xX()hHpP/\\~.]+", t)) for t in texts)
    alpha = sum(bool(re.search(r"[^\W\d_]{2,}", t)) for t in texts)
    if chords >= 1 and chords / len(texts) >= 0.7:
        return "chord"
    if nums / len(texts) >= 0.8:
        return "tab"
    vi = sum(looks_vi(t) for t in texts)
    if alpha >= 1 and alpha / len(texts) >= 0.5 and vi / len(texts) >= 0.6:
        return "lyric"
    return "other"


def group_lines(words, tol=0.55):
    """Cụm từ cùng hàng. Nguồn OCR: tin phân dòng của chính engine (block/par/line) — tránh tách chữ hoa cao khỏi dòng."""
    if words and all("lk" in w for w in words):
        keyed = {}
        for w in words:
            keyed.setdefault((w.get("band", 0), w["lk"]), []).append(w)
        out = []
        for ws_ in keyed.values():
            ws_.sort(key=lambda w: w["x"])
            out.append(dict(cy=float(np.mean([w["y"] + w["h"] / 2 for w in ws_])), h=max(w["h"] for w in ws_), w=ws_))
        out.sort(key=lambda l: l["cy"])
        return out
    lines = []
    for w in sorted(words, key=lambda w: w["y"] + w["h"] / 2):
        cy = w["y"] + w["h"] / 2
        for ln in lines:
            if abs(cy - ln["cy"]) <= tol * max(w["h"], ln["h"]):
                ln["w"].append(w)
                n = len(ln["w"]); ln["cy"] = (ln["cy"] * (n - 1) + cy) / n; ln["h"] = max(ln["h"], w["h"])
                break
        else:
            lines.append(dict(cy=cy, h=w["h"], w=[w]))
    for ln in lines:
        ln["w"].sort(key=lambda w: w["x"])
    lines.sort(key=lambda l: l["cy"])
    return lines


def make_token(pid, ln_i, i, w, W, H, source, conf):
    t = w["text"]
    kind = "number" if re.fullmatch(r"[\d.,]+", t) else "word" if re.search(r"[^\W\d_]", t) else "symbol"
    return dict(id=f"p{pid}-l{ln_i}-t{i}", text=t, bbox=nb(w["x"], w["y"], w["w"], w["h"], W, H), confidence=conf, kind=kind, source=source)


def refine_roles(lines, min_ocr_lyric_conf=0.55):
    """Hậu xử lý theo bằng chứng cấp TRANG (không theo từng dòng riêng lẻ)."""
    for ln in lines:
        src = ln["tokens"][0]["source"] if ln["tokens"] else "text_layer"
        if src != "text_layer" and ln["role"] == "lyric" and (ln["confidence"] or 0) < min_ocr_lyric_conf:
            ln["role"] = "other"
    multi = sum(1 for ln in lines if ln["role"] == "chord" and sum(t["kind"] == "chord" for t in ln["tokens"]) >= 2)
    for ln in lines:
        if ln["role"] != "chord":
            continue
        n = sum(t["kind"] == "chord" for t in ln["tokens"])
        src = ln["tokens"][0]["source"]
        # "Em", "A"… là cả hợp âm lẫn chữ Việt: dòng chỉ có 1 hợp âm cần ≥2 dòng hợp âm nhiều-token cùng trang làm chứng;
        # ảnh OCR đòi nghiêm hơn (không có dòng chứng → không bao giờ là hợp âm).
        if n < 2 and multi < 2:
            ln["role"] = "lyric" if looks_vi(ln["tokens"][0]["text"]) and src == "text_layer" else "other"
            for t in ln["tokens"]:
                t["kind"] = "word"
        elif src != "text_layer" and multi < 1:
            ln["role"] = "other"
            for t in ln["tokens"]:
                t["kind"] = "word"
    return lines


def build_lines(pid, words, W, H, source, start_line=0, min_ocr_lyric_conf=0.55):
    out = []
    for li, ln in enumerate(group_lines(words), start=start_line):
        toks = []
        for i, w in enumerate(ln["w"]):
            conf = w.get("conf", 1.0 if source == "text_layer" else None)
            toks.append(make_token(pid, li, i, w, W, H, source, None if conf is None else round(conf, 3)))
        role = line_role(toks)
        if role == "chord":
            for t in toks:
                if is_chord(t["text"]):
                    t["kind"] = "chord"
        confs = [t["confidence"] for t in toks if t["confidence"] is not None]
        out.append(dict(id=f"p{pid}-l{li}", role=role, bbox=union([t["bbox"] for t in toks]),
                        confidence=round(float(np.mean(confs)), 3) if confs else None, tokens=toks))
    return refine_roles(out, min_ocr_lyric_conf)


def attach_chords(lines, window=9):
    """Hợp âm nằm TRÊN lời: nối mỗi token hợp âm với token lời gần nhất bên dưới theo x (dòng lời gần nhất bên dưới,
    trước dòng hợp âm kế tiếp). Giữ `offset` 0..1 = vị trí tương đối trong token lời — nguyên liệu cho anchors sau này."""
    links = []
    for i, ln in enumerate(lines):
        if ln["role"] != "chord":
            continue
        below = None
        for j in range(i + 1, min(i + window, len(lines))):
            if lines[j]["role"] == "lyric":
                below = lines[j]; break
            if lines[j]["role"] == "chord":
                break
        if not below:
            continue
        for c in ln["tokens"]:
            if c["kind"] != "chord":
                continue
            cx = c["bbox"][0] + c["bbox"][2] / 2
            best, bd = None, 9.0
            for t in below["tokens"]:
                x0, x1 = t["bbox"][0], t["bbox"][0] + t["bbox"][2]
                d = 0 if x0 <= cx <= x1 else min(abs(cx - x0), abs(cx - x1))
                if d < bd:
                    best, bd = t, d
            if best is not None:
                off = (cx - best["bbox"][0]) / max(best["bbox"][2], 1e-6)
                links.append(dict(chordTokenId=c["id"], lyricTokenId=best["id"], relation="above", offset=round(min(max(off, 0), 1), 3)))
    return links
