-- PREFLIGHT (read-only) cho db/share_text_v2_setup.sql — GATE = PASS mới được dryrun/migrate. Không đọc nội dung giáo trình / ghi chú (chỉ đếm + dấu vân tay).
select section, item from (
  select 1 o, 'INFO' section, 'share_notes: ' || (select count(*) from public.share_notes) || ' hàng, ' || (select count(*) from public.share_notes where deleted_at is null) || ' còn sống' item
  union all select 2, 'INFO', 'dấu vân tay ghi chú ô nhịp (id,section,path,sha,bar): ' || (select left(md5(coalesce(string_agg(id::text || ':' || section_idx || ':' || array_to_string(score_path, '.') || ':' || tex_sha || ':' || bar_from || '-' || bar_to, ',' order by id), '')), 12) from public.share_notes)
  union all select 3, 'INFO', 'CSDL: ' || (select pg_encoding_to_char(encoding) from pg_database where datname = current_database())
  union all select 4, 'INFO', 'đã có V2? ' || case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'share_notes' and column_name = 'anchor_kind') then 'CÓ (chạy lại idempotent)' else 'chưa' end
  union all select 9, 'GATE', case when
       to_regclass('public.share_notes') is not null and to_regclass('public.class_lesson_content') is not null and to_regclass('public.class_sessions') is not null
   and to_regprocedure('public.share_note_visible(uuid)') is not null and to_regprocedure('public.share_note_score_ok(uuid)') is not null
   and to_regprocedure('public.share_note_tex(uuid,integer,text[])') is not null and to_regprocedure('public.share_note_open(uuid)') is not null
   and to_regprocedure('public.share_note_create(uuid,integer,text[],integer,integer,text,text)') is not null
   and to_regprocedure('public.share_note_session_open(uuid)') is not null and to_regprocedure('public.dm_share(uuid,text,text)') is not null
   and (select pg_encoding_to_char(encoding) from pg_database where datname = current_database()) = 'UTF8'
   and (select string_agg(p.proname || '=' || left(md5(p.prosrc), 8), ',' order by p.proname collate "C") from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname in ('share_note_create', 'share_note_open', 'share_note_card', 'share_note_session_open', 'social_share_share_note', 'share_note_delete', 'share_note_visible', 'share_note_score_ok', 'share_note_tex', 'dm_share'))
       = 'dm_share=8637face,share_note_card=1e195567,share_note_create=00c38582,share_note_delete=2c6b8538,share_note_open=036e51a6,share_note_score_ok=36ddb7c8,share_note_session_open=c1c6c42b,share_note_tex=6ac7f900,share_note_visible=8394c6b0,social_share_share_note=0d200f62'
  then 'PASS' else 'FAIL' end
) z order by o;
