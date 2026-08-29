-- =====================================================================
-- HT2027 — HỌC PHÍ / CÁCH THAM GIA (lưu trong bảng packages — nguồn chuẩn Class)
-- 3 lựa chọn: theo tháng · theo chặng · gói 6 tháng.
-- Landing /hanhtrinh2027 ĐỌC TỪ ĐÂY (admin sửa được, không hardcode trong UI).
-- IDEMPOTENT — chạy lại nhiều lần vô hại. Additive, không đụng dữ liệu cũ.
-- =====================================================================

-- ── (1) RLS: cho phép KHÁCH (anon) đọc packages — giá công khai trên landing ──
-- (Giữ nguyên policy ghi chỉ dành cho teacher ở packages_setup.sql)
drop policy if exists pkgs_anon_read on public.packages;
create policy pkgs_anon_read on public.packages for select to anon using (true);

-- ── (2) Seed 3 gói (upsert theo package_code) ─────────────────────────
insert into public.packages (package_code, name, description, config, status)
values
  ('HT2027_MONTHLY',
   'Đăng ký theo tháng',
   'Học và đóng học phí theo từng tháng.',
   '{"price_vnd": 499000, "unit": "tháng", "sessions_per_unit": null, "total_sessions": null, "highlight": false}'::jsonb,
   'active'),
  ('HT2027_STAGE',
   'Đăng ký theo chặng',
   'Mỗi chặng gồm 8 buổi thực hành.',
   '{"price_vnd": 990000, "unit": "chặng", "sessions_per_unit": 8, "total_sessions": null, "highlight": true}'::jsonb,
   'active'),
  ('HT2027_SIXMONTH',
   'Gói 6 tháng',
   '24 buổi thực hành liên tục, tương đương 3 chặng.',
   '{"price_vnd": 396000, "unit": "tháng", "sessions_per_unit": null, "total_sessions": 24, "highlight": false, "min_commit_months": 6}'::jsonb,
   'active')
on conflict (package_code) do update
  set name = excluded.name, description = excluded.description,
      config = excluded.config, status = excluded.status, updated_at = now();

notify pgrst, 'reload schema';
