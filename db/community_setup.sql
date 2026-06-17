-- =====================================================================
-- TVA Guitar — "Cộng đồng của bạn" — Phần 1: nền dữ liệu
-- (Facebook chung cho mọi học viên + nhóm Zalo riêng gán theo lớp)
--
-- Đã qua kiểm tra đối kháng. Bảo mật:
--   - claim_group: học viên tự xác nhận nhóm bằng TOKEN (không nhận group_id
--     từ client) → không tự gán bừa.
--   - edu_groups / edu_group_claim_tokens: chỉ teacher đọc/ghi trực tiếp;
--     học viên xem nhóm của mình qua RPC my_groups (SECURITY DEFINER).
--   - anon bị thu hồi mọi quyền thực thi RPC.
--   - 3 bảng này TỰ QUẢN RLS → db/rls_setup.sql đã được sửa để BỎ QUA chúng.
--
-- ⚠️ Bảo mật của is_teacher() PHỤ THUỘC app_users.role không tự sửa được.
--    PHẢI chạy db/rls_setup.sql (bản mới) để khóa app_users chỉ-đọc, nếu không
--    học viên có thể tự UPDATE role='admin' rồi vượt mọi cổng teacher.
--
-- Idempotent: chạy lại vô hại.
-- =====================================================================

-- ── KIỂM TRA TRƯỚC (tùy chọn): nếu trả về dòng nào, BÁO LẠI trước khi chạy
--    (tránh đè hàm/bảng đã tồn tại sẵn trên DB) ──
--   SELECT proname FROM pg_proc WHERE proname IN ('is_teacher','claim_group','my_groups');
--   SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'edu_group%';

-- ── 1) Bảng ──
create table if not exists public.edu_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  group_type text not null default 'zalo',   -- 'facebook' (chung) | 'zalo' (riêng)
  zalo_url text,
  facebook_url text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.edu_group_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid not null references public.edu_groups(id) on delete cascade,
  source text not null default 'admin',     -- 'admin' | 'claim_link' | 'manual_import'
  status text not null default 'active',    -- 'active' | 'pending' | 'removed'
  created_at timestamptz not null default now(),
  unique(user_id, group_id)
);

create table if not exists public.edu_group_claim_tokens (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.edu_groups(id) on delete cascade,
  token text not null unique,
  is_active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── 2) Helper: caller có phải teacher/admin ──
create or replace function public.is_teacher()
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (select 1 from public.app_users au
                 where au.id = auth.uid() and au.role in ('teacher','admin'));
$$;

-- ── 3) RLS ──
alter table public.edu_groups             enable row level security;
alter table public.edu_group_members      enable row level security;
alter table public.edu_group_claim_tokens enable row level security;

drop policy if exists eg_teacher_all on public.edu_groups;
create policy eg_teacher_all on public.edu_groups
  for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

drop policy if exists egm_teacher_all on public.edu_group_members;
create policy egm_teacher_all on public.edu_group_members
  for all to authenticated using (public.is_teacher()) with check (public.is_teacher());
drop policy if exists egm_self_read on public.edu_group_members;
create policy egm_self_read on public.edu_group_members
  for select to authenticated using (user_id = auth.uid());

drop policy if exists egct_teacher_all on public.edu_group_claim_tokens;
create policy egct_teacher_all on public.edu_group_claim_tokens
  for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

-- ── 4) RPC: học viên tự xác nhận nhóm bằng token ──
create or replace function public.claim_group(p_token text)
returns table (group_id uuid, group_name text)
language plpgsql security definer set search_path = '' as $$
declare v_group_id uuid; v_name text;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  select t.group_id, g.name into v_group_id, v_name
  from public.edu_group_claim_tokens t
  join public.edu_groups g on g.id = t.group_id
  where t.token = p_token and t.is_active = true
    and (t.expires_at is null or t.expires_at > now()) and g.is_active = true;
  if v_group_id is null then
    raise exception 'Link xác nhận không hợp lệ hoặc đã hết hạn';
  end if;
  insert into public.edu_group_members (user_id, group_id, source, status)
  values (auth.uid(), v_group_id, 'claim_link', 'active')
  on conflict (user_id, group_id) do update set status = 'active';
  return query select v_group_id, v_name;
end; $$;

-- ── 5) RPC: cộng đồng của user hiện tại (Facebook chung + Zalo đã gán) ──
create or replace function public.my_groups()
returns table (id uuid, name text, group_type text, zalo_url text, facebook_url text)
language sql security definer set search_path = '' stable as $$
  select g.id, g.name, g.group_type, g.zalo_url, g.facebook_url
  from public.edu_groups g
  where g.is_active = true and g.group_type = 'facebook'
  union
  select g.id, g.name, g.group_type, g.zalo_url, g.facebook_url
  from public.edu_groups g
  join public.edu_group_members m on m.group_id = g.id
  where g.is_active = true and g.group_type <> 'facebook'
    and m.user_id = auth.uid() and m.status = 'active';
$$;

-- ── 6) Quyền thực thi RPC ──
revoke all on function public.is_teacher()        from public, anon;
grant  execute on function public.is_teacher()    to authenticated;
revoke all on function public.claim_group(text)   from public, anon;
grant  execute on function public.claim_group(text) to authenticated;
revoke all on function public.my_groups()         from public, anon;
grant  execute on function public.my_groups()     to authenticated;

notify pgrst, 'reload schema';
