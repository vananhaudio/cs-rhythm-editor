-- ROLLBACK — Play Scroll Share V1. Chạy bằng scripts/prod-db.py. Quay FE TRƯỚC (ẩn nút Chia sẻ + thẻ), rồi chạy file này.
-- Từ chối nếu còn tin DM chord_sheet (mất tham chiếu); bài Feed chord_sheet (dữ liệu dẫn xuất) được xoá.
do $gate$ begin
  if exists (select 1 from public.dm_messages where ref_type = 'chord_sheet') then
    raise exception 'DỪNG — còn tin Chat tham chiếu chord_sheet; không rollback khi chưa xử lý';
  end if;
end $gate$;
delete from public.class_posts where type = 'tool_share' and tool_share ->> 'tool' = 'chord_sheet';
alter table public.dm_messages drop constraint if exists dm_messages_ref_valid_check;
alter table public.dm_messages add constraint dm_messages_ref_valid_check check (
  ref_type is null or (ref_type in ('tool_artifact', 'class', 'class_session')
                       and ref_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'));

create or replace function public.dm_share(p_user uuid, p_ref_type text, p_ref_key text)
returns table(conversation_id uuid, seq bigint) language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_key text := lower(coalesce(p_ref_key, '')); v_conv uuid; v_seq bigint; v_ok boolean := false;
begin
  if v_me is null or not public.is_class_member() then raise exception 'Chưa đăng nhập Class' using errcode = '42501'; end if;
  if not public.dm_rule(v_me, p_user) then raise exception 'Bạn chưa thể nhắn tin cho người này' using errcode = '42501'; end if;
  if v_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    if p_ref_type = 'tool_artifact' then
      v_ok := exists (select 1 from public.tool_artifacts a
                       where a.id = v_key::uuid and ((a.tool = 'bms' and a.kind = 'song') or (a.tool = 'nhipphach' and a.kind = 'score'))
                         and (a.owner_id = v_me or a.visibility = 'class'));
    elsif p_ref_type = 'class' then
      v_ok := exists (select 1 from public.class_schedule c where c.id = v_key::uuid)
              and (public.is_teacher() or public.social_class_is_member(v_key::uuid, v_me));
    elsif p_ref_type = 'class_session' then
      v_ok := exists (select 1 from public.class_sessions s where s.id = v_key::uuid and s.event_type = 'lesson'
                       and (public.is_teacher() or public.social_class_is_member(s.class_id, v_me)));
    end if;
  end if;
  if not v_ok then raise exception 'Nội dung này không thể chia sẻ' using errcode = '22023'; end if;
  v_conv := public.dm_open(v_me, p_user);
  v_seq := public.dm_append(v_conv, v_me, null, p_ref_type, v_key);
  return query select v_conv, v_seq;
end $$;
comment on function public.dm_share(uuid, text, text) is 'universal_share_v1: chia sẻ tham chiếu (artifact | lớp | buổi học) cho bạn';
revoke all on function public.dm_share(uuid, text, text) from public, anon;
grant execute on function public.dm_share(uuid, text, text) to authenticated;


drop function if exists public.social_share_chord_sheet(uuid);
drop function if exists public.chord_share_card(uuid[]);
drop function if exists public.chord_share_ok(uuid);
notify pgrst, 'reload schema';
