# Chord extraction — Slice 2A (DB + worker, KHÔNG UI)

Đường server: `file nguồn đã nạp → worker /extract-content → engine chord_extract → chord-extraction/1 → lưu → đọc lại`.
Chưa tạo bản nháp, chưa đổi editor. **Chưa chạy migration production, chưa deploy** (xem PRE-MIGRATION GATE trong báo cáo Slice 2A).

## DB — `db/chord_library_v1_3_extractions_setup.sql` (+ `_rollback.sql`, test `scripts/test-chord-extraction-db.sh`)
- Bảng `chord_sheet_extractions`: 1 hàng = 1 lần chạy engine trên 1 file nguồn (`version_id`, `source_index` → `sources[source_index]`, đã chụp path/mime/sha256).
  Bất biến sau khi kết thúc (trigger); chạy lại = hàng mới (`rerun_of`). JSONB trong DB (đo corpus: 37–225 KB JSON, 10–41 KB lưu thực).
- Vòng đời `running (lease 5′) → succeeded | failed(error_code đóng)`; quá lease mà còn running ⇒ ĐỌC ra `failed/abandoned`.
- Chống trùng: `request_key` = sha256(version | source_index | sha256 file | schema | engine_version | config_hash); begin() trả lại lần chạy thành công/đang chạy cùng khoá; `p_force` mới tạo hàng mới; trần 10 lần/giờ/phiên bản.
- Quyền: chỉ `chordlib` review (thầy/admin); RLS bật không policy; RPC `chord_extraction_{begin,complete,fail,get,list}` (SECURITY DEFINER).
- `db/rls_setup.sql`: thêm bảng vào `self_managed`.

## Worker — `services/measure-analyzer/extract.ts` (cùng tiến trình với analyzer; analyzer KHÔNG đổi)
`POST /extract-content {versionId, sourceIndex, force?, forceVision?}` + `Authorization: Bearer <JWT người dùng>`; trả 202 (đã bắt đầu) / 200 (trùng) ngay,
việc chạy ở nền; trình duyệt đọc kết quả bằng RPC `chord_extraction_get`. Không service-role; không nhận URL/đường dẫn/khoá Vision từ browser.
Cấu hình (env của service, KHÔNG trong repo): `MA_EXTRACT_DIR` (bật tính năng; = `<release>/chord-extract`), `MA_EXTRACT_PYTHON`, `MA_EXTRACT_TESSDATA` (gói `vie`),
Vision (tuỳ chọn, mặc định TẮT): `MA_EXTRACT_VISION_MODEL` + `ANTHROPIC_API_KEY`.
Mac mini cần thêm: `tesseract` + gói `vie` (chưa có ở đó — việc của giai đoạn triển khai, không phải Slice 2A).

## Mô hình tin cậy của observation (V1 — Owner chấp nhận 06/10/2026)
DB **không** tự chứng minh `observation/interpretation/pipeline` thật sự được sinh từ file nguồn: các cột này do worker gửi qua RPC bằng JWT người gọi.
DB chỉ kiểm: người gọi là chủ lần chạy + có quyền review, khuôn tài liệu, kích thước ≤ 4 MB, `input_sha256` = sha256 khai ở phiên bản, `engine_version` khớp lúc begin.
Không thêm bí mật worker ↔ DB (cơ chế xác thực thứ hai) vì: quyền ghi chỉ thầy/admin (vốn gõ được lời tuỳ ý), extraction chỉ là dữ liệu phân tích trung gian,
không phải bản chuẩn, bản nháp vẫn cần người duyệt, và worker tự tải file, kiểm magic bytes + sha256.
**XEM LẠI** nếu mở extraction cho học viên, cho worker bên ngoài, hoặc nếu extraction trở thành đầu vào tự động duyệt.
