-- ═══════════════════════════════════════════════════════════════════════════
-- THƯ VIỆN HỢP ÂM CHUẨN HOÁ — V1.5: BIÊN TẬP ÂM NHẠC ĐĂNG BÀI CÔNG KHAI NGAY, SỬA/GỠ BÀI CỦA MÌNH, GHI CÔNG NGƯỜI BIÊN TẬP.
-- Rollback: db/chord_library_v1_5_editor_publish_rollback.sql. Chạy qua prod-db.py (file KHÔNG có begin/commit).
--
-- Người đang giữ vai Biên tập âm nhạc (teamlab_is_any_music_editor()) — KHÔNG có quyền 'review':
--   • chord_sheet_contribute_publish: cùng tham số chord_sheet_contribute. Biên tập → ghi phiên bản RỒI công khai ngay
--     (approved + bản chuẩn của bài) trong MỘT transaction; chỉ bài MỚI hoặc bài do chính mình tạo. Người có review
--     và người KHÔNG phải Biên tập: gọi thẳng chord_sheet_contribute (bản nháp như cũ) — hành vi cũ không đổi.
--   • chord_sheet_update_info: thêm nhánh cho Biên tập với bài DO MÌNH TẠO, chưa gỡ.
--   • chord_sheet_archive: gỡ bài (archived_at) — Biên tập với bài của mình; người review với mọi bài. Không xoá dữ liệu.
--   • chord_sheet_search / chord_sheet_get: lọc bài đã gỡ (trừ người review) + trả 'editor_name' (tên Người biên tập,
--     từ class_public_identity — không email/SĐT), 'sheet_mine', 'archived'. KHÔNG lộ uid của người khác.
-- KHÔNG đổi: chordlib_can, tool_capabilities, chord_sheet_approve/reject/accept_anchors, 26 phiên bản hiện có.
-- Cột mới trên chord_sheets: archived_at, archived_by (NULL = đang hiện).
-- ═══════════════════════════════════════════════════════════════════════════
set local lock_timeout = '5s';

do $gate$
declare
  v_search text := (select p.prosrc from pg_proc p where p.oid = 'public.chord_sheet_search(text,integer)'::regprocedure);
  v_get    text := (select p.prosrc from pg_proc p where p.oid = 'public.chord_sheet_get(uuid)'::regprocedure);
  v_upd    text := (select p.prosrc from pg_proc p where p.oid = 'public.chord_sheet_update_info(uuid,text,text)'::regprocedure);
begin
  if to_regprocedure('public.teamlab_is_any_music_editor()') is null then raise exception 'GATE: thiếu teamlab_is_any_music_editor() (Teamlab Việc 3)'; end if;
  if to_regprocedure('public.class_public_identity(uuid)') is null then raise exception 'GATE: thiếu class_public_identity'; end if;
  if to_regprocedure('public.chord_sheet_contribute(text,text,text,jsonb,integer,jsonb,uuid,uuid,uuid,jsonb)') is null then raise exception 'GATE: thiếu chord_sheet_contribute'; end if;
  -- Hàm sẵn có phải đúng bản đã đọc (hoặc đã vá bởi chính file này) — không ghi đè thay đổi lạ.
  if md5(v_search) <> 'bb14e70e8b6db6f7385e6a4b0cab3fbf' and v_search not like '%editor_name%' then raise exception 'GATE: chord_sheet_search khác bản đã đọc'; end if;
  if md5(v_get)    <> '78edc4067a67545fc6f5b8f27dafb7c6' and v_get    not like '%editor_name%' then raise exception 'GATE: chord_sheet_get khác bản đã đọc'; end if;
  if md5(v_upd)    <> '0bc59e222a4582620d040a9dd9c2fea6' and v_upd    not like '%teamlab_is_any_music_editor%' then raise exception 'GATE: chord_sheet_update_info khác bản đã đọc'; end if;
end
$gate$;

alter table public.chord_sheets add column if not exists archived_at timestamptz;
alter table public.chord_sheets add column if not exists archived_by uuid;

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

-- ── chord_sheet_update_info (thêm nhánh Biên tập, bài của mình) ──
CREATE OR REPLACE FUNCTION public.chord_sheet_update_info(p_sheet_id uuid, p_title text, p_composer text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $fn$
declare
  v_uid uuid := auth.uid();
  v_title text := btrim(coalesce(p_title, ''));
  v_composer text := nullif(btrim(coalesce(p_composer, '')), '');
  v_sheet public.chord_sheets%rowtype;
begin
  if v_uid is null then
    raise exception 'CHORDLIB_FORBIDDEN' using errcode = '42501';
  end if;
  select * into v_sheet from public.chord_sheets s where s.id = p_sheet_id for update;
  -- Người review (admin/teacher): như cũ. Biên tập: CHỈ bài do chính mình tạo và chưa gỡ (không tiết lộ bài có tồn tại hay không).
  if not public.chordlib_can('review')
     and not (v_sheet.id is not null and v_sheet.created_by = v_uid and v_sheet.archived_at is null
              and public.teamlab_is_any_music_editor()) then
    raise exception 'CHORDLIB_FORBIDDEN' using errcode = '42501';
  end if;
  if v_sheet.id is null then raise exception 'CHORDLIB_NOT_FOUND' using errcode = 'P0002'; end if;
  if length(v_title) not between 1 and 200 then
    raise exception 'CHORDLIB_INVALID: thiếu tên bài (1–200 ký tự)' using errcode = '22023';
  end if;
  if v_composer is not null and length(v_composer) > 200 then
    raise exception 'CHORDLIB_INVALID: tên tác giả quá dài' using errcode = '22023';
  end if;
  if v_sheet.title is distinct from v_title or v_sheet.composer is distinct from v_composer then
    update public.chord_sheets set title = v_title, composer = v_composer, updated_at = now() where id = p_sheet_id;
  end if;
  return jsonb_build_object('ok', true, 'sheet_id', p_sheet_id, 'title', v_title, 'composer', v_composer);
end $fn$
;

-- ── Đăng bài: Biên tập công khai ngay ─────────────────────────────────────────────────────
create or replace function public.chord_sheet_contribute_publish(
  p_text text, p_title text default null, p_composer text default null, p_meter jsonb default null,
  p_suggested_bpm integer default null, p_sources jsonb default '[]'::jsonb, p_version_id uuid default null,
  p_sheet_id uuid default null, p_parent_version_id uuid default null, p_anchors jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
  v public.chord_sheet_versions%rowtype;
  v_sheet public.chord_sheets%rowtype;
begin
  if v_uid is null or not public.chordlib_can('contribute') then
    raise exception 'CHORDLIB_FORBIDDEN' using errcode = '42501';
  end if;
  -- Người review, hoặc người KHÔNG phải Biên tập: đúng hành vi cũ (bản nháp chờ duyệt).
  if public.chordlib_can('review') or not public.teamlab_is_any_music_editor() then
    return public.chord_sheet_contribute(p_text, p_title, p_composer, p_meter, p_suggested_bpm, p_sources,
                                         p_version_id, p_sheet_id, p_parent_version_id, p_anchors);
  end if;
  -- Biên tập: chỉ bài MỚI hoặc bài do chính mình tạo (sửa = phiên bản mới của bài mình).
  if p_sheet_id is not null then
    select * into v_sheet from public.chord_sheets s where s.id = p_sheet_id;
    if not found or v_sheet.created_by is distinct from v_uid then
      raise exception 'CHORDLIB_FORBIDDEN: chỉ sửa được bài do chính mình tạo' using errcode = '42501';
    end if;
  end if;
  v_result := public.chord_sheet_contribute(p_text, p_title, p_composer, p_meter, p_suggested_bpm, p_sources,
                                            p_version_id, p_sheet_id, p_parent_version_id, p_anchors);
  -- Thứ tự khoá thống nhất: bài trước, phiên bản sau.
  perform 1 from public.chord_sheets x where x.id = (v_result ->> 'sheet_id')::uuid for update;
  select * into v from public.chord_sheet_versions x where x.id = (v_result ->> 'version_id')::uuid for update;
  if v.contributed_by is distinct from v_uid then
    return v_result;   -- trùng nội dung với bản của người khác: không công khai hộ
  end if;
  if v.review_status = 'private' then
    update public.chord_sheet_versions
       set review_status = 'approved', reviewed_by = v_uid, reviewed_at = now(), rejection_reason = null
     where id = v.id;
  end if;
  if v.review_status <> 'rejected' then
    -- Chỉ bài do chính mình tạo; đăng lại một bài đã gỡ → hiện lại.
    update public.chord_sheets
       set canonical_version_id = v.id, archived_at = null, archived_by = null, updated_at = now()
     where id = v.sheet_id and created_by = v_uid;
  end if;
  return v_result || jsonb_build_object('review_status', 'approved', 'published', true);
end $fn$;

-- ── Gỡ bài (lưu trữ, không xoá) ──────────────────────────────────────────────────────────────
create or replace function public.chord_sheet_archive(p_sheet_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  v_uid uuid := auth.uid();
  v_sheet public.chord_sheets%rowtype;
begin
  if v_uid is null then raise exception 'CHORDLIB_FORBIDDEN' using errcode = '42501'; end if;
  select * into v_sheet from public.chord_sheets s where s.id = p_sheet_id for update;
  if not public.chordlib_can('review')
     and not (v_sheet.id is not null and v_sheet.created_by = v_uid and public.teamlab_is_any_music_editor()) then
    raise exception 'CHORDLIB_FORBIDDEN' using errcode = '42501';
  end if;
  if v_sheet.id is null then raise exception 'CHORDLIB_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_sheet.archived_at is null then
    update public.chord_sheets set archived_at = now(), archived_by = v_uid, updated_at = now() where id = p_sheet_id;
  end if;
  return jsonb_build_object('ok', true, 'sheet_id', p_sheet_id, 'archived', true);
end $fn$;

revoke all on function public.chord_sheet_contribute_publish(text, text, text, jsonb, integer, jsonb, uuid, uuid, uuid, jsonb) from public, anon;
revoke all on function public.chord_sheet_archive(uuid) from public, anon;
grant execute on function public.chord_sheet_contribute_publish(text, text, text, jsonb, integer, jsonb, uuid, uuid, uuid, jsonb) to authenticated;
grant execute on function public.chord_sheet_archive(uuid) to authenticated;
comment on function public.chord_sheet_contribute_publish(text, text, text, jsonb, integer, jsonb, uuid, uuid, uuid, jsonb)
  is 'chord_library_v1: đóng góp; Biên tập đăng và công khai ngay (bài của mình)';
comment on function public.chord_sheet_archive(uuid) is 'chord_library_v1: gỡ bài khỏi danh sách (lưu trữ, không xoá)';
notify pgrst, 'reload schema';
