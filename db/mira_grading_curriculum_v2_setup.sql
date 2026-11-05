-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- MIRA GRADING — GIÁO TRÌNH ĐẦY ĐỦ HƠN CHO NGUỒN `curriculum` (V2)   |  CHƯA CHẠY TRÊN PRODUCTION — chờ Owner duyệt từng cổng
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Vấn đề (điều tra 01/11/2026): RPC mira_grading_context('curriculum') chỉ trả checkpoint + objectives + note nên Mira không thấy
-- bản đồ nốt (fretboard), lời dặn/cách chấm (assignment, recap, layers, repertoire.guidance), checklist của buổi.
-- Việc làm: thay thân 1 hàm (CHỈ nhánh curriculum) + 3 hàm thuần phụ. Cùng nguồn class_lesson_content status='published' mà học viên đang học;
-- không bảng mới, không sao chép giáo trình, không đổi quyền/vé/pilot/khoá (các dòng kiểm quyền giữ NGUYÊN từng chữ).
-- `data` thêm: guide[], fretboard[], present{}; giữ nguyên session_title, content_updated_at, checkpoint, objectives, notes (tương thích ngược).
-- Hoàn tác: db/mira_grading_curriculum_v2_rollback.sql (trả đúng thân V1.1 đang chạy, md5 485339e8…).
-- Chạy: preflight (prod-db query) → PASS → dryrun → migrate --confirm. Không dùng transaction control trong file này.

do $g$
declare v_c text;
begin
  select prosrc into v_c from pg_proc where oid = to_regprocedure('public.mira_grading_context(text,text)');
  if v_c is null then raise exception 'mira_grading_curriculum_v2: thiếu mira_grading_context — dừng'; end if;
  if md5(v_c) not in ('485339e878064c693d5a7866ba6022ae', 'dbd5b076cd47916dede475c6690f6e83') then
    raise exception 'mira_grading_curriculum_v2: thân mira_grading_context khác bản V1.1 đã nghiệm thu (md5 %) — dừng', md5(v_c);
  end if;
  if to_regclass('public.mira_grading_pilot') is null or to_regclass('public.class_lesson_content') is null or to_regclass('public.class_sessions') is null then
    raise exception 'mira_grading_curriculum_v2: thiếu bảng nền — dừng';
  end if;
end $g$;

-- ==== HELPERS BEGIN (hàm thuần, không đọc bảng; test riêng bằng scripts/test-mira-grading-curriculum-db.sh) ====
create or replace function public.mira_gc_s(p text, p_w int)
returns text language sql immutable set search_path = '' as $f$
  select nullif(left(btrim(coalesce(p, '')), p_w), '')
$f$;

create or replace function public.mira_gc_strs(p jsonb, p_n int, p_w int)
returns jsonb language sql immutable set search_path = '' as $f$
  select coalesce((select jsonb_agg(left(t, p_w) order by o)
                     from (select t, o from jsonb_array_elements_text(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end) with ordinality e(t, o)
                            where btrim(t) <> '' order by o limit p_n) q), '[]'::jsonb)
$f$;

-- Rút từ các khối published của MỘT buổi: đề của bài trả đang mở + mục tiêu + ghi chú + hướng dẫn thực hành + bản đồ nốt.
-- KHÔNG đưa: quiz/đáp án, bản nhạc dạng ký hiệu (tex), ghi chú riêng của học viên. `present` cho Mira biết buổi CÓ những loại khối nào để báo thiếu trung thực.
create or replace function public.mira_grading_curriculum_data(p_blocks jsonb, p_cp text, p_title text, p_at timestamptz)
returns jsonb language sql immutable set search_path = '' as $f$
  with b as (
    select x, o from jsonb_array_elements(case when jsonb_typeof(p_blocks) = 'array' then p_blocks else '[]'::jsonb end) with ordinality t(x, o)
     where jsonb_typeof(x) = 'object'
  )
  select jsonb_strip_nulls(jsonb_build_object(
    'v', 2,
    'session_title', p_title,
    'content_updated_at', p_at,
    'checkpoint', (select jsonb_build_object('id', x ->> 'id', 'title', x ->> 'title', 'prompt', x ->> 'prompt', 'required', x -> 'required', 'accepts', x -> 'accepts')
                     from b where x ->> 'kind' = 'checkpoint' and x ->> 'id' = p_cp order by o limit 1),
    'objectives', coalesce((select jsonb_agg(left(i, 400) order by o, k)
                              from (select i, o, k from b cross join lateral jsonb_array_elements_text(case when jsonb_typeof(x -> 'items') = 'array' then x -> 'items' else '[]'::jsonb end) with ordinality e(i, k)
                                     where x ->> 'kind' = 'objectives' order by o, k limit 12) q), '[]'::jsonb),
    'notes', coalesce((select jsonb_agg(jsonb_build_object('title', left(coalesce(x ->> 'title', ''), 200), 'text', left(coalesce(x ->> 'text', ''), 800)) order by o)
                         from (select x, o from b where x ->> 'kind' = 'note' and coalesce(x ->> 'text', '') <> '' order by o limit 8) n), '[]'::jsonb),
    'guide', coalesce((
      select jsonb_agg(g order by o) from (
        select o, case x ->> 'kind'
          when 'assignment' then jsonb_build_object('kind', 'assignment', 'title', public.mira_gc_s(x ->> 'title', 160), 'message', public.mira_gc_s(x ->> 'message', 800),
            'items', coalesce((select jsonb_agg(jsonb_build_object('label', public.mira_gc_s(i ->> 'label', 40), 'text', public.mira_gc_s(i ->> 'text', 500)) order by k)
                                 from (select i, k from jsonb_array_elements(case when jsonb_typeof(x -> 'items') = 'array' then x -> 'items' else '[]'::jsonb end) with ordinality e(i, k)
                                        where jsonb_typeof(i) = 'object' order by k limit 10) q), '[]'::jsonb))
          when 'recap' then jsonb_build_object('kind', 'recap', 'title', public.mira_gc_s(x ->> 'title', 160), 'message', public.mira_gc_s(x ->> 'message', 800),
            'steps', coalesce((select jsonb_agg(jsonb_build_object('label', public.mira_gc_s(i ->> 'label', 120), 'items', public.mira_gc_strs(i -> 'items', 8, 300)) order by k)
                                 from (select i, k from jsonb_array_elements(case when jsonb_typeof(x -> 'steps') = 'array' then x -> 'steps' else '[]'::jsonb end) with ordinality e(i, k)
                                        where jsonb_typeof(i) = 'object' order by k limit 8) q), '[]'::jsonb))
          when 'layers' then jsonb_build_object('kind', 'layers', 'title', public.mira_gc_s(x ->> 'title', 160), 'lead', public.mira_gc_s(x ->> 'lead', 400), 'note', public.mira_gc_s(x ->> 'note', 800),
            'layers', coalesce((select jsonb_agg(jsonb_build_object('label', public.mira_gc_s(i ->> 'label', 40), 'what', public.mira_gc_s(i ->> 'what', 500)) order by k)
                                  from (select i, k from jsonb_array_elements(case when jsonb_typeof(x -> 'layers') = 'array' then x -> 'layers' else '[]'::jsonb end) with ordinality e(i, k)
                                         where jsonb_typeof(i) = 'object' order by k limit 4) q), '[]'::jsonb))
          when 'repertoire' then jsonb_build_object('kind', 'repertoire', 'title', public.mira_gc_s(x ->> 'title', 160),
            'pieces', coalesce((select jsonb_agg(jsonb_build_object('title', public.mira_gc_s(i ->> 'title', 160), 'composer', public.mira_gc_s(i ->> 'composer', 160), 'note', public.mira_gc_s(i ->> 'note', 600),
                                  'guidance', public.mira_gc_strs(i -> 'guidance', 12, 300),
                                  'marks', coalesce((select jsonb_agg(jsonb_build_object('at', public.mira_gc_s(m ->> 'at', 60), 'text', public.mira_gc_s(m ->> 'text', 300)) order by mk)
                                                       from (select m, mk from jsonb_array_elements(case when jsonb_typeof(i -> 'marks') = 'array' then i -> 'marks' else '[]'::jsonb end) with ordinality me(m, mk)
                                                              where jsonb_typeof(m) = 'object' order by mk limit 8) mm), '[]'::jsonb)) order by k)
                                  from (select i, k from jsonb_array_elements(case when jsonb_typeof(x -> 'pieces') = 'array' then x -> 'pieces' else '[]'::jsonb end) with ordinality e(i, k)
                                         where jsonb_typeof(i) = 'object' order by k limit 6) q), '[]'::jsonb))
          when 'checklist' then jsonb_build_object('kind', 'checklist', 'title', public.mira_gc_s(x ->> 'title', 160), 'items', public.mira_gc_strs(x -> 'items', 12, 200))
        end as g
        from b where x ->> 'kind' in ('assignment', 'recap', 'layers', 'repertoire', 'checklist') order by o limit 12
      ) s where g is not null), '[]'::jsonb),
    'fretboard', coalesce((
      select jsonb_agg(jsonb_build_object('title', public.mira_gc_s(x ->> 'title', 160), 'lead', public.mira_gc_s(x ->> 'lead', 400), 'legend', public.mira_gc_strs(x -> 'legend', 8, 200),
          'zones', coalesce((select jsonb_agg(jsonb_build_object('no', z -> 'no', 'label', public.mira_gc_s(z ->> 'label', 80), 'hint', public.mira_gc_s(z ->> 'hint', 200)) order by k)
                               from (select z, k from jsonb_array_elements(case when jsonb_typeof(x -> 'zones') = 'array' then x -> 'zones' else '[]'::jsonb end) with ordinality e(z, k)
                                      where jsonb_typeof(z) = 'object' order by k limit 6) q), '[]'::jsonb),
          'dots', coalesce((select jsonb_agg(jsonb_build_object('name', d ->> 'name', 'string', d -> 'string', 'fret', d -> 'fret', 'zone', d -> 'zone') order by k)
                              from (select d, k from jsonb_array_elements(case when jsonb_typeof(x -> 'dots') = 'array' then x -> 'dots' else '[]'::jsonb end) with ordinality e(d, k)
                                     where jsonb_typeof(d) = 'object' and coalesce(d ->> 'name', '') <> '' order by k limit 90) q), '[]'::jsonb)) order by o)
        from (select x, o from b where x ->> 'kind' = 'fretboard' order by o limit 4) f), '[]'::jsonb),
    'present', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select coalesce(x ->> 'kind', '?') k, count(*) n from b group by 1) z)
  ))
$f$;
revoke all on function public.mira_gc_s(text, int), public.mira_gc_strs(jsonb, int, int), public.mira_grading_curriculum_data(jsonb, text, text, timestamptz) from public, anon, authenticated;
-- ==== HELPERS END ====

create or replace function public.mira_grading_context(p_ticket text, p_source text)
returns jsonb language plpgsql security definer stable set search_path = '' as $$
declare
  v_hdr text := nullif(coalesce(nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-mira-grading-key', ''), '');
  v_tk public.mira_grading_tickets%rowtype;
  v_th public.learning_threads%rowtype;
  v_teacher jsonb;
  v_data jsonb; v_status text := 'ok';
  v_cp_id text; v_blocks jsonb; v_content_at timestamptz; v_session public.class_sessions%rowtype;
begin
  -- Khoá của Mira: sai/thiếu → cùng một lỗi như vé sai (không lộ gì)
  if v_hdr is null or not exists (select 1 from public.mira_grading_keys k
                                   where k.revoked_at is null and k.key_hash = encode(sha256(convert_to(v_hdr, 'UTF8')), 'hex')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_source not in ('thread', 'curriculum', 'student360') then raise exception 'bad_source' using errcode = '22023'; end if;
  select * into v_tk from public.mira_grading_tickets
   where ticket_hash = encode(sha256(convert_to(coalesce(p_ticket, ''), 'UTF8')), 'hex') and expires_at > now();
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;
  -- Thầy phải CÒN là Thầy/admin ở thời điểm đọc
  select jsonb_build_object('id', au.id, 'name', coalesce(nullif(trim(au.name), ''), 'Thầy')) into v_teacher
    from public.app_users au where au.id = v_tk.teacher_id and au.role in ('teacher', 'admin')
     and exists (select 1 from public.mira_grading_pilot pl where pl.user_id = au.id);
  if v_teacher is null then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into v_th from public.learning_threads t where t.id = v_tk.thread_id;
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;

  if p_source = 'thread' then
    v_data := jsonb_build_object(
      'learner', (select jsonb_build_object('name', i.name) from public.class_public_identity(v_th.learner_user_id) i),
      'status', v_th.status, 'program_code', v_th.program_code, 'session_no', v_th.session_no, 'checkpoint_id', v_th.checkpoint_id,
      'class', jsonb_build_object('code', v_th.identity #>> '{class,code}', 'name', v_th.identity #>> '{class,name}'),
      'checkpoint', jsonb_build_object('title', v_th.identity #>> '{checkpoint,title}', 'required', v_th.identity #> '{checkpoint,required}'),
      'created_at', v_th.created_at, 'passed_at', v_th.passed_at,
      'events', coalesce((
        select jsonb_agg(e order by e.seq) from (
          select ev.seq, ev.author_role as role, ev.kind, ev.verdict, left(ev.body, 4000) as body,
                 ev.media_provider, ev.media_url, ev.created_at
            from public.learning_thread_events ev
           where ev.thread_id = v_th.id and ev.hidden_at is null
           order by ev.seq desc limit 20) e), '[]'::jsonb));
  elsif p_source = 'curriculum' then
    select * into v_session from public.class_sessions s
     where s.class_id = v_th.class_schedule_id and s.session_number = v_th.session_no and s.event_type = 'lesson' limit 1;
    if v_th.class_schedule_id is null or v_session.id is null then
      v_status := 'empty'; v_data := '{}'::jsonb;
    else
      select c.blocks, c.updated_at into v_blocks, v_content_at
        from public.class_lesson_content c where c.session_id = v_session.id and c.status = 'published';
      if v_blocks is null then v_status := 'empty'; v_data := '{}'::jsonb;
      else
        -- Cùng nguồn published mà học viên đang học; cách rút gọn nằm ở hàm thuần mira_grading_curriculum_data (có test riêng).
        v_data := public.mira_grading_curriculum_data(v_blocks, v_th.checkpoint_id, v_session.title, v_content_at);
      end if;
    end if;
  else -- student360: mục đang hiệu lực, bản nhìn của Thầy nhưng KHÔNG có source_ref/người tạo (con trỏ nội bộ)
    v_data := jsonb_build_object(
      'level', (select es.level from public.edu_students es where es.user_id = v_th.learner_user_id order by es.enrolled_at desc nulls last limit 1),
      'facts', coalesce((select jsonb_agg(jsonb_build_object('category', f.category, 'content', f.content, 'origin', f.origin,
                          'verification', f.verification, 'source_kind', f.source_kind, 'updated_at', f.updated_at) order by f.category, f.created_at)
                           from (select * from public.student_360_facts x where x.user_id = v_th.learner_user_id and x.status = 'active'
                                  order by x.category, x.created_at limit 50) f), '[]'::jsonb));
    if jsonb_array_length(v_data -> 'facts') = 0 then v_status := 'empty'; end if;
  end if;

  return jsonb_build_object('v', 1, 'source', p_source, 'status', v_status, 'thread_id', v_th.id,
                            'teacher', v_teacher, 'as_of', now(), 'data', v_data);
end $$;
revoke all on function public.mira_grading_context(text, text) from public, authenticated;
grant execute on function public.mira_grading_context(text, text) to anon;
