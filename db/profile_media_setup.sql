-- ═══════════════════════════════════════════════════════════════════════════
-- HỒ SƠ — ẢNH BÌA (profile_media). CHƯA CHẠY. Idempotent. Rollback: db/profile_media_rollback.sql.
-- Yêu cầu: db/class_social_posts_setup.sql đã chạy (hàm public.is_class_member()).
--
-- Vì sao bảng riêng, không thêm cột vào edu_students:
--  • edu_students nằm NGOÀI self_managed của rls_setup.sql → policy rộng (mọi tài khoản đăng
--    nhập sửa được hàng của nhau). Ảnh bìa là danh tính → cần policy "chỉ chính chủ ghi".
--  • Thầy/admin không có hàng edu_students nhưng vẫn là thành viên Class.
--  • Khoá theo TÀI KHOẢN (auth.users) — không gắn với một component Social; App học có thể đọc sau.
-- Ảnh đại diện KHÔNG nằm ở đây: nguồn duy nhất vẫn là edu_students.avatar_url (App học đang dùng).
--
-- File ảnh: dùng lại bucket 'avatars' (public, đang dùng cho ảnh đại diện), tên `cover-<uid>-<ms>.jpg`.
-- cover_url BẮT BUỘC trỏ vào bucket đó → không nhét được URL ngoài (pixel theo dõi, ảnh lạ).
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.profile_media (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  cover_url  text,
  updated_at timestamptz not null default now()
);

alter table public.profile_media drop constraint if exists profile_media_cover_url_check;
alter table public.profile_media add constraint profile_media_cover_url_check
  check (cover_url is null or (
    char_length(cover_url) <= 1024
    and cover_url ~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/avatars/cover-[A-Za-z0-9-]+\.(jpg|jpeg|png|webp)$'
  ));

create or replace function public.profile_media_touch()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.user_id    := coalesce(old.user_id, new.user_id);   -- không đổi chủ khi sửa
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists profile_media_touch on public.profile_media;
create trigger profile_media_touch before update on public.profile_media
  for each row execute function public.profile_media_touch();

alter table public.profile_media enable row level security;
revoke all on public.profile_media from anon;
grant select, insert, update, delete on public.profile_media to authenticated;

-- Đọc: thành viên Class (ảnh bìa là danh tính hiển thị trong cộng đồng). Anon: không.
drop policy if exists profile_media_member_read on public.profile_media;
create policy profile_media_member_read on public.profile_media
  for select to authenticated using (public.is_class_member());
-- Ghi: CHỈ chính chủ. Thầy/admin KHÔNG tự sửa ảnh bìa người khác (V1).
drop policy if exists profile_media_own_insert on public.profile_media;
create policy profile_media_own_insert on public.profile_media
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists profile_media_own_update on public.profile_media;
create policy profile_media_own_update on public.profile_media
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists profile_media_own_delete on public.profile_media;
create policy profile_media_own_delete on public.profile_media
  for delete to authenticated using (user_id = auth.uid());

notify pgrst, 'reload schema';
