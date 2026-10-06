-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK Thư viện hợp âm V1.3 (extraction) — gỡ đúng những gì db/chord_library_v1_3_extractions_setup.sql tạo.
-- Gỡ worker/endpoint /extract-content TRƯỚC (nếu đã bật). KHÔNG đụng chord_sheets / chord_sheet_versions / Storage / policy.
-- AN TOÀN DỮ LIỆU: đã có extraction → DỪNG (không xoá kết quả đọc): export chord_sheet_extractions rồi tự xoá có chủ đích.
-- CHẠY cả file trong MỘT transaction (file KHÔNG có begin/commit). Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════
set local lock_timeout = '5s';
do $$ declare has_rows boolean := false; begin
  if to_regclass('public.chord_sheet_extractions') is not null then
    execute 'select exists (select 1 from public.chord_sheet_extractions)' into has_rows;
  end if;
  if has_rows then
    raise exception 'ROLLBACK DỪNG: chord_sheet_extractions đang có dữ liệu — export và xoá có chủ đích trước';
  end if;
end $$;
drop function if exists public.chord_extraction_list(uuid);
drop function if exists public.chord_extraction_get(uuid);
drop function if exists public.chord_extraction_fail(uuid, text, integer);
drop function if exists public.chord_extraction_complete(uuid, text, integer, integer, jsonb, jsonb, jsonb, integer);
drop function if exists public.chord_extraction_begin(uuid, integer, text, text, boolean);
drop table if exists public.chord_sheet_extractions;
drop function if exists public.chord_extractions_guard();
notify pgrst, 'reload schema';
