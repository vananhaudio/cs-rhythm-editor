-- ROLLBACK Band Chat V1.1 — về hàm V1: bandchat_members không còn group_role; gỡ 2 hàm nội bộ.
-- KHÔNG xoá bảng, KHÔNG đụng tin nhắn/dữ liệu. Idempotent. Không begin/commit (prod-db sở hữu transaction).
drop function if exists public.bandchat_can_admin(uuid);
drop function if exists public.bandchat_members(uuid);
create function public.bandchat_members(p_band uuid)
returns table(user_id uuid, name text, avatar_url text, role text)
language plpgsql security definer set search_path = '' stable as $$
declare v_archived boolean;
begin
  if auth.uid() is null or public.bandchat_access(p_band) is null then
    raise exception 'Không tìm thấy cuộc trò chuyện' using errcode = 'P0002';
  end if;
  select (r.archived_at is not null) into v_archived from public.bandchat_rooms r where r.band_id = p_band;
  return query
  select u.uid, i.name, i.avatar_url, i.role
    from (select m.user_id uid from public.teamlab_band_members m where m.band_id = p_band and not coalesce(v_archived, false)
          union select f.user_id from public.bandchat_frozen f where f.band_id = p_band and coalesce(v_archived, false)) u
    cross join lateral public.class_public_identity(u.uid) i
   order by i.name, u.uid
   limit 200;
end $$;
comment on function public.bandchat_members(uuid) is 'bandchat_v1: thành viên nhóm';
revoke all on function public.bandchat_members(uuid) from public, anon;
grant execute on function public.bandchat_members(uuid) to authenticated;
drop function if exists public.bandchat_group_role(uuid, uuid);
