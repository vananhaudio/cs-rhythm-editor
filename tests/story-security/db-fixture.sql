-- Dựng lại grant + policy của production (đọc 26/11/2026) trên PostgreSQL trống.
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create schema storage;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('t.uid', true),'')::uuid $$;
grant usage on schema auth, public to anon, authenticated, service_role;
create table storage.buckets (id text primary key, public boolean, allowed_mime_types text[], file_size_limit bigint);
insert into storage.buckets values ('story-photos', true, null, null);
create table public.stories (id uuid primary key, user_id uuid not null, status text not null, title text, slug text, story_number int, content text,
  conversation jsonb not null default '[]', zalo text, ai_review jsonb, pen_name text, author_name text, published_at timestamptz, updated_at timestamptz default now());
-- cột dùng ở Lát 0.1 (production cấp cho authenticated toàn bộ; anon đọc phần giới thiệu tác giả)
alter table public.stories add column slug_unused int, add column featured boolean default false, add column created_at timestamptz default now(), add column submitted_at timestamptz,
  add column author_full_name text, add column author_age int, add column author_hometown text, add column author_living_in text, add column author_job text, add column author_bio text,
  add column author_portrait_url text, add column consent_bio_publish boolean default false, add column consent_publish boolean default false;
create table public.story_chunks (id bigint generated always as identity primary key, story_id uuid references public.stories(id) on delete cascade, content text);
create table public.story_comments (id bigint generated always as identity primary key, story_id uuid, user_id uuid, content text);
alter table public.stories enable row level security; alter table public.story_chunks enable row level security; alter table public.story_comments enable row level security;
grant select (id,status,title,slug,content,pen_name,published_at) on public.stories to anon;
grant select (id,user_id,status,title,slug,story_number,content,conversation,zalo,ai_review,pen_name,author_name,published_at,updated_at),
      insert (id,user_id,status,title,conversation,zalo,pen_name), update (status,title,conversation) on public.stories to authenticated;
grant delete on public.stories to authenticated;
grant select (featured,created_at,submitted_at,author_full_name,author_age,author_hometown,author_living_in,author_job,author_bio,author_portrait_url,consent_bio_publish,consent_publish),
  insert (slug,story_number,content,published_at,featured,created_at,ai_review,consent_publish), update (slug,story_number,content,published_at,featured,created_at,ai_review,user_id,pen_name,submitted_at,consent_publish,author_full_name,author_age,author_hometown,author_living_in,author_job,author_bio,author_portrait_url,consent_bio_publish) on public.stories to authenticated;
grant select (author_full_name,author_age,author_living_in,consent_bio_publish) on public.stories to anon;
create policy stories_own_update on public.stories for all to public;
grant all on public.stories to service_role;
grant select on public.story_chunks to anon; grant select,insert,update,delete on public.story_chunks to authenticated;
grant select on public.story_comments to anon; grant select,insert,update,delete on public.story_comments to authenticated;
create policy stories_public_read on public.stories for select to anon, authenticated using (status='published');
create policy stories_own_read on public.stories for select to authenticated using (user_id=auth.uid());
create policy stories_own_insert on public.stories for insert to authenticated with check (user_id=auth.uid() and status in ('telling','collecting_photos','writing','user_review'));
create policy chunks_own_read on public.story_chunks for select to authenticated using (exists(select 1 from public.stories s where s.id=story_id and s.user_id=auth.uid()));
create policy chunks_public_read on public.story_chunks for select to anon, authenticated using (exists(select 1 from public.stories s where s.id=story_id and s.status='published'));
create policy sc_own_insert on public.story_comments for insert to authenticated with check (user_id=auth.uid());

insert into public.stories (id,user_id,status,title,slug,story_number,content,conversation,zalo,pen_name,author_name,published_at) values
 ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-0000000000aa','published','A','a-1',1,'nội dung','[{"role":"user","text":"RIENG"}]','0900','x@y.com','x@y.com','2026-07-01'),
 ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-0000000000aa','telling','B',null,null,null,'[{"role":"user","text":"NHAP"}]',null,'Lan','Lan',null);
insert into public.story_chunks (story_id,content) values ('00000000-0000-4000-8000-000000000001','LOI KE THO');
