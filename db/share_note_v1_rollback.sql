-- Rollback Share Note V1 (db/share_note_v1_setup.sql). Không begin/commit. Chạy lại an toàn (idempotent).
-- GIỮ DỮ LIỆU: tin Chat share_note còn → giữ CHECK rộng (không làm hỏng hàng cũ); bảng share_notes còn hàng → GIỮ bảng (đóng, không ai đọc được).
-- Bài Feed tool 'share_note' được giữ (frontend cũ hiện thẻ nhẹ "không hiển thị được", không lỗi). Giáo trình / bản nhạc không bị chạm.
drop function if exists public.social_share_share_note(uuid);
drop function if exists public.share_note_delete(uuid);
drop function if exists public.share_note_card(uuid[]);
drop function if exists public.share_note_open(uuid);
drop function if exists public.share_note_create(uuid, integer, text[], integer, integer, text, text);

-- dm_share về NGUYÊN VĂN baseline chord_share_v1 (md5 prosrc 202766fca632bc9cf22d092b07f0251b)
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
    elsif p_ref_type = 'chord_sheet' then
      v_ok := public.chord_share_ok(v_key::uuid);
    end if;
  end if;
  if not v_ok then raise exception 'Nội dung này không thể chia sẻ' using errcode = '22023'; end if;
  v_conv := public.dm_open(v_me, p_user);
  v_seq := public.dm_append(v_conv, v_me, null, p_ref_type, v_key);
  return query select v_conv, v_seq;
end $$;
comment on function public.dm_share(uuid, text, text) is 'universal_share_v1 + chord_share_v1: chia sẻ tham chiếu (artifact | lớp | buổi học | hợp âm) cho bạn';
revoke all on function public.dm_share(uuid, text, text) from public, anon;
grant execute on function public.dm_share(uuid, text, text) to authenticated;
comment on function public.dm_share(uuid, text, text) is 'universal_share_v1 + chord_share_v1: chia sẻ tham chiếu (artifact | lớp | buổi học | hợp âm) cho bạn';

drop function if exists public.share_note_visible(uuid);
drop function if exists public.share_note_score_ok(uuid);
drop function if exists public.share_note_tex(uuid, integer, text[]);

do $$
begin
  if not exists (select 1 from public.dm_messages where ref_type = 'share_note') then
    alter table public.dm_messages drop constraint if exists dm_messages_ref_valid_check;
    alter table public.dm_messages add constraint dm_messages_ref_valid_check check (
      ref_type is null or (ref_type in ('tool_artifact', 'class', 'class_session', 'chord_sheet')
                           and ref_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'));
  end if;
  if to_regclass('public.share_notes') is not null and not exists (select 1 from public.share_notes) then
    drop table public.share_notes;
  end if;
end $$;

notify pgrst, 'reload schema';
