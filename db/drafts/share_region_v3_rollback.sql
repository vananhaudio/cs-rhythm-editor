-- DỰ THẢO rollback V3: xoá ghi chú 'region' (và bài Feed của chúng) rồi gỡ hàm/cột/ràng buộc về trạng thái V2. Không đụng 'bars' / 'text'.
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='share_notes' and column_name='region') then
    delete from public.class_posts where type = 'tool_share' and tool_share ->> 'tool' = 'share_note' and tool_share ->> 'anchor' = 'region';
    delete from public.share_notes where anchor_kind = 'region';
  end if;
end $$;
drop function if exists public.social_share_share_region(uuid), public.share_region_open(uuid), public.share_region_create(uuid, jsonb, text, text),
  public.share_region_resolve(uuid, jsonb), public.share_region_build(uuid, jsonb), public.share_region_sha(jsonb);
alter table public.share_notes drop constraint if exists share_notes_anchor_shape_check;
alter table public.share_notes drop column if exists region;
alter table public.share_notes add constraint share_notes_anchor_shape_check check (
  (anchor_kind = 'bars'
     and score_path is not null and tex_sha is not null and bar_from is not null and bar_to is not null
     and text_path is null and char_from is null and char_to is null and text_sha is null and ctx_sha is null and block_fp is null)
  or
  (anchor_kind = 'text'
     and score_path is null and tex_sha is null and bar_from is null and bar_to is null
     and text_path is not null and char_from is not null and char_to is not null and text_sha is not null and ctx_sha is not null and block_fp is not null
     and cardinality(text_path) between 1 and 5
     and char_from >= 0 and char_to > char_from and char_to - char_from <= 500
     and text_sha ~ '^[0-9a-f]{64}$' and ctx_sha ~ '^[0-9a-f]{64}$' and block_fp ~ '^[0-9a-f]{64}$'
     and array_to_string(text_path, '/') ~ '^(text|items|steps|blocks|rows|[0-9]{1,3})(/(text|items|steps|blocks|rows|[0-9]{1,3}))*$'));
notify pgrst, 'reload schema';
