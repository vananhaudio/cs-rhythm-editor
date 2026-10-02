-- ROLLBACK JOIN CLASS BY CODE V1. KHÔNG begin/commit. Gỡ RPC; mã tham gia đã phát (edu_group_claim_tokens) được TẮT
-- (is_active = false), không xoá. Thành viên đã vào lớp bằng mã vẫn ở nguyên nhóm canonical.
set local lock_timeout = '5s';
update public.edu_group_claim_tokens set is_active = false where is_active and token ~ '^[A-HJ-KM-NP-Z2-9]{8}$'
  and exists (select 1 from pg_proc where proname = 'class_join');
drop function if exists public.class_join_preview(text);
drop function if exists public.class_join(text);
drop function if exists public.admin_class_join_code(uuid, boolean);
drop function if exists public.class_learning_entry(uuid);
drop function if exists tva_private.class_for_join_code(text);
drop function if exists tva_private.normalize_join_code(text);
notify pgrst, 'reload schema';
