-- =====================================================================
-- 1001 CÂU CHUYỆN — BƯỚC "CHUẨN BỊ XUẤT BẢN"
-- Project Supabase: wojmdilyflffvdtpovmq · chạy trong SQL Editor
--
-- Người kể xác nhận CÁCH HIỂN THỊ trước khi gửi Ban biên tập.
-- Nguyên tắc: TÁI SỬ DỤNG dữ liệu hồ sơ học viên (edu_students,
-- class_schedule qua nhóm lớp) — KHÔNG tạo nguồn dữ liệu mới,
-- KHÔNG cho upload ảnh riêng.
--
-- AN TOÀN: chỉ THÊM cột. Không đụng dữ liệu/policy sẵn có.
-- Idempotent — chạy lại nhiều lần vô hại.
-- =====================================================================

-- ── 1) stories: thông tin hiển thị khi xuất bản ──────────────────────
alter table public.stories
  -- Cách hiển thị tên: full_name | first_name | pen_name | anonymous
  add column if not exists display_mode      text not null default 'full_name',
  -- Tên CHỐT tại thời điểm gửi (đã tính theo display_mode) — dùng để in tạp chí
  add column if not exists author_name       text,
  -- Ảnh đại diện CHỐT tại thời điểm gửi, copy từ edu_students.avatar_url.
  -- Snapshot vì anon KHÔNG đọc được edu_students (PII) — trang công khai cần URL này.
  add column if not exists author_avatar_url text,
  -- Lớp hiển thị dưới tên (null = người kể chọn không hiển thị)
  add column if not exists class_display     text,
  -- Hai xác nhận bắt buộc trước khi gửi
  add column if not exists consent_edit      boolean not null default false,
  add column if not exists consent_publish   boolean not null default false,
  add column if not exists consent_at        timestamptz;

do $$ begin
  alter table public.stories add constraint stories_display_mode_check
    check (display_mode in ('full_name','first_name','pen_name','anonymous'));
exception when duplicate_object then null; end $$;

-- ── 2) edu_students: bút danh mặc định cho các câu chuyện sau ────────
-- Hồ sơ học viên là nguồn dữ liệu sẵn có → lưu tại đây, không tạo bảng mới.
alter table public.edu_students
  add column if not exists default_pen_name     text,
  add column if not exists default_display_mode text;

-- ── 3) Nạp lại schema cho PostgREST ──────────────────────────────────
NOTIFY pgrst, 'reload schema';
