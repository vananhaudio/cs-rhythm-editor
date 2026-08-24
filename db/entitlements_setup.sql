-- =====================================================================
-- STUDENT ENTITLEMENTS — App Subscription Step 2
-- Project: Thay Van Anh Guitar / Class 2.0
--
-- MUC DICH:
--   Source of entitlement tach rieng khoi effective access.
--   Bao ve nguoi dung cu bang legacy_99_lifetime.
--   San sang cho Apple/Google subscription sau nay.
--
-- NGUYEN TAC:
--   - Additive + idempotent.
--   - KHONG xoa/sua edu_course_access, edu_enrollments, packages,
--     student_packages, billing_* hay IAP cu.
--   - FREE la effective tier hop le; mac dinh no-paid-entitlement => free.
--   - Frontend chi doc effective entitlement qua function.
--   - Hoc vien KHONG duoc tu cap/sua entitlement.
-- =====================================================================

-- 1) Bang source entitlement.
create table if not exists public.student_entitlements (
  id            bigint generated always as identity primary key,
  student_id    uuid not null references public.edu_students(id) on delete cascade,
  tier          text not null check (tier in (
                  'free',
                  'khoi_dau_99',
                  'can_ban_396',
                  'nang_cao_499'
                )),
  source        text not null check (source in (
                  'free',
                  'legacy_99_lifetime',
                  'apple_subscription',
                  'google_subscription',
                  'manual_admin',
                  'future_web_provider'
                )),
  source_ref    text,
  starts_at     timestamptz not null default now(),
  ends_at       timestamptz,
  is_lifetime   boolean not null default false,
  status        text not null default 'active' check (status in (
                  'active',
                  'trialing',
                  'past_due',
                  'cancelled',
                  'expired',
                  'revoked'
                )),
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint se_lifetime_no_end_chk check (not is_lifetime or ends_at is null),
  constraint se_legacy_shape_chk check (
    source <> 'legacy_99_lifetime'
    or (tier = 'khoi_dau_99' and is_lifetime and ends_at is null)
  ),
  constraint se_free_shape_chk check (
    source <> 'free'
    or tier = 'free'
  )
);

create index if not exists se_student_idx
  on public.student_entitlements (student_id);
create index if not exists se_student_status_idx
  on public.student_entitlements (student_id, status, starts_at, ends_at);
create index if not exists se_source_idx
  on public.student_entitlements (source);

-- Mot hoc vien chi co 1 legacy 99 lifetime active/trialing.
create unique index if not exists se_legacy_99_lifetime_uq
  on public.student_entitlements (student_id)
  where source = 'legacy_99_lifetime'
    and tier = 'khoi_dau_99'
    and is_lifetime
    and status in ('active','trialing');

-- Provider/subscription external id khong duoc map vao nhieu hoc vien.
create unique index if not exists se_source_ref_uq
  on public.student_entitlements (source, source_ref)
  where source_ref is not null;

-- 2) RLS: hoc vien khong doc truc tiep bang source; doc qua RPC effective.
alter table public.student_entitlements enable row level security;

-- Supabase runtime roles: GRANT cap quyen SQL co ban, RLS quyet dinh ai duoc thay/ghi.
-- Student van khong doc/ghi duoc source records vi khong co policy match.
grant select, insert, update, delete on public.student_entitlements to authenticated;
grant usage, select on sequence public.student_entitlements_id_seq to authenticated;

drop policy if exists se_teacher_read on public.student_entitlements;
drop policy if exists se_teacher_write on public.student_entitlements;
drop policy if exists se_no_student_write on public.student_entitlements;

create policy se_teacher_read on public.student_entitlements
  for select to authenticated using (public.is_teacher());

create policy se_teacher_write on public.student_entitlements
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

-- 3) Helper: cap nhat updated_at.
create or replace function public.touch_student_entitlements_updated_at()
returns trigger
language plpgsql
set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end; $$;

drop trigger if exists trg_student_entitlements_updated_at on public.student_entitlements;
create trigger trg_student_entitlements_updated_at
before update on public.student_entitlements
for each row execute function public.touch_student_entitlements_updated_at();

-- 4) Effective entitlement: mot cua duy nhat de hoi quyen hien tai.
create or replace function public.get_effective_student_entitlement(
  p_student_id uuid default null
) returns table (
  student_id uuid,
  effective_tier text,
  source text,
  source_ref text,
  entitlement_id bigint,
  starts_at timestamptz,
  ends_at timestamptz,
  is_lifetime boolean,
  active_entitlements jsonb
)
language plpgsql
security definer
set search_path = '' as $$
declare
  v_student_id uuid;
  v_row record;
begin
  if p_student_id is null then
    select s.id into v_student_id
      from public.edu_students s
      where s.user_id = auth.uid()
      limit 1;
  else
    v_student_id := p_student_id;
  end if;

  if v_student_id is null then
    raise exception 'student_id khong ton tai';
  end if;

  if not public.is_teacher() and not exists (
    select 1 from public.edu_students s
    where s.id = v_student_id and s.user_id = auth.uid()
  ) then
    raise exception 'Khong duoc doc entitlement cua hoc vien khac';
  end if;

  with valid_entitlements as (
    select
      e.*,
      case e.tier
        when 'nang_cao_499' then 4
        when 'can_ban_396' then 3
        when 'khoi_dau_99' then 2
        else 1
      end as tier_rank,
      case e.source
        when 'apple_subscription' then 50
        when 'google_subscription' then 50
        when 'future_web_provider' then 45
        when 'manual_admin' then 40
        when 'legacy_99_lifetime' then 30
        when 'free' then 10
        else 0
      end as source_rank
    from public.student_entitlements e
    where e.student_id = v_student_id
      and e.status in ('active','trialing')
      and e.starts_at <= now()
      and (e.is_lifetime or e.ends_at is null or e.ends_at > now())
  )
  select *
    into v_row
    from valid_entitlements
    order by tier_rank desc, source_rank desc, starts_at desc, id desc
    limit 1;

  if v_row.id is null then
    student_id := v_student_id;
    effective_tier := 'free';
    source := 'free';
    source_ref := null;
    entitlement_id := null;
    starts_at := null;
    ends_at := null;
    is_lifetime := false;
    active_entitlements := '[]'::jsonb;
    return next;
    return;
  end if;

  student_id := v_student_id;
  effective_tier := v_row.tier;
  source := v_row.source;
  source_ref := case when public.is_teacher() then v_row.source_ref else null end;
  entitlement_id := v_row.id;
  starts_at := v_row.starts_at;
  ends_at := v_row.ends_at;
  is_lifetime := v_row.is_lifetime;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id,
    'tier', e.tier,
    'source', e.source,
    'source_ref', case when public.is_teacher() then e.source_ref else null end,
    'starts_at', e.starts_at,
    'ends_at', e.ends_at,
    'is_lifetime', e.is_lifetime,
    'status', e.status
  ) order by
    case e.tier
      when 'nang_cao_499' then 4
      when 'can_ban_396' then 3
      when 'khoi_dau_99' then 2
      else 1
    end desc, e.starts_at desc), '[]'::jsonb)
    into active_entitlements
    from public.student_entitlements e
    where e.student_id = v_student_id
      and e.status in ('active','trialing')
      and e.starts_at <= now()
      and (e.is_lifetime or e.ends_at is null or e.ends_at > now());

  return next;
end; $$;

-- 5) Grant/revoke nho, dung cho admin/server/service workflow.
-- Hoc vien khong duoc goi; teacher/admin co guard is_teacher().
create or replace function public.grant_student_entitlement(
  p_student_id uuid,
  p_tier text,
  p_source text,
  p_source_ref text default null,
  p_starts_at timestamptz default now(),
  p_ends_at timestamptz default null,
  p_is_lifetime boolean default false,
  p_status text default 'active',
  p_metadata jsonb default '{}'::jsonb
) returns bigint
language plpgsql
security definer
set search_path = '' as $$
declare
  v_id bigint;
begin
  if not public.is_teacher() then
    raise exception 'Chi thay/admin moi duoc cap entitlement';
  end if;

  insert into public.student_entitlements
    (student_id, tier, source, source_ref, starts_at, ends_at, is_lifetime, status, metadata)
  values
    (p_student_id, p_tier, p_source, p_source_ref, p_starts_at, p_ends_at,
     p_is_lifetime, p_status, coalesce(p_metadata, '{}'::jsonb))
  on conflict do nothing
  returning id into v_id;

  if v_id is null and p_source = 'legacy_99_lifetime' then
    select id into v_id
      from public.student_entitlements
      where student_id = p_student_id
        and source = 'legacy_99_lifetime'
        and tier = 'khoi_dau_99'
        and is_lifetime
        and status in ('active','trialing')
      limit 1;
  elsif v_id is null and p_source_ref is not null then
    select id into v_id
      from public.student_entitlements
      where student_id = p_student_id
        and source = p_source
        and source_ref = p_source_ref
      limit 1;
    if v_id is null and exists (
      select 1 from public.student_entitlements
      where source = p_source and source_ref = p_source_ref
    ) then
      raise exception 'source_ref %/% da duoc gan cho hoc vien khac', p_source, p_source_ref;
    end if;
  end if;

  return v_id;
end; $$;

create or replace function public.revoke_student_entitlement(
  p_entitlement_id bigint,
  p_status text default 'revoked'
) returns boolean
language plpgsql
security definer
set search_path = '' as $$
begin
  if not public.is_teacher() then
    raise exception 'Chi thay/admin moi duoc thu entitlement';
  end if;
  if p_status not in ('cancelled','expired','revoked','past_due') then
    raise exception 'status thu quyen khong hop le: %', p_status;
  end if;

  update public.student_entitlements
    set status = p_status, updated_at = now()
    where id = p_entitlement_id;
  return found;
end; $$;

-- Quyen thuc thi.
revoke all on function public.get_effective_student_entitlement(uuid) from public, anon;
grant execute on function public.get_effective_student_entitlement(uuid) to authenticated;

revoke all on function public.grant_student_entitlement(uuid, text, text, text, timestamptz, timestamptz, boolean, text, jsonb) from public, anon;
grant execute on function public.grant_student_entitlement(uuid, text, text, text, timestamptz, timestamptz, boolean, text, jsonb) to authenticated;

revoke all on function public.revoke_student_entitlement(bigint, text) from public, anon;
grant execute on function public.revoke_student_entitlement(bigint, text) to authenticated;

notify pgrst, 'reload schema';
