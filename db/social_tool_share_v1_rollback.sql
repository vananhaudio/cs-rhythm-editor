-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK TOOL SHARE V1 (db/social_tool_share_v1_setup.sql). Idempotent. Rollback frontend TRƯỚC.
-- Luôn gỡ RPC ghi (không tạo thêm chia sẻ). Cột / ràng buộc / index CHỈ gỡ khi CHƯA có bài tool_share nào —
-- có rồi thì GIỮ (không xoá dữ liệu người dùng; frontend cũ tự bỏ qua type lạ).
-- CHẠY bằng scripts/prod-db.py (không begin/commit trong file).
-- ═══════════════════════════════════════════════════════════════════════════
set local lock_timeout = '5s';
drop function if exists public.social_share_tool_result(text, jsonb, uuid);
do $rb$
begin
  if to_regclass('public.class_posts') is null then return; end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'class_posts' and column_name = 'tool_share')
     and exists (select 1 from public.class_posts where type = 'tool_share') then
    raise notice 'Đã có bài tool_share → GIỮ cột/ràng buộc (chỉ gỡ RPC ghi).';
    return;
  end if;
  drop index if exists public.class_posts_tool_share_client_key;
  alter table public.class_posts drop constraint if exists class_posts_tool_share_check;
  alter table public.class_posts drop constraint if exists class_posts_type_check;
  alter table public.class_posts add constraint class_posts_type_check check (type in ('assignment', 'question', 'practice', 'status'));
  alter table public.class_posts drop column if exists tool_share;
end $rb$;
notify pgrst, 'reload schema';
