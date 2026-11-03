-- ═══════════════════════════════════════════════════════════════════════════
-- CLASS SOCIAL — G3: thẻ "Ôn nhanh" (lesson_clip) trên Feed /me. *** BẢN CHƯA CHẠY PRODUCTION — chờ Owner duyệt riêng. ***
-- Thiết kế: docs/LESSON-CLIP-CARD-V1.md. CHỈ ĐỌC, KHÔNG BẢNG / CỘT / POLICY MỚI, KHÔNG audience mới. Idempotent.
-- Nguồn dẫn xuất (tiền lệ teamlab_publication): mỗi khối kind='video' của giáo trình ĐÃ XUẤT BẢN = một thẻ. Asset không nhân đôi:
--   video chỉ nằm trong khối giáo trình; thẻ chỉ tham chiếu buổi học (class_id + số buổi) — payload KHÔNG có url / video id / note / blocks.
-- QUYỀN (hai hàm Feed là SECURITY DEFINER, cổng is_class_member() là toàn cục ⇒ kiểm TỪNG DÒNG):
--   • for_you    : dòng chỉ vào khi tva_private.can_read_class_curriculum(class_id) (đúng vị từ RLS class_lesson_content_student_read).
--   • my_classes : như trên VÀ lớp thuộc lớp hiện tại của người xem (social_class_is_member). friends: không có thẻ.
-- KHOÁ THẺ: 'c:<session_id>:<md5(added_at|title)>' — chèn thêm khối khác trong buổi KHÔNG đổi khoá (không dùng chỉ số khối).
-- SẮP XẾP ỔN ĐỊNH: sort_at = khối.added_at (ISO UTC 'Z', công cụ chèn ghi MỘT lần). class_lesson_content không có published_at và updated_at đổi
--   mỗi lần sửa ⇒ KHÔNG dùng. Khối không có added_at / sai định dạng / quá 5 phút trong tương lai ⇒ KHÔNG hiện (không làm vỡ Feed, không "nổi" vĩnh viễn). Chỉ lấy 90 ngày gần nhất.
-- Thay HAI hàm (create or replace ⇒ ACL giữ nguyên): public.social_feed, public.social_feed_scoped. Thêm HAI hàm nội bộ (không ai ngoài owner gọi được):
--   public.social_clip_added_at(text), public.social_feed_clip_items(uuid[]). Các nhánh cũ GIỮ NGUYÊN từng dòng (chỉ thêm cột payload = null).
-- Frontend cũ bỏ qua kind lạ ⇒ DB trước hay frontend trước đều an toàn. Rollback: db/lesson_clip_card_v1_rollback.sql (cổng md5 riêng).
-- CHẠY: scripts/prod-db.py dryrun|migrate (file KHÔNG có begin/commit).
-- md5 prosrc bản này: social_feed = 91e32e8ba809cda3b28c6a8964d43efa · social_feed_scoped = f79d95d5d7ce80a7a044513b2d1e086d
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0) Cổng: hai hàm Feed phải ĐÚNG bản production đã xác minh (01/11) hoặc đã là bản G3; phụ thuộc phải có ───────────
do $gate$
declare
  v_feed text; v_scoped text; v_drift text[] := '{}';
  v_col text; v_tab text;
begin
  select string_agg(md5(p.prosrc), ',') into v_feed from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'social_feed';
  select string_agg(md5(p.prosrc), ',') into v_scoped from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'social_feed_scoped';
  if v_feed is null then v_drift := v_drift || 'thiếu hàm social_feed'::text;
  elsif v_feed not in ('2697eb50daaf7c085da22adaddc2baa2', '91e32e8ba809cda3b28c6a8964d43efa') then v_drift := v_drift || format('social_feed md5 %s lạ', v_feed); end if;
  if v_scoped is null then v_drift := v_drift || 'thiếu hàm social_feed_scoped'::text;
  elsif v_scoped not in ('47bf0f5f3382086d19ad6d0b184644cc', 'f79d95d5d7ce80a7a044513b2d1e086d') then v_drift := v_drift || format('social_feed_scoped md5 %s lạ', v_scoped); end if;
  if to_regprocedure('tva_private.can_read_class_curriculum(uuid)') is null then v_drift := v_drift || 'thiếu tva_private.can_read_class_curriculum(uuid)'::text; end if;
  if to_regprocedure('public.social_class_is_member(uuid,uuid)') is null then v_drift := v_drift || 'thiếu public.social_class_is_member(uuid,uuid)'::text; end if;
  for v_tab, v_col in select * from (values
      ('class_lesson_content','session_id'),('class_lesson_content','status'),('class_lesson_content','blocks'),
      ('class_sessions','id'),('class_sessions','class_id'),('class_sessions','session_number'),('class_sessions','event_type'),
      ('class_schedule','id'),('class_schedule','code'),('class_schedule','name')) v(t, c) loop
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = v_tab and column_name = v_col) then
      v_drift := v_drift || format('thiếu cột %s.%s', v_tab, v_col);
    end if;
  end loop;
  if array_length(v_drift, 1) > 0 then
    raise exception 'LESSON_CLIP_GATE_FAIL: %', array_to_string(v_drift, '; ');
  end if;
end
$gate$;

-- ── 1) Đọc added_at an toàn: sai định dạng / ngày không tồn tại → NULL (không bao giờ ném lỗi vào Feed) ───────────────
create or replace function public.social_clip_added_at(p_text text)
returns timestamptz language plpgsql stable set search_path = '' as $$
begin
  if p_text is null or p_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?Z$' then return null; end if;
  return p_text::timestamptz;
exception when others then return null;
end $$;
comment on function public.social_clip_added_at(text) is 'lesson_clip_card_v1: parse added_at ISO UTC an toàn (nội bộ)';
revoke all on function public.social_clip_added_at(text) from public, anon, authenticated;

-- ── 2) Các thẻ Ôn nhanh người xem ĐƯỢC PHÉP thấy (nội bộ; p_class_ids null = mọi lớp, mảng = chỉ các lớp đó) ──────────
create or replace function public.social_feed_clip_items(p_class_ids uuid[] default null)
returns table(sort_at timestamptz, sort_key text, payload jsonb)
language sql stable security definer set search_path = '' as $$
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
  order by s.id, k.key, b.ord
$$;
comment on function public.social_feed_clip_items(uuid[]) is 'lesson_clip_card_v1: thẻ Ôn nhanh người gọi được đọc (can_read_class_curriculum); payload KHÔNG có url/video id (nội bộ)';
revoke all on function public.social_feed_clip_items(uuid[]) from public, anon, authenticated;

-- ── 3) social_feed + nguồn lesson_clip (nhánh cũ giữ nguyên) ──────────────────────────────────────────────────────
create or replace function public.social_feed(
  p_before     timestamptz default null,
  p_before_key text        default null,
  p_limit      int         default 20
)
returns table(kind text, sort_at timestamptz, sort_key text, post jsonb, thread jsonb)
language sql stable security definer set search_path = '' as $$
  with items as (
    select 'post'::text as kind, p.created_at as sort_at, 'p:' || p.id::text as sort_key, p.id, null::uuid as tid, null::jsonb as payload
    from public.class_posts p
    where (p.audience = 'class' and (p.hidden_at is null or public.is_teacher()))
       or (p.audience = 'friends' and p.hidden_at is null
           and (p.author_user_id = auth.uid() or public.is_friend_of(p.author_user_id)))
    union all
    select 'learning_thread', t.last_event_at, 't:' || t.id::text, null::uuid, t.id, null::jsonb
    from public.learning_threads t
    where t.visibility = 'community' and t.hidden_at is null and t.archived_at is null and t.last_event_at is not null
    union all
    select 'teamlab_publication', pb.published_at, 'u:' || pb.id::text, pb.id, null::uuid, null::jsonb
    from public.teamlab_publications pb
    where pb.status = 'published' and pb.published_at is not null and pb.public_slug is not null
    union all
    select 'lesson_clip', ci.sort_at, ci.sort_key, null::uuid, null::uuid, ci.payload
    from public.social_feed_clip_items(null) ci
  ),
  page as (
    select * from items
    where public.is_class_member()
      and (p_before is null or (sort_at, sort_key) < (p_before, coalesce(p_before_key, '')))
    order by sort_at desc, sort_key desc
    limit least(greatest(coalesce(p_limit, 20), 1), 50)
  )
  select pg.kind, pg.sort_at, pg.sort_key,
         case pg.kind
           when 'post' then (
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
             where p.id = pg.id)
           when 'teamlab_publication' then (
             select jsonb_build_object(
               'publication_id', pb.id, 'project_id', pr.id, 'slug', pb.public_slug, 'title', t.name,
               'band_name', b.name, 'project_name', pr.name,
               'cover_path', pr.cover_path, 'avatar_path', pr.avatar_path, 'project_slug', pr.public_slug,
               'published_at', pb.published_at)
             from public.teamlab_publications pb
             join public.teams t on t.id = pb.song_id
             join public.projects pr on pr.id = pb.project_id
             left join public.teamlab_bands b on b.id = t.band_id
             where pb.id = pg.id)
           when 'lesson_clip' then pg.payload
         end,
         case when pg.kind = 'learning_thread' then public.lt_thread_card(pg.tid) end
  from page pg
  order by pg.sort_at desc, pg.sort_key desc;
$$;

grant execute on function public.social_feed(timestamptz, text, int) to authenticated;

-- ── 4) social_feed_scoped + nguồn lesson_clip chỉ ở góc nhìn my_classes ───────────────────────────────────────────
create or replace function public.social_feed_scoped(
  p_scope      text,
  p_before     timestamptz default null,
  p_before_key text        default null,
  p_limit      int         default 20
)
returns table(kind text, sort_at timestamptz, sort_key text, post jsonb, thread jsonb)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare v_me uuid := auth.uid();
begin
  if p_scope = 'for_you' then
    return query select * from public.social_feed(p_before, p_before_key, p_limit);
    return;
  end if;
  if p_scope is null or p_scope not in ('my_classes', 'friends') then
    raise exception 'SF_BAD_SCOPE' using errcode = '22023';
  end if;
  if v_me is null or not public.is_class_member() then return; end if;

  return query
  with my_class as (          -- lớp HIỆN TẠI của tôi: đúng luật social_my_classes
    select cs.id from public.class_schedule cs
    where p_scope = 'my_classes' and coalesce(cs.status, '') not in ('cancelled', 'merged', 'draft')
      and public.social_class_is_member(cs.id, v_me)
  ),
  friend as (                 -- bạn bè ĐÃ CHẤP NHẬN (không pending/declined; không chính mình)
    select case when f.requester_id = v_me then f.addressee_id else f.requester_id end as uid
    from public.friendships f
    where p_scope = 'friends' and f.status = 'accepted' and v_me in (f.requester_id, f.addressee_id)
  ),
  items as (
    select 'learning_thread'::text as k, t.last_event_at as at, 't:' || t.id::text as sk, null::uuid as pid, t.id as tid, null::jsonb as payload
    from public.learning_threads t
    where t.visibility = 'community' and t.hidden_at is null and t.archived_at is null and t.last_event_at is not null
      and ((p_scope = 'my_classes' and t.class_schedule_id in (select id from my_class))
        or (p_scope = 'friends' and t.learner_user_id in (select uid from friend)))
    union all
    select 'post', p.created_at, 'p:' || p.id::text, p.id, null::uuid, null::jsonb
    from public.class_posts p
    where p_scope = 'friends' and p.author_user_id in (select uid from friend)
      and ((p.audience = 'class' and (p.hidden_at is null or public.is_teacher()))
        or (p.audience = 'friends' and p.hidden_at is null))
    union all
    select 'lesson_clip', ci.sort_at, ci.sort_key, null::uuid, null::uuid, ci.payload
    from public.social_feed_clip_items(coalesce((select array_agg(m.id) from my_class m), '{}'::uuid[])) ci
    where p_scope = 'my_classes'
  ),
  page as (
    select * from items i
    where p_before is null or (i.at, i.sk) < (p_before, coalesce(p_before_key, ''))
    order by i.at desc, i.sk desc
    limit least(greatest(coalesce(p_limit, 20), 1), 50)
  )
  select pg.k, pg.at, pg.sk,
         case when pg.k = 'post' then public.social_post_card(pg.pid) when pg.k = 'lesson_clip' then pg.payload end,
         case when pg.k = 'learning_thread' then public.lt_thread_card(pg.tid) end
  from page pg
  order by pg.at desc, pg.sk desc;
end $$;

revoke all on function public.social_feed_scoped(text, timestamptz, text, int) from public, anon;
grant execute on function public.social_feed_scoped(text, timestamptz, text, int) to authenticated;
notify pgrst, 'reload schema';
