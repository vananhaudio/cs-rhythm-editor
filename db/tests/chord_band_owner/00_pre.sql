-- Dữ liệu nền TRƯỚC V1.5 (cluster TẠM). Teamlab stub + người dùng + một bài đã duyệt của Admin + một nháp của học viên.
\set ON_ERROR_STOP on
create table public.teamlab_band_roles (band_id uuid, user_id uuid, role text);
create function public.teamlab_is_any_music_editor() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.teamlab_band_roles r join public.app_users u on u.id = r.user_id
                  where r.user_id = auth.uid() and r.role = 'music_editor' and u.status = 'active') $$;
revoke all on function public.teamlab_is_any_music_editor() from public, anon;
grant execute on function public.teamlab_is_any_music_editor() to authenticated;
grant select on public.teamlab_band_roles to authenticated;


-- class_public_identity: bản production (account_avatar_v1) — authenticated KHÔNG gọi trực tiếp được.
alter table public.app_users add column if not exists avatar_url text;
create or replace function public.class_public_identity(p_user_id uuid)
returns table(name text, avatar_url text, role text, ht_member boolean)
language sql stable security definer set search_path to '' as $f$
  select coalesce(
           nullif(split_part(trim(s.display_name), '@', 1), ''),
           nullif(split_part(trim(s.full_name), '@', 1), ''),
           nullif(split_part(trim(au.name), '@', 1), ''),
           'Thành viên Class'),
         coalesce(s.avatar_url, au.avatar_url),
         case when au.role in ('teacher', 'admin') then 'teacher' else 'student' end,
         coalesce(s.ht_member, false)
  from (select p_user_id as uid) x
  left join lateral (
    select es.display_name, es.full_name, es.avatar_url, es.ht_member
    from public.edu_students es where es.user_id = x.uid
    order by es.enrolled_at desc nulls last limit 1
  ) s on true
  left join public.app_users au on au.id = x.uid;
$f$;
revoke all on function public.class_public_identity(uuid) from public, anon, authenticated;

create schema t;
grant usage on schema t to anon, authenticated;
create function t.u(k text) returns uuid language sql immutable as $$
  select case k when 'ED1' then '11111111-1111-4111-8111-111111111111'::uuid when 'ED2' then '22222222-2222-4222-8222-222222222222'::uuid
                when 'LD' then '33333333-3333-4333-8333-333333333333'::uuid when 'ST' then '44444444-4444-4444-8444-444444444444'::uuid
                when 'TE' then '55555555-5555-4555-8555-555555555555'::uuid when 'AD' then '66666666-6666-4666-8666-666666666666'::uuid end $$;
create function t.as_user(k text) returns void language plpgsql as $$ begin
  perform set_config('role', 'postgres', false);
  perform set_config('request.jwt.claims', json_build_object('sub', t.u(k), 'role', 'authenticated')::text, false);
  perform set_config('role', 'authenticated', false);
end $$;
create function t.reset() returns void language plpgsql as $$ begin
  perform set_config('role', 'postgres', false); perform set_config('request.jwt.claims', '{}', false);
end $$;
create table t.res (n serial, ok boolean, msg text);
grant all on t.res to anon, authenticated; grant usage on all sequences in schema t to anon, authenticated;
create function t.ok(cond boolean, msg text) returns void language plpgsql as $$ begin
  insert into t.res(ok, msg) values (coalesce(cond, false), msg);
end $$;
-- Ghi nhận kết quả của MỘT lệnh phải bị chặn với lý do cho trước (null = lý do nào cũng được)
create function t.fails(q text, msg text, p_expect text default null) returns void language plpgsql as $$ begin
  begin execute q;
  exception when others then
    insert into t.res(ok, msg) values (p_expect is null or position(p_expect in sqlerrm) > 0, msg || ' [' || left(sqlerrm, 80) || ']');
    return;
  end;
  insert into t.res(ok, msg) values (false, msg || ' [LẼ RA PHẢI BỊ CHẶN]');
end $$;
create table t.kv (k text primary key, v jsonb);
grant all on t.kv to anon, authenticated;
create function t.put(p_k text, p_v jsonb) returns jsonb language sql as $$
  insert into t.kv values (p_k, p_v) on conflict (k) do update set v = excluded.v returning v $$;
create function t.val(p_k text) returns jsonb language sql as $$ select v from t.kv where k = p_k $$;
create function t.id(p_k text, p_f text default 'version_id') returns uuid language sql as $$ select (v ->> p_f)::uuid from t.kv where k = p_k $$;
grant execute on all functions in schema t to anon, authenticated;

do $$ declare k text; begin
  foreach k in array array['ED1','ED2','LD','ST','TE','AD'] loop
    insert into auth.users (id, email) values (t.u(k), lower(k) || '@test.local');
    insert into public.app_users (id, name, role, status)
    values (t.u(k), 'Tên ' || k, case k when 'TE' then 'teacher' when 'AD' then 'admin' else 'student' end, 'active');
  end loop;
end $$;
-- Stub production: teamlab_bands + teamlab_is_band_editor (đúng ngữ nghĩa: vai music_editor của CHÍNH người gọi, theo Band).
create table public.teamlab_bands (id uuid primary key default gen_random_uuid(), name text not null);
create function public.teamlab_is_band_editor(p_band_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select p_band_id is not null and exists (select 1 from public.teamlab_band_roles r join public.app_users u on u.id = r.user_id
   where r.band_id = p_band_id and r.user_id = auth.uid() and r.role = 'music_editor' and u.status = 'active') $$;
revoke all on function public.teamlab_is_band_editor(uuid) from public, anon;
grant execute on function public.teamlab_is_band_editor(uuid) to authenticated;
grant select on public.teamlab_bands to authenticated;
insert into public.teamlab_bands values ('aaaaaaaa-0000-4000-8000-00000000000a', 'Band A'), ('bbbbbbbb-0000-4000-8000-00000000000b', 'Band B');
insert into public.teamlab_band_roles values ('aaaaaaaa-0000-4000-8000-00000000000a', t.u('ED1'), 'music_editor'),
  ('bbbbbbbb-0000-4000-8000-00000000000b', t.u('ED2'), 'music_editor'),
  ('aaaaaaaa-0000-4000-8000-00000000000a', t.u('LD'), 'leader');

-- Bài đã duyệt của Admin + nháp của học viên (cơ chế CŨ)
select t.as_user('AD');
select t.put('admin_sheet', public.chord_sheet_contribute('Chiều [Am] nao tiễn nhau [E7] đi', 'Bài của Admin', 'Nhạc sĩ A', '{"beats":4,"beatType":4}'));
select public.chord_sheet_approve(t.id('admin_sheet'));
select t.as_user('ST');
select t.put('st_draft', public.chord_sheet_contribute('Hoàng [Dm] hôn [G] đây', 'Nháp học viên'));
select t.reset();
-- Vân tay bản hiện có (không tính cột mới)
create table t.fp0 as select md5(string_agg(v::text, '|' order by v.id)) fp from public.chord_sheet_versions v;
create table t.fps0 as select md5(string_agg(s.id::text || s.title || coalesce(s.composer,'') || coalesce(s.canonical_version_id::text,'') || s.created_by::text || s.updated_at::text, '|' order by s.id)) fp from public.chord_sheets s;
