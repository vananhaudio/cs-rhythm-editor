-- Rollback Contextual Share V2 (db/share_text_v2_setup.sql). Không begin/commit (prod-db.py bọc transaction).
-- THỨ TỰ: (1) gỡ bài Feed của ghi chú văn bản (2) xoá hàng 'text' (tin Chat còn: thẻ → "không còn khả dụng", như share_note_delete V1)
-- (3) bỏ hàm V2 (4) bỏ ràng buộc/cột (5) khôi phục NOT NULL. Ghi chú ô nhịp V1 KHÔNG bị chạm.
-- LƯU Ý: bước (2) làm MẤT các ghi chú văn bản đã tạo (chỉ là tham chiếu + lời nhắn, giáo trình không đổi).
-- (idempotent: chỉ xoá khi cột anchor_kind còn tồn tại)
do $rb$
begin
  delete from public.class_posts p
   where p.type = 'tool_share' and p.tool_share ->> 'tool' = 'share_note' and p.tool_share ->> 'anchor' = 'text';
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'share_notes' and column_name = 'anchor_kind') then
    execute 'delete from public.share_notes where anchor_kind = ''text''';
  end if;
end $rb$;
drop function if exists public.social_share_share_text(uuid);
drop function if exists public.share_note_card_v2(uuid[]);
drop function if exists public.share_note_open_v2(uuid);
drop function if exists public.share_text_create(uuid, integer, text[], integer, integer, text, text);
drop function if exists public.share_text_resolve(uuid, integer, text[], integer, integer, text, text, text);
drop function if exists public.share_text_leaf(uuid, integer, text[]);
drop function if exists public.share_text_cost(jsonb, integer);
drop function if exists public.share_text_scan(jsonb, integer, integer, text, text);
drop function if exists public.share_text_boundary_ok(text, integer, integer);
drop function if exists public.share_text_fp(jsonb);
drop function if exists public.share_text_ctx_sha(text, integer, integer);
drop function if exists public.share_text_sel_sha(text);
drop function if exists public.share_text_leaves(jsonb);
drop function if exists public.share_text_arr(jsonb);
alter table public.share_notes drop constraint if exists share_notes_anchor_shape_check;
alter table public.share_notes drop column if exists anchor_kind, drop column if exists text_path, drop column if exists char_from, drop column if exists char_to,
  drop column if exists text_sha, drop column if exists ctx_sha, drop column if exists block_fp;
alter table public.share_notes alter column score_path set not null, alter column tex_sha set not null,
  alter column bar_from set not null, alter column bar_to set not null;
notify pgrst, 'reload schema';
