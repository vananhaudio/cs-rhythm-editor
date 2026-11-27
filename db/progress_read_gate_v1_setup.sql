-- ═══════════════════════════════════════════════════════════════════════════
-- PROGRESS_READ_GATE_V1 (Owner chốt 27/11/2026) — NGUYÊN TẮC SƯ PHẠM SOLO được giữ ở SERVER:
--   · Buổi đầu chương trình: đọc khi có quyền giáo trình.
--   · Buổi mở đầu chặng (9, 17…): đọc khi Thầy mở cho lớp, không phụ thuộc chặng trước.
--   · Buổi còn lại: phải ĐÃ MỞ THEO TIẾN ĐỘ (đạt buổi trước) VÀ đạt điều kiện mở khoá của lớp. Học viên vào giữa khoá cũng vậy.
-- Trước V1: học viên đọc được (API) mọi buổi đã xuất bản, không bị khoá; điều kiện tiến độ chỉ có ở giao diện.
-- Phạm vi = chương trình trong tva_private.stage_open_program (SOLO01). CB1/CB2/HT và lớp 'open' / chưa có bài trả: giữ nguyên.
-- File này KHÔNG đổi policy (policy ở progress_read_gate_v1_policy.sql, chạy NGAY SAU, transaction riêng vì policy khoá auth.*).
-- KHÔNG thêm/xoá tiến độ, khoá, bản ghi mở. Hoàn tác: progress_read_gate_v1_rollback.sql. CHẠY bằng scripts/prod-db.py.
-- ═══════════════════════════════════════════════════════════════════════════
set local lock_timeout = '5s';

do $gate$
declare
  replaced constant jsonb := '{"share_note_score_ok": "283965c047e0ca5becaee19ed8a883c2", "dp_class_curriculum_rows": "1eeaf6ca56adcf5f128a3cf77c546398", "social_feed_clip_items": "972b1d6e0104274412d54d967f8e1c29"}';
  k text; v text; src text; drift text[] := '{}';
begin
  for k, v in select key, value from jsonb_each_text(replaced) loop
    select p.prosrc into src from pg_proc p join pg_namespace n on n.oid = p.pronamespace where p.proname = k and n.nspname = 'public';
    if src is null then drift := drift || format('thiếu hàm %s', k);
    elsif position('PROGRESS_READ_GATE_V1' in src) = 0 and md5(src) <> v then drift := drift || format('hàm %s khác bản đã kiểm (md5 %s)', k, md5(src));
    end if;
  end loop;
  if cardinality(drift) > 0 then raise exception 'DỪNG — production khác bản đã kiểm: %', array_to_string(drift, '; '); end if;
end $gate$;

create or replace function tva_private.session_progress_ok(p_session uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select not exists (select 1 from tva_private.stage_open_program sp where sp.program_code = c.program_code)
        or coalesce(c.unlock_policy, 'sequential') = 'open'
        or not exists (select 1 from public.class_sessions x join public.class_lesson_content lc on lc.session_id = x.id
                        where x.class_id = s.class_id and x.event_type = 'lesson' and lc.status = 'published'
                          and lc.blocks @> '[{"kind":"checkpoint"}]'::jsonb)          -- chế độ giáo trình: không có tiến độ
        or s.session_number = 0
        or s.session_number = (select min(f.session_number) from public.class_sessions f
                                where f.class_id = s.class_id and f.event_type = 'lesson' and f.session_number >= 1)
        or tva_private.session_needs_stage_open(s.id)                                 -- mở đầu chặng: do lesson_session_released quyết
        or exists (select 1 from public.learning_session_progress p                   -- dòng tiến độ chỉ sinh khi đạt buổi trước
                    where p.learner_user_id = p_user and p.program_code = c.program_code and p.session_no = s.session_number)
      from public.class_sessions s join public.class_schedule c on c.id = s.class_id
     where s.id = p_session and s.event_type = 'lesson'), false);
$$;
revoke all on function tva_private.session_progress_ok(uuid, uuid) from public, anon, authenticated;

create or replace function tva_private.lesson_session_readable(p_session uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  -- PROGRESS_READ_GATE_V1: điểm kiểm ĐỌC NỘI DUNG của người đang đăng nhập = khoá của lớp VÀ tiến độ của chính họ.
  select tva_private.lesson_session_released(p_session) and tva_private.session_progress_ok(p_session, auth.uid());
$$;
revoke all on function tva_private.lesson_session_readable(uuid) from public, anon;
grant execute on function tva_private.lesson_session_readable(uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.share_note_score_ok(p_session uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 -- LESSON_HOLD_V2
  select auth.uid() is not null and exists (
    select 1 from public.class_sessions s where s.id = p_session and s.event_type = 'lesson'
       and (public.is_teacher() or (tva_private.can_read_class_curriculum(s.class_id) and tva_private.lesson_session_readable(s.id)  /* PROGRESS_READ_GATE_V1 */
            and exists (select 1 from public.class_lesson_content c where c.session_id = s.id and c.status = 'published'))));
$function$;

CREATE OR REPLACE FUNCTION public.dp_class_curriculum_rows(p_teacher boolean, p_q text)
 RETURNS TABLE(prog text, pname text, session_no integer, title text, blocks jsonb, updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 -- LESSON_HOLD_V2
  select coalesce(nullif(btrim(cs.program_code), ''), cs.code), cs.name, s.session_number, s.title, c.blocks, c.updated_at
    from public.class_schedule cs
    join public.class_sessions s on s.class_id = cs.id and s.event_type = 'lesson'
    join public.class_lesson_content c on c.session_id = s.id and c.status = 'published'
   where (p_teacher or (tva_private.can_read_class_curriculum(cs.id) and tva_private.lesson_session_readable(s.id)  /* PROGRESS_READ_GATE_V1 */))
     and (p_q = '' or position(p_q in public.dp_fold(coalesce(cs.program_code, '') || ' ' || coalesce(cs.code, '') || ' ' || coalesce(cs.name, ''))) > 0)
$function$;

CREATE OR REPLACE FUNCTION public.social_feed_clip_items(p_class_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(sort_at timestamp with time zone, sort_key text, payload jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 -- LESSON_HOLD_V2
  select distinct on (s.id, k.key) v.at, 'c:' || s.id::text || ':' || k.key,
         jsonb_build_object('session_id', s.id, 'class_id', cs.id, 'class_code', cs.code, 'class_name', cs.name,
                            'session_no', s.session_number, 'title', left(btrim(b.e ->> 'title'), 120),
                            'duration', left(btrim(coalesce(b.e ->> 'duration', '')), 20), 'added_at', v.at)
  from public.class_lesson_content lc
  join public.class_sessions s on s.id = lc.session_id and s.event_type = 'lesson'
  join public.class_schedule cs on cs.id = s.class_id
  cross join lateral jsonb_array_elements(lc.blocks) with ordinality b(e, ord)
  cross join lateral (select public.social_clip_added_at(b.e ->> 'added_at') as at) v
  cross join lateral (select substr(md5(coalesce(b.e ->> 'added_at', '') || '|' || coalesce(b.e ->> 'title', '')), 1, 10) as key) k
  where lc.status = 'published'
    and lc.blocks @> '[{"kind":"video"}]'::jsonb
    and b.e ->> 'kind' = 'video'
    and v.at is not null and v.at > now() - interval '90 days' and v.at <= now() + interval '5 minutes'
    and s.session_number is not null
    and btrim(coalesce(b.e ->> 'title', '')) <> ''
    and (p_class_ids is null or cs.id = any (p_class_ids))
    and tva_private.can_read_class_curriculum(cs.id)
     and (public.is_teacher() or tva_private.lesson_session_readable(s.id)  /* PROGRESS_READ_GATE_V1 */)
  order by s.id, k.key, b.ord
$function$;

notify pgrst, 'reload schema';
