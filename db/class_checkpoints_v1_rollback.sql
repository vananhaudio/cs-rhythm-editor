-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK — LỚP CỦA TÔI V1 (checkpoint + tiến độ buổi). Idempotent. Chạy bằng scripts/prod-db.py (không begin/commit).
-- Thứ tự production: frontend về bản trước TRƯỚC (frontend V1 gọi class_learning_state / lt_submit_checkpoint), rồi file này.
--
-- LUÔN làm: gỡ 2 RPC mới + trigger hoàn thành buổi + hàm nội bộ; trả lt_detail / lt_set_visibility / social_class_activity
--   về ĐÚNG bản trước V1 (md5 = production 01/10) → thread 'class' (nếu có) chỉ còn chính chủ + Thầy xem được.
-- CHỈ KHI CHƯA CÓ DỮ LIỆU V1 (0 thread checkpoint, 0 dòng tiến độ): gỡ bảng learning_session_progress, cột checkpoint_id,
--   trả ràng buộc learning_threads về bản P1. Có dữ liệu → GIỮ (không xoá bài trả/tiến độ thật của học sinh), báo NOTICE.
-- ═══════════════════════════════════════════════════════════════════════════
set local lock_timeout = '5s';

drop trigger if exists learning_threads_checkpoint_passed on public.learning_threads;
drop function if exists public.class_learning_state(uuid);
drop function if exists public.lt_submit_checkpoint(uuid, int, text, text, text, text, text, text);
drop function if exists public.lsp_on_checkpoint_passed();
drop function if exists public.lsp_sync(uuid, uuid, text);
drop function if exists public.lsp_try_complete(uuid, text, int, uuid);
drop function if exists public.cl_next_session(uuid, int);
drop function if exists public.cl_session_checkpoints(uuid, int);

-- ── Hàm về đúng bản trước V1 (chép nguyên văn từ learning_threads_p1_setup.sql / social_classes_v1_setup.sql) ──
create or replace function public.lt_detail(p_thread_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_thread public.learning_threads%rowtype; v_teacher boolean := public.is_teacher(); v_out jsonb;
begin
  select * into v_thread from public.learning_threads where id = p_thread_id;
  if not found or not public.lt_can_view(v_thread.learner_user_id, v_thread.visibility, v_thread.hidden_at) then
    raise exception 'LT_NOT_FOUND' using errcode = '22023';
  end if;
  select jsonb_build_object(
    'id', v_thread.id, 'content_key', v_thread.content_key, 'lesson_id', v_thread.lesson_id,
    'course_id', v_thread.course_id, 'identity', v_thread.identity, 'visibility', v_thread.visibility,
    'status', v_thread.status, 'passed_at', v_thread.passed_at, 'created_at', v_thread.created_at,
    'last_event_at', v_thread.last_event_at, 'event_count', v_thread.event_count,
    'archived_at', v_thread.archived_at, 'is_hidden', v_thread.hidden_at is not null,
    'is_mine', v_thread.learner_user_id = auth.uid(), 'can_respond', v_teacher and v_thread.archived_at is null,
    'learner', (select jsonb_build_object('user_id', v_thread.learner_user_id, 'name', i.name, 'avatar_url', i.avatar_url)
                from public.class_public_identity(v_thread.learner_user_id) i),
    'passed_by', (select jsonb_build_object('user_id', v_thread.passed_by, 'name', i.name, 'avatar_url', i.avatar_url)
                  from public.class_public_identity(v_thread.passed_by) i where v_thread.passed_by is not null),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'seq', e.seq, 'kind', e.kind, 'verdict', e.verdict, 'author_role', e.author_role,
        'author', jsonb_build_object('user_id', e.author_user_id, 'name', i.name, 'avatar_url', i.avatar_url),
        'body', e.body, 'media_type', e.media_type, 'media_provider', e.media_provider, 'media_url', e.media_url,
        'external_media_id', e.external_media_id, 'resources', e.resources,
        'tags', coalesce((select jsonb_agg(jsonb_build_object('id', ct.id, 'name', ct.name) order by ct.name)
                            from public.class_tags ct where ct.id = any(e.tag_ids)), '[]'::jsonb),
        'is_hidden', e.hidden_at is not null, 'created_at', e.created_at) order by e.seq)
      from public.learning_thread_events e
      left join lateral public.class_public_identity(e.author_user_id) i on true
      where e.thread_id = v_thread.id and (e.hidden_at is null or v_teacher)), '[]'::jsonb)
  ) into v_out;
  return v_out;
end $$;

create or replace function public.lt_set_visibility(p_thread_id uuid, p_visibility text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_visibility is null or p_visibility not in ('community', 'private') then
    raise exception 'LT_BAD_VISIBILITY' using errcode = '22023';
  end if;
  update public.learning_threads set visibility = p_visibility, updated_at = clock_timestamp()
   where id = p_thread_id and learner_user_id = auth.uid() and auth.uid() is not null;
  if not found then raise exception 'LT_NOT_FOUND' using errcode = '22023'; end if;
end $$;

create or replace function public.social_class_activity(
  p_class      uuid,
  p_before     timestamptz default null,
  p_before_key text        default null,
  p_limit      int         default 20
)
returns table(kind text, sort_at timestamptz, sort_key text, post jsonb, thread jsonb)
language sql stable security definer set search_path = '' as $$
  select 'learning_thread'::text, t.last_event_at, 't:' || t.id::text, null::jsonb, public.lt_thread_card(t.id)
  from public.learning_threads t
  where public.is_class_member() and t.class_schedule_id = p_class
    and t.visibility = 'community' and t.hidden_at is null and t.archived_at is null and t.last_event_at is not null
    and (p_before is null or (t.last_event_at, 't:' || t.id::text) < (p_before, coalesce(p_before_key, '')))
  order by t.last_event_at desc, ('t:' || t.id::text) desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

revoke all on function public.lt_detail(uuid), public.lt_set_visibility(uuid, text),
  public.social_class_activity(uuid, timestamptz, text, int) from public, anon;
grant execute on function public.lt_detail(uuid), public.lt_set_visibility(uuid, text),
  public.social_class_activity(uuid, timestamptz, text, int) to authenticated;

-- ── Bảng/cột/ràng buộc: chỉ gỡ khi chưa có dữ liệu V1 ──
do $rb$
declare v_threads int := 0; v_progress int := 0;
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_threads' and column_name = 'checkpoint_id') then
    select count(*) into v_threads from public.learning_threads where content_kind = 'program_checkpoint';
  end if;
  if to_regclass('public.learning_session_progress') is not null then
    execute 'select count(*) from public.learning_session_progress' into v_progress;
  end if;
  if v_threads > 0 or v_progress > 0 then
    raise notice 'GIỮ dữ liệu V1: % thread checkpoint, % dòng tiến độ — chỉ gỡ RPC/trigger, không xoá bảng/cột.', v_threads, v_progress;
    return;
  end if;
  drop table if exists public.learning_session_progress;
  drop function if exists public.lsp_guard_history();
  drop index if exists public.learning_threads_class_idx;
  alter table public.learning_threads drop constraint if exists learning_threads_visibility_check;
  alter table public.learning_threads add constraint learning_threads_visibility_check check (visibility in ('community', 'private'));
  alter table public.learning_threads drop constraint if exists learning_threads_key_check;
  alter table public.learning_threads add constraint learning_threads_key_check check (
    (content_kind = 'course_lesson' and content_key ~ '^L:[0-9a-f-]{36}$')
    or (content_kind = 'program_session' and content_key ~ '^S:[A-Z0-9_]{1,32}:[0-9]{1,4}$'));
  alter table public.learning_threads drop constraint if exists learning_threads_kind_check;
  alter table public.learning_threads add constraint learning_threads_kind_check check (content_kind in ('course_lesson', 'program_session'));
  alter table public.learning_threads drop column if exists checkpoint_id;
end $rb$;

notify pgrst, 'reload schema';
