-- POSTFLIGHT (read-only) cho db/share_text_v2_setup.sql. Hàm V1 phải KHÔNG đổi; mọi ghi chú sẵn có vẫn là 'bars' và dấu vân tay không đổi (so với dòng INFO 2 của preflight).
select section, item from (
  select 1 o, 'INFO' section, 'ghi chú: bars=' || (select count(*) from public.share_notes where anchor_kind = 'bars') || ', text=' || (select count(*) from public.share_notes where anchor_kind = 'text') item
  union all select 2, 'INFO', 'dấu vân tay ghi chú ô nhịp (id,section,path,sha,bar): ' || (select left(md5(coalesce(string_agg(id::text || ':' || section_idx || ':' || array_to_string(score_path, '.') || ':' || tex_sha || ':' || bar_from || '-' || bar_to, ',' order by id), '')), 12) from public.share_notes where anchor_kind = 'bars')
  union all select 9, 'GATE', case when
       (select string_agg(p.proname || '=' || left(md5(p.prosrc), 8), ',' order by p.proname collate "C") from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname in ('share_note_create', 'share_note_open', 'share_note_card', 'share_note_session_open', 'social_share_share_note', 'share_note_delete', 'share_note_visible', 'share_note_score_ok', 'share_note_tex', 'dm_share'))
       = 'dm_share=8637face,share_note_card=1e195567,share_note_create=00c38582,share_note_delete=2c6b8538,share_note_open=036e51a6,share_note_score_ok=36ddb7c8,share_note_session_open=c1c6c42b,share_note_tex=6ac7f900,share_note_visible=8394c6b0,social_share_share_note=0d200f62'
   and (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'share_notes' and column_name in ('anchor_kind', 'text_path', 'char_from', 'char_to', 'text_sha', 'ctx_sha', 'block_fp')) = 7
   and exists (select 1 from pg_constraint where conrelid = 'public.share_notes'::regclass and conname = 'share_notes_anchor_shape_check')
   and not exists (select 1 from public.share_notes where anchor_kind = 'bars' and (score_path is null or tex_sha is null or bar_from is null or bar_to is null))
   and (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
         and p.proname in ('share_text_create', 'share_note_open_v2', 'share_note_card_v2', 'social_share_share_text')
         and has_function_privilege('authenticated', p.oid, 'execute') and not has_function_privilege('anon', p.oid, 'execute')) = 4
   and not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'share\_text\_%'
         and p.proname not in ('share_text_create', 'social_share_share_text') and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute')))
   and not has_table_privilege('authenticated', 'public.share_notes', 'select') and not has_table_privilege('anon', 'public.share_notes', 'select')
  then 'PASS' else 'FAIL' end
) z order by o;
