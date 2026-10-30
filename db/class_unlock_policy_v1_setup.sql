-- ═══════════════════════════════════════════════════════════════════════════
-- CLASS_UNLOCK_POLICY_V1 — TÁCH "ĐIỂM NỘP BÀI" (checkpoint) KHỎI "MỞ KHOÁ TUẦN TỰ" (unlock). Thiết kế: docs/CLASS-UNLOCK-POLICY-V1.md.
-- Rollback: db/class_unlock_policy_v1_rollback.sql. Preflight/postflight (read-only): db/class_unlock_policy_v1_{preflight,postflight}.sql.
-- Test (cluster PostgreSQL tạm, KHÔNG production): scripts/test-class-unlock-policy-db.sh.
--
-- Vấn đề: hiện một lớp có ≥ 1 khối checkpoint đã xuất bản thì TOÀN LỚP vào chế độ bài trả, và chế độ đó LUÔN khoá tuần tự
--   (chỉ Buổi 1 mở; xong bài trả bắt buộc mới mở buổi kế). Hành Trình cần nút Trả bài nhưng KHÔNG khoá tuần tự.
-- Giải pháp tối thiểu, tương thích ngược:
--   • Cột class_schedule.unlock_policy ('sequential' | 'open'), MẶC ĐỊNH 'sequential' → mọi lớp đang chạy GIỮ NGUYÊN hành vi.
--   • lsp_sync: nếu lớp 'open' → mở (tạo tiến độ) MỌI buổi lesson ĐÃ XUẤT BẢN. Mở = có dòng tiến độ, nên lt_submit_checkpoint /
--     lt_answer_checkpoint (đã kiểm "buổi đã mở") KHÔNG phải sửa. Hoàn thành buổi (lsp_try_complete) vẫn ghi nhận tiến độ.
--   • class_learning_state: trả thêm unlock_policy · pace_days (0 khi 'open' = không nhịp tuần) · start_at từng buổi.
-- KHÔNG đặt lớp nào sang 'open' trong file này. Việc đó là thao tác dữ liệu riêng, Owner duyệt (xem docs).
-- Thay đúng 2 hàm (cổng md5 = bản repo = production sau V1 + QUIZ + Buổi 0 (class_session_zero_intro)): lsp_sync, class_learning_state.
-- Idempotent. CHẠY bằng scripts/prod-db.py (prod-db sở hữu transaction — file KHÔNG có begin/commit).
-- ═══════════════════════════════════════════════════════════════════════════
set local lock_timeout = '5s';

do $gate$
declare
  replaced constant jsonb := '{"lsp_sync": "85655a791d24a9a0997d94bcbe6687a3", "class_learning_state": "db9015ea8a462af44a7750a5bbc26f86"}';
  needed constant text[] := array['is_teacher', 'cl_session_checkpoints', 'cl_next_session', 'lsp_try_complete', 'lsp_on_checkpoint_passed', 'lt_submit_checkpoint', 'lt_answer_checkpoint'];
  k text; v text; src text; drift text[] := '{}';
begin
  for k, v in select key, value #>> '{}' from jsonb_each(replaced) loop
    select p.prosrc into src from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = k;
    if src is null then drift := drift || format('thiếu hàm %s', k);
    elsif position('CLASS_UNLOCK_POLICY_V1' in src) = 0 and md5(src) <> v then drift := drift || format('hàm %s khác bản đã kiểm (md5 %s)', k, md5(src));
    end if;
  end loop;
  foreach k in array needed loop
    if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = k) then
      drift := drift || format('thiếu hàm %s', k);
    end if;
  end loop;
  if to_regclass('public.class_schedule') is null then drift := drift || 'thiếu bảng class_schedule'::text; end if;
  if to_regclass('public.learning_session_progress') is null then drift := drift || 'thiếu bảng learning_session_progress'::text; end if;
  if cardinality(drift) > 0 then raise exception 'DỪNG — production khác repo: %', array_to_string(drift, '; '); end if;
end $gate$;

-- ── 1) Cột chính sách (mặc định 'sequential' = hành vi hiện tại của MỌI lớp) ──────────────────
alter table public.class_schedule add column if not exists unlock_policy text not null default 'sequential';
do $c$ begin
  if not exists (select 1 from pg_constraint where conname = 'class_schedule_unlock_policy_check' and conrelid = 'public.class_schedule'::regclass) then
    alter table public.class_schedule add constraint class_schedule_unlock_policy_check check (unlock_policy in ('sequential', 'open'));
  end if;
end $c$;
comment on column public.class_schedule.unlock_policy is
  'CLASS_UNLOCK_POLICY_V1: sequential = mở buổi kế khi xong bài trả bắt buộc của buổi trước (mặc định) · open = mọi buổi đã xuất bản đều mở; bài trả vẫn nộp/chấm bình thường';

-- ── 2) lsp_sync: chính sách 'open' mở mọi buổi đã xuất bản (phần còn lại GIỮ NGUYÊN bản Buổi 0) ──
create or replace function public.lsp_sync(p_user uuid, p_class uuid, p_program text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_first int; r record; v_policy text;
begin
  perform pg_advisory_xact_lock(hashtextextended('lsp:' || p_user::text || ':' || p_program, 0));
  select min(s.session_number) into v_first from public.class_sessions s
   where s.class_id = p_class and s.event_type = 'lesson' and s.session_number is not null and s.session_number >= 1;
  -- Buổi 0 (nhập môn): mở + xong ngay, không bao giờ chặn buổi 1.
  if exists (select 1 from public.class_sessions s where s.class_id = p_class and s.event_type = 'lesson' and s.session_number = 0) then
    insert into public.learning_session_progress (learner_user_id, program_code, session_no, class_schedule_id, completed_at, completed_class_schedule_id)
    values (p_user, p_program, 0, p_class, now(), p_class)
    on conflict (learner_user_id, program_code, session_no) do nothing;
  end if;
  if v_first is null then return; end if;
  insert into public.learning_session_progress (learner_user_id, program_code, session_no, class_schedule_id)
  values (p_user, p_program, v_first, p_class)
  on conflict (learner_user_id, program_code, session_no) do nothing;
  -- CLASS_UNLOCK_POLICY_V1: chính sách theo lớp ('sequential' = như cũ · 'open' = mọi buổi ĐÃ XUẤT BẢN đều mở)
  select coalesce(c.unlock_policy, 'sequential') into v_policy from public.class_schedule c where c.id = p_class;
  if v_policy = 'open' then
    insert into public.learning_session_progress (learner_user_id, program_code, session_no, class_schedule_id)
    select p_user, p_program, s.session_number, p_class
      from public.class_sessions s
      join public.class_lesson_content c on c.session_id = s.id and c.status = 'published'
     where s.class_id = p_class and s.event_type = 'lesson' and s.session_number is not null
    on conflict (learner_user_id, program_code, session_no) do nothing;
  end if;
  for r in select p.session_no from public.learning_session_progress p
            where p.learner_user_id = p_user and p.program_code = p_program
            order by p.session_no loop
    perform public.lsp_try_complete(p_user, p_program, r.session_no, p_class);
  end loop;
end $$;

-- ── 3) class_learning_state: thêm unlock_policy / pace_days / start_at (phần còn lại GIỮ NGUYÊN bản QUIZ V1) ──
create or replace function public.class_learning_state(p_class uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_teacher boolean;
  v_cls public.class_schedule%rowtype;
  v_learner boolean;
begin
  -- CLASS_UNLOCK_POLICY_V1: thêm unlock_policy · pace_days (0 = không nhịp tuần khi 'open') · start_at từng buổi
  if v_uid is null then raise exception 'LT_NOT_AUTHENTICATED' using errcode = '42501'; end if;
  select * into v_cls from public.class_schedule where id = p_class;
  if not found then return jsonb_build_object('class_id', p_class, 'enabled', false); end if;
  v_teacher := public.is_teacher();
  v_learner := not v_teacher and tva_private.can_read_class_curriculum(p_class);
  if coalesce(v_cls.program_code, '') !~ '^[A-Z0-9_]{1,32}$' or not (v_teacher or v_learner)
     or not exists (select 1 from public.class_sessions s join public.class_lesson_content c on c.session_id = s.id
                    cross join lateral jsonb_array_elements(c.blocks) b
                    where s.class_id = p_class and s.event_type = 'lesson' and c.status = 'published'
                      and jsonb_typeof(b) = 'object' and b ->> 'kind' = 'checkpoint') then
    return jsonb_build_object('class_id', p_class, 'enabled', false);
  end if;
  if v_learner then perform public.lsp_sync(v_uid, p_class, v_cls.program_code); end if;

  return jsonb_build_object(
    'class_id', p_class, 'enabled', true, 'role', case when v_teacher then 'teacher' else 'learner' end,
    'program_code', v_cls.program_code, 'class_code', v_cls.code, 'class_name', v_cls.name,
    'server_now', clock_timestamp(), 'unlock_policy', coalesce(v_cls.unlock_policy, 'sequential'),
    'pace_days', case when v_cls.unlock_policy = 'open' then 0 else 7 end,
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'session_id', s.id, 'session_no', s.session_number, 'title', s.title,
        'stage_no', st.stage_no, 'stage_title', st.public_title,
        'published', c.session_id is not null, 'start_at', s.start_at,
        'opened_at', p.opened_at, 'completed_at', p.completed_at,
        'checkpoints', case when c.session_id is not null and (v_teacher or p.opened_at is not null) then coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', cp.id, 'title', cp.title, 'required', cp.required, 'accepts', to_jsonb(cp.accepts),
            'thread', (select jsonb_build_object('id', t.id, 'status', t.status, 'visibility', t.visibility,
                                                 'passed_at', t.passed_at, 'last_event_at', t.last_event_at)
                       from public.learning_threads t
                       where not v_teacher and t.learner_user_id = v_uid and t.archived_at is null
                         and t.content_key = 'C:' || v_cls.program_code || ':' || s.session_number::text || ':' || cp.id),
            'quiz_passed_at', (select q.passed_at from public.learning_checkpoint_passes q   -- QUIZ_CHECKPOINT_V1
                               where not v_teacher and q.learner_user_id = v_uid
                                 and q.content_key = 'C:' || v_cls.program_code || ':' || s.session_number::text || ':' || cp.id))
            order by cp.ord)
          from public.cl_session_checkpoints(p_class, s.session_number) cp), '[]'::jsonb) else '[]'::jsonb end)
        order by s.session_number)
      from public.class_sessions s
      left join public.class_stages st on st.id = s.stage_id
      left join public.class_lesson_content c on c.session_id = s.id and c.status = 'published'
      left join public.learning_session_progress p
             on not v_teacher and p.learner_user_id = v_uid and p.program_code = v_cls.program_code
            and p.session_no = s.session_number
      where s.class_id = p_class and s.event_type = 'lesson' and s.session_number is not null), '[]'::jsonb));
end $$;

-- ── 4) Quyền (như các bản trước: anon không EXECUTE; hàm nội bộ không cấp cho ai) ──
revoke all on function public.lsp_sync(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.class_learning_state(uuid) from public, anon;
grant execute on function public.class_learning_state(uuid) to authenticated;
notify pgrst, 'reload schema';
