-- =====================================================================
-- 1001 CÂU CHUYỆN CÙNG GUITAR (/story) — NỀN DỮ LIỆU
-- Project Supabase: wojmdilyflffvdtpovmq · chạy trong SQL Editor
--
-- Thiết kế & giải thích: ~/App/1001 câu chuyện/docs/database.md
-- UX flow tham chiếu:    ~/App/1001 câu chuyện/docs/UX-FLOW-KE-CHUYEN.md
--
-- AN TOÀN: chỉ THÊM bảng mới + policy hẹp riêng. KHÔNG đụng dữ liệu hay
-- quyền của các bảng cũ. Idempotent — chạy lại nhiều lần vô hại.
--
-- ⚠️ 'stories' và 'story_comments' PHẢI có trong mảng self_managed của
-- db/rls_setup.sql (đã thêm cùng đợt với file này) — nếu không, chạy lại
-- rls_setup sẽ đè policy hẹp bên dưới bằng policy rộng.
--
-- Sau khi chạy: NOTIFY pgrst, 'reload schema';  (đã có ở cuối file)
-- =====================================================================

-- ── 1) CÂU CHUYỆN (stories) — mỗi dòng = một câu chuyện ──────────────
-- 7 trạng thái theo UX flow + 'unpublished' (thầy gỡ bài khi giám sát):
--   telling            Đang kể            (trò chuyện với Mira)
--   collecting_photos  Đang thu thập ảnh
--   writing            Đang viết          (Mira viết bài)
--   user_review        Chờ người dùng duyệt
--   submitted          Đã gửi biên tập    (AI biên tập đang đọc)
--   pending_publish    Chờ xuất bản
--   published          Đã xuất bản
--   unpublished        Đã gỡ              (thầy gỡ sau xuất bản — hiếm)
create table if not exists public.stories (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,              -- auth.uid() — tài khoản học sinh sẵn có (app_users)
  status        text not null default 'telling'
                check (status in ('telling','collecting_photos','writing','user_review',
                                  'submitted','pending_publish','published','unpublished')),

  -- Nội dung bài (Mira viết ở bước B4, người dùng sửa ở B5)
  title         text,
  slug          text unique,                -- gán khi xuất bản
  topic         text,                       -- chủ đề (10 chủ đề gợi ý hoặc tự do)
  content       text,                       -- bài hoàn chỉnh (markdown)

  -- Chất liệu thô (nguồn để Mira viết + nháp tự lưu, kể tiếp đa thiết bị)
  conversation  jsonb not null default '[]'::jsonb,  -- [{role:'mira'|'user', text, at}]
  photos        jsonb not null default '[]'::jsonb,  -- [{url, caption}] — tối đa 3, Storage bucket story-photos

  -- Ký tên (B6)
  pen_name      text,                       -- tên hoặc bút danh
  location      text,                       -- địa phương
  zalo          text,                       -- tùy chọn — kênh báo tin thêm (app + email luôn có)

  -- Biên tập & xuất bản (B7–B8)
  ai_review     jsonb,                      -- {verdict:'ok'|'need_more'|'escalate', notes, at}
  story_number  int unique,                 -- số thứ tự #N/1001 — gán khi xuất bản
  submitted_at  timestamptz,
  published_at  timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists stories_user_idx      on public.stories (user_id);
create index if not exists stories_status_idx    on public.stories (status);
create index if not exists stories_published_idx on public.stories (status, published_at desc);

-- Tự cập nhật updated_at
create or replace function public.stories_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists stories_touch_updated_at on public.stories;
create trigger stories_touch_updated_at
  before update on public.stories
  for each row execute function public.stories_touch_updated_at();

alter table public.stories enable row level security;

drop policy if exists "stories_public_read"   on public.stories;
drop policy if exists "stories_own_read"      on public.stories;
drop policy if exists "stories_own_insert"    on public.stories;
drop policy if exists "stories_own_update"    on public.stories;
drop policy if exists "stories_own_delete"    on public.stories;
drop policy if exists "stories_teacher_all"   on public.stories;

-- Công khai (anon + đã đăng nhập) CHỈ đọc bài ĐÃ XUẤT BẢN
create policy "stories_public_read" on public.stories
  for select to anon, authenticated using (status = 'published');

-- Người kể đọc bài của MÌNH ở mọi trạng thái (trang "Câu chuyện của tôi")
create policy "stories_own_read" on public.stories
  for select to authenticated using (user_id = auth.uid());

-- Người kể tạo bài của mình, trạng thái bắt đầu là luồng kể
create policy "stories_own_insert" on public.stories
  for insert to authenticated
  with check (user_id = auth.uid()
              and status in ('telling','collecting_photos','writing','user_review'));

-- Người kể sửa bài của mình KHI CÒN TRONG TAY MÌNH (trước khi gửi biên tập);
-- bước "Gửi" = tự chuyển sang submitted. Sau đó chỉ AI biên tập (service role,
-- vượt RLS trong Edge Function) mới chuyển tiếp: submitted → pending_publish
-- → published (+ gán slug, story_number) — người kể KHÔNG tự xuất bản được.
create policy "stories_own_update" on public.stories
  for update to authenticated
  using (user_id = auth.uid()
         and status in ('telling','collecting_photos','writing','user_review'))
  with check (user_id = auth.uid()
              and status in ('telling','collecting_photos','writing','user_review','submitted'));

-- Người kể xoá nháp của mình (chưa gửi biên tập)
create policy "stories_own_delete" on public.stories
  for delete to authenticated
  using (user_id = auth.uid()
         and status in ('telling','collecting_photos','writing','user_review'));

-- Thầy (giám sát) toàn quyền — is_teacher() có sẵn từ db/community_setup.sql
create policy "stories_teacher_all" on public.stories
  for all to authenticated using (public.is_teacher()) with check (public.is_teacher());


-- ── 2) BÌNH LUẬN (story_comments) — cho trang chi tiết /story/:slug ──
-- Tạo sẵn cùng đợt (UI bình luận làm ở hạng mục sau).
create table if not exists public.story_comments (
  id          bigint generated always as identity primary key,
  story_id    uuid not null references public.stories(id) on delete cascade,
  user_id     uuid not null,               -- auth.uid()
  author_name text not null,               -- tên hiển thị (chốt tại thời điểm bình luận)
  content     text not null,
  hidden      boolean not null default false,  -- thầy ẩn khi giám sát
  created_at  timestamptz not null default now()
);

create index if not exists story_comments_story_idx on public.story_comments (story_id, created_at);

alter table public.story_comments enable row level security;

drop policy if exists "sc_public_read"  on public.story_comments;
drop policy if exists "sc_own_insert"   on public.story_comments;
drop policy if exists "sc_own_delete"   on public.story_comments;
drop policy if exists "sc_teacher_all"  on public.story_comments;

-- Ai cũng đọc bình luận CHƯA BỊ ẨN của bài ĐÃ XUẤT BẢN
create policy "sc_public_read" on public.story_comments
  for select to anon, authenticated
  using (hidden = false
         and exists (select 1 from public.stories s
                     where s.id = story_id and s.status = 'published'));

-- Đã đăng nhập mới được bình luận, và chỉ đứng tên chính mình
create policy "sc_own_insert" on public.story_comments
  for insert to authenticated with check (user_id = auth.uid());

-- Xoá bình luận của chính mình
create policy "sc_own_delete" on public.story_comments
  for delete to authenticated using (user_id = auth.uid());

-- Thầy toàn quyền (ẩn/xoá khi giám sát)
create policy "sc_teacher_all" on public.story_comments
  for all to authenticated using (public.is_teacher()) with check (public.is_teacher());


-- ── 3) STORAGE — bucket ảnh câu chuyện ───────────────────────────────
-- Bucket công khai (đọc), upload theo thư mục của từng người: {auth.uid()}/...
insert into storage.buckets (id, name, public)
values ('story-photos', 'story-photos', true)
on conflict (id) do nothing;

drop policy if exists "story_photos_own_insert" on storage.objects;
drop policy if exists "story_photos_own_update" on storage.objects;
drop policy if exists "story_photos_own_delete" on storage.objects;

create policy "story_photos_own_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'story-photos'
              and (storage.foldername(name))[1] = auth.uid()::text);
create policy "story_photos_own_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'story-photos'
         and (storage.foldername(name))[1] = auth.uid()::text);
create policy "story_photos_own_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'story-photos'
         and (storage.foldername(name))[1] = auth.uid()::text);


-- ── 4) Nạp lại schema cho PostgREST ──────────────────────────────────
NOTIFY pgrst, 'reload schema';
