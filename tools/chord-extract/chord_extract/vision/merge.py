"""Hợp nhất VISION + LOCAL (provider-agnostic). Quy tắc cố định:

1. HÌNH HỌC (trang, vùng, khuông, dòng, bbox) luôn từ local. Vision không bao giờ là nguồn bbox.
2. CHỮ lời: thay token OCR bằng chữ Vision CHỈ khi số khuông của trang và số hàng lời từng khuông khớp local.
   Không khớp → giữ OCR + cảnh báo (không đoán ghép). bbox token Vision = chia ước lượng theo độ dài chữ trong bbox dòng local (bboxEstimated).
   Trang text layer không bao giờ bị Vision đụng tới.
3. METADATA: Vision điền chỗ local trống. Hai bên khác nhau: local thắng nếu tin cậy ≥ metadata_prefer_local_conf, không thì Vision thắng;
   giá trị thua luôn ghi ở `alt`, cộng cảnh báo METADATA_CONFLICT. Nhịp/khoá chỉ Vision cung cấp được (local không đọc ký hiệu khuông).
4. HỢP ÂM: Vision KHÔNG được thêm hợp âm vào token (không có hình học để kiểm chứng). Local NO_CHORDS_DETECTED mà Vision báo có →
   trạng thái UNKNOWN + cảnh báo VISION_CHORDS_UNVERIFIED (người xem lại), tuyệt đối không tự điền.
"""
import copy

from ..interpret import interpret
from ..util import fold


def _alt(value, source, confidence):
    return dict(value=value, source=source, confidence=confidence)


def _pick(local, vision_value, cfg, name, warnings):
    """local: field|None; vision_value: giá trị Vision|None → field|None."""
    if vision_value is None:
        return local
    vfield = dict(value=vision_value, evidence=[], source="vision", confidence=None)
    if local is None:
        return vfield
    if fold(str(local["value"])).lower().strip() == fold(str(vision_value)).lower().strip():
        return local
    keep_local = local["confidence"] is not None and local["confidence"] >= cfg.metadata_prefer_local_conf
    winner, loser = (local, vfield) if keep_local else (vfield, local)
    out = dict(winner)
    out["alt"] = [_alt(loser["value"], loser["source"], loser["confidence"])]
    warnings.append(dict(code="METADATA_CONFLICT", message=f"{name}: local và Vision khác nhau — chọn {out['source']}; giá trị còn lại ở alt."))
    return out


def merge_vision(doc, result, page_indexes, cfg):
    """→ (doc mới, warnings). `page_indexes` = các trang đã gửi cho Vision, theo thứ tự ảnh."""
    doc = copy.deepcopy(doc)
    warnings = []
    by_index = {p["index"]: p for p in doc["pages"]}
    if len(result.pages) != len(page_indexes):
        warnings.append(dict(code="VISION_PAGE_COUNT_MISMATCH", message=f"Vision trả {len(result.pages)} trang, đã gửi {len(page_indexes)}."))
    else:
        for idx, vp in zip(page_indexes, result.pages):
            pg = by_index[idx]
            if vp.printed_page_number:
                pg["printedPageNumber"] = vp.printed_page_number
            if pg["method"] != "local_ocr":
                continue
            blocks = [r for r in pg["regions"] if r["kind"] == "lyric_block"]
            if len(blocks) != len(vp.systems):
                warnings.append(dict(code="VISION_SYSTEM_COUNT_MISMATCH", page=idx, message=f"Trang {idx}: local {len(blocks)} khuông, Vision {len(vp.systems)}."))
                continue
            for blk, rows in zip(blocks, vp.systems):
                lyr = [ln for ln in blk["lines"] if ln["role"] == "lyric"]
                if len(lyr) != len(rows):
                    warnings.append(dict(code="VISION_ROW_COUNT_MISMATCH", page=idx, system=blk.get("systemIndex"),
                                         message=f"Trang {idx}, khuông {blk.get('systemIndex')}: local {len(lyr)} hàng, Vision {len(rows)}."))
                    continue
                for ln, text in zip(lyr, rows):
                    words = text.split()
                    if not words:
                        continue
                    x0, y0, w, h = ln["bbox"]
                    total = sum(len(t) for t in words) or 1
                    cx, toks = x0, []
                    for i, t in enumerate(words):
                        tw = w * len(t) / total
                        toks.append(dict(id=f"{ln['id']}-v{i}", text=t, bbox=[round(cx, 5), y0, round(tw, 5), h], confidence=None,
                                         kind="word", source="vision", bboxEstimated=True))
                        cx += tw
                    ln["tokens"], ln["confidence"] = toks, None

    interp = interpret(doc)
    meta = interp["metadata"]
    meta["title"] = _pick(meta.get("title"), result.title, cfg, "title", warnings)
    meta["author"] = _pick(meta.get("author"), result.author, cfg, "author", warnings)
    if result.time_signature and meta.get("timeSignature") is None:
        meta["timeSignature"] = dict(value=dict(beats=result.time_signature[0], beatType=result.time_signature[1]), evidence=[], source="vision", confidence=None)
    if result.key_fifths is not None:
        if meta.get("key") is None:
            meta["key"] = dict(value=dict(fifths=result.key_fifths), evidence=[], source="vision", confidence=None)
        else:
            meta["key"]["alt"] = [_alt(dict(fifths=result.key_fifths), "vision", None)]
    if result.directions:
        meta["directions"] = dict(value=result.directions, evidence=[], source="vision", confidence=None)

    status = interp["chords"]["status"]
    if status == "NO_CHORDS_DETECTED" and (result.chord_status == "DETECTED" or result.chord_symbols):
        interp["chords"]["status"] = "UNKNOWN"
        warnings.append(dict(code="VISION_CHORDS_UNVERIFIED", message="Vision báo có hợp âm nhưng local không thấy: không tự điền, cần người xem lại ảnh gốc.",
                             symbols=result.chord_symbols[:30]))
    elif status == "DETECTED" and result.chord_status == "NO_CHORDS_DETECTED":
        warnings.append(dict(code="VISION_CHORDS_DISAGREE", message="Vision báo không có hợp âm nhưng local phát hiện — giữ kết quả local."))

    interp["draft"]["warnings"] = [w for w in interp["draft"]["warnings"] if not (w["code"] == "NO_CHORDS_DETECTED" and interp["chords"]["status"] == "UNKNOWN")] + warnings
    doc["interpretation"] = interp
    return doc, warnings
