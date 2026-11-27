-- Hoàn tác PROGRESS_READ_GATE_V1: trả policy + 3 hàm về bản trước. Không đụng dữ liệu.
set local lock_timeout = '3s';
alter policy class_lesson_content_student_read on public.class_lesson_content using (
  status = 'published' and exists (select 1 from public.class_sessions s
    where s.id = class_lesson_content.session_id and s.event_type = 'lesson'
      and tva_private.can_read_class_curriculum(s.class_id) and tva_private.lesson_session_released(s.id)));

CREATE OR REPLACE FUNCTION public.share_note_score_ok(p_session uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 -- LESSON_HOLD_V2
  select auth.uid() is not null and exists (
    select 1 from public.class_sessions s where s.id = p_session and s.event_type = 'lesson'
       and (public.is_teacher() or (tva_private.can_read_class_curriculum(s.class_id) and tva_private.lesson_session_released(s.id)
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
   where (p_teacher or (tva_private.can_read_class_curriculum(cs.id) and tva_private.lesson_session_released(s.id)))
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
     and (public.is_teacher() or tva_private.lesson_session_released(s.id))
  order by s.id, k.key, b.ord
$function$;

drop function if exists tva_private.lesson_session_readable(uuid);
drop function if exists tva_private.session_progress_ok(uuid, uuid);
notify pgrst, 'reload schema';
