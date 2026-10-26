-- ROLLBACK Class UGC Safety V1 — gỡ trigger + hàm + 4 bảng mới. CẢNH BÁO: xoá TOÀN BỘ báo cáo, danh sách chặn, đồng ý quy tắc và từ cấm Thầy đã thêm
-- (export trước nếu cần). KHÔNG đụng: bảng/hàm production (class_posts, friendships, dm_*, bandchat_*, edu_students …), dữ liệu cũ,
-- cột edu_students.blocked_at/blocked_reason và các đình chỉ đã đặt (dữ liệu của Thầy — gỡ bằng tay nếu muốn), friendships đã bị huỷ khi chặn (không khôi phục được).
-- Idempotent. Không begin/commit (prod-db sở hữu transaction). Trigger gỡ TRƯỚC hàm, hàm gỡ TRƯỚC bảng.
do $gate$
declare v_name text;
begin
  for v_name in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname in ('class_reports', 'class_user_blocks', 'class_ugc_consent', 'class_ugc_blocklist')
       and coalesce(obj_description(c.oid, 'pg_class'), '') not like 'class_ugc_safety_v1:%'
  loop raise exception 'DỪNG — bảng % không thuộc UGC Safety V1, không rollback', v_name; end loop;
  for v_name in
    select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in ('class_report_submit', 'class_block_user', 'class_unblock_user', 'class_my_blocks', 'class_is_blocked_pair',
       'class_ugc_status', 'class_ugc_accept', 'class_ugc_required_version', 'class_ugc_pair_blocked', 'class_ugc_text_blocked',
       'class_ugc_guard_write', 'class_ugc_guard_friend', 'class_ugc_guard_student', 'class_feed_safe', 'class_comments_for_posts_safe',
       'dm_messages_safe', 'dm_conversations_safe', 'bandchat_messages_safe', 'social_feed_safe', 'social_feed_scoped_safe', 'class_reports_list', 'class_report_resolve')
       and coalesce(obj_description(p.oid, 'pg_proc'), '') not like 'class_ugc_safety_v1:%'
  loop raise exception 'DỪNG — hàm % không thuộc UGC Safety V1, không rollback', v_name; end loop;
end $gate$;

-- Trigger (chỉ gỡ trigger do hàm của UGC Safety tạo; to_regclass để chạy được cả khi bảng nền chưa có)
do $trg$
declare r record;
begin
  for r in
    select t.tgname, t.tgrelid::regclass::text as tbl from pg_trigger t join pg_proc f on f.oid = t.tgfoid
     where not t.tgisinternal and obj_description(f.oid, 'pg_proc') like 'class_ugc_safety_v1:%'
  loop
    execute format('drop trigger if exists %I on %s', r.tgname, r.tbl);
  end loop;
end $trg$;

drop function if exists public.class_report_resolve(bigint, text, text);
drop function if exists public.class_reports_list(text, int);
drop function if exists public.social_feed_scoped_safe(text, timestamptz, text, int);
drop function if exists public.social_feed_safe(timestamptz, text, int);
drop function if exists public.bandchat_messages_safe(uuid, bigint, bigint, int);
drop function if exists public.dm_conversations_safe(int);
drop function if exists public.dm_messages_safe(uuid, bigint, bigint, int);
drop function if exists public.class_comments_for_posts_safe(uuid[], int);
drop function if exists public.class_feed_safe(timestamptz, uuid, int);
drop function if exists public.class_ugc_accept(int);
drop function if exists public.class_ugc_status();
drop function if exists public.class_is_blocked_pair(uuid, uuid);
drop function if exists public.class_my_blocks();
drop function if exists public.class_unblock_user(uuid);
drop function if exists public.class_block_user(uuid);
drop function if exists public.class_report_submit(text, text, text, text);
drop function if exists public.class_ugc_required_version();
drop function if exists public.class_ugc_guard_student();
drop function if exists public.class_ugc_guard_friend();
drop function if exists public.class_ugc_guard_write();
drop function if exists public.class_ugc_text_blocked(text);
drop function if exists public.class_ugc_pair_blocked(uuid, uuid);

-- Gỡ bảng trong MỘT câu lệnh, đặt cuối (DROP bảng có khoá ngoại xin khoá trên auth.users tới COMMIT)
do $tables$
begin
  drop table if exists public.class_reports;
  drop table if exists public.class_user_blocks;
  drop table if exists public.class_ugc_consent;
  drop table if exists public.class_ugc_blocklist;
end $tables$;

notify pgrst, 'reload schema';
