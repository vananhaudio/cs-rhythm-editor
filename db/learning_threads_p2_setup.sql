-- ═══════════════════════════════════════════════════════════════════════════
-- LEARNING THREAD P2 — Feed · Tường · Hành trình (CHỈ ĐỌC, KHÔNG BẢNG MỚI). Idempotent.
-- Thiết kế: docs/LEARNING-THREAD-P2.md. Rollback: db/learning_threads_p2_rollback.sql.
-- Test: scripts/test-learning-threads-db.sh (cluster PostgreSQL tạm, KHÔNG production).
--
-- Nguyên tắc (Owner chốt 29/09/2026):
--   • Feed/Tường/Hành trình là CÁCH NHÌN của learning_threads — KHÔNG copy sang class_posts, KHÔNG bảng journey.
--   • MỘT thread = MỘT item, xếp theo hoạt động mới nhất (last_event_at); event mới → câu chuyện nổi lên, không nhân bản.
--   • Feed: chỉ thread community, không ẩn, không lưu trữ. private TUYỆT ĐỐI không lên Feed (kể cả với Thầy).
--   • Tường: bài Social + Trả bài cũ (đúng luật get_user_wall) + thread của người đó — cùng luật can_view_wall;
--     community cho bạn bè; private/ẩn chỉ chính chủ + Thầy.
--   • Hành trình: mọi thread của một người, gom theo DANH TÍNH LỊCH SỬ (snapshot P1), không cần lớp.
--     Chính chủ + Thầy: tất cả (kể cả private/ẩn/lưu trữ). Thành viên Class khác: community + không ẩn.
--   • class_feed / get_user_wall GIỮ NGUYÊN (không đổi kiểu trả về, không đụng cổng drift Bạn bè + Tường).
-- CHẠY: dán NGUYÊN FILE vào Supabase SQL Editor — file tự mở/đóng MỘT giao dịch.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- ── 0) Cổng phụ thuộc ────────────────────────────────────────────────────────
do $gate$
declare
  fn_expected constant jsonb := '{"can_view_wall": ["72be0399a709b62fb512bbf0be34294b"], "class_public_identity": ["9bda0938889c533040fb52f3301f3152"], "is_class_member": ["459786921eb5bbd4ff07c83bdb4db480"], "is_teacher": ["19b164504b4ce59b9bbdb4b0b64e48ad"]}';
  k text; allowed jsonb; actual text; drift text[] := '{}';
begin
  for k, allowed in select * from jsonb_each(fn_expected) loop
    select string_agg(md5(p.prosrc), ',') into actual from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = k;
    if actual is null then drift := drift || format('thiếu hàm %s', k);
    elsif not allowed ? actual then drift := drift || format('hàm %s (md5 %s)', k, actual); end if;
  end loop;
  foreach k in array array['learning_threads', 'learning_thread_events', 'class_posts', 'class_post_comments'] loop
    if to_regclass('public.' || k) is null then drift := drift || format('thiếu bảng %s', k); end if;
  end loop;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'lt_detail') then
    drift := drift || 'thiếu Learning Thread P1 (lt_detail)'::text;
  end if;
  if cardinality(drift) > 0 then
    raise exception 'DỪNG — production khác repo, KHÔNG migration: %', array_to_string(drift, '; ')
      using hint = 'Chạy db/learning_threads_p2_preflight.sql, gửi kết quả cho người review.';
  end if;
end $gate$;

-- ── 1) Index cho Feed (thread community đang hoạt động, mới nhất trước) ──────
create index if not exists learning_threads_feed_idx on public.learning_threads (last_event_at desc, id desc)
  where visibility = 'community' and hidden_at is null and archived_at is null;

-- ── 2) Thẻ tóm tắt MỘT thread (dùng chung Feed + Tường) — nội bộ ────────────
-- Kể câu chuyện, KHÔNG bung toàn bộ: ai · danh tính lịch sử · bài · diễn biến mới nhất · trạng thái.
create or replace function public.lt_thread_card(p_thread_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', t.id, 'status', t.status, 'visibility', t.visibility, 'identity', t.identity,
    'created_at', t.created_at, 'last_event_at', t.last_event_at, 'event_count', t.event_count,
    'passed_at', t.passed_at, 'is_hidden', t.hidden_at is not null, 'archived', t.archived_at is not null,
    'is_mine', t.learner_user_id = auth.uid(),
    'learner', (select jsonb_build_object('user_id', t.learner_user_id, 'name', i.name, 'avatar_url', i.avatar_url)
                from public.class_public_identity(t.learner_user_id) i),
    'first_kind', (select e.kind from public.learning_thread_events e
                   where e.thread_id = t.id and e.author_role = 'student' order by e.seq limit 1),
    'submission_count', (select count(*)::int from public.learning_thread_events e
                         where e.thread_id = t.id and e.kind = 'submission' and e.hidden_at is null),
    'last_event', (select jsonb_build_object(
                     'kind', e.kind, 'verdict', e.verdict, 'author_role', e.author_role,
                     'author', jsonb_build_object('user_id', e.author_user_id, 'name', i.name, 'avatar_url', i.avatar_url),
                     'has_resources', jsonb_array_length(e.resources) > 0,
                     'is_resubmission', e.kind = 'submission' and exists (
                        select 1 from public.learning_thread_events e2
                        where e2.thread_id = t.id and e2.kind = 'submission' and e2.seq < e.seq),
                     'created_at', e.created_at)
                   from public.learning_thread_events e
                   left join lateral public.class_public_identity(e.author_user_id) i on true
                   where e.thread_id = t.id and e.hidden_at is null
                   order by e.seq desc limit 1))
  from public.learning_threads t where t.id = p_thread_id;
$$;
revoke all on function public.lt_thread_card(uuid) from public, anon, authenticated;

-- ── 3) Feed /me: bài Social (đúng luật class_feed) + thread community ────────
-- Keyset: (sort_at, sort_key) giảm dần. sort_key = 'p:<id>' | 't:<id>' → xác định, không trùng, không lặp item.
create or replace function public.social_feed(
  p_before     timestamptz default null,
  p_before_key text        default null,
  p_limit      int         default 20
)
returns table(kind text, sort_at timestamptz, sort_key text, post jsonb, thread jsonb)
language sql stable security definer set search_path = '' as $$
  with items as (
    select 'post'::text as kind, p.created_at as sort_at, 'p:' || p.id::text as sort_key, p.id, null::uuid as tid
    from public.class_posts p
    where p.audience = 'class' and (p.hidden_at is null or public.is_teacher())
    union all
    select 'learning_thread', t.last_event_at, 't:' || t.id::text, null::uuid, t.id
    from public.learning_threads t
    where t.visibility = 'community' and t.hidden_at is null and t.archived_at is null and t.last_event_at is not null
  ),
  page as (
    select * from items
    where public.is_class_member()
      and (p_before is null or (sort_at, sort_key) < (p_before, coalesce(p_before_key, '')))
    order by sort_at desc, sort_key desc
    limit least(greatest(coalesce(p_limit, 20), 1), 50)
  )
  select pg.kind, pg.sort_at, pg.sort_key,
         case when pg.kind = 'post' then (
           select jsonb_build_object(
             'id', p.id, 'type', p.type, 'body', p.body, 'media_type', p.media_type, 'media_provider', p.media_provider,
             'media_url', p.media_url, 'external_media_id', p.external_media_id, 'created_at', p.created_at,
             'updated_at', p.updated_at, 'author_user_id', p.author_user_id, 'author_name', idn.name,
             'author_avatar_url', idn.avatar_url, 'author_role', idn.role, 'author_ht_member', idn.ht_member,
             'is_mine', p.author_user_id = auth.uid(), 'is_hidden', p.hidden_at is not null,
             'comment_count', (select count(*)::int from public.class_post_comments c
                               where c.post_id = p.id and (c.hidden_at is null or public.is_teacher())),
             'audience', p.audience)
           from public.class_posts p cross join lateral public.class_public_identity(p.author_user_id) idn
           where p.id = pg.id) end,
         case when pg.kind = 'learning_thread' then public.lt_thread_card(pg.tid) end
  from page pg
  order by pg.sort_at desc, pg.sort_key desc;
$$;

-- ── 4) Tường: bài của p_user (đúng luật get_user_wall) + thread của p_user ────
-- Không được xem tường (không phải chính mình / bạn bè / Thầy) → KHÔNG trả hàng nào (như get_user_wall).
create or replace function public.user_wall(
  p_user       uuid,
  p_before     timestamptz default null,
  p_before_key text        default null,
  p_limit      int         default 20
)
returns table(kind text, sort_at timestamptz, sort_key text, post jsonb, thread jsonb)
language sql stable security definer set search_path = '' as $$
  with items as (
    select 'post'::text as kind, p.created_at as sort_at, 'p:' || p.id::text as sort_key, p.id, null::uuid as tid
    from public.class_posts p
    where p.author_user_id = p_user and p.type in ('assignment', 'status')
      and (p.hidden_at is null or public.is_teacher())
    union all
    select 'learning_thread', t.last_event_at, 't:' || t.id::text, null::uuid, t.id
    from public.learning_threads t
    where t.learner_user_id = p_user and t.last_event_at is not null
      and (
        (t.learner_user_id = auth.uid() or public.is_teacher())                 -- chính chủ / Thầy: mọi thread
        or (t.visibility = 'community' and t.hidden_at is null)                 -- bạn bè: chỉ community không ẩn
      )
  ),
  page as (
    select * from items
    where public.can_view_wall(p_user)
      and (p_before is null or (sort_at, sort_key) < (p_before, coalesce(p_before_key, '')))
    order by sort_at desc, sort_key desc
    limit least(greatest(coalesce(p_limit, 20), 1), 50)
  )
  select pg.kind, pg.sort_at, pg.sort_key,
         case when pg.kind = 'post' then (
           select jsonb_build_object(
             'id', p.id, 'type', p.type, 'body', p.body, 'media_type', p.media_type, 'media_provider', p.media_provider,
             'media_url', p.media_url, 'external_media_id', p.external_media_id, 'created_at', p.created_at,
             'updated_at', p.updated_at, 'author_user_id', p.author_user_id, 'author_name', idn.name,
             'author_avatar_url', idn.avatar_url, 'author_role', idn.role, 'author_ht_member', null,
             'is_mine', p.author_user_id = auth.uid(), 'is_hidden', p.hidden_at is not null,
             'comment_count', (select count(*)::int from public.class_post_comments c
                               where c.post_id = p.id and (c.hidden_at is null or public.is_teacher())),
             'audience', p.audience)
           from public.class_posts p cross join lateral public.class_public_identity(p.author_user_id) idn
           where p.id = pg.id) end,
         case when pg.kind = 'learning_thread' then public.lt_thread_card(pg.tid) end
  from page pg
  order by pg.sort_at desc, pg.sort_key desc;
$$;

-- ── 5) Hành trình: mọi thread của p_user theo thứ tự thời gian + tóm tắt event ─
-- Nguồn DUY NHẤT = learning_threads + snapshot + events (không bảng journey). Gom nhóm/màu ở client (hàm thuần).
create or replace function public.learning_journey(p_user uuid)
returns table(id uuid, status text, visibility text, identity jsonb, created_at timestamptz, last_event_at timestamptz,
              passed_at timestamptz, is_hidden boolean, archived boolean, events jsonb)
language sql stable security definer set search_path = '' as $$
  select t.id, t.status, t.visibility, t.identity, t.created_at, t.last_event_at, t.passed_at,
         t.hidden_at is not null, t.archived_at is not null,
         coalesce((select jsonb_agg(jsonb_build_object(
                      'kind', e.kind, 'verdict', e.verdict, 'author_role', e.author_role,
                      'has_resources', jsonb_array_length(e.resources) > 0, 'created_at', e.created_at) order by e.seq)
                   from public.learning_thread_events e
                   where e.thread_id = t.id and (e.hidden_at is null or public.is_teacher())),   -- như lt_detail
                  '[]'::jsonb)
  from public.learning_threads t
  where p_user is not null and t.learner_user_id = p_user and public.is_class_member()
    and (
      t.learner_user_id = auth.uid() or public.is_teacher()
      or (t.visibility = 'community' and t.hidden_at is null)
    )
  order by t.created_at, t.id
  limit 1000;
$$;

revoke all on function public.social_feed(timestamptz, text, int),
  public.user_wall(uuid, timestamptz, text, int),
  public.learning_journey(uuid)
  from public, anon;
grant execute on function public.social_feed(timestamptz, text, int),
  public.user_wall(uuid, timestamptz, text, int),
  public.learning_journey(uuid)
  to authenticated;

notify pgrst, 'reload schema';
commit;
