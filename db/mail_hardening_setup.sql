-- MAIL HARDENING — vòng 9: khóa send-mail, cron 401, app_config canonical public-safe, entitlement guard Email 2
-- Backward-compatible + idempotent.

-- ── 1) APP_CONFIG → canonical names (rename, không duplicate) ──────────
insert into public.app_config (key, value, note) values
  ('bank_account_number', (select value from public.app_config where key = 'bank_account'), 'số TK (canonical)'),
  ('bank_account_name',   (select value from public.app_config where key = 'bank_owner'), 'chủ TK (canonical)'),
  ('payment_qr',          (select value from public.app_config where key = 'bank_qr'), 'QR tĩnh (canonical)'),
  ('class_site_url',      (select value from public.app_config where key = 'site_url'), 'site class (canonical)'),
  ('app_ios_url',         (select value from public.app_config where key = 'appstore_url'), 'App Store (canonical)'),
  ('app_android_url',     (select value from public.app_config where key = 'playstore_url'), 'Google Play (canonical)')
on conflict (key) do nothing;
delete from public.app_config where key in ('bank_account', 'bank_owner', 'bank_qr', 'site_url', 'appstore_url', 'playstore_url');

-- ── 2) PUBLIC-SAFE CONFIG — anon chỉ đọc allowlist qua view ────────────
drop policy if exists "app_config_anon_read" on public.app_config;
drop policy if exists "app_config_auth_read" on public.app_config;

drop view if exists public.public_app_config;
create view public.public_app_config as
  select key, value from public.app_config
  where key in ('bank_name', 'bank_account_number', 'bank_account_name', 'payment_qr',
                'zalo_url', 'class_site_url', 'app_ios_url', 'app_android_url', 'app_url',
                'class_fee');
grant select on public.public_app_config to anon, authenticated;

-- ── 3) ENTITLEMENT GUARD — canonical thật (KHÔNG chỉ tin lead.status) ──
-- Class  = edu_course_access.active (grant bởi apply_package_permissions / grantHT)
-- Practice = student_packages.status='active' (tạo bởi activate_student_package)
-- Both   = cả hai.
create or replace function public.lead_entitlement_ok(p_lead bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student uuid;
  v_mode   text;
  v_class_ok  boolean;
  v_practice_ok boolean;
begin
  select student_id, coalesce((regexp_match(coalesce(note, ''), '\[reg-mode:([a-z]+)\]'))[1], 'class')
    into v_student, v_mode
    from public.leads where id = p_lead;
  if v_student is null then
    return false;  -- chưa có tài khoản học sinh → chưa thể kích hoạt
  end if;
  select exists(
    select 1 from public.edu_course_access a
    where a.student_id = v_student and a.active = true
  ) into v_class_ok;
  select exists(
    select 1 from public.student_packages p
    where p.student_id = v_student and p.status = 'active'
  ) into v_practice_ok;
  if v_mode = 'practice' then return v_practice_ok; end if;
  if v_mode = 'both' then return v_class_ok and v_practice_ok; end if;
  return v_class_ok;
end;
$$;
grant execute on function public.lead_entitlement_ok(bigint) to service_role;

-- ── 4) TRIGGER Email 2 — chỉ queue khi entitlement thật verified ──────
create or replace function public.leads_after_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'Đã đóng phí' and old.status is distinct from new.status then
    -- Defense in depth (DB layer): KHÔNG gửi nếu chưa có quyền học thật.
    -- Activation fail / status-only update / thiếu student_id → không Email 2.
    if public.lead_entitlement_ok(new.id) then
      perform public.queue_mail(new.id, 'learning_access_ready');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_leads_after_update on public.leads;
create trigger trg_leads_after_update
  after update on public.leads
  for each row execute function public.leads_after_update();

-- ── 5) CRON daily-mail-scheduler — sửa 401: gửi Authorization JWT + x-internal-secret ──
select cron.unschedule('daily-mail-scheduler') where exists (select 1 from cron.job where jobname = 'daily-mail-scheduler');
select cron.schedule(
  'daily-mail-scheduler',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://wojmdilyflffvdtpovmq.supabase.co/functions/v1/daily-mail-scheduler',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select value from public.app_secrets where name = 'service_role_jwt'),
      'x-internal-secret', (select value from public.app_secrets where name = 'daily_mail_internal_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
  $$
);
