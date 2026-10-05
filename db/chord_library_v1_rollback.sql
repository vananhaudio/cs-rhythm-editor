-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK Thư viện hợp âm chuẩn hoá V1 — Lát 1 (gỡ đúng những gì db/chord_library_v1_setup.sql tạo).
-- Gỡ FRONTEND/consumer trước (nếu đã có).
-- AN TOÀN DỮ LIỆU: đã có đóng góp thật → DỪNG (không xoá bài của học viên). Muốn gỡ hẳn thì export
-- chord_sheets + chord_sheet_versions trước rồi tự xoá có chủ đích.
-- Bucket `chord-sheet-sources` CỐ Ý để lại: file nguồn là bằng chứng, và Supabase không cho xoá bucket
-- còn file bằng SQL. Bucket riêng tư không còn policy = không ai (trừ service_role) đọc/ghi được.
-- KHÔNG đụng kho MusicXML. CHẠY cả file trong MỘT transaction (file KHÔNG có begin/commit). Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════
set local lock_timeout = '5s';
do $$ declare has_rows boolean := false; begin
  if to_regclass('public.chord_sheet_versions') is not null then
    execute 'select exists (select 1 from public.chord_sheet_versions)' into has_rows;
  end if;
  if has_rows then
    raise exception 'ROLLBACK DỪNG: chord_sheet_versions đang có đóng góp thật — export và xoá có chủ đích trước';
  end if;
end $$;
drop policy if exists "chord sheet sources read"    on storage.objects;
drop policy if exists "chord sheet sources insert"  on storage.objects;
drop policy if exists "chord sheet sources cleanup" on storage.objects;
drop function if exists public.chord_sheet_accept_anchors(uuid, jsonb, jsonb);
drop function if exists public.chord_anchors_problem(jsonb, integer[]);
drop function if exists public.chord_lyric_token_counts(text);
drop function if exists public.chord_sheet_update_info(uuid, text, text);
drop function if exists public.chord_sheet_reject(uuid, text);
drop function if exists public.chord_sheet_approve(uuid, uuid);
drop function if exists public.chord_sheet_get(uuid);
drop function if exists public.chord_sheet_contribute(text, text, text, jsonb, integer, jsonb, uuid, uuid, uuid);
drop function if exists public.chord_sheet_search(text, integer);
drop trigger if exists chord_source_guard_trg on storage.objects;
drop function if exists public.chord_source_guard();
drop function if exists public.chord_source_can_write(text, text);
drop function if exists public.chord_source_rule(uuid, text, text);
drop function if exists public.chord_source_recorded(text);
drop function if exists public.my_chordlib_caps();
drop function if exists public.chordlib_can(text);
alter table if exists public.chord_sheets drop constraint if exists chord_sheets_canonical_fk;
drop table if exists public.chord_sheet_versions;
drop table if exists public.chord_sheets;
drop function if exists public.chord_sheet_versions_guard();
drop function if exists public.chord_meter_ok(jsonb);
drop function if exists public.chord_source_key(jsonb);
drop function if exists public.chord_canonical_text(text);
drop function if exists public.chord_fold_vi(text);
delete from public.tool_capabilities where tool_id = 'chordlib';
delete from public.edu_tools where id = 'chordlib';
notify pgrst, 'reload schema';
