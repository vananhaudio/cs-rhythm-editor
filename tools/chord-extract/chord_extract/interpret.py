"""Diễn giải (suy ra TỪ quan sát, dựng lại được): metadata, hợp âm, khổ lời, bản nháp."""
import re


def all_lines(doc):
    for pg in doc["pages"]:
        for r in pg["regions"]:
            for ln in r["lines"]:
                yield pg, r, ln


def _field(value, ln, conf=None):
    return dict(value=value, evidence=[t["id"] for t in ln["tokens"]], source=ln["tokens"][0]["source"],
                confidence=ln["confidence"] if conf is None else conf)


def _draft_from(lines, links):
    by = {}
    for l in links:
        by.setdefault(l["lyricTokenId"], []).append(l["chordTokenId"])
    ctext = {t["id"]: t["text"] for ln in lines for t in ln["tokens"]}
    out = []
    for ln in lines:
        if ln["role"] != "lyric":
            continue
        parts = []
        for t in ln["tokens"]:
            parts += [f"[{ctext[c]}]" for c in by.get(t["id"], [])]
            parts.append(t["text"])
        out.append(" ".join(parts))
    return "\n".join(out)


def interpret(doc):
    meta, warnings = {}, []
    lines = list(all_lines(doc))
    first = [(pg, r, ln) for pg, r, ln in lines if pg["index"] == 1 and ln["tokens"]]
    cands = [(ln["bbox"][3], pg, r, ln) for pg, r, ln in first
             if r["kind"] in ("header", "text_body") and ln["bbox"][1] < 0.5 and ln["role"] in ("lyric", "other")
             and sum(len(t["text"]) for t in ln["tokens"]) >= 3]
    hs = sorted(ln["bbox"][3] for _, _, ln in first)
    med = hs[len(hs) // 2] if hs else 0
    if len(hs) >= 3:  # cần đủ dòng để có 'mặt bằng chữ' làm chuẩn
        cands = [c for c in cands if c[0] >= 1.2 * med]  # tiêu đề phải nổi hơn mặt bằng chữ của trang
    if cands:
        _, _, _, ln = max(cands, key=lambda c: c[0])
        meta["title"] = _field(" ".join(t["text"] for t in ln["tokens"]), ln)
    for pg, r, ln in first:
        m = re.search(r"(?:nhạc\s*(?:và|&)?\s*lời|sáng tác|nhạc|lời|st)\s*[:：\-–—.]\s*(.+)$", " ".join(t["text"] for t in ln["tokens"]), re.I)
        if m:
            meta["author"] = _field(m.group(1).strip(), ln)
            break
    for pg, r, ln in lines:
        txt = " ".join(t["text"] for t in ln["tokens"])
        m = re.search(r"(?:key|tone|tông)\s*[:=]?\s*([A-G][#b♯♭]?m?)\b", txt, re.I)
        if m and "key" not in meta:
            meta["key"] = _field(dict(text=m.group(1)), ln)
        m = re.search(r"[♩=]\s*=?\s*(\d{2,3})\b", txt)
        if m and "bpm" not in meta and 30 <= int(m.group(1)) <= 300:
            meta["bpm"] = _field(int(m.group(1)), ln)
    for k in ("title", "author", "key", "timeSignature", "bpm"):
        meta.setdefault(k, None)
    if meta["title"] is None:
        warnings.append(dict(code="TITLE_NOT_FOUND", message="Không nhận ra tiêu đề trên trang đầu."))
    n_chord = sum(1 for _, _, ln in lines for t in ln["tokens"] if t["kind"] == "chord")
    chords = dict(status="DETECTED" if n_chord else "NO_CHORDS_DETECTED", count=n_chord)
    # Khổ lời: khuông có k hàng lời; khổ i = hàng lời thứ i dưới mọi khuông (ước đoán theo bố cục).
    verses = {}
    for pg in doc["pages"]:
        for r in pg["regions"]:
            if r["kind"] != "lyric_block":
                continue
            for i, ln in enumerate([l for l in r["lines"] if l["role"] == "lyric"], start=1):
                verses.setdefault(i, []).append(ln["id"])
    structure = dict(verses=[dict(row=i, lineIds=ids) for i, ids in sorted(verses.items())],
                     note="khổ i = hàng lời thứ i dưới mỗi khuông (ước đoán theo bố cục)") if verses else None
    links = [l for pg in doc["pages"] for l in pg["links"]]
    if chords["status"] == "DETECTED":
        text = _draft_from([ln for _, _, ln in lines], links)
    elif structure:
        idmap = {ln["id"]: ln for _, _, ln in lines}
        text = "\n\n".join(f"{v['row']}. " + "\n".join(" ".join(t["text"] for t in idmap[i]["tokens"]) for i in v["lineIds"]) for v in structure["verses"])
    else:
        text = "\n".join(" ".join(t["text"] for t in ln["tokens"]) for _, _, ln in lines if ln["role"] == "lyric")
    if chords["status"] == "NO_CHORDS_DETECTED":
        warnings.append(dict(code="NO_CHORDS_DETECTED", message="Không thấy hợp âm in trên trang."))
    return dict(metadata=meta, chords=chords, structure=structure, draft=dict(text=text, warnings=warnings, reviewRequired=True))
