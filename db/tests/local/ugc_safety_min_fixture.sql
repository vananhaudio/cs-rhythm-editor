-- Chỉ cho test DB tạm: phần tối thiểu của class_ugc_safety_v1 mà Feed Comments Safety cần (DDL giống production).
create table if not exists public.class_user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id), constraint class_user_blocks_not_self check (blocker_id <> blocked_id));
create or replace function public.class_ugc_pair_blocked(p_a uuid, p_b uuid)
returns boolean language plpgsql security definer set search_path = '' stable as $$
begin
  if p_a is null or p_b is null or p_a = p_b then return false; end if;
  return exists (select 1 from public.class_user_blocks b where b.blocker_id = p_a and b.blocked_id = p_b)
      or exists (select 1 from public.class_user_blocks b where b.blocker_id = p_b and b.blocked_id = p_a);
end $$;
revoke all on function public.class_ugc_pair_blocked(uuid, uuid) from public, anon, authenticated;
create table if not exists public.class_reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  kind text not null, target_id text not null,
  target_user_id uuid references auth.users(id) on delete set null,
  reason text not null, note text, excerpt text, status text not null default 'new',
  created_at timestamptz not null default now(),
  handled_by uuid references auth.users(id) on delete set null, handled_at timestamptz, handled_action text, handled_note text,
  constraint class_reports_kind_check check (kind in ('post', 'comment', 'profile', 'dm_message', 'band_message', 'thread')),
  constraint class_reports_reason_check check (reason in ('spam', 'harassment', 'inappropriate', 'hate', 'sexual', 'violence', 'other')),
  constraint class_reports_status_check check (status in ('new', 'handled', 'dismissed')),
  constraint class_reports_handled_check check ((status = 'new') = (handled_at is null)));
create unique index if not exists class_reports_open_uq on public.class_reports (reporter_id, kind, target_id) where status = 'new';
alter table public.class_reports enable row level security;
revoke all on public.class_reports, public.class_user_blocks from anon, authenticated;
