-- =====================================================================
-- 1001 CÂU CHUYỆN — BÁO CÁO NỘI DUNG & CHẶN NGƯỜI KỂ
-- Project Supabase: wojmdilyflffvdtpovmq · chạy trong SQL Editor
--
-- Đáp ứng App Store Review Guideline 1.2 (nội dung do người dùng tạo):
--   (1) lọc nội dung  → ĐÃ CÓ: Ban biên tập duyệt trước khi xuất bản
--   (2) cơ chế báo cáo → bảng story_reports + nút trên trang câu chuyện
--   (3) chặn người gây hại → edu_students.blocked_at
--   (4) thông tin liên hệ → ĐÃ CÓ: nút "Liên hệ" (Zalo) ở footer
--
-- AN TOÀN: chỉ THÊM bảng/cột + policy hẹp. Idempotent.
-- ⚠️ 'story_reports' PHẢI nằm trong mảng self_managed của db/rls_setup.sql
--    (đã thêm cùng đợt) — nếu không, chạy lại rls_setup sẽ đè policy hẹp.
-- =====================================================================

-- ── 1) BÁO CÁO NỘI DUNG ──────────────────────────────────────────────
create table if not exists public.story_reports (
  id          bigint generated always as identity primary key,
  story_id    uuid not null references public.stories(id) on delete cascade,
  reporter_id uuid,                                  -- auth.uid(); null = khách chưa đăng nhập
  reason      text not null,                         -- loại vi phạm (xem UI)
  note        text,                                  -- mô tả thêm (tuỳ chọn)
  status      text not null default 'new'
              check (status in ('new','handled','dismissed')),
  created_at  timestamptz not null default now(),
  handled_at  timestamptz
);

create index if not exists story_reports_status_idx on public.story_reports (status, created_at desc);
create index if not exists story_reports_story_idx  on public.story_reports (story_id);

alter table public.story_reports enable row level security;

drop policy if exists "sr_anyone_insert" on public.story_reports;
drop policy if exists "sr_teacher_all"   on public.story_reports;

-- AI CŨNG báo cáo được (kể cả khách chưa đăng nhập) — Apple yêu cầu
-- cơ chế báo cáo phải sẵn cho mọi người đọc.
create policy "sr_anyone_insert" on public.story_reports
  for insert to anon, authenticated with check (true);

-- CHỈ thầy đọc & xử lý (báo cáo có thể chứa thông tin nhạy cảm)
create policy "sr_teacher_all" on public.story_reports
  for all to authenticated using (public.is_teacher()) with check (public.is_teacher());


-- ── 2) CHẶN NGƯỜI KỂ GÂY HẠI ─────────────────────────────────────────
-- Dùng hồ sơ học viên sẵn có, không tạo bảng mới.
alter table public.edu_students
  add column if not exists blocked_at     timestamptz,
  add column if not exists blocked_reason text;


-- ── 3) Nạp lại schema cho PostgREST ──────────────────────────────────
NOTIFY pgrst, 'reload schema';
