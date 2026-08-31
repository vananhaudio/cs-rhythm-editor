-- MAIL ONBOARDING SETUP — Email 1 (registration_received) / Email 2 (learning_access_ready)
-- Backward-compatible: chỉ tạo bảng mới + trigger, KHÔNG đụng bảng cũ.
-- Pattern reuse: cron/trigger → edge function `mail-worker` (x-internal-secret như daily-mail-scheduler).

-- ── 1) MAIL LOG — audit + idempotency (chống gửi trùng) ────────────────
create table if not exists public.mail_log (
  id             bigint generated always as identity primary key,
  lead_id        bigint references public.leads(id) on delete cascade,
  mail_type      text not null,            -- registration_received / learning_access_ready / first_session_reminder
  attempt        int  not null default 1,  -- 1 = lần đầu; resend tăng dần
  idempotency_key text not null,
  status         text not null default 'queued',  -- queued / processing / sent / failed
  subject        text,
  to_email       text,
  error          text,
  resent_of      bigint,                   -- id mail_log của lần gốc (audit resend)
  created_at     timestamptz not null default now(),
  started_at     timestamptz,
  sent_at        timestamptz
);
create unique index if not exists mail_log_idem_uq on public.mail_log (mail_type, lead_id, attempt);
create index if not exists mail_log_lead_idx on public.mail_log (lead_id, mail_type, id);
create index if not exists mail_log_queue_idx on public.mail_log (status, id) where status = 'queued';
alter table public.mail_log enable row level security;
-- anon/authenticated KHÔNG đọc được mail log; service_role (qua definer function) mới được
drop policy if exists "mail_log_service_all" on public.mail_log;
create policy "mail_log_service_all" on public.mail_log
  for all to service_role using (true) with check (true);

-- ── 2) APP CONFIG — canonical bank/links cho mail (không hardcode trong template) ──
create table if not exists public.app_config (
  key   text primary key,
  value text not null,
  note  text
);
alter table public.app_config enable row level security;
drop policy if exists "app_config_service_all" on public.app_config;
create policy "app_config_service_all" on public.app_config
  for all to service_role using (true) with check (true);
-- anon đọc được config công khai (bank/app links) — không có gì nhạy cảm
drop policy if exists "app_config_anon_read" on public.app_config;
create policy "app_config_anon_read" on public.app_config
  for select to anon using (true);
drop policy if exists "app_config_auth_read" on public.app_config;
create policy "app_config_auth_read" on public.app_config
  for select to authenticated using (true);

insert into public.app_config (key, value, note) values
  ('bank_name',     'TPBank', ''),
  ('bank_account',  '06496099801', ''),
  ('bank_owner',    'Công ty TNHH Văn Anh Audio', ''),
  ('bank_qr',       '/qr-thanhtoan.png', 'đường dẫn QR tĩnh trên site class'),
  ('class_fee',     '990000', 'học phí lớp cố định hiện tại (VNĐ)'),
  ('site_url',      'https://class.vananhaudio.com', ''),
  ('app_url',       'https://timming.vananhaudio.com/start', 'cổng đăng nhập app'),
  ('appstore_url',  'https://apps.apple.com/vn/app/id6776205968', ''),
  ('playstore_url', 'https://play.google.com/store/apps/details?id=com.vananhaudio.guitar', ''),
  ('zalo_url',      'https://zalo.me/vananhguitarist', '')
on conflict (key) do nothing;

-- ── 3) APP SECRETS — chỉ service_role (definer) đọc; trigger/cron lấy x-internal-secret ──
create table if not exists public.app_secrets (
  name  text primary key,
  value text not null
);
alter table public.app_secrets enable row level security;
drop policy if exists "app_secrets_service_all" on public.app_secrets;
create policy "app_secrets_service_all" on public.app_secrets
  for all to service_role using (true) with check (true);
-- KHÔNG policy anon/authenticated → bảng này chỉ service_role đọc được

-- ── 4) QUEUE + GỌI WORKER ───────────────────────────────────────────────
-- SECURITY DEFINER: trigger đọc app_secrets (bỏ RLS) + insert mail_log + gọi worker.
create or replace function public.queue_mail(p_lead bigint, p_type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_secret text;
  v_jwt text;
begin
  v_key := p_type || ':' || p_lead || ':1';
  insert into public.mail_log (lead_id, mail_type, attempt, idempotency_key)
  values (p_lead, p_type, 1, v_key)
  on conflict (mail_type, lead_id, attempt) do nothing;
  -- Gọi worker NGAY (nhanh); cron mỗi phút là fallback + retry
  select value into v_secret from public.app_secrets where name = 'mail_worker_secret';
  select value into v_jwt from public.app_secrets where name = 'service_role_jwt';
  if v_secret is null or v_jwt is null then
    return;
  end if;
  perform net.http_post(
    url := (select value from public.app_config where key = 'site_url') || '/functions/v1/mail-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_jwt,
      'x-internal-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;

-- Trigger sau INSERT leads → Email 1 (không đợi thanh toán/duyệt)
create or replace function public.leads_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.queue_mail(new.id, 'registration_received');
  return new;
end;
$$;

drop trigger if exists trg_leads_after_insert on public.leads;
create trigger trg_leads_after_insert
  after insert on public.leads
  for each row execute function public.leads_after_insert();

-- Trigger sau UPDATE leads → Email 2 chỉ khi status CHUYỂN sang 'Đã đóng phí'
-- (code LeadsManager chỉ setStatus sau khi activation RPC thành công → activation success được xác nhận trước)
create or replace function public.leads_after_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'Đã đóng phí' and old.status is distinct from new.status then
    perform public.queue_mail(new.id, 'learning_access_ready');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_leads_after_update on public.leads;
create trigger trg_leads_after_update
  after update on public.leads
  for each row execute function public.leads_after_update();

-- ── 4b) CLAIM JOBS — worker lấy hàng loạt queued một cách atomic (chống race trigger+cron) ──
create or replace function public.claim_mail_jobs(p_limit int default 20)
returns setof public.mail_log
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    update public.mail_log m
    set status = 'processing', started_at = now()
    where m.id in (
      select id from public.mail_log
      where status = 'queued'
      order by id
      limit p_limit
    )
    returning m.*;
end;
$$;

grant execute on function public.claim_mail_jobs(int) to service_role;

-- ── 5) RPC RESEND (Admin — protected: chỉ authenticated; insert attempt mới, KHÔNG activation lại) ──
create or replace function public.mail_resend(p_lead bigint, p_type text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
  v_jwt text;
  v_attempt int;
  v_new_id bigint;
begin
  if auth.role() is distinct from 'authenticated' then
    raise exception 'Forbidden';
  end if;
  select value into v_secret from public.app_secrets where name = 'mail_worker_secret';
  select value into v_jwt from public.app_secrets where name = 'service_role_jwt';
  if v_secret is null or v_jwt is null then
    raise exception 'Mail worker chưa được cấu hình';
  end if;
  select coalesce(max(attempt), 0) + 1 into v_attempt
    from public.mail_log where lead_id = p_lead and mail_type = p_type;
  insert into public.mail_log (lead_id, mail_type, attempt, idempotency_key, resent_of)
  values (p_lead, p_type, v_attempt, p_type || ':' || p_lead || ':' || v_attempt,
          (select id from public.mail_log where lead_id = p_lead and mail_type = p_type order by id limit 1))
  returning id into v_new_id;
  perform net.http_post(
    url := (select value from public.app_config where key = 'site_url') || '/functions/v1/mail-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_jwt,
      'x-internal-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  return v_new_id;
end;
$$;

grant execute on function public.mail_resend(bigint, text) to authenticated;

-- ── 6) CRON FALLBACK — mỗi phút xử lý queue (retry khi trigger http_post fail) ──
select cron.unschedule('mail-worker-cron') where exists (select 1 from cron.job where jobname = 'mail-worker-cron');
select cron.schedule(
  'mail-worker-cron',
  '* * * * *',
  $$
  select net.http_post(
    url := (select value from public.app_config where key = 'site_url') || '/functions/v1/mail-worker',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select value from public.app_secrets where name = 'service_role_jwt'),
      'x-internal-secret', (select value from public.app_secrets where name = 'mail_worker_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
  $$
);
