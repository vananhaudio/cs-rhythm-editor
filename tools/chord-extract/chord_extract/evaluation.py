"""Đo extraction với gold (dùng cho test hồi quy và hiệu chuẩn ngưỡng sau này). Không dùng ở lúc chạy engine."""
import collections
import re
import unicodedata

from .util import fold


def _lev(a, b):
    prev = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        cur = [i]
        for j, y in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x != y)))
        prev = cur
    return prev[-1]


def norm(s):
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", "", unicodedata.normalize("NFC", s))).strip().lower()


def lyric_texts(doc):
    return [" ".join(t["text"] for t in ln["tokens"]) for pg in doc["pages"] for r in pg["regions"] for ln in r["lines"] if ln["role"] == "lyric"]


def _equiv_map(equivalents):
    m = {}
    for group in equivalents or []:
        for w in group:
            m[norm(w)] = norm(group[0])
    return m


def _apply(words, m):
    return [m.get(w, w) for w in words]


def compare_to_gold(doc, gold_rows, equivalents=None):
    """CER/WER trên chuỗi liên tục (thứ tự đọc), hàng gần đúng. `equivalents` (GOLD_NEEDS_OWNER_REVIEW): mỗi nhóm coi là một chữ."""
    m = _equiv_map(equivalents)
    gw = _apply(norm(" ".join(gold_rows)).split(), m)
    pw = _apply(norm(" ".join(lyric_texts(doc))).split(), m)
    g, p = " ".join(gw), " ".join(pw)
    cer = _lev(p, g) / max(len(g), 1)
    wer = _lev(pw, gw) / max(len(gw), 1)
    pred_rows = [" ".join(_apply(norm(t).split(), m)) for t in lyric_texts(doc)]
    close = 0
    for row in gold_rows:
        gn = " ".join(_apply(norm(row).split(), m))
        if min((_lev(x, gn) / max(len(gn), 1) for x in pred_rows), default=1) <= 0.1:
            close += 1
    return dict(cer=round(cer, 4), wer=round(wer, 4), rows=len(gold_rows), rowsWithin10pct=close, predLines=len(pred_rows))


def bag_scores(doc, reference_text):
    """Precision/recall theo túi từ (khi chỉ có văn bản tham chiếu không theo hàng)."""
    toks = lambda s: re.findall(r"\w+", unicodedata.normalize("NFC", s.lower()))
    ref = collections.Counter(toks(re.sub(r"\[[^\]]*\]", "", reference_text)))
    pred = collections.Counter(toks(" ".join(lyric_texts(doc))))
    tp = sum((pred & ref).values())
    return dict(precision=round(tp / max(sum(pred.values()), 1), 3), recall=round(tp / max(sum(ref.values()), 1), 3))
