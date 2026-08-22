-- BƯỚC 6 — Lưu lựa chọn gói đăng ký có cấu trúc trên bảng leads.
-- package_choice là NGUỒN SỰ THẬT về gói khách chọn (không parse note).
-- Backward-compatible: nullable → lead cũ giữ NULL, không đụng dữ liệu cũ.
-- Không đổi RLS: leads_anon_insert (with check true) đã cho form ghi cột mới;
-- leads_auth_read/update (using true) đã cho admin đọc/cập nhật.

alter table public.leads
  add column if not exists package_choice text;

alter table public.leads
  drop constraint if exists leads_package_choice_check;

alter table public.leads
  add constraint leads_package_choice_check
  check (package_choice is null or package_choice in
    ('khoi_dau_99', 'can_ban_396', 'nang_cao_499', 'hanh_trinh_9990'));

-- Không index ở bước này: số lead nhỏ, lọc theo gói sau này tính sau.
