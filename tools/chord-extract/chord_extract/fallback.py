"""Quyết định có cần Vision hay không — luôn kèm LÝ DO giải thích được (`fallbackReasons[]`) và số đo (`metrics`).
Vision không bao giờ chạy âm thầm: không có lý do → không chạy. Ngưỡng nằm ở FallbackConfig (chưa hiệu chuẩn)."""
from collections import Counter

from .roles import looks_vi

LOW_OCR_CONFIDENCE = "LOW_OCR_CONFIDENCE"
HIGH_NOISE_RATIO = "HIGH_NOISE_RATIO"
STAFF_LYRIC_MISMATCH = "STAFF_LYRIC_MISMATCH"
METADATA_MISSING = "METADATA_MISSING"
USER_REQUESTED = "USER_REQUESTED"
NO_TEXT_RECOGNIZED = "NO_TEXT_RECOGNIZED"
CODES = (LOW_OCR_CONFIDENCE, HIGH_NOISE_RATIO, STAFF_LYRIC_MISMATCH, METADATA_MISSING, USER_REQUESTED, NO_TEXT_RECOGNIZED)


def _title_ok(field, min_conf):
    if not field:
        return False
    toks = field["value"].split()
    if not toks or sum(looks_vi(t) for t in toks) / len(toks) < 0.6:
        return False
    return field["confidence"] is None or field["confidence"] >= min_conf


def measure(doc, cfg):
    """Số đo trên kết quả LOCAL — chỉ tính trang OCR (trang text layer chính xác tuyệt đối, không cần Vision)."""
    ocr_pages = [p for p in doc["pages"] if p["method"] == "local_ocr"]
    ocr_tokens = sum(len(ln["tokens"]) for p in ocr_pages for r in p["regions"] for ln in r["lines"])
    lyric_conf, noise, total, staves, rows_per_system = [], 0, 0, 0, []
    for p in ocr_pages:
        staves += sum(1 for r in p["regions"] if r["kind"] == "staff_system")
        for r in p["regions"]:
            if r["kind"] == "header":
                continue
            for ln in r["lines"]:
                if not ln["tokens"]:
                    continue
                total += 1
                if ln["role"] == "lyric" and ln["confidence"] is not None:
                    lyric_conf.append(ln["confidence"])
                elif ln["role"] == "other":
                    noise += 1
            if r["kind"] == "lyric_block":
                rows_per_system.append(sum(1 for ln in r["lines"] if ln["role"] == "lyric"))
    modal = Counter(rows_per_system).most_common(1)[0][0] if rows_per_system else 0
    meta = doc["interpretation"]["metadata"]
    return dict(
        ocrPages=len(ocr_pages), ocrTokens=ocr_tokens, staffSystems=staves,
        meanLyricConfidence=round(sum(lyric_conf) / len(lyric_conf), 3) if lyric_conf else None,
        noiseRatio=round(noise / total, 3) if total else None,
        lyricRowsPerSystem=rows_per_system, modalRows=modal,
        irregularSystems=sum(1 for n in rows_per_system if n != modal),
        titleOk=_title_ok(meta.get("title"), cfg.min_title_confidence),
        hasTimeSignature=meta.get("timeSignature") is not None, hasKey=meta.get("key") is not None,
    )


def decide(doc, cfg):
    """→ (reasons, metrics). reasons rỗng = không cần Vision."""
    m = measure(doc, cfg)
    reasons = []
    if cfg.force_vision:
        reasons.append(dict(code=USER_REQUESTED, detail="Người dùng yêu cầu phân tích chính xác hơn."))
    if m["ocrPages"] and m["ocrTokens"] == 0:
        reasons.append(dict(code=NO_TEXT_RECOGNIZED, detail="OCR không nhận ra chữ nào trên các trang scan.", metric="ocrTokens", value=0, threshold=1))
    if m["ocrPages"]:
        if m["meanLyricConfidence"] is not None and m["meanLyricConfidence"] < cfg.min_mean_lyric_confidence:
            reasons.append(dict(code=LOW_OCR_CONFIDENCE, detail="Độ tin cậy trung bình của dòng lời OCR thấp.",
                                metric="meanLyricConfidence", value=m["meanLyricConfidence"], threshold=cfg.min_mean_lyric_confidence))
        if m["noiseRatio"] is not None and m["noiseRatio"] > cfg.max_noise_ratio:
            reasons.append(dict(code=HIGH_NOISE_RATIO, detail="Tỉ lệ dòng nhiễu (không phải lời/hợp âm) cao.",
                                metric="noiseRatio", value=m["noiseRatio"], threshold=cfg.max_noise_ratio))
        if m["staffSystems"] and m["irregularSystems"] > cfg.max_irregular_systems:
            reasons.append(dict(code=STAFF_LYRIC_MISMATCH, detail="Số hàng lời dưới các khuông không đều (có khuông thiếu/thừa hàng).",
                                metric="irregularSystems", value=m["irregularSystems"], threshold=cfg.max_irregular_systems))
        missing = []
        if not m["titleOk"]:
            missing.append("title")
        if m["staffSystems"] and cfg.require_notation_fields:
            missing += [k for k, ok in (("timeSignature", m["hasTimeSignature"]), ("key", m["hasKey"])) if not ok]
        if missing:
            reasons.append(dict(code=METADATA_MISSING, detail="Thiếu/không đủ tin cậy: " + ", ".join(missing), metric="missingFields", value=missing))
    return reasons, m
