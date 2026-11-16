-- ROLLBACK Class Room Chat V1 — gỡ phòng chat lớp. KHÔNG đụng dm_*, bandchat_*, teamlab_*, class_schedule (Band Chat/DM giữ nguyên).
-- Rollback MỀM trước: revert frontend → phòng lớp biến khỏi UI, bảng + tin giữ nguyên. File này là rollback CỨNG: XOÁ classchat_* và TIN LỚP phát sinh sau migration.
-- Trước khi chạy xuất 3 bảng: prod-db.py query --sql "select * from public.classchat_messages" (… classchat_rooms, classchat_reads).
-- Hộp thư V2: khôi phục NGUYÊN VĂN chat_inbox_base / chat_inbox_summary từ tva_private.classchat_v1_backup. Idempotent; không có begin/commit.
do $gate$
begin
  if to_regclass('public.classchat_rooms') is not null and coalesce(obj_description(to_regclass('public.classchat_rooms'), 'pg_class'), '') not like 'classchat_v1:%' then
    raise exception 'DỪNG — public.classchat_rooms không phải của Class Room Chat V1, không rollback';
  end if;
end $gate$;

do $restore$
declare v_def text;
begin
  if to_regclass('tva_private.classchat_v1_backup') is not null then
    for v_def in select def from tva_private.classchat_v1_backup order by fn loop execute v_def; end loop;
  elsif exists (select 1 from pg_proc where proname in ('chat_inbox_base', 'chat_inbox_summary') and prosrc like '%classchat_%') then
    raise exception 'DỪNG — Hộp thư V2 đã có khối lớp nhưng thiếu bản sao lưu gốc (tva_private.classchat_v1_backup)';
  end if;
end $restore$;
comment on function public.chat_inbox_base(text) is 'chat_list_v2: ứng viên danh sách (nội bộ)';
comment on function public.chat_inbox_summary() is 'chat_list_v2: tổng số hội thoại theo loại';
drop table if exists tva_private.classchat_v1_backup;

drop trigger if exists classchat_guard_ins on public.classchat_messages;
drop function if exists public.classchat_messages_safe(uuid, bigint, bigint, int);
drop function if exists public.classchat_guard_write();
drop function if exists public.classchat_members(uuid);
drop function if exists public.classchat_unread_count();
drop function if exists public.classchat_mark_read(uuid, bigint);
drop function if exists public.classchat_send(uuid, text);
drop function if exists public.classchat_messages(uuid, bigint, bigint, int);
drop function if exists public.classchat_rooms(int);
drop function if exists public.classchat_append(uuid, uuid, text);
drop function if exists public.classchat_access(uuid);
drop table if exists public.classchat_reads;
drop table if exists public.classchat_messages;
drop table if exists public.classchat_rooms;

notify pgrst, 'reload schema';
