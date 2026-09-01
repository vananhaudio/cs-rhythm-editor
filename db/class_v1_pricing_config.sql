-- /class V1: HERO PRICING CANONICAL — vòng 12
-- Thêm 3 key Gói Thực hành (trước đây hardcode 4 nơi trên landing) + allowlist public_app_config.
-- class_fee (990000) đã có sẵn — dùng chung cho tab lớp/form.
-- Backward-compatible + idempotent.

insert into public.app_config (key, value, note) values
  ('practice_monthly_fee', '499000', 'Gói Thực hành 1 tháng (VNĐ) — canonical'),
  ('practice_6m_total',    '2376000', 'Gói Thực hành 6 tháng tổng (VNĐ) — canonical'),
  ('practice_6m_monthly',  '396000', 'Gói Thực hành 6 tháng tương đương/tháng (VNĐ) — canonical')
on conflict (key) do nothing;

drop view if exists public.public_app_config;
create view public.public_app_config as
  select key, value from public.app_config
  where key in ('bank_name', 'bank_account_number', 'bank_account_name', 'payment_qr',
                'zalo_url', 'class_site_url', 'app_ios_url', 'app_android_url', 'app_url',
                'class_fee', 'practice_monthly_fee', 'practice_6m_total', 'practice_6m_monthly');
grant select on public.public_app_config to anon, authenticated;
