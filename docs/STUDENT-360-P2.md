# Student 360° — P2 giao diện giáo viên

Trạng thái: nhánh `feat/student-360-p2` (từ main 577dd7f9). **Chưa merge, chưa deploy, chưa migrate production.**
Nền: [STUDENT-360-P1.md](STUDENT-360-P1.md) (DB/RPC đã LIVE trên production).

## Kiến trúc
- Hồ sơ giáo viên = `src/StudentProfile.tsx` (khoá theo `edu_students.id`), mở từ `/admin` → Học viên và `/student?id=`.
  Class Mobile (5 tab) là giao diện **học viên**, không chứa màn này; trên điện thoại giáo viên dùng cùng component (bố cục co giãn).
- Thêm đúng một tab **"🧭 Thấu hiểu"** vào StudentProfile (3 sửa nhỏ + 1 khối render). Không thêm trang, không hệ thống hồ sơ thứ hai.
- `src/student360/`: `types.ts` (kiểu khớp RPC) · `api.ts` (lớp gọi RPC có kiểu, dịch lỗi sang tiếng Việt, không import supabase) ·
  `client.ts` (gắn Supabase client dùng chung, JWT người dùng, không service role) · `model.ts` (nhãn/nhóm/xác minh thuần) ·
  `Student360Panel.tsx` (giao diện).
- Dữ liệu Class **không sao chép**: phần "Tổng quan nhanh" hiển thị trực tiếp từ bản ghi `edu_students` mà StudentProfile đã tải;
  lớp, bài nộp, tiến độ vẫn ở các tab hiện có.

## Giáo viên làm được gì
Xem theo 6 nhóm · thêm (3 nguồn: học viên nói / Thầy ghi nhận / Thầy suy đoán — luôn bắt đầu "Chưa xác minh") · sửa (về "Chưa xác minh") ·
xác minh / bỏ xác minh · **cho học viên xem / chỉ giáo viên** · xem lịch sử (nội dung trước/sau) · thu hồi (có xác nhận + lý do, không xoá cứng) ·
xem cả mục đã thu hồi.
Mỗi mục ghi bằng CHỮ: nguồn · loại thông tin · mức xác minh · phạm vi hiển thị · thời điểm. Suy luận luôn là "Suy luận · <mức xác minh>".
Giao diện KHÔNG hiển thị `source_ref` (con trỏ nội bộ tới CRM).

## Thay đổi backend (cần migration RIÊNG — chưa áp production)
P1 **chưa có** RPC đổi phạm vi hiển thị → thêm `student_360_set_visibility(p_fact, p_visibility)`:
`db/student_360_p2_setup.sql` (không có begin/commit, chạy bằng prod-db.py), `_rollback.sql`, `_preflight.sql`, test `db/tests/student_360_p2_test.sql`.
Chỉ Thầy · chỉ mục còn hiệu lực · ghi nhật ký · idempotent · không đổi verification/origin · học viên và anon không gọi được.
Không đụng bảng/RLS P1. Rollback P2 trước P1.
**Giao diện hoạt động đầy đủ chỉ sau khi migration P2 được áp**; trước đó nút "Cho học viên xem" báo lỗi (không có hàm) — các thao tác còn lại dùng RPC P1 đã LIVE.

## Liên kết Zalo — chỉ thiết kế, chưa hiển thị gì
Hiện trạng: 413 liên kết nằm ở SQLite CRM trên Mac mini (`identity_link`: 10 `owner_confirmed`, 403 `rule_matched`). Class (Netlify/Supabase)
không có đường an toàn nào tới CRM (CRM chỉ nghe 127.0.0.1) và browser không được nối thẳng SQLite. → **UI không hiện trạng thái liên kết**,
không số liệu giả.
Hợp đồng dữ liệu đề xuất (P3, cần Owner duyệt): CRM chủ động ĐẨY ra ngoài (outbound) tối thiểu `class_user_id` + `status`
(`verified` | `rule_matched` | `none`) + `updated_at` — không tin nhắn, không UID Zalo — vào một bảng nhỏ của Class chỉ đọc qua RPC giáo viên.
Hiển thị: "Đã xác minh" (owner_confirmed) · "Khớp theo quy tắc — chưa xác minh" (rule_matched, không bao giờ coi là đúng) · "Chưa liên kết".
Sửa liên kết sai → gọi `student_360_revoke_by_source('crm_zalo', '<ref>')` (đã có ở P1) để thu hồi mọi mục chắt lọc từ liên kết đó.

## Kiểm thử
- `bash scripts/test-student-360-db.sh` — DB tạm: P1 + P2 (preflight, migration ×2, quyền, test theo danh tính, rollback ×2).
- `npm run test:student360` — model, lớp API, component (jsdom) gồm thêm/sửa/xác minh/đổi phạm vi/thu hồi/lịch sử/lỗi/chống bấm đúp.
- `node tests/e2e-student360/run.mjs` — Chrome thật + Supabase giả ở tầng mạng (không production): luồng đầy đủ, điện thoại 390px
  (không tràn ngang, nút ≥ 44px), lỗi quyền, 6 tab cũ vẫn mở được. Cần `DIST` (build) và `PLAYWRIGHT_CORE`.
- Giới hạn: chưa thử bằng phiên giáo viên thật trên production.
