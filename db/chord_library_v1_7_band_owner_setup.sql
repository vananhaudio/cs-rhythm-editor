-- ═══════════════════════════════════════════════════════════════════════════
-- THƯ VIỆN HỢP ÂM CHUẨN HOÁ — V1.7: BAND SỞ HỮU BÀI (chord_sheets.band_id).
-- Rollback: db/chord_library_v1_7_band_owner_rollback.sql. Chạy qua prod-db.py (file KHÔNG có begin/commit).
--
--   • chord_sheets.band_id uuid NULL → teamlab_bands(id) ON DELETE SET NULL. Bài cũ = NULL ("Chưa gán Band"), KHÔNG backfill.
--   • chord_sheet_contribute_publish_band(... , p_band_id): bọc chord_sheet_contribute_publish (chữ ký CŨ giữ nguyên).
--     Chỉ gán Band khi tạo BÀI MỚI; Admin được chọn Band bất kỳ, người khác chỉ Band mình là Biên tập (teamlab_is_band_editor).
--     Kiểm tra ở backend, TRƯỚC khi ghi. Không đổi duyệt/canonical/phiên bản.
--   • trigger chord_sheets_band_guard: client không đổi được Band đã có (trừ Admin).
--   • chord_sheet_search / chord_sheet_get: thêm 'band_id', 'band_name' (tên Band đọc chung như teamlab_bands).
-- KHÔNG đổi: quyền sửa/xoá (created_by + review), chordlib_can, approve/reject/accept_anchors, dữ liệu bài/phiên bản.
-- ═══════════════════════════════════════════════════════════════════════════
set local lock_timeout = '5s';

do $gate$
declare
  v_search text := (select p.prosrc from pg_proc p where p.oid = 'public.chord_sheet_search(text,integer)'::regprocedure);
  v_get    text := (select p.prosrc from pg_proc p where p.oid = 'public.chord_sheet_get(uuid)'::regprocedure);
begin
  if to_regclass('public.teamlab_bands') is null then raise exception 'GATE: thiếu teamlab_bands'; end if;
  if to_regprocedure('public.teamlab_is_band_editor(uuid)') is null then raise exception 'GATE: thiếu teamlab_is_band_editor'; end if;
  if to_regprocedure('public.chord_sheet_contribute_publish(text,text,text,jsonb,integer,jsonb,uuid,uuid,uuid,jsonb)') is null then
    raise exception 'GATE: thiếu chord_sheet_contribute_publish (V1.5)'; end if;
  if md5(v_search) <> '2a5ba860e166f57ac3244743799f457b' and v_search not like '%band_name%' then raise exception 'GATE: chord_sheet_search khác bản V1.5'; end if;
  if md5(v_get)    <> '3217f51d732686e0d4228ca0196383e1'    and v_get    not like '%band_name%' then raise exception 'GATE: chord_sheet_get khác bản V1.5'; end if;
end
$gate$;

alter table public.chord_sheets add column if not exists band_id uuid references public.teamlab_bands(id) on delete set null;
create index if not exists chord_sheets_band_idx on public.chord_sheets (band_id) where band_id is not null;

-- Client không đổi Band đã gán (ghi chỉ qua RPC SECURITY DEFINER; đây là lớp phòng thủ thứ hai).
create or replace function public.chord_sheets_band_guard()
returns trigger language plpgsql set search_path = '' as $fn$
begin
  if new.band_id is distinct from old.band_id and new.band_id is not null and old.band_id is not null
     and auth.uid() is not null
     and not exists (select 1 from public.app_users u where u.id = auth.uid() and u.role = 'admin' and u.status = 'active') then
    raise exception 'CHORDLIB_FORBIDDEN: không đổi được Band sở hữu' using errcode = '42501';
  end if;
  return new;
end $fn$;
revoke all on function public.chord_sheets_band_guard() from public, anon, authenticated;
drop trigger if exists chord_sheets_band_guard on public.chord_sheets;
create trigger chord_sheets_band_guard before update of band_id on public.chord_sheets
  for each row execute function public.chord_sheets_band_guard();

-- ── chord_sheet_search (V1.7: thêm band_id, band_name) ──
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
               'band_id', s.band_id, 'band_name', bnd.name,
               'created_at', v.created_at)
             || case when v_review then jsonb_build_object('contributed_by', v.contributed_by) else '{}'::jsonb end as item
        from public.chord_sheets s
        join public.chord_sheet_versions v on v.sheet_id = s.id
        left join lateral public.class_public_identity(v.contributed_by) idn on true
        left join public.teamlab_bands bnd on bnd.id = s.band_id
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

-- ── chord_sheet_get (V1.7: thêm band_id, band_name) ──
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
    'editor_name', (select i.name from public.class_public_identity(v.contributed_by) i),
    'band_id', s.band_id, 'band_name', (select b.name from public.teamlab_bands b where b.id = s.band_id))
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


-- ── Đăng bài kèm Band sở hữu (chữ ký cũ của chord_sheet_contribute_publish KHÔNG đổi) ──────────
create or replace function public.chord_sheet_contribute_publish_band(
  p_text text, p_title text default null, p_composer text default null, p_meter jsonb default null,
  p_suggested_bpm integer default null, p_sources jsonb default '[]'::jsonb, p_version_id uuid default null,
  p_sheet_id uuid default null, p_parent_version_id uuid default null, p_anchors jsonb default null,
  p_band_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null then raise exception 'CHORDLIB_FORBIDDEN' using errcode = '42501'; end if;
  if p_band_id is not null then
    if p_sheet_id is not null then
      raise exception 'CHORDLIB_INVALID: Band sở hữu chỉ chọn khi tạo bài mới' using errcode = '22023';
    end if;
    if not exists (select 1 from public.teamlab_bands b where b.id = p_band_id) then
      raise exception 'CHORDLIB_INVALID: Band không tồn tại' using errcode = '22023';
    end if;
    if not (exists (select 1 from public.app_users u where u.id = v_uid and u.role = 'admin' and u.status = 'active')
            or public.teamlab_is_band_editor(p_band_id)) then
      raise exception 'CHORDLIB_FORBIDDEN: không có quyền lưu bài vào Band này' using errcode = '42501';
    end if;
  end if;
  v_result := public.chord_sheet_contribute_publish(p_text, p_title, p_composer, p_meter, p_suggested_bpm, p_sources,
                                                    p_version_id, p_sheet_id, p_parent_version_id, p_anchors);
  if p_band_id is not null and coalesce((v_result ->> 'duplicate')::boolean, false) = false then
    update public.chord_sheets
       set band_id = p_band_id
     where id = (v_result ->> 'sheet_id')::uuid and band_id is null and created_by = v_uid;
  end if;
  return v_result;
end $fn$;

revoke all on function public.chord_sheet_contribute_publish_band(text, text, text, jsonb, integer, jsonb, uuid, uuid, uuid, jsonb, uuid) from public, anon;
grant execute on function public.chord_sheet_contribute_publish_band(text, text, text, jsonb, integer, jsonb, uuid, uuid, uuid, jsonb, uuid) to authenticated;
comment on function public.chord_sheet_contribute_publish_band(text, text, text, jsonb, integer, jsonb, uuid, uuid, uuid, jsonb, uuid)
  is 'chord_library_v1.7: như chord_sheet_contribute_publish, kèm Band sở hữu cho bài MỚI (Admin: bất kỳ; Biên tập: Band của mình)';
notify pgrst, 'reload schema';
