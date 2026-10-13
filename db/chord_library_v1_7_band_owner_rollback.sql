-- Rollback V1.7: trả search/get về bản V1.5, gỡ hàm bọc + trigger. GIỮ cột chord_sheets.band_id (không mất thông tin sở hữu;
-- muốn bỏ hẳn: alter table public.chord_sheets drop column band_id; sau khi Owner đồng ý).
set local lock_timeout = '5s';
drop function if exists public.chord_sheet_contribute_publish_band(text, text, text, jsonb, integer, jsonb, uuid, uuid, uuid, jsonb, uuid);
drop trigger if exists chord_sheets_band_guard on public.chord_sheets;
drop function if exists public.chord_sheets_band_guard();
drop index if exists public.chord_sheets_band_idx;
-- ── chord_sheet_search (thêm: lọc bài đã gỡ, editor_name, sheet_mine) ──
CREATE OR REPLACE FUNCTION public.chord_sheet_search(p_query text DEFAULT ''::text, p_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $fn$
declare
  v_uid uuid := auth.uid();
  v_review boolean;
  v_key text := public.chord_fold_vi(coalesce(p_query, ''));
begin
  if v_uid is null or not public.chordlib_can('search') then
    raise exception 'CHORDLIB_FORBIDDEN' using errcode = '42501';
  end if;
  v_review := public.chordlib_can('review');
  return coalesce((
    select jsonb_agg(r.item order by r.rank, r.title_key, r.is_canonical desc, r.created_at desc)
    from (
      select s.title_key, v.created_at, coalesce(v.id = s.canonical_version_id, false) as is_canonical,
             case when s.title_key = v_key then 0 when left(s.title_key, length(v_key)) = v_key then 1 else 2 end as rank,
             jsonb_build_object(
               'sheet_id', s.id, 'title', s.title, 'composer', s.composer,
               'version_id', v.id, 'version_number', v.version_number,
               'is_canonical', coalesce(v.id = s.canonical_version_id, false),
               'review_status', v.review_status, 'anchors_status', v.anchors_status,
               'mine', coalesce(v.contributed_by = v_uid, false),
               'sheet_mine', coalesce(s.created_by = v_uid, false), 'editor_name', idn.name,
               'created_at', v.created_at)
             || case when v_review then jsonb_build_object('contributed_by', v.contributed_by) else '{}'::jsonb end as item
        from public.chord_sheets s
        join public.chord_sheet_versions v on v.sheet_id = s.id
        left join lateral public.class_public_identity(v.contributed_by) idn on true
       where (v_key = '' or position(v_key in s.title_key) > 0 or position(v_key in coalesce(s.composer_key, '')) > 0)
         and (s.archived_at is null or v_review)
         and (v.id = s.canonical_version_id
              or (v.contributed_by = v_uid and v.review_status in ('private', 'rejected'))
              or (v_review and v.review_status = 'private'))
       order by 4, s.title_key, 3 desc, v.created_at desc
       limit least(greatest(coalesce(p_limit, 20), 1), 50)
    ) r), '[]'::jsonb);
end $fn$
;

-- ── chord_sheet_get (thêm: editor_name, sheet_mine, archived) ──
CREATE OR REPLACE FUNCTION public.chord_sheet_get(p_version_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $fn$
declare
  v_uid uuid := auth.uid();
  v_review boolean;
  v public.chord_sheet_versions%rowtype;
  s public.chord_sheets%rowtype;
  v_inner boolean;
begin
  if v_uid is null or not public.chordlib_can('search') then
    raise exception 'CHORDLIB_FORBIDDEN' using errcode = '42501';
  end if;
  v_review := public.chordlib_can('review');
  select * into v from public.chord_sheet_versions x where x.id = p_version_id;
  v_inner := found and (v_review or coalesce(v.contributed_by = v_uid, false));
  if v.id is null or not (v.review_status = 'approved' or v_inner) then
    raise exception 'CHORDLIB_NOT_FOUND' using errcode = 'P0002';
  end if;
  select * into s from public.chord_sheets x where x.id = v.sheet_id;
  return jsonb_build_object(
    'sheet_id', s.id, 'title', s.title, 'composer', s.composer,
    'canonical_version_id', s.canonical_version_id,
    'version_id', v.id, 'version_number', v.version_number, 'parent_version_id', v.parent_version_id,
    'is_canonical', coalesce(v.id = s.canonical_version_id, false),
    'text', v.text, 'text_hash', v.text_hash, 'meter', v.meter, 'suggested_bpm', v.suggested_bpm,
    'anchors', v.anchors, 'anchors_status', v.anchors_status, 'generator', v.generator,
    'review_status', v.review_status, 'reviewed_at', v.reviewed_at,
    'mine', coalesce(v.contributed_by = v_uid, false), 'created_at', v.created_at,
    'sheet_mine', coalesce(s.created_by = v_uid, false), 'archived', s.archived_at is not null,
    'editor_name', (select i.name from public.class_public_identity(v.contributed_by) i))
  -- Bàn biên tập: đang xem một bản mà bài còn bản chờ duyệt MỚI HƠN → trỏ tới bản đó. Chỉ cho người review.
  || case when v_review then jsonb_build_object('draft_version_id', (
       select x.id from public.chord_sheet_versions x
        where x.sheet_id = v.sheet_id and x.review_status = 'private' and x.version_number > v.version_number
        order by x.version_number desc limit 1))
     else '{}'::jsonb end
  || case when v_inner then jsonb_build_object(
       'sources', v.sources, 'anchor_review', v.anchor_review, 'rejection_reason', v.rejection_reason,
       'contributed_by', v.contributed_by, 'reviewed_by', v.reviewed_by)
     else '{}'::jsonb end;
end $fn$
;

notify pgrst, 'reload schema';
