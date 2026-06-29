-- =====================================================================
-- ĐĂNG KÝ KHOÁ trong app: học sinh đã đăng nhập bấm "Đăng ký lớp này".
-- Nếu tick "Tôi là học sinh lớp Hành trình — miễn phí" → yêu cầu MIỄN PHÍ chờ thầy duyệt.
-- Thầy duyệt trong /admin (LeadsManager) → mở khoá. Dùng lại bảng leads sẵn có.
-- Chạy trong Supabase SQL Editor. Idempotent.
-- =====================================================================

-- Cờ: yêu cầu này là học sinh lớp Hành trình xin miễn phí
alter table public.leads add column if not exists is_hanhtrinh boolean default false;

-- Cho tài khoản ĐÃ ĐĂNG NHẬP (authenticated) gửi đăng ký (trước đây chỉ anon insert được)
drop policy if exists "leads_auth_insert" on public.leads;
create policy "leads_auth_insert" on public.leads
  for insert to authenticated with check (true);

notify pgrst, 'reload schema';
