"""Ghép OCR lời GẦN ĐÚNG của sheet với lời CHUẨN (Hợp Âm Việt) → vị trí {line, token}. Thuần Python (stdlib), không OCR, không I/O.

OCR chỉ để ĐỊNH VỊ: đầu ra luôn trỏ vào lời chuẩn, không bao giờ là chữ OCR. Mỗi dòng OCR (lyric row) là một quan sát ĐỘC LẬP
(không nối hai hàng, không giả định thứ tự trang/khổ): căn chỉnh cục bộ (Smith–Waterman) với toàn bộ dãy token chuẩn, kèm điểm
tốt nhất / tốt nhì (vùng đã chọn bị chặn) → MATCH / AMBIGUOUS / UNMATCHED. Lặp lại ở nhiều chỗ → AMBIGUOUS, không đoán.

Chỉ số token ({line, token}) là CHỈ SỐ CỦA TOKENIZER APP (gồm cả "1:"/"2:" sau nhãn). Nhãn khổ "1:"/"2:" ở đầu dòng bị loại khỏi
DÃY ĐỂ GHÉP (sheet không in chúng) nhưng KHÔNG đổi chỉ số của bất kỳ token nào.
"""
import re
import unicodedata

MATCH_MIN = 0.6     # độ giống tối thiểu để một cặp chữ tính là khớp
GAP = -1.0          # thừa một chữ OCR
MISS = -1.0         # lệch / thiếu một token chuẩn
VERSE_LABEL = re.compile(r"^\d{1,2}[.:)]$")


def norm(text):
    """Chuẩn hoá CHỈ để so khớp: Unicode, bỏ dấu tiếng Việt (đ→d), chữ thường, bỏ dấu câu. Không sửa lời gốc."""
    s = unicodedata.normalize("NFD", text.replace("đ", "d").replace("Đ", "D"))
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]", "", s.lower())


def _lev(a, b):
    if a == b:
        return 0
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def similarity(a, b):
    """0..1. Chữ ngắn (≤2 ký tự) bắt buộc trùng hệt (tránh khớp bừa "em"/"ơi")."""
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    if min(len(a), len(b)) <= 2:
        return 0.0
    return max(0.0, 1 - _lev(a, b) / max(len(a), len(b)))


def _pair(a, b):
    s = similarity(a, b)
    return 2 * s if s >= MATCH_MIN else MISS


class Canon:
    """Lời chuẩn dưới dạng dãy token phẳng. `flat[i] = (line, token, word)`; chỉ số i ĐỒNG NHẤT với đếm token theo dòng của app."""

    def __init__(self, line_words):
        self.flat = []
        self.line_start = []
        for li, words in enumerate(line_words):
            self.line_start.append(len(self.flat))
            for ti, w in enumerate(words):
                self.flat.append((li, ti, w))
        self.total = len(self.flat)
        # nhãn khổ ("1:", "2:") chỉ khi MỌI token đứng trước nó trong dòng cũng là nhãn (vị trí cấu trúc)
        self.label = [False] * self.total
        for li, words in enumerate(line_words):
            for ti, w in enumerate(words):
                if VERSE_LABEL.match(w) and all(self.label[self.line_start[li] + k] for k in range(ti)):
                    self.label[self.line_start[li] + ti] = True
        # dãy để ghép: bỏ nhãn; stream[k] = chỉ số phẳng
        self.stream = [i for i in range(self.total) if not self.label[i]]
        self.stream_norm = [norm(self.flat[i][2]) for i in self.stream]

    def snap(self, idx):
        """Chỉ số phẳng → chỉ số của app. Nếu mọi token đứng trước trong dòng đều là nhãn khổ, ô mở ở ĐẦU DÒNG (token 0): vạch
        đứng trước "1:" hay trước "Em" là cùng một chỗ về mặt nghe, và token 0 giữ nguyên cách đánh số của app."""
        if idx >= self.total:
            return idx
        li, ti, _ = self.flat[idx]
        start = self.line_start[li]
        if ti > 0 and all(self.label[start + k] for k in range(ti)):
            return start
        return idx

    def at(self, idx):
        li, ti, _ = self.flat[idx]
        return {"line": li, "token": ti}


def _sw(ocr, canon_norm, blocked=frozenset()):
    """Smith–Waterman cục bộ. Trả (score, [(oi, cj)]) — cj là chỉ số TRONG DÃY GHÉP."""
    n, m = len(ocr), len(canon_norm)
    H = [[0.0] * (m + 1) for _ in range(n + 1)]
    B = [[0] * (m + 1) for _ in range(n + 1)]
    best = (0.0, 0, 0)
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            d = H[i - 1][j - 1] + (MISS if (j - 1) in blocked else _pair(ocr[i - 1], canon_norm[j - 1]))
            u = H[i - 1][j] + GAP
            l = H[i][j - 1] + MISS
            v = max(0.0, d, u, l)
            H[i][j] = v
            B[i][j] = 0 if v == 0 else (1 if v == d else 2 if v == u else 3)
            if v > best[0]:
                best = (v, i, j)
    score, i, j = best
    pairs = []
    while i > 0 and j > 0 and H[i][j] > 0:
        b = B[i][j]
        if b == 1:
            if (j - 1) not in blocked and _pair(ocr[i - 1], canon_norm[j - 1]) > 0:
                pairs.append((i - 1, j - 1))
            i -= 1
            j -= 1
        elif b == 2:
            i -= 1
        elif b == 3:
            j -= 1
        else:
            break
    pairs.reverse()
    return score, pairs


def align_row(tokens, canon):
    """tokens: [(text, x)] của MỘT dòng OCR, theo thứ tự. Trả dict: status, best, second, span, pairs (oi→chỉ số phẳng)."""
    ocr = [norm(t) for t, _ in tokens]
    empty = {"status": "UNMATCHED", "best": 0.0, "second": 0.0, "span": None, "pairs": {}, "n": len(ocr)}
    if len(ocr) < 1 or not canon.stream:
        return empty
    s1, p1 = _sw(ocr, canon.stream_norm)
    if not p1:
        return empty
    a, b = p1[0][1], p1[-1][1]
    s2, _ = _sw(ocr, canon.stream_norm, frozenset(range(max(0, a - 1), b + 2)))
    n = len(ocr)
    cover = len(p1) / n
    if s1 < 0.5 * 2 * n * 0.6 or cover < 0.5:
        status = "UNMATCHED"
    elif s2 >= 0.75 * s1:
        status = "AMBIGUOUS"
    else:
        status = "MATCH"
    return {"status": status, "best": round(s1, 2), "second": round(s2, 2),
            "span": (canon.stream[a], canon.stream[b]), "pairs": {oi: canon.stream[cj] for oi, cj in p1}, "n": n}


def resolve_tokens(row, canon):
    """Mỗi token OCR → (chỉ số phẳng | None, cách): 'direct' (khớp trực tiếp), 'interpolated' (nội suy từ hai phía đã khớp, CHỈ khi
    số token OCR giữa hai neo bằng đúng số token chuẩn), 'edge' (sát đầu/cuối hàng, lệch ≤ 1), hoặc None (không đủ chắc)."""
    n = row["n"]
    pairs = row["pairs"]
    mapped = sorted(pairs)
    out = []
    for k in range(n):
        if k in pairs:
            out.append((pairs[k], "direct"))
            continue
        left = max((m for m in mapped if m < k), default=None)
        right = min((m for m in mapped if m > k), default=None)
        res = (None, None)
        if left is not None and right is not None:
            il, ir = pairs[left], pairs[right]
            if ir - il == right - left:            # canonical liền mạch đúng bằng số token OCR → chắc chắn
                res = (il + (k - left), "interpolated")
        elif left is not None and k - left == 1:
            res = (pairs[left] + 1, "edge")
        elif right is not None and right - k == 1:
            res = (pairs[right] - 1, "edge")
        if res[0] is not None and not (0 <= res[0] < canon.total):
            res = (None, None)
        out.append(res)
    return out


def bar_token(resolved, xs, bar_x):
    """Token chuẩn CHỮ HÁT ĐẦU TIÊN sau vạch (chữ OCR đầu tiên có tâm x ≥ vạch). Trả (chỉ số phẳng | None, cách):
    'direct' | 'interpolated' | 'edge' | 'row_end' (không còn chữ nào sau vạch trong hàng) | 'unresolved'."""
    k = next((i for i, x in enumerate(xs) if x >= bar_x), None)
    if k is None:
        return None, "row_end"
    idx, how = resolved[k]
    if idx is None:
        return None, "unresolved"
    return idx, how


# ── Từ tài liệu OCR + hình học khuông → kế hoạch ghép (thuần, test được) ─────────────────────────────────────────

def doc_rows(doc, dims, min_tokens=3):
    """Tài liệu chord-extraction/1 → các dòng OCR theo trang: [[{"y": px, "tokens": [(text, x_px)]}]]. Mỗi dòng độc lập.
    dims[pi] = (W, H) px của ảnh mà hình học khuông đo trên đó. Toạ độ OCR là tỉ lệ 0..1 nên không phụ thuộc độ phân giải."""
    pages = []
    for pi, pg in enumerate(doc.get("pages", [])):
        W, H = dims[pi] if pi < len(dims) else (1, 1)
        rows = []
        for region in pg.get("regions", []):
            for ln in region.get("lines", []):
                toks = [t for t in ln.get("tokens", []) if norm(t.get("text", ""))]
                if len(toks) < min_tokens:
                    continue
                toks.sort(key=lambda t: t["bbox"][0])
                rows.append({"y": ln["bbox"][1] * H,
                             "tokens": [(t["text"], (t["bbox"][0] + t["bbox"][2] / 2) * W) for t in toks]})
        pages.append(rows)
    return pages


def plan_alignment(canon, rows_by_page, geos_by_page):
    """geos_by_page[pi] = [{"y1","y5","gap","bars":[x…]}] (khuông từ trên xuống). Gán dòng OCR vào khuông theo y (dải lời = từ đáy
    khuông tới đỉnh khuông kế), ghép TỪNG dòng độc lập với lời chuẩn. Trả:
      systems[(pi, si)] = {"rows": [row…], "primary": chỉ số hàng trên cùng đã MATCH | None}
      row = {status, best, second, span, y, xs, resolved}
    """
    systems = {}
    for pi, geos in enumerate(geos_by_page):
        rows = rows_by_page[pi] if pi < len(rows_by_page) else []
        for si, g in enumerate(geos):
            top = g["y5"]
            bottom = geos[si + 1]["y1"] if si + 1 < len(geos) else float("inf")
            band = sorted((r for r in rows if top - 0.5 * g["gap"] <= r["y"] < bottom), key=lambda r: r["y"])
            out = []
            for r in band:
                res = align_row(r["tokens"], canon)
                res.update({"y": r["y"], "xs": [x for _, x in r["tokens"]], "text_n": len(r["tokens"])})
                res["resolved"] = resolve_tokens(res, canon) if res["status"] == "MATCH" else [(None, None)] * res["n"]
                out.append(res)
            primary = next((i for i, r in enumerate(out) if r["status"] == "MATCH"), None)
            systems[(pi, si)] = {"rows": out, "primary": primary}
    return systems


def page_order(systems, n_pages):
    """Thứ tự trang theo NỘI DUNG: trang có hàng khớp ở đoạn lời sớm hơn đứng trước (trang không khớp giữ chỗ nguyên)."""
    keys = []
    for pi in range(n_pages):
        starts = [s["rows"][s["primary"]]["span"][0] for (p, _), s in systems.items() if p == pi and s["primary"] is not None]
        keys.append((min(starts) if starts else float("inf"), pi))
    return [pi for _, pi in sorted(keys)]


def system_bar(canon, system, bar_x):
    """Vạch → chữ chuẩn hát đầu tiên sau nó theo HÀNG CHÍNH của khuông. (chỉ số phẳng | None, cách)."""
    if system["primary"] is None:
        return None, "no_row"
    row = system["rows"][system["primary"]]
    idx, how = bar_token(row["resolved"], row["xs"], bar_x)
    if idx is not None:
        idx = canon.snap(idx) if how in ("direct", "interpolated", "edge") else idx
    return idx, how


def row_bar_candidates(canon, row, bars):
    """Ứng viên anchor của MỘT hàng (kể cả hàng không phải hàng chính): mỗi vạch → {line, token} chuẩn | None."""
    out = []
    for x in bars:
        idx, how = bar_token(row["resolved"], row["xs"], x)
        if idx is not None:
            idx = canon.snap(idx)
        out.append({"x": round(x, 1), "anchor": canon.at(idx) if idx is not None and idx < canon.total else None, "how": how})
    return out
