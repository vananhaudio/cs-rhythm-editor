-- ACCOUNT AVATAR V1 — tài khoản KHÔNG có hồ sơ học sinh (Thầy/admin) tự đổi ảnh đại diện của CHÍNH MÌNH.
-- Chạy bằng scripts/prod-db.py (một transaction; file không có begin/commit). Idempotent.
--
-- Nguồn avatar chuẩn KHÔNG đổi: class_public_identity(user_id). Chỉ nối thêm bậc dự phòng cho ảnh,
-- y hệt luật tên đã có (display_name → full_name → app_users.name):
--     avatar = edu_students.avatar_url (hàng mới nhất) → app_users.avatar_url
-- Học sinh vẫn ghi edu_students.avatar_url như cũ (App học + /me); app_users.avatar_url chỉ ghi được
-- qua RPC class_set_my_avatar khi tài khoản KHÔNG có hàng edu_students → mỗi người vẫn một ảnh.
-- app_users vẫn chỉ-đọc với authenticated (rls_setup.sql) → RPC không mở UPDATE role.

-- 1) Cột ảnh trên app_users (chỉ URL https; null = chưa có ảnh)
alter table public.app_users add column if not exists avatar_url text;
alter table public.app_users drop constraint if exists app_users_avatar_url_check;
alter table public.app_users add constraint app_users_avatar_url_check
  check (avatar_url is null or (avatar_url ~ '^https://' and length(avatar_url) <= 1024));

-- 2) Danh tính công khai: thêm bậc dự phòng ảnh app_users (chữ ký + các cột khác giữ nguyên)
create or replace function public.class_public_identity(p_user_id uuid)
returns table(name text, avatar_url text, role text, ht_member boolean)
language sql security definer set search_path = '' stable as $$
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
$$;
revoke all on function public.class_public_identity(uuid) from public, anon, authenticated;  -- chỉ dùng nội bộ RPC

-- 3) Tự đổi ảnh: CHỈ hàng của auth.uid(); URL phải là ảnh của chính mình trong bucket 'avatars'
--    (đường dẫn <auth.uid()>-<ms>.jpg do /me tải lên). Có hồ sơ học sinh → từ chối (ghi edu_students như cũ).
create or replace function public.class_set_my_avatar(p_url text)
returns text
language plpgsql security definer set search_path = '' volatile as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if p_url is null or p_url !~ ('^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/avatars/'
                                 || v_uid::text || '-[0-9]{10,16}\.jpg$') then
    raise exception 'invalid_avatar_url' using errcode = '22023';
  end if;
  if exists (select 1 from public.edu_students es where es.user_id = v_uid) then
    raise exception 'use_student_profile' using errcode = '42501';
  end if;
  update public.app_users set avatar_url = p_url where id = v_uid;
  if not found then raise exception 'no_account' using errcode = '42501'; end if;
  return p_url;
end $$;
comment on function public.class_set_my_avatar(text) is 'account_avatar_v1: tự đổi ảnh đại diện (tài khoản không có edu_students)';
revoke all on function public.class_set_my_avatar(text) from public, anon;
grant execute on function public.class_set_my_avatar(text) to authenticated;

notify pgrst, 'reload schema';
