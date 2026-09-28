-- Fixture cho cluster PostgreSQL TẠM (scripts/test-friends-wall-db.sh). KHÔNG chạy trên production.
-- Giả lập đúng phần baseline production mà Social dựa vào: auth.users + auth.uid(), vai trò
-- anon/authenticated, default privileges RỘNG (production cấp mọi quyền bảng + EXECUTE hàm mới),
-- app_users (authenticated chỉ đọc), edu_students (policy rộng `rls_authenticated_all` như hiện nay).

create schema auth;
create role anon nologin;
create role authenticated nologin;
create role authenticator login password 'authenticator' noinherit;
grant anon, authenticated to authenticator;
grant usage on schema public, auth to anon, authenticated;
alter default privileges in schema public grant select, insert, update, delete, truncate, trigger, references on tables to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
alter default privileges in schema public grant usage, select, update on sequences to anon, authenticated;

create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  nullif(current_setting('request.jwt.claims', true), '')::json->>'sub')::uuid
$$;
grant execute on function auth.uid() to anon, authenticated;

create table public.app_users (
  id uuid primary key references auth.users(id), role text, status text default 'active', name text, email text
);
create table public.edu_students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  full_name text, display_name text, email text, phone text, avatar_url text,
  level text, enrolled_at timestamptz default now(), ht_member boolean not null default false,
  is_active boolean default true
);
alter table public.app_users enable row level security;
create policy rls_authenticated_read on public.app_users for select to authenticated using (true);
alter table public.edu_students enable row level security;
create policy rls_authenticated_all on public.edu_students for all to authenticated using (true) with check (true);

-- Identity test: A, B, C (học sinh) · T (thầy) · N (tài khoản không thuộc Class)
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-00000000000a', 'a@test.local'),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'b@test.local'),
  ('cccccccc-0000-4000-8000-00000000000c', 'c@test.local'),
  ('dddddddd-0000-4000-8000-00000000000d', 't@test.local'),
  ('eeeeeeee-0000-4000-8000-00000000000e', 'n@test.local');
insert into public.app_users (id, role, name, email) values
  ('aaaaaaaa-0000-4000-8000-00000000000a', 'student', 'An', 'a@test.local'),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'student', 'Bình', 'b@test.local'),
  ('cccccccc-0000-4000-8000-00000000000c', 'student', 'Chi', 'c@test.local'),
  ('dddddddd-0000-4000-8000-00000000000d', 'teacher', 'Thầy Văn Anh', 't@test.local'),
  ('eeeeeeee-0000-4000-8000-00000000000e', 'student', 'Người ngoài', 'n@test.local');
insert into public.edu_students (user_id, full_name, display_name, email, phone, level) values
  ('aaaaaaaa-0000-4000-8000-00000000000a', 'Nguyễn An', 'An', 'a@test.local', '0900000001', 'beginner'),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'Trần Bình', 'Bình', 'b@test.local', '0900000002', 'elementary'),
  ('cccccccc-0000-4000-8000-00000000000c', 'Lê Chi', 'Chi', 'c@test.local', '0900000003', 'beginner');
