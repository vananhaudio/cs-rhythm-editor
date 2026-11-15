-- Rollback Broadcast V1. CHỈ chạy sau khi đã revert frontend. Thông báo/tin nhắn ĐÃ PHÁT THẬT được giữ nguyên (không xoá lịch sử).
-- Ghi chú: các hàng class_system_notices kind 'broadcast' (nếu đã có chiến dịch thật) giữ lại → KHÔNG thu hẹp CHECK khi còn hàng đó.
do $cron$
begin
  if to_regnamespace('cron') is not null then perform cron.unschedule(jobid) from cron.job where jobname = 'broadcast-worker'; end if;
end $cron$;
drop function if exists public.broadcast_tick(int);
drop function if exists public.broadcast_deliver(public.broadcast_campaigns, uuid);
drop function if exists public.broadcast_cancel(uuid);
drop function if exists public.broadcast_refresh(uuid);
drop function if exists public.broadcast_recipients_page(uuid, text, uuid, int);
drop function if exists public.broadcast_campaign(uuid);
drop function if exists public.broadcast_campaigns(int);
drop function if exists public.broadcast_stats(uuid);
drop function if exists public.broadcast_confirm(text, text, text, uuid, text, text, text, int);
drop function if exists public.broadcast_preview(text, text, uuid);
drop function if exists public.broadcast_audiences();
drop function if exists public.broadcast_require_admin();
drop function if exists public.broadcast_audience_label(text, uuid);
drop function if exists public.broadcast_scope(text, text, uuid, uuid);
drop function if exists public.broadcast_classify(text, text, uuid, uuid);
-- Giữ bảng broadcast_* (nhật ký chiến dịch đã phát). Chỉ xoá khi KHÔNG có chiến dịch nào.
do $t$
declare v_n bigint;
begin
  if to_regclass('public.broadcast_campaigns') is not null then
    execute 'select count(*) from public.broadcast_campaigns' into v_n;
    if v_n = 0 then
      drop table if exists public.broadcast_recipients;
      drop table if exists public.broadcast_campaigns;
    end if;
  end if;
end $t$;
-- Thông báo: đưa RPC về chữ ký V1 (bỏ title/link); cột title/link và kind 'broadcast' còn nguyên nếu đã có hàng broadcast.
drop function if exists public.class_system_notices(bigint, int);
create function public.class_system_notices(p_before_seq bigint default null, p_limit int default 30)
returns table(seq bigint, kind text, body text, ref_type text, ref_key text, created_at timestamptz, unread boolean)
language plpgsql security definer set search_path = '' stable as $$
declare v_me uuid := auth.uid(); v_lim int := least(greatest(coalesce(p_limit, 30), 1), 100); v_read bigint;
begin
  if v_me is null or not public.is_class_member() then raise exception 'Chưa đăng nhập Class' using errcode = '42501'; end if;
  select coalesce((select r.last_read_seq from public.class_system_notice_reads r where r.user_id = v_me), 0) into v_read;
  return query
  select n.seq, n.kind, n.body, n.ref_type, n.ref_key, n.created_at, n.seq > v_read
    from public.class_system_notices n
   where n.user_id = v_me and n.kind <> 'broadcast' and (p_before_seq is null or n.seq < p_before_seq)
   order by n.seq desc limit v_lim;
end $$;
comment on function public.class_system_notices(bigint, int) is 'class_system_chat_v1: thông báo của mình';
revoke all on function public.class_system_notices(bigint, int) from public, anon;
grant execute on function public.class_system_notices(bigint, int) to authenticated;
notify pgrst, 'reload schema';
