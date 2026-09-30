-- ═══════════════════════════════════════════════════════════════════════════
-- CLASS SOCIAL — FEED V1: "Dành cho bạn · Lớp của tôi · Bạn bè" — CHỈ ĐỌC, KHÔNG BẢNG MỚI. Idempotent.
-- Thiết kế: docs/SOCIAL-FEED-V1.md. Rollback: db/social_feed_v1_rollback.sql.
--
-- Nguyên tắc: BỘ LỌC KHÔNG TẠO QUYỀN MỚI. Mỗi góc nhìn là TẬP CON của thứ người xem vốn được xem:
--   • for_you    = social_feed() hiện có, giữ NGUYÊN (không sửa hàm này).
--   • my_classes = Learning Thread community (không ẩn/lưu trữ) có snapshot lớp ∈ LỚP HIỆN TẠI của người xem,
--                  theo ĐÚNG luật social_my_classes (social_class_is_member; bỏ lớp cancelled/merged/draft).
--                  Không bài Social (class_posts chưa có ngữ cảnh lớp) — không suy diễn lớp. Tự học: không bao giờ.
--   • friends    = hoạt động mà TÁC GIẢ/NGƯỜI HỌC là bạn bè ĐÃ CHẤP NHẬN (không tính chính mình), với cùng luật
--                  xem như social_feed: thread community; bài 'class' (bài ẩn chỉ Thầy); bài 'friends' không ẩn.
--                  Thread "Chỉ Thầy" KHÔNG bao giờ vào (kể cả với bạn bè).
-- Keyset giống social_feed: (sort_at, sort_key) giảm dần; sort_key 'p:<id>' | 't:<id>' → xác định, không trùng.
-- Một thread = một mục (theo last_event_at). Không đổi dữ liệu, không đổi snapshot.
-- CHẠY: dán NGUYÊN FILE vào Supabase SQL Editor — file tự mở/đóng MỘT giao dịch.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- ── 0) Cổng phụ thuộc: hàm sắp gọi phải đúng bản repo đang chạy production ─────────────────────
do $gate$
declare
  fn_expected constant jsonb := '{"class_public_identity": ["9bda0938889c533040fb52f3301f3152"], "is_class_member": ["459786921eb5bbd4ff07c83bdb4db480"], "is_teacher": ["19b164504b4ce59b9bbdb4b0b64e48ad"], "lt_thread_card": ["172c1d1d323e637944097493b5bf5344"], "social_class_is_member": ["85167bc26d7c87dfbd7227b2b9687411"], "social_class_members_of": ["b434c0e8478ec8ed62c004fffe6668d0"], "social_feed": ["d62b6a78984817b787e7731e46c2a0e5"]}';
  col_required constant jsonb := '{"class_post_comments": ["post_id", "hidden_at"], "class_posts": ["id", "author_user_id", "type", "body", "audience", "hidden_at", "created_at", "updated_at", "media_type", "media_provider", "media_url", "external_media_id"], "class_schedule": ["id", "status"], "friendships": ["requester_id", "addressee_id", "status"], "learning_threads": ["id", "learner_user_id", "class_schedule_id", "visibility", "hidden_at", "archived_at", "last_event_at"]}';
  k text; allowed jsonb; actual text; c text; drift text[] := '{}';
begin
  for k, allowed in select * from jsonb_each(fn_expected) loop
    select string_agg(md5(p.prosrc), ',') into actual from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = k;
    if actual is null then drift := drift || format('thiếu hàm %s', k);
    elsif not allowed ? actual then drift := drift || format('hàm %s (md5 %s)', k, actual); end if;
  end loop;
  for k, allowed in select * from jsonb_each(col_required) loop
    for c in select jsonb_array_elements_text(allowed) loop
      if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = k and column_name = c) then
        drift := drift || format('thiếu cột %s.%s', k, c);
      end if;
    end loop;
  end loop;
  if cardinality(drift) > 0 then
    raise exception 'DỪNG — production khác repo, KHÔNG migration: %', array_to_string(drift, '; ')
      using hint = 'Chạy db/social_feed_v1_preflight.sql, gửi kết quả cho người review.';
  end if;
end $gate$;

-- ── 1) Thẻ bài Social (nội bộ) — ĐÚNG dạng jsonb social_feed đang trả (frontend dùng lại toFeedEntries) ──
create or replace function public.social_post_card(p_post uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
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
  where p.id = p_post;
$$;
revoke all on function public.social_post_card(uuid) from public, anon, authenticated;

-- ── 2) Feed theo góc nhìn ──────────────────────────────────────────────────────
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
    select 'learning_thread'::text as k, t.last_event_at as at, 't:' || t.id::text as sk, null::uuid as pid, t.id as tid
    from public.learning_threads t
    where t.visibility = 'community' and t.hidden_at is null and t.archived_at is null and t.last_event_at is not null
      and ((p_scope = 'my_classes' and t.class_schedule_id in (select id from my_class))
        or (p_scope = 'friends' and t.learner_user_id in (select uid from friend)))
    union all
    select 'post', p.created_at, 'p:' || p.id::text, p.id, null::uuid
    from public.class_posts p
    where p_scope = 'friends' and p.author_user_id in (select uid from friend)
      and ((p.audience = 'class' and (p.hidden_at is null or public.is_teacher()))
        or (p.audience = 'friends' and p.hidden_at is null))
  ),
  page as (
    select * from items i
    where p_before is null or (i.at, i.sk) < (p_before, coalesce(p_before_key, ''))
    order by i.at desc, i.sk desc
    limit least(greatest(coalesce(p_limit, 20), 1), 50)
  )
  select pg.k, pg.at, pg.sk,
         case when pg.k = 'post' then public.social_post_card(pg.pid) end,
         case when pg.k = 'learning_thread' then public.lt_thread_card(pg.tid) end
  from page pg
  order by pg.at desc, pg.sk desc;
end $$;

revoke all on function public.social_feed_scoped(text, timestamptz, text, int) from public, anon;
grant execute on function public.social_feed_scoped(text, timestamptz, text, int) to authenticated;

notify pgrst, 'reload schema';
commit;
