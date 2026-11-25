# CLASS_UNLOCK_POLICY_V1 — tách "điểm nộp bài" (checkpoint) khỏi "mở khoá tuần tự" (unlock)

Trạng thái: **bản thử trên nhánh `wip/macbook/ht-tra-bai-open-policy-20261030`. Chưa merge, chưa chạy production, chưa deploy.**

## Vấn đề
Hiện hai khái niệm dính nhau: lớp có ≥ 1 khối `checkpoint` đã xuất bản → toàn lớp vào **chế độ bài trả**, và chế độ đó **luôn** khoá tuần tự
(`lsp_sync` chỉ mở Buổi 1; `lsp_try_complete` chỉ mở buổi kế khi mọi bài trả bắt buộc của buổi trước ĐẠT; buổi không có bài bắt buộc **không bao giờ**
hoàn thành → chuỗi đứng). Hành Trình cần nút Trả bài nhưng học viên phải học được mọi buổi đã được cấp quyền.

## Thiết kế (thay đổi tối thiểu, tương thích ngược)
- **Một cột:** `class_schedule.unlock_policy` ∈ {`sequential` (mặc định) · `open`}. Mọi lớp hiện có giữ `sequential` ⇒ **hành vi Solo không đổi**.
- **`lsp_sync`** (hàm nội bộ): nếu lớp `open` → tạo tiến độ (mở) cho MỌI buổi lesson **đã xuất bản**. "Mở" vẫn là một dòng `learning_session_progress`,
  nên `lt_submit_checkpoint` / `lt_answer_checkpoint` (đã kiểm "buổi đã mở") **không phải sửa**. Hoàn thành buổi vẫn được ghi nhận khi đủ bài ĐẠT.
- **`class_learning_state`**: thêm `unlock_policy`, `pace_days` (= 0 khi `open`: không nhịp tuần), `start_at` từng buổi (để chọn buổi hiện tại theo lịch).
- **Giao diện (dùng chung Web + Mobile):** `sessionPhase`/`sessionBadge`/`currentSessionNo`/`sessionPace` nhận chính sách; lớp `open`: không 🔒, buổi nháp ghi "Đang soạn",
  không "Đang học"/nhịp tuần; Admin không ép "mỗi buổi phải có bài trả bắt buộc" cho lớp `open`.
- **Không có** hệ nộp bài/bảng mới: dùng nguyên `learning_threads` (`program_checkpoint`), hàng đợi Thầy `/me/queue`, `/me/t/<id>`.

## Không làm
- Không đổi chính sách lớp nào trong migration. Đặt `open` là **một UPDATE dữ liệu riêng** (Owner duyệt).
- Không đổi giáo án đã duyệt. Bài trả Hành Trình là **lớp phủ** `src/data/ht2027/traBai.ts` (ghép lúc xuất bản).

## Thứ tự triển khai an toàn (mỗi bước cần Owner duyệt)
1. Deploy frontend (đọc `unlock_policy`; thiếu → `sequential`). Frontend mới chạy được với DB cũ.
2. `prod-db.py query db/class_unlock_policy_v1_preflight.sql` → GATE PASS → `dryrun` → `migrate … --confirm wojmdilyflffvdtpovmq` → `query …_postflight.sql` GATE PASS.
3. `update public.class_schedule set unlock_policy = 'open' where code = 'HT2027.TH01';` (chỉ lớp Hành Trình).
4. Xuất bản/ghép bài trả cho Hành Trình (Admin). **Không làm bước 4 trước bước 3**: lớp `sequential` có checkpoint sẽ khoá chuỗi ở Buổi 1.
5. App native: bản cũ vẫn chạy (bỏ qua trường mới): lớp `open` hiện 🔒/"cần trả bài" cho buổi CHƯA xuất bản; buổi đã xuất bản vẫn mở và nộp bài được. Muốn hết nhãn sai → build mới.

## Rollback
`db/class_unlock_policy_v1_rollback.sql`: hai hàm về đúng md5 trước; gỡ cột chỉ khi mọi lớp `sequential`; **không xoá tiến độ** (buổi đã mở theo `open` vẫn mở).

## Kiểm thử
- DB: `bash scripts/test-class-unlock-policy-db.sh` (cluster PostgreSQL 17 tạm): md5 cổng · preflight · setup ×2 · postflight · ca nghiệp vụ (mặc định giữ nguyên; open mở mọi buổi đã xuất bản, buổi nháp không mở;
  trả bài khi chưa xong buổi trước; chấm Đạt hoàn thành đúng buổi; Thầy không nộp; ngoài lớp bị chặn; lớp khác không ảnh hưởng; đổi lại sequential giữ lịch sử; ca Hành Trình) · rollback có/không dữ liệu · cài lại · drift.
- FE: `npm run test:class-social` (`unlock-policy.test.ts`, `ht-tra-bai.test.ts`).

## Hiệu chỉnh 30/10/2026 (phát hiện khi chạy preflight production)
Preflight production báo `lsp_sync` md5 `85655a79…` ≠ bản V1 (`c85a6a52…`): production đã áp dụng `db/class_session_zero_intro.sql` (Buổi 0). Cổng md5 đã dừng migration đúng thiết kế. Migration + rollback + test nay dựa trên bản **Buổi 0** (md5 `85655a791d24a9a0997d94bcbe6687a3`); `class_learning_state` giữ md5 QUIZ `db9015ea…` (khớp production). Test DB 46 PASS gồm ca Buổi 0 + lớp `open`.

## STAGE_OPEN_V1 — buổi mở đầu chặng (Owner chốt 25/11/2026)
- Buổi số nhỏ nhất của mỗi chặng (`class_stages`; xếp chặng như `stageOf`: `stage_id`, không có thì khoảng `from_session..to_session`) **chỉ phụ thuộc Thầy mở cho lớp**, không phụ thuộc chặng trước. Các buổi sau trong chặng giữ cơ chế tiến độ.
- "Mở" = Thầy bấm ở trang buổi (`class_lesson_set_hold(buổi, false)` → ghi `tva_private.class_stage_opening`). **Xuất bản mà chưa bấm mở thì học viên vẫn không đọc được**, dù không có dòng khoá.
- Không áp: lớp `open`, lớp chưa có bài trả (chỉ đọc), buổi đầu của cả chương trình.
- Gỡ dòng khoá bằng SQL KHÔNG đủ để mở một buổi mở đầu chặng — dùng nút của Thầy.
- Tiến độ/hoàn thành chặng cũ không bị sửa. Migration `db/stage_open_v1_setup.sql` · hoàn tác `db/stage_open_v1_rollback.sql` (cần `lesson_hold_v2`).

## STAGE_OPEN_SCOPE_V2 — phạm vi và lối vào chặng mới (25/11/2026)

- Quy tắc mở đầu chặng **chỉ áp cho chương trình khai trong `tva_private.stage_open_program`** (đã duyệt: `SOLO01`). Khai `class_stages` không tự làm
  một lớp có chặng độc lập về sư phạm: CB1/CB2 chia khối 4 buổi và giữ nguyên cơ chế tiến độ. Thêm chương trình mới phải được Thầy duyệt.
  File: `db/stage_open_scope_v2_setup.sql` (+ `_rollback.sql`). Chạy lại `stage_open_v1_setup.sql` sẽ ghi đè phạm vi → chạy lại file V2 ngay sau đó.
- Học viên: khi Thầy đã mở đầu chặng mới, buổi hiện tại chỉ xét từ chặng đó trở đi; mục lục bung chặng mới; đầu trang lớp có nút vào buổi mở đầu
  (ẩn khi đã hoàn thành buổi đó). Chỉ trình bày — bài và tiến độ chặng cũ giữ nguyên, vẫn học tiếp được.
