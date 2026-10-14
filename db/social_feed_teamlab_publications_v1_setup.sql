-- ═══════════════════════════════════════════════════════════════════════════
-- CLASS SOCIAL — FEED "DÀNH CHO BẠN": bài TeamLab ĐÃ XUẤT BẢN công khai. CHỈ ĐỌC, KHÔNG BẢNG MỚI, KHÔNG SAO CHÉP DỮ LIỆU.
-- Thay MỘT hàm: public.social_feed (cùng chữ ký + cùng cột trả về; create or replace → ACL giữ nguyên).
-- Thêm nguồn thứ ba vào Feed: teamlab_publications.status = 'published' → kind 'teamlab_publication', sort_key 'u:<publication_id>'.
--   • Một publication = một thẻ. Gỡ xuất bản → status ≠ 'published' → biến mất ngay. Phát hành lại → published_at mới → nổi lên đầu.
--   • Không mốc cắt theo ngày: bài đang published hiện nay cũng hiện (Owner duyệt).
--   • Payload (cột post) CHỈ: publication_id, project_id, slug, title, band_name, project_name, cover_path, avatar_path, published_at.
--     Không user_id / take / track / snapshot. Đã là dữ liệu của RPC công khai teamlab_public_song.
--   • Hai nguồn cũ (class_posts, learning_threads) GIỮ NGUYÊN từng dòng; cổng is_class_member() áp cho cả ba nguồn.
--   • Frontend cũ bỏ qua kind lạ (toFeedEntries) → triển khai DB trước, frontend sau đều an toàn.
-- Không đổi RLS, không đụng TeamLab. Rollback: db/social_feed_teamlab_publications_v1_rollback.sql.
-- CHẠY: ~/Projects/cs-prod-db-infra/scripts/prod-db.py dryrun|migrate (file KHÔNG có begin/commit).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0) Cổng: social_feed phải đúng bản đang chạy production (md5 prosrc) hoặc đã là bản này ─────
do $gate$
declare
  v_md5 text;
  v_known constant text[] := array['d62b6a78984817b787e7731e46c2a0e5'];   -- bản production trước thay đổi
  v_col text; v_tab text; v_drift text[] := '{}';
begin
  select string_agg(md5(p.prosrc), ',') into v_md5
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'social_feed';
  if v_md5 is null then v_drift := v_drift || 'thiếu hàm social_feed';
  elsif not (v_md5 = any (v_known)) and position('teamlab_publication' in (select p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'social_feed')) = 0 then
    v_drift := v_drift || format('social_feed md5 %s lạ', v_md5);
  end if;
  for v_tab, v_col in select * from (values
      ('teamlab_publications','id'),('teamlab_publications','status'),('teamlab_publications','published_at'),
      ('teamlab_publications','public_slug'),('teamlab_publications','song_id'),('teamlab_publications','project_id'),
      ('teams','id'),('teams','name'),('teams','band_id'),('projects','id'),('projects','name'),
      ('projects','cover_path'),('projects','avatar_path'),('teamlab_bands','id'),('teamlab_bands','name')) v(t, c) loop
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = v_tab and column_name = v_col) then
      v_drift := v_drift || format('thiếu cột %s.%s', v_tab, v_col);
    end if;
  end loop;
  if array_length(v_drift, 1) > 0 then
    raise exception 'FEED_TEAMLAB_GATE_FAIL: %', array_to_string(v_drift, '; ');
  end if;
end
$gate$;

-- ── 1) social_feed + nguồn teamlab_publication ────────────────────────────────────────────────
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
    where (p.audience = 'class' and (p.hidden_at is null or public.is_teacher()))
       or (p.audience = 'friends' and p.hidden_at is null
           and (p.author_user_id = auth.uid() or public.is_friend_of(p.author_user_id)))
    union all
    select 'learning_thread', t.last_event_at, 't:' || t.id::text, null::uuid, t.id
    from public.learning_threads t
    where t.visibility = 'community' and t.hidden_at is null and t.archived_at is null and t.last_event_at is not null
    union all
    select 'teamlab_publication', pb.published_at, 'u:' || pb.id::text, pb.id, null::uuid
    from public.teamlab_publications pb
    where pb.status = 'published' and pb.published_at is not null and pb.public_slug is not null
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
               'cover_path', pr.cover_path, 'avatar_path', pr.avatar_path, 'published_at', pb.published_at)
             from public.teamlab_publications pb
             join public.teams t on t.id = pb.song_id
             join public.projects pr on pr.id = pb.project_id
             left join public.teamlab_bands b on b.id = t.band_id
             where pb.id = pg.id)
         end,
         case when pg.kind = 'learning_thread' then public.lt_thread_card(pg.tid) end
  from page pg
  order by pg.sort_at desc, pg.sort_key desc;
$$;

grant execute on function public.social_feed(timestamptz, text, int) to authenticated;
notify pgrst, 'reload schema';
