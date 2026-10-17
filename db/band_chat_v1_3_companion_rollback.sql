-- ROLLBACK Band Chat V1.3 — bandchat_access về định nghĩa V1 (Thầy/Admin chỉ ĐỌC khi không là thành viên). Không đụng dữ liệu/tin nhắn. Không begin/commit.
create or replace function public.bandchat_access(p_band uuid)
returns text language plpgsql security definer set search_path = '' stable as $$
begin
  if auth.uid() is null or p_band is null then return null; end if;
  if exists (select 1 from public.bandchat_rooms r where r.band_id = p_band and r.archived_at is not null) then
    if exists (select 1 from public.bandchat_frozen f where f.band_id = p_band and f.user_id = auth.uid()) or public.is_teacher() then return 'read'; end if;
    return null;
  end if;
  if exists (select 1 from public.teamlab_band_members m where m.band_id = p_band and m.user_id = auth.uid()) then return 'send'; end if;
  if public.is_teacher() then return 'read'; end if;
  return null;
end $$;
comment on function public.bandchat_access(uuid) is 'bandchat_v1: quyền của người gọi với nhóm (null|read|send)';
revoke all on function public.bandchat_access(uuid) from public, anon, authenticated;
drop function if exists public.bandchat_is_companion();
notify pgrst, 'reload schema';
