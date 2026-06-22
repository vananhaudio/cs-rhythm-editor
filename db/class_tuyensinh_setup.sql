-- =====================================================================
-- TRANG TUYỂN SINH class.vananhaudio.com — BƯỚC 1: NỀN DỮ LIỆU
-- Project Supabase: wojmdilyflffvdtpovmq · chạy trong SQL Editor
--
-- AN TOÀN: chỉ THÊM bảng/cột mới + policy hẹp riêng. KHÔNG đụng dữ liệu
-- hay quyền của các bảng cũ. Idempotent — chạy lại nhiều lần vô hại.
--
-- ⚠️ Bảo mật edu_* đã được khóa từ trước (db/rls_setup.sql, 2026-06):
--    RLS bật mọi bảng, anon CHỈ đọc 6 bảng nội dung (gồm edu_courses),
--    KHÔNG đọc PII. ⇒ KHÔNG chạy "Phần 4" của file bàn giao cũ.
--    edu_courses đã cho anon đọc nên cột showcase_* dưới đây tự đọc được.
--
-- 'articles' và 'leads' ĐÃ được thêm vào mảng self_managed trong
-- db/rls_setup.sql ⇒ chạy lại rls_setup KHÔNG xóa policy hẹp bên dưới.
-- =====================================================================

-- ── 1) BÀI VIẾT (articles) — nội dung cho các thẻ showcase ────────────
create table if not exists public.articles (
  id          bigint generated always as identity primary key,
  title       text not null,
  slug        text unique,
  slot        text,                       -- gắn vào thẻ nào (vd: "90-phut-moi-tuan")
  body        text,
  published   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.articles enable row level security;

drop policy if exists "articles_public_read" on public.articles;
drop policy if exists "articles_auth_all"    on public.articles;
-- Public CHỈ đọc bài ĐÃ ĐĂNG
create policy "articles_public_read" on public.articles
  for select to anon using (published = true);
-- Admin (đã đăng nhập) toàn quyền
create policy "articles_auth_all" on public.articles
  for all to authenticated using (true) with check (true);


-- ── 2) ĐĂNG KÝ / CRM (leads) — mọi người quan tâm ────────────────────
-- Lớp phễu: học thử lớp, dùng thử app, đăng ký. Nối ngược học sinh thật qua email/lead_id.
create table if not exists public.leads (
  id          bigint generated always as identity primary key,
  name        text not null,
  phone       text not null,
  zalo        text,
  email       text,
  class_name  text,                          -- lớp muốn đăng ký
  path        text,                          -- lộ trình: dem_hat / tia_not / cam_am
  intent      text default 'dang_ky',        -- ý định: dang_ky / hoc_thu_lop / dung_thu_app
  note        text,
  source      text default 'landing',        -- nguồn: landing / zalo / fb...
  status      text not null default 'Mới đăng ký',  -- Mới/Cần gọi/Đã tư vấn/Học thử/Dùng thử app/Đã đóng phí/Chưa phù hợp
  student_id  uuid,                          -- gắn khi đã tạo tài khoản học sinh thật
  created_at  timestamptz not null default now()
);
-- Bổ sung cột nếu bảng đã tồn tại từ bản cũ (idempotent)
alter table public.leads add column if not exists intent     text default 'dang_ky';
alter table public.leads add column if not exists student_id uuid;

create index if not exists leads_email_idx  on public.leads (lower(email));
create index if not exists leads_status_idx on public.leads (status);

alter table public.leads enable row level security;

drop policy if exists "leads_anon_insert" on public.leads;
drop policy if exists "leads_auth_read"   on public.leads;
drop policy if exists "leads_auth_update" on public.leads;
-- Public CHỈ được GHI (gửi form), KHÔNG đọc được của ai → không lộ dữ liệu
create policy "leads_anon_insert" on public.leads
  for insert to anon with check (true);
-- Admin đọc & cập nhật trạng thái (không cho anon đọc PII)
create policy "leads_auth_read"   on public.leads
  for select to authenticated using (true);
create policy "leads_auth_update" on public.leads
  for update to authenticated using (true) with check (true);


-- ── 3) SHOWCASE cho edu_courses (dùng lại bảng sẵn có) ────────────────
-- anon đã đọc được edu_courses ⇒ các cột này tự hiển thị ra trang tuyển sinh.
alter table public.edu_courses
  add column if not exists showcase_for_who text,                      -- "Dành cho ai"
  add column if not exists showcase_desc    text,                      -- mô tả chi tiết
  add column if not exists showcase_learn   jsonb default '[]'::jsonb; -- ["Bạn sẽ học...", ...]


-- ── 4) PHÂN NHÓM HỌC SINH + DÙNG THỬ APP (edu_students) ───────────────
-- student_type: phân quyền mở khóa theo nhóm đóng phí.
--   paid  = học sinh chính thức (mặc định cho 577 người sẵn có)
--   trial = dùng thử app 7 ngày (có trial_expires_at)
--   free  = chỉ dùng nội dung miễn phí
alter table public.edu_students
  add column if not exists student_type     text default 'paid',
  add column if not exists trial_expires_at timestamptz,             -- null = không phải trial
  add column if not exists lead_id          bigint;                   -- nối ngược về leads

create index if not exists edu_students_type_idx on public.edu_students (student_type);

-- =====================================================================
-- Sau khi chạy: NOTIFY pgrst, 'reload schema';
-- =====================================================================
notify pgrst, 'reload schema';
