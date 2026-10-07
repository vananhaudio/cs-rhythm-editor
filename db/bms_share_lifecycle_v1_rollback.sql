-- ROLLBACK BMS Share Lifecycle V1 → trả policy/check/RPC về baseline. Idempotent. Không begin/commit. KHÔNG xoá tin nhắn, KHÔNG xoá artifact.
-- Artifact 'shared' còn tồn tại: chỉ chủ bài đọc được (policy baseline không có nhánh 'shared'); khi đó GIỮ check ('class','shared') để không làm hỏng dữ liệu.
-- Ưu tiên rollback frontend; file này chỉ dùng khi cần trả hợp đồng DB.
alter policy tool_artifacts_read on public.tool_artifacts
  using (owner_id = auth.uid() or (visibility = 'class' and public.is_class_member()));
drop function if exists public.social_publish_tool_artifact(uuid);
drop function if exists public.bms_save_for_share(jsonb);
drop function if exists public.dm_artifact_granted(uuid);
drop index if exists public.dm_messages_ref_idx;
drop index if exists public.class_posts_tool_artifact_once;
do $$ begin
  if not exists (select 1 from public.tool_artifacts where visibility <> 'class') then
    alter table public.tool_artifacts drop constraint if exists tool_artifacts_visibility_check;
    alter table public.tool_artifacts add constraint tool_artifacts_visibility_check check (visibility = 'class');
  end if;
end $$;
notify pgrst, 'reload schema';
