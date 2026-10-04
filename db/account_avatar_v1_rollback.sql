-- ROLLBACK cho db/account_avatar_v1_setup.sql. Chạy SAU khi frontend đã về bản trước.
-- Mất ảnh đã đặt ở app_users.avatar_url (ảnh trong bucket 'avatars' vẫn còn). Idempotent.

-- class_public_identity về đúng bản production trước (md5 prosrc 9bda0938…)
create or replace function public.class_public_identity(p_user_id uuid)
returns table(name text, avatar_url text, role text, ht_member boolean)
language sql security definer set search_path = '' stable as $$
  select coalesce(
           nullif(split_part(trim(s.display_name), '@', 1), ''),
           nullif(split_part(trim(s.full_name), '@', 1), ''),
           nullif(split_part(trim(au.name), '@', 1), ''),
           'Thành viên Class'),
         s.avatar_url,
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
revoke all on function public.class_public_identity(uuid) from public, anon, authenticated;

drop function if exists public.class_set_my_avatar(text);
alter table public.app_users drop constraint if exists app_users_avatar_url_check;
alter table public.app_users drop column if exists avatar_url;

notify pgrst, 'reload schema';
