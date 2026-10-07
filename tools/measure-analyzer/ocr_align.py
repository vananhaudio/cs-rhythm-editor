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
    """Mỗi token OCR → (chỉ số phẳng | None, cách):
      'direct'       khớp trực tiếp với một token chuẩn;
      'interpolated' nội suy từ hai neo đã khớp — CHỈ khi số token OCR giữa hai neo bằng ĐÚNG số token chuẩn giữa hai neo;
      'edge'         sát đầu/cuối hàng, lệch ≤ 1 và vẫn CÙNG DÒNG chuẩn với neo;
      'noise'        chữ OCR thừa, bị bỏ qua — chỉ khi lời chuẩn không còn chỗ nào để nó là chữ thật:
                       (A) nằm giữa hai neo mà hai token chuẩn LIỀN NHAU (tiến trình chuẩn liên tục, không còn token nào ở giữa);
                       (B) sau token chuẩn CUỐI CÙNG của cả bài, hoặc trước token chuẩn ĐẦU TIÊN của cả bài (ngoài biên lời chuẩn).
      None           không đủ chắc → unresolved / review, KHÔNG đoán. Độ giống thấp KHÔNG phải lý do để coi là nhiễu: một chữ OCR
                     hỏng nhưng vẫn có thể là lời thật (đứng giữa dòng, hoặc ở cuối một dòng chuẩn còn dòng sau) thì không bị bỏ."""
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
            elif ir - il == 1:                      # hai neo liền nhau trong lời chuẩn → mọi chữ OCR ở giữa là thừa
                res = (None, "noise")
        elif left is not None:
            il = pairs[left]
            if il + 1 >= canon.total:               # hết lời chuẩn: không còn token nào để chữ này là lời thật
                res = (None, "noise")
            elif k - left == 1 and canon.flat[il + 1][0] == canon.flat[il][0]:
                res = (il + 1, "edge")
        elif right is not None:
            ir = pairs[right]
            if ir == 0:                             # trước token chuẩn đầu tiên của cả bài
                res = (None, "noise")
            elif right - k == 1 and canon.flat[ir - 1][0] == canon.flat[ir][0]:
                res = (ir - 1, "edge")
        out.append(res)
    return out


def bar_token(resolved, xs, bar_x):
    """Token chuẩn CHỮ HÁT ĐẦU TIÊN sau vạch (chữ OCR đầu tiên có tâm x ≥ vạch, bỏ qua chữ 'noise'). Trả (chỉ số phẳng | None, cách):
    'direct' | 'interpolated' | 'edge' | 'row_end' (không còn chữ hát nào sau vạch trong hàng) | 'unresolved'."""
    k = next((i for i, x in enumerate(xs) if x >= bar_x), None)
    while k is not None and k < len(xs) and resolved[k][1] == "noise":
        k += 1
    if k is None or k >= len(xs):
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


REPAIR_REASON = "cross_system_single_token_continuity"


def repair_cross_system(canon, plan, order):
    """SỬA CHỮA LIÊN TỤC XUYÊN KHUÔNG: ĐÚNG MỘT token chuẩn bị mất ở ranh giới hai khuông liền nhau (theo `order` của trang), khi hai
    phía của dãy chuẩn xác định duy nhất token đó. Lý do là liên tục của dãy (N → N+1 → N+2), KHÔNG phải độ giống chữ OCR.
    Chỉ sửa khi ĐỒNG THỜI:
      1. hai khuông liền nhau, cả hai có hàng chính; xét ĐẦU hàng chính của khuông sau;
      2. chữ OCR đầu hàng chưa gán (None, None) — không phải 'noise', không phải đã gán 'edge';
      3. chữ OCR CUỐI hàng chính khuông trước được gán 'direct' = N (neo tin cậy, hàng không kết thúc bằng chữ chưa gán);
      4. chữ OCR ngay sau chữ đầu hàng sau được gán 'direct' = M (neo tin cậy);
      5. trong DÃY GHÉP (đã bỏ nhãn khổ), M cách N đúng 2 vị trí → chỉ thiếu đúng token ở giữa; nhãn khổ không bao giờ là ứng viên;
      6. chữ OCR chưa gán nằm hình học trước M (hàng OCR đã xếp theo x) và là chữ DUY NHẤT chưa gán ở đó;
      7. token thiếu chưa được BẤT KỲ hàng nào của bất kỳ khuông nào nhận (không tranh chấp) → một nghiệm duy nhất.
    Thoả hết → gán chữ đầu hàng = token thiếu ('continuity') và nới span hàng tới token đó. Trả danh sách sửa chữa (không chứa chữ lời)."""
    keys = [(pi, si) for pi in order for si in sorted(s for (p, s) in plan if p == pi)]
    pos = {idx: k for k, idx in enumerate(canon.stream)}
    claimed = {a for sy in plan.values() for r in sy["rows"] for a, _ in r["resolved"] if a is not None}
    repairs = []
    for ka, kb in zip(keys, keys[1:]):
        sa, sb = plan[ka], plan[kb]
        if sa["primary"] is None or sb["primary"] is None:
            continue
        ra, rb = sa["rows"][sa["primary"]], sb["rows"][sb["primary"]]
        if ra["n"] < 1 or rb["n"] < 2:
            continue
        n_idx, n_how = ra["resolved"][-1]
        m_idx, m_how = rb["resolved"][1]
        if rb["resolved"][0] != (None, None) or n_how != "direct" or m_how != "direct":
            continue
        if n_idx not in pos or m_idx not in pos or pos[m_idx] - pos[n_idx] != 2:
            continue
        missing = canon.stream[pos[n_idx] + 1]
        if canon.label[missing] or missing in claimed:
            continue
        rb["resolved"][0] = (missing, "continuity")
        rb["span"] = (min(rb["span"][0], missing), rb["span"][1])
        rb.setdefault("repairs", {})[0] = REPAIR_REASON
        claimed.add(missing)
        repairs.append({"page": kb[0], "system": kb[1], "index": 0, "canonical": missing, "reason": REPAIR_REASON})
    return repairs


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
