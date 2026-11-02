-- ROLLBACK Chat List V2 — gỡ hàm chat_* và bảng chat_pins. KHÔNG đụng dm_*, bandchat_*, teamlab_* (không mất tin nhắn).
-- Mất duy nhất: danh sách ghim đã lưu (chat_pins). Xuất trước nếu cần: select * from public.chat_pins.
-- Frontend tự rơi về danh sách cũ (50 gần nhất, không ghim) khi RPC không còn. Idempotent; chỉ xoá đối tượng của mình.
do $gate$
begin
  if to_regclass('public.chat_pins') is not null and coalesce(obj_description(to_regclass('public.chat_pins'), 'pg_class'), '') not like 'chat_list_v2:%' then
    raise exception 'DỪNG — public.chat_pins không phải của Chat List V2, không rollback';
  end if;
end $gate$;
drop function if exists public.chat_pin_set(text, boolean);
drop function if exists public.chat_conversation_info(text);
drop function if exists public.chat_inbox_summary();
drop function if exists public.chat_inbox(text, text, text, boolean, text, int, timestamptz, text);
drop function if exists public.chat_inbox_base(text);
drop function if exists public.chat_fold(text);
drop table if exists public.chat_pins;
