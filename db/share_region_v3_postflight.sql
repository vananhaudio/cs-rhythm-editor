-- POSTFLIGHT (read-only) cho db/share_region_v3_setup.sql. Hàm V1/V2 phải KHÔNG đổi; mọi ghi chú sẵn có giữ nguyên (so với dòng INFO 2 của preflight); hàm V3 chỉ authenticated gọi được 3 hàm công khai.
select section, item from (
  select 1 o, 'INFO' section, 'ghi chú: bars=' || (select count(*) from public.share_notes where anchor_kind = 'bars') || ', text=' || (select count(*) from public.share_notes where anchor_kind = 'text') || ', region=' || (select count(*) from public.share_notes where anchor_kind = 'region') item
  union all select 2, 'INFO', 'dấu vân tay ghi chú (id,kind,section,path,sha,bar/text): ' || (select left(md5(coalesce(string_agg(id::text || ':' || anchor_kind || ':' || coalesce(array_to_string(score_path, '.'), '') || ':' || coalesce(tex_sha, '') || ':' || coalesce(bar_from::text, '') || '-' || coalesce(bar_to::text, '') || ':' || coalesce(text_sha, ''), ',' order by id), '')), 12) from public.share_notes where anchor_kind in ('bars', 'text'))
  union all select 9, 'GATE', case when
       (select string_agg(p.proname || '=' || left(md5(p.prosrc), 8), ',' order by p.proname collate "C") from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and (p.proname like 'share\_note%' or p.proname like 'share\_text%' or p.proname in ('social_share_share_note', 'social_share_share_text', 'dm_share')))
       = 'dm_share=8637face,share_note_card=1e195567,share_note_card_v2=ad08d062,share_note_create=00c38582,share_note_delete=2c6b8538,share_note_open=036e51a6,share_note_open_v2=7ca9689b,share_note_score_ok=36ddb7c8,share_note_session_open=c1c6c42b,share_note_tex=6ac7f900,share_note_visible=8394c6b0,share_text_arr=79235af0,share_text_boundary_ok=81481cd1,share_text_cost=ed464474,share_text_create=c8f9ebf9,share_text_ctx_sha=30a4b08b,share_text_fp=28c5dd5e,share_text_leaf=084190a1,share_text_leaves=f5baf6ee,share_text_resolve=b5a5d7a8,share_text_scan=20e4bbc9,share_text_sel_sha=80f13552,social_share_share_note=0d200f62,social_share_share_text=62e4985b'
   and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'share_notes' and column_name = 'region')
   and exists (select 1 from pg_constraint where conrelid = 'public.share_notes'::regclass and conname = 'share_notes_anchor_shape_check')
   and (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
         and p.proname in ('share_region_create', 'share_region_open', 'social_share_share_region')
         and has_function_privilege('authenticated', p.oid, 'execute') and not has_function_privilege('anon', p.oid, 'execute')) = 3
   and not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('share_region_sha', 'share_region_leaf_txt', 'share_region_build', 'share_region_resolve')
         and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute')))
   and not exists (select 1 from public.share_notes where anchor_kind = 'bars' and (score_path is null or tex_sha is null or bar_from is null or bar_to is null))
   and not has_table_privilege('authenticated', 'public.share_notes', 'select') and not has_table_privilege('anon', 'public.share_notes', 'select')
  then 'PASS' else 'FAIL' end
) z order by o;
