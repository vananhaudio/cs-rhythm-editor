-- Share Note — Feed Preview: BẢO VỆ KHOÁ BUỔI. Migration ADDITIVE (không sửa share_note_v1, không sửa class_learning_state).
-- Thêm DUY NHẤT một hàm CHỈ ĐỌC: share_note_session_open(p_note) → boolean = "buổi chứa bản nhạc này đang MỞ cho người gọi?".
-- Dùng cho bài Feed: chỉ khi share_note_open = ok VÀ hàm này = true thì client mới tải giáo trình và vẽ nhạc.
-- Luật SAO CHÉP đúng class_learning_state (CLASS_UNLOCK_POLICY_V1) / sessionPhase của giao diện, KHÔNG gọi lsp_sync:
--   • không thấy note / không có quyền giáo trình / buổi chưa xuất bản (share_note_visible + share_note_score_ok)  → false
--   • Thầy (is_teacher) → true (xem mọi buổi)
--   • lớp không dùng cổng checkpoint (program_code không hợp lệ hoặc chưa có checkpoint đã xuất bản = chế độ giáo trình) → true
--   • unlock_policy = 'open' → true
--   • sequential: Buổi 0 → true · buổi học đầu tiên → true (lsp_sync mở ngay khi người học vào lớp) · buổi khác → có dòng
--     learning_session_progress.opened_at của CHÍNH người gọi, ngược lại false
-- KHÔNG INSERT/UPDATE/DELETE, KHÔNG đụng opened_at/tiến độ (STABLE), chỉ trả boolean (không lộ dữ liệu lớp khác). Không begin/commit. Idempotent.
do $gate$
begin
  if to_regprocedure('public.share_note_visible(uuid)') is null or to_regprocedure('public.share_note_score_ok(uuid)') is null
     or to_regclass('public.share_notes') is null or to_regclass('public.learning_session_progress') is null
     or to_regprocedure('public.cl_session_checkpoints(uuid,integer)') is null or to_regprocedure('public.is_teacher()') is null then
    raise exception 'DỪNG — thiếu nền (Share Note V1, Lớp của tôi V1)';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'class_schedule' and column_name = 'unlock_policy') then
    raise exception 'DỪNG — thiếu class_schedule.unlock_policy (CLASS_UNLOCK_POLICY_V1)';
  end if;
  if position('CLASS_UNLOCK_POLICY_V1' in (select p.prosrc from pg_proc p where p.oid = to_regprocedure('public.class_learning_state(uuid)'))) = 0 then
    raise exception 'DỪNG — class_learning_state chưa là bản CLASS_UNLOCK_POLICY_V1 (luật khoá có thể khác hàm này)';
  end if;
end $gate$;

create or replace function public.share_note_session_open(p_note uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare r record; v_cls public.class_schedule%rowtype; v_first integer;
begin
  if auth.uid() is null or p_note is null or not public.share_note_visible(p_note) then return false; end if;
  select n.session_id, s.class_id, s.session_number into r
    from public.share_notes n join public.class_sessions s on s.id = n.session_id where n.id = p_note;
  if not found or not public.share_note_score_ok(r.session_id) then return false; end if;
  if public.is_teacher() then return true; end if;
  select * into v_cls from public.class_schedule where id = r.class_id;
  if not found then return false; end if;
  if coalesce(v_cls.program_code, '') !~ '^[A-Z0-9_]{1,32}$'
     or not exists (select 1 from public.class_sessions s2 join public.class_lesson_content c on c.session_id = s2.id
                     cross join lateral jsonb_array_elements(c.blocks) b
                    where s2.class_id = r.class_id and s2.event_type = 'lesson' and c.status = 'published'
                      and jsonb_typeof(b) = 'object' and b ->> 'kind' = 'checkpoint') then
    return true;                                                       -- chế độ giáo trình: không có khoá buổi
  end if;
  if coalesce(v_cls.unlock_policy, 'sequential') = 'open' then return true; end if;
  if r.session_number is null then return false; end if;
  if r.session_number = 0 then return true; end if;
  select min(s3.session_number) into v_first from public.class_sessions s3
   where s3.class_id = r.class_id and s3.event_type = 'lesson' and s3.session_number is not null and s3.session_number >= 1;
  if r.session_number = v_first then return true; end if;
  return exists (select 1 from public.learning_session_progress p
                  where p.learner_user_id = auth.uid() and p.program_code = v_cls.program_code
                    and p.session_no = r.session_number and p.opened_at is not null);
end $$;
revoke all on function public.share_note_session_open(uuid) from public, anon;
grant execute on function public.share_note_session_open(uuid) to authenticated;
comment on function public.share_note_session_open(uuid) is 'share_note_session_open_v1: buổi chứa note đang mở cho người gọi? (chỉ đọc; luật = class_learning_state)';
notify pgrst, 'reload schema';
