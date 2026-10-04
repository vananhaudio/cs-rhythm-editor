-- Fixture cho cluster PostgreSQL TẠM (scripts/test-chord-library-db.sh). KHÔNG chạy trên production.
-- Nạp SAU social_fixture.sql + community_setup.sql, TRƯỚC nhipphach_capabilities_setup.sql.
-- Giả lập phần production mà Thư viện hợp âm dựa vào: edu_tools, schema storage, và một bảng
-- musicxml_library THẾ THÂN để chứng minh migration không đụng tới kho MusicXML.

-- edu_tools: DDL không có trong repo — các cột dưới đây là các cột nhipphach_capabilities_setup.sql ghi.
create table public.edu_tools (
  id text primary key, name text, description text, icon text, category text, route text,
  tier text, enabled boolean default true, status text, order_index integer, config jsonb
);
create role service_role nologin bypassrls;
grant usage on schema public to service_role;

-- Storage như Supabase: objects bật RLS, quyền bảng cấp rộng — policy mới là thứ chặn.
create schema storage;
grant usage on schema storage to anon, authenticated, service_role;
create table storage.buckets (
  id text primary key, name text not null unique, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id), name text, owner uuid, metadata jsonb,
  created_at timestamptz default now(), unique (bucket_id, name)
);
alter table storage.objects enable row level security;
alter table storage.buckets enable row level security;
grant select, insert, update, delete on storage.objects, storage.buckets to anon, authenticated;
create function storage.foldername(name text) returns text[] language plpgsql immutable as $$
declare _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1:array_length(_parts, 1) - 1];
end $$;
grant execute on function storage.foldername(text) to anon, authenticated;

-- Kho MusicXML thế thân (cột như src/thuvien/masterLibrary.ts đọc/ghi) + policy riêng + 1 dòng.
create table public.musicxml_library (
  id uuid primary key default gen_random_uuid(), title text not null, composer text,
  original_filename text, musicxml_text text, content_hash text, size_bytes integer,
  created_by uuid, created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table public.musicxml_library enable row level security;
create policy musicxml_library_fixture_policy on public.musicxml_library
  for all to authenticated using (true) with check (true);
insert into public.musicxml_library (id, title, composer, original_filename, musicxml_text, content_hash, size_bytes)
values ('11111111-0000-4000-8000-000000000001', 'Diễm Xưa', 'Trịnh Công Sơn', 'diem-xua.musicxml', '<score-partwise/>', repeat('a', 64), 17);

-- Admin riêng (X) để phân biệt với thầy (T): is_teacher() gộp cả hai, is_admin() thì không.
insert into auth.users (id, email) values ('ffffffff-0000-4000-8000-00000000000f', 'x@test.local');
insert into public.app_users (id, role, name, email) values ('ffffffff-0000-4000-8000-00000000000f', 'admin', 'Quản trị', 'x@test.local');
