# chord_extract — PDF/ảnh sheet → `chord-extraction/1` (Slice 1, ENGINE ONLY)

Đọc một file sheet (PDF/JPEG/PNG/WebP) thành JSON canonical trung lập engine, để Thư viện hợp âm dùng làm đầu vào. **Chưa nối DB, UI, worker production.**

```
PDF → classify từng trang
        ├ text (có text layer tốt) → pdftotext-bbox → từ/bbox → dòng → hợp âm nối với chữ
        └ scan/mixed → ảnh nhúng → khuông (hình học) → OCR local tiếng Việt theo dải lời → dòng/token + confidence
   → interpretation (metadata, hợp âm, khổ lời, bản nháp)
   → fallback.decide(): lý do + số đo → (nếu có lý do VÀ có provider) Vision → merge → draft (luôn cần người duyệt)
```

## Dùng
```bash
python3 -m chord_extract file.pdf --out out.json [--validate] [--vision none|claude-cli|anthropic-api] [--vision-model M] [--force-vision]
```
Cần: `pdfinfo/pdftotext/pdfimages/pdftoppm` (poppler), `tesseract` + gói `vie` (`CHORD_EXTRACT_TESSDATA` nếu để ngoài mặc định), numpy, Pillow. Thiếu gói `vie` → lỗi RÕ (không âm thầm OCR bằng tiếng khác: `eng` cho CER 31% trên Tình ca).
Vision **mặc định tắt**; chạy khi `pipeline.fallbackReasons` không rỗng và có provider.

## Quy tắc không thoả hiệp
- Hợp âm chỉ là chữ ĐƯỢC IN. Không in → `NO_CHORDS_DETECTED`. Không suy hoà âm, Vision không được thêm hợp âm vào token.
- Hình học (trang/khuông/dòng/bbox) luôn từ local. Vision chỉ sửa chữ, metadata, nhịp/khoá.
- Tên engine/provider/model/version chỉ nằm ở `pipeline.stages`; token chỉ có `source: text_layer|local_ocr|vision`.
- Mọi ngưỡng là cấu hình (`config.py`), ghi vào `pipeline.config`; số đo ở `pipeline.metrics`; lý do ở `pipeline.fallbackReasons[]`.
- API key chỉ đọc từ môi trường PROCESS worker (`ANTHROPIC_API_KEY`); không bao giờ ở browser/mã nguồn/log. `claude-cli` chỉ dùng dev/test.

## Test
```bash
pip install -r tools/chord-extract/requirements-dev.txt
npm run test:chord-extract
```
Test tổng hợp chạy ở mọi nơi. Test corpus cần file ngoài repo (bản nhạc có bản quyền; repo công khai): `CHORD_EXTRACT_CORPUS` (mặc định `~/Documents/VAA-Work-In-Progress/chord-library-pdf-extract/corpus`), kiểm sha256 theo `tests/chord-extract/corpus.manifest.json`; thiếu → SKIP có lý do.

## Hợp đồng
`contract/chord-extraction.schema.json` (JSON Schema 2020-12). QUAN SÁT (`pages[]`) tách khỏi DIỄN GIẢI (`interpretation`); toạ độ chuẩn hoá 0..1; `links[]` nối hợp âm → token lời kèm offset (nền cho anchors).

## Giới hạn đã biết / corpus còn thiếu
Xem báo cáo Slice 1. Còn thiếu mẫu: scan CÓ hợp âm; hợp âm chen trong lời; mixed; text PDF không hợp âm (có test tổng hợp thay thế một phần).
