-- TVA Daily Mail V1 — Database Setup
-- Run: psql < daily_mail_setup.sql (or via Supabase SQL Editor)

begin;

-- ============================================================
-- 1. Bảng daily_mail — lưu mỗi chiến dịch gửi mail
--
-- INVARIANT (payload immutability): subject, content, cta_text,
-- cta_url MUST NOT change after status transitions from 'draft'.
-- The UI enforces this by locking edit for non-draft mails.
-- This ensures idempotency-key retries send the same payload.
-- Violation → Resend returns 409 invalid_idempotent_request.
--
-- TEST AUDIENCE SAFETY:
--   audience_type = 'test'      → backend CHỈ gửi tới test_emails (max 10)
--   audience_type = 'all_active' → backend lấy toàn bộ edu_students active
--   Default bắt buộc = 'test' để fail safe.
--   NULL/invalid → fail closed, gửi 0 email.
-- ============================================================
create table if not exists public.daily_mail (
  id            uuid primary key default gen_random_uuid(),
  subject       text not null,
  content       text not null default '',
  cta_text      text,
  cta_url       text,
  scheduled_at  timestamptz not null,
  status        text not null default 'draft'
                check (status in ('draft','scheduled','processing','sent','failed')),
  audience_type text not null default 'test'
                check (audience_type in ('test','all_active')),
  test_emails   text[] default '{}',   -- whitelist email cho test mode, max 10
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- 2. Bảng daily_mail_recipient — trạng thái từng người nhận
--    student_id nullable: NULL cho test emails (không có học sinh thật)
-- ============================================================
create table if not exists public.daily_mail_recipient (
  id                uuid primary key default gen_random_uuid(),
  daily_mail_id     uuid not null references public.daily_mail(id) on delete cascade,
  student_id        uuid references public.edu_students(id) on delete cascade,  -- nullable for test emails
  email             text not null,
  student_name      text,
  unsubscribe_token text unique,   -- token khó đoán cho link huỷ nhận mail
  status            text not null default 'pending'
                    check (status in ('pending','sent','failed')),
  resend_id         text,          -- Resend email ID để tra cứu sau
  error             text,
  sent_at           timestamptz,
  created_at        timestamptz not null default now(),
  unique(daily_mail_id, student_id)  -- mỗi học sinh chỉ nhận 1 lần/chiến dịch
                                     -- (NULL student_id treated as distinct per SQL standard)
);

-- Index lookup token nhanh
create index if not exists idx_dmr_unsubscribe_token
  on public.daily_mail_recipient(unsubscribe_token);

-- ============================================================
-- 3. Bảng email_preference — học sinh bật/tắt nhận mail
-- ============================================================
create table if not exists public.email_preference (
  student_id           uuid primary key references public.edu_students(id) on delete cascade,
  daily_mail_enabled   boolean not null default true,
  unsubscribed_at      timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ============================================================
-- 4. Trigger auto-update updated_at
-- ============================================================
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_daily_mail_updated_at on public.daily_mail;
create trigger trg_daily_mail_updated_at
  before update on public.daily_mail
  for each row execute function public.update_updated_at();

drop trigger if exists trg_email_preference_updated_at on public.email_preference;
create trigger trg_email_preference_updated_at
  before update on public.email_preference
  for each row execute function public.update_updated_at();

-- ============================================================
-- 5. Function: lấy danh sách học sinh active + enabled email
--    Dùng trong Edge Function sender (chỉ gọi khi audience_type = all_active)
-- ============================================================
create or replace function public.get_daily_mail_recipients(p_daily_mail_id uuid)
returns table (
  student_id   uuid,
  email        text,
  student_name text
) as $$
begin
  return query
  select s.id, s.email, coalesce(s.display_name, s.full_name)
  from public.edu_students s
  left join public.email_preference ep on ep.student_id = s.id
  where s.is_active = true
    and s.email is not null
    and s.email != ''
    and (ep.daily_mail_enabled is true or ep.daily_mail_enabled is null);  -- null = chưa có pref → mặc định nhận
end;
$$ language plpgsql security definer;

-- ============================================================
-- 6. Function: scheduler — tìm daily mail cần gửi (idempotent)
--    Dùng FOR UPDATE SKIP LOCKED chống concurrent
-- ============================================================
create or replace function public.find_due_daily_mails()
returns setof public.daily_mail as $$
begin
  return query
  select *
  from public.daily_mail
  where status = 'scheduled'
    and scheduled_at <= now()
  order by scheduled_at
  limit 5
  for update skip locked;
end;
$$ language plpgsql security definer;

-- ============================================================
-- 7. Function: đánh dấu daily_mail đang xử lý
-- ============================================================
create or replace function public.mark_daily_mail_processing(p_id uuid)
returns void as $$
begin
  update public.daily_mail
  set status = 'processing', updated_at = now()
  where id = p_id and status = 'scheduled';
end;
$$ language plpgsql security definer;

-- ============================================================
-- 8. Function: đánh dấu daily_mail hoàn tất
-- ============================================================
create or replace function public.mark_daily_mail_sent(p_id uuid)
returns void as $$
begin
  update public.daily_mail
  set status = 'sent', updated_at = now()
  where id = p_id;
end;
$$ language plpgsql security definer;

-- ============================================================
-- 9. Function: đánh dấu daily_mail thất bại
-- ============================================================
create or replace function public.mark_daily_mail_failed(p_id uuid)
returns void as $$
begin
  update public.daily_mail
  set status = 'failed', updated_at = now()
  where id = p_id;
end;
$$ language plpgsql security definer;

-- ============================================================
-- 10. Function: unsubscribe bằng token (công khai — SECURITY DEFINER)
--     Token được sinh từ HMAC-SHA-256(daily_mail_id + student_id, INTERNAL_SECRET)
--     Chỉ có Edge Function mới biết secret → token khó đoán
-- ============================================================
create or replace function public.unsubscribe_by_token(p_token text)
returns jsonb as $$
declare
  v_student_id uuid;
begin
  -- Lookup token trong daily_mail_recipient
  select dmr.student_id into v_student_id
  from public.daily_mail_recipient dmr
  where dmr.unsubscribe_token = p_token;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Token không hợp lệ hoặc đã hết hạn.');
  end if;

  -- Test emails không có student_id → không cần update preference
  if v_student_id is null then
    return jsonb_build_object('success', true, 'message', 'Đã huỷ nhận Daily Mail thành công.');
  end if;

  -- Cập nhật email_preference
  insert into public.email_preference (student_id, daily_mail_enabled, unsubscribed_at)
  values (v_student_id, false, now())
  on conflict (student_id)
  do update set daily_mail_enabled = false, unsubscribed_at = now(), updated_at = now();

  return jsonb_build_object('success', true, 'message', 'Đã huỷ nhận Daily Mail thành công.');
end;
$$ language plpgsql security definer;

-- ============================================================
-- 11. RLS — authenticated toàn quyền (theo policy hiện tại của dự án)
--     anon: KHÔNG được đọc/ghi bất kỳ bảng nào
--     Public chỉ tương tác qua RPC unsubscribe_by_token (SECURITY DEFINER)
-- ============================================================
alter table public.daily_mail enable row level security;
alter table public.daily_mail_recipient enable row level security;
alter table public.email_preference enable row level security;

-- authenticated full access
create policy "auth_full_daily_mail"
  on public.daily_mail for all
  to authenticated
  using (true) with check (true);

create policy "auth_full_daily_mail_recipient"
  on public.daily_mail_recipient for all
  to authenticated
  using (true) with check (true);

create policy "auth_full_email_preference"
  on public.email_preference for all
  to authenticated
  using (true) with check (true);

-- anon: KHÔNG có quyền đọc/ghi trên 3 bảng Daily Mail
-- (unsubscribe chỉ qua RPC SECURITY DEFINER, bỏ qua RLS)

commit;
