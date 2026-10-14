-- TEST-ONLY (stack E2E cục bộ): bảng TeamLab tối thiểu để kiểm Feed "bài mới phát hành". KHÔNG chạy trên production.
create table if not exists public.projects (id uuid primary key, name text not null, cover_path text, avatar_path text);
create table if not exists public.teamlab_bands (id uuid primary key, name text not null);
create table if not exists public.teams (id uuid primary key, name text not null, band_id uuid, project_id uuid);
create table if not exists public.teamlab_publications (
  id uuid primary key default gen_random_uuid(), project_id uuid not null, song_id uuid not null, status text not null,
  published_at timestamptz, public_slug text, created_at timestamptz default now());
