-- BROADCAST V1 — Gửi thông điệp hàng loạt (Owner/admin) qua HAI kênh có sẵn: Thông báo (class_system_notices) và Trò chuyện 1–1 (dm_*).
-- Chạy bằng scripts/prod-db.py (một transaction; file KHÔNG có begin/commit). Idempotent. ADDITIVE:
--   • KHÔNG sửa dm_* / friendships / learning_thread_* / RLS / policy / quyền nhắn tin (dm_rule giữ nguyên: học viên vẫn chỉ nhắn bạn bè).
--   • Thông báo: thêm kind 'broadcast' + 2 cột tuỳ chọn (title, link) vào class_system_notices; badge/đã đọc/âm thanh dùng nguyên cơ chế seq hiện có.
--   • Chat: worker (nội bộ, SECURITY DEFINER) tìm-hoặc-tạo hội thoại Owner↔người nhận RỒI ghi tin bằng dm_append — đúng bảng/seq/unread hiện có.
--     Ngoại lệ dm_rule chỉ tồn tại BÊN TRONG worker, người gọi phải là admin đã xác nhận chiến dịch; client không có đường gọi nào tới nó.
--     Người chặn nhau → bỏ qua (skipped: blocked), không vượt quyền chặn. Hội thoại cũ được dùng lại, không tạo trùng (khoá theo cặp).
--   • Mọi RPC cho client kiểm is_admin() phía server. Danh sách người nhận do SERVER chụp tại lúc xác nhận (snapshot trong broadcast_recipients).
--   • Chống trùng: unique (campaign, user); khoá idempotency (người tạo, key); thông báo có unique (user, dedupe_key); trạng thái người nhận
--     và tin nhắn ghi cùng một transaction nên worker chạy lại/chạy song song không phát đúp.
--   • Worker: pg_cron mỗi phút gọi broadcast_tick() (lô 200/chiến dịch/phút, retry 3 lần backoff 1–5–15 phút). KHÔNG chiến dịch → không làm gì.
--   • Xác nhận ≠ phát thử: migration KHÔNG tạo chiến dịch nào, KHÔNG gửi gì.

do $gate$
begin
  if to_regclass('public.class_system_notices') is null or to_regclass('public.class_system_notice_reads') is null
     or to_regclass('public.dm_conversations') is null or to_regclass('public.dm_participants') is null or to_regclass('public.dm_messages') is null
     or to_regprocedure('public.dm_append(uuid,uuid,text)') is null or to_regprocedure('public.is_admin()') is null
     or to_regprocedure('public.class_ugc_pair_blocked(uuid,uuid)') is null or to_regprocedure('public.class_public_identity(uuid)') is null
     or to_regclass('tva_private.class_memberships') is null or to_regclass('public.class_schedule') is null
     or to_regclass('public.teamlab_band_members') is null or to_regclass('public.teamlab_bands') is null or to_regclass('public.projects') is null
     or to_regclass('public.edu_students') is null or to_regclass('public.app_users') is null then
    raise exception 'DỪNG — thiếu nền (System Chat, Chat V1, is_admin, UGC safety, lớp/Band)';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'class_system_notices_kind_check' and conrelid = 'public.class_system_notices'::regclass) then
    raise exception 'DỪNG — thiếu CHECK class_system_notices_kind_check';
  end if;
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = 'public' and c.relname in ('broadcast_campaigns', 'broadcast_recipients')
                and coalesce(obj_description(c.oid, 'pg_class'), '') not like 'broadcast_v1:%') then
    raise exception 'DỪNG — đã có bảng broadcast_* không thuộc Broadcast V1';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace
              where s.nspname = 'public' and p.proname like 'broadcast\_%' and coalesce(obj_description(p.oid, 'pg_proc'), '') not like 'broadcast_v1:%') then
    raise exception 'DỪNG — đã có hàm broadcast_* không thuộc Broadcast V1';
  end if;
  -- dấu vân tay dữ liệu hiện có (so lại ở cuối)
  perform set_config('broadcast_v1.fp', (select (select count(*) from public.dm_messages)::text || ':' || (select count(*) from public.dm_conversations)::text
         || ':' || (select count(*) from public.class_system_notices)::text), true);
end $gate$;

-- 1) Thông báo: thêm kind + cột tuỳ chọn (bảng nhỏ, khoá ngắn). Các kind/ràng buộc cũ vẫn hợp lệ nguyên vẹn.
alter table public.class_system_notices add column if not exists title text;
alter table public.class_system_notices add column if not exists link text;
alter table public.class_system_notices drop constraint if exists class_system_notices_kind_check;
alter table public.class_system_notices add constraint class_system_notices_kind_check
  check (kind in ('checkpoint_graded', 'submission_received', 'question_received', 'question_answered', 'teacher_commented', 'broadcast'));
alter table public.class_system_notices drop constraint if exists class_system_notices_body_check;
alter table public.class_system_notices add constraint class_system_notices_body_check
  check (char_length(body) between 1 and (case when kind = 'broadcast' then 2000 else 300 end));
alter table public.class_system_notices drop constraint if exists class_system_notices_ref_check;
alter table public.class_system_notices add constraint class_system_notices_ref_check
  check ((ref_type = 'thread' and ref_key ~ '^[0-9a-f-]{36}$') or (kind = 'broadcast' and ref_type = 'broadcast' and ref_key ~ '^[0-9a-f-]{36}$'));
alter table public.class_system_notices drop constraint if exists class_system_notices_title_link_check;
alter table public.class_system_notices add constraint class_system_notices_title_link_check
  check ((title is null or char_length(title) between 1 and 80) and (link is null or (link ~ '^/[^/\\ ]' and char_length(link) <= 300)));

-- 1b) RPC đọc thông báo: thêm title/link (đổi cột trả về → drop + create trong cùng transaction; client cũ bỏ qua cột thừa)
drop function if exists public.class_system_notices(bigint, int);
create function public.class_system_notices(p_before_seq bigint default null, p_limit int default 30)
returns table(seq bigint, kind text, body text, ref_type text, ref_key text, created_at timestamptz, unread boolean, title text, link text)
language plpgsql security definer set search_path = '' stable as $$
declare v_me uuid := auth.uid(); v_lim int := least(greatest(coalesce(p_limit, 30), 1), 100); v_read bigint;
begin
  if v_me is null or not public.is_class_member() then raise exception 'Chưa đăng nhập Class' using errcode = '42501'; end if;
  select coalesce((select r.last_read_seq from public.class_system_notice_reads r where r.user_id = v_me), 0) into v_read;
  return query
  select n.seq, n.kind, n.body, n.ref_type, n.ref_key, n.created_at, n.seq > v_read, n.title, n.link
    from public.class_system_notices n
   where n.user_id = v_me and (p_before_seq is null or n.seq < p_before_seq)
   order by n.seq desc limit v_lim;
end $$;
comment on function public.class_system_notices(bigint, int) is 'class_system_chat_v1+broadcast_v1: thông báo của mình';
revoke all on function public.class_system_notices(bigint, int) from public, anon;
grant execute on function public.class_system_notices(bigint, int) to authenticated;

-- 2) Bảng chiến dịch + người nhận (RLS bật, không policy, không grant: chỉ RPC SECURITY DEFINER)
create table if not exists public.broadcast_campaigns (
  id             uuid primary key default gen_random_uuid(),
  created_by     uuid not null references auth.users(id),
  idem_key       text not null,
  channel        text not null check (channel in ('notice', 'chat')),
  audience_kind  text not null check (audience_kind in ('all', 'students', 'class', 'band')),
  audience_ref   uuid,
  audience_label text not null,
  title          text check (title is null or char_length(title) between 1 and 80),
  body           text not null check (char_length(body) between 1 and 2000),
  link           text check (link is null or (link ~ '^/[^/\\ ]' and char_length(link) <= 300)),
  status         text not null default 'sending' check (status in ('draft', 'ready', 'sending', 'completed', 'partial_failed', 'failed', 'cancelled')),
  eligible_total int not null,
  excluded       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  confirmed_at   timestamptz not null default now(),
  started_at     timestamptz,
  finished_at    timestamptz,
  cancelled_at   timestamptz,
  constraint broadcast_campaigns_idem_uq unique (created_by, idem_key),
  constraint broadcast_campaigns_scope_chk check ((audience_kind in ('class', 'band')) = (audience_ref is not null)),
  constraint broadcast_campaigns_title_chk check (channel = 'notice' or title is null)
);
create table if not exists public.broadcast_recipients (
  campaign_id     uuid not null references public.broadcast_campaigns(id) on delete restrict,
  user_id         uuid not null references auth.users(id) on delete cascade,
  status          text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped', 'cancelled')),
  attempts        int not null default 0,
  next_attempt_at timestamptz not null default now(),
  error           text,
  delivered_at    timestamptz,
  ref_seq         bigint,
  ref_conversation uuid,
  primary key (campaign_id, user_id)
);
create index if not exists broadcast_recipients_pending_idx on public.broadcast_recipients (campaign_id, next_attempt_at) where status = 'pending';
alter table public.broadcast_campaigns enable row level security;
alter table public.broadcast_recipients enable row level security;
revoke all on public.broadcast_campaigns, public.broadcast_recipients from public, anon, authenticated;
comment on table public.broadcast_campaigns is 'broadcast_v1: chiến dịch gửi thông điệp (chỉ RPC admin)';
comment on table public.broadcast_recipients is 'broadcast_v1: snapshot người nhận + kết quả phân phối';

-- 3) Phân loại MỘT tài khoản (nguồn sự thật duy nhất, dùng cả lúc chụp danh sách lẫn ngay trước khi phát). null = đủ điều kiện.
create or replace function public.broadcast_classify(p_channel text, p_audience text, p_uid uuid, p_sender uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when p_uid = p_sender then 'self'
    when u.id is null then 'no_account'
    when u.deleted_at is not null then 'deleted'
    when u.banned_until is not null and u.banned_until > now() then 'disabled'
    when not (st.is_staff or st.has_profile) then 'not_class_member'
    when p_audience = 'students' and st.is_staff then 'not_student'
    when not st.is_staff and not st.has_active then 'inactive'
    when not st.is_staff and st.is_blocked then 'suspended'
    when p_channel = 'chat' and public.class_ugc_pair_blocked(p_sender, p_uid) then 'blocked'
    else null end
  from (select 1) o
  left join auth.users u on u.id = p_uid
  cross join lateral (select
      exists (select 1 from public.app_users au where au.id = p_uid and au.role in ('teacher', 'admin')) as is_staff,
      exists (select 1 from public.edu_students es where es.user_id = p_uid) as has_profile,
      exists (select 1 from public.edu_students es where es.user_id = p_uid and coalesce(es.is_active, true)) as has_active,
      exists (select 1 from public.edu_students es where es.user_id = p_uid and es.blocked_at is not null) as is_blocked) st;
$$;
comment on function public.broadcast_classify(text, text, uuid, uuid) is 'broadcast_v1: phân loại người nhận (nội bộ)';
revoke all on function public.broadcast_classify(text, text, uuid, uuid) from public, anon, authenticated;

-- 3b) Tập tài khoản thuộc phạm vi + phân loại (nội bộ)
create or replace function public.broadcast_scope(p_channel text, p_audience text, p_ref uuid, p_sender uuid)
returns table(user_id uuid, reason text) language sql stable security definer set search_path = '' as $$
  select b.uid, public.broadcast_classify(p_channel, p_audience, b.uid, p_sender)
  from (
    select u.id as uid from auth.users u where p_audience = 'all'
    union select es.user_id from public.edu_students es where p_audience = 'students' and es.user_id is not null
    union select m.user_id from tva_private.class_memberships m where p_audience = 'class' and m.class_id = p_ref
    union select bm.user_id from public.teamlab_band_members bm where p_audience = 'band' and bm.band_id = p_ref
  ) b;
$$;
comment on function public.broadcast_scope(text, text, uuid, uuid) is 'broadcast_v1: phạm vi người nhận (nội bộ)';
revoke all on function public.broadcast_scope(text, text, uuid, uuid) from public, anon, authenticated;

-- 3c) Nhãn đối tượng + kiểm đầu vào (nội bộ)
create or replace function public.broadcast_audience_label(p_audience text, p_ref uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare v text;
begin
  if p_audience = 'all' then return 'Tất cả người dùng'; end if;
  if p_audience = 'students' then return 'Tất cả học viên'; end if;
  if p_audience = 'class' then
    select 'Lớp ' || coalesce(cs.name, '') into v from public.class_schedule cs where cs.id = p_ref;
  elsif p_audience = 'band' then
    select 'Band ' || coalesce(p.name, b.name) into v from public.teamlab_bands b left join public.projects p on p.id = b.project_id where b.id = p_ref;
  else
    raise exception 'Đối tượng không hợp lệ' using errcode = '22023';
  end if;
  if v is null then raise exception 'Không tìm thấy lớp/Band đã chọn' using errcode = 'P0002'; end if;
  return v;
end $$;
comment on function public.broadcast_audience_label(text, uuid) is 'broadcast_v1: nhãn đối tượng (nội bộ)';
revoke all on function public.broadcast_audience_label(text, uuid) from public, anon, authenticated;

create or replace function public.broadcast_require_admin()
returns uuid language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Chỉ quản trị viên được gửi thông điệp' using errcode = '42501'; end if;
  return auth.uid();
end $$;
comment on function public.broadcast_require_admin() is 'broadcast_v1: cổng quyền (nội bộ)';
revoke all on function public.broadcast_require_admin() from public, anon, authenticated;

-- 4) RPC cho giao diện Owner (admin)
create or replace function public.broadcast_audiences()
returns table(kind text, id uuid, label text, members int) language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.broadcast_require_admin();
  return query
  select 'class'::text, cs.id, cs.name::text, (select count(*)::int from tva_private.class_memberships m where m.class_id = cs.id)
    from public.class_schedule cs where coalesce(cs.status, '') not in ('cancelled', 'merged', 'draft') order by cs.name;
  return query
  select 'band'::text, b.id, coalesce(p.name, b.name)::text, (select count(*)::int from public.teamlab_band_members bm where bm.band_id = b.id)
    from public.teamlab_bands b left join public.projects p on p.id = b.project_id order by 3;
end $$;
comment on function public.broadcast_audiences() is 'broadcast_v1: lớp/Band chọn được';
revoke all on function public.broadcast_audiences() from public, anon;
grant execute on function public.broadcast_audiences() to authenticated;

create or replace function public.broadcast_preview(p_channel text, p_audience text, p_ref uuid default null)
returns table(eligible int, excluded int, reasons jsonb, label text) language plpgsql stable security definer set search_path = '' as $$
declare v_me uuid := public.broadcast_require_admin(); v_label text;
begin
  if p_channel not in ('notice', 'chat') then raise exception 'Kênh không hợp lệ' using errcode = '22023'; end if;
  v_label := public.broadcast_audience_label(p_audience, p_ref);
  return query
  select count(*) filter (where s.reason is null)::int, count(*) filter (where s.reason is not null)::int,
         coalesce((select jsonb_object_agg(r.reason, r.c) from (select s2.reason, count(*) c from public.broadcast_scope(p_channel, p_audience, p_ref, v_me) s2
                                                                  where s2.reason is not null group by 1) r), '{}'::jsonb),
         v_label
  from public.broadcast_scope(p_channel, p_audience, p_ref, v_me) s;
end $$;
comment on function public.broadcast_preview(text, text, uuid) is 'broadcast_v1: đếm người nhận (không ghi gì)';
revoke all on function public.broadcast_preview(text, text, uuid) from public, anon;
grant execute on function public.broadcast_preview(text, text, uuid) to authenticated;

-- Xác nhận: chụp snapshot + tạo chiến dịch 'sending'. Số người nhận thực tế phải KHỚP số Owner đã thấy ở bước xem trước.
create or replace function public.broadcast_confirm(p_key text, p_channel text, p_audience text, p_ref uuid, p_title text, p_body text, p_link text, p_expected int)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_me uuid := public.broadcast_require_admin(); v_id uuid; v_label text; v_title text; v_body text; v_link text; v_n int; v_ex jsonb;
begin
  if coalesce(btrim(p_key), '') = '' or char_length(p_key) > 100 then raise exception 'Thiếu khoá chống gửi trùng' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('broadcast_confirm:' || v_me::text || ':' || p_key, 21));
  select c.id into v_id from public.broadcast_campaigns c where c.created_by = v_me and c.idem_key = p_key;
  if v_id is not null then return v_id; end if;   -- bấm lại/reload: trả chiến dịch cũ, KHÔNG tạo thêm

  if p_channel not in ('notice', 'chat') then raise exception 'Kênh không hợp lệ' using errcode = '22023'; end if;
  v_body := regexp_replace(coalesce(p_body, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
  v_title := nullif(btrim(coalesce(p_title, '')), '');
  v_link := nullif(btrim(coalesce(p_link, '')), '');
  if v_body = '' then raise exception 'Nội dung trống' using errcode = '22023'; end if;
  if char_length(v_body) > 2000 then raise exception 'Nội dung quá dài (tối đa 2000 ký tự)' using errcode = '22023'; end if;
  if p_channel = 'notice' and v_title is not null and char_length(v_title) > 80 then raise exception 'Tiêu đề quá dài (tối đa 80 ký tự)' using errcode = '22023'; end if;
  if p_channel = 'chat' then v_title := null; end if;
  if v_link is not null and (v_link !~ '^/[^/\\ ]' or char_length(v_link) > 300) then raise exception 'Đường dẫn phải là đường dẫn nội bộ, bắt đầu bằng /' using errcode = '22023'; end if;
  v_label := public.broadcast_audience_label(p_audience, p_ref);

  create temp table _bc_scope on commit drop as select * from public.broadcast_scope(p_channel, p_audience, p_ref, v_me);
  select count(*) filter (where reason is null)::int into v_n from _bc_scope;
  if v_n is distinct from p_expected then
    raise exception 'BROADCAST_COUNT_CHANGED: số người nhận hiện là % (bạn đã xem %). Hãy xem lại trước khi gửi.', v_n, p_expected using errcode = '22023';
  end if;
  if v_n = 0 then raise exception 'Không có người nhận hợp lệ' using errcode = '22023'; end if;
  select coalesce(jsonb_object_agg(r.reason, r.c), '{}'::jsonb) into v_ex from (select reason, count(*) c from _bc_scope where reason is not null group by 1) r;

  insert into public.broadcast_campaigns (created_by, idem_key, channel, audience_kind, audience_ref, audience_label, title, body, link, status, eligible_total, excluded, started_at)
  values (v_me, p_key, p_channel, p_audience, p_ref, v_label, v_title, v_body, v_link, 'sending', v_n, v_ex, now()) returning id into v_id;
  insert into public.broadcast_recipients (campaign_id, user_id, status, error)
  select v_id, s.user_id, case when s.reason is null then 'pending' else 'skipped' end, s.reason from _bc_scope s;
  drop table _bc_scope;
  return v_id;
end $$;
comment on function public.broadcast_confirm(text, text, text, uuid, text, text, text, int) is 'broadcast_v1: xác nhận gửi (chụp danh sách, tạo chiến dịch)';
revoke all on function public.broadcast_confirm(text, text, text, uuid, text, text, text, int) from public, anon;
grant execute on function public.broadcast_confirm(text, text, text, uuid, text, text, text, int) to authenticated;

-- Tổng hợp một chiến dịch (nội bộ, tính trực tiếp từ bảng người nhận — không số liệu lưu sẵn có thể lệch)
create or replace function public.broadcast_stats(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'sent', count(*) filter (where r.status = 'sent'), 'failed', count(*) filter (where r.status = 'failed'),
    'pending', count(*) filter (where r.status = 'pending'), 'skipped', count(*) filter (where r.status = 'skipped'),
    'cancelled', count(*) filter (where r.status = 'cancelled'),
    'read', case when c.channel = 'notice' then
        count(*) filter (where r.status = 'sent' and r.ref_seq <= coalesce((select rd.last_read_seq from public.class_system_notice_reads rd where rd.user_id = r.user_id), 0))
      else null end)
  from public.broadcast_recipients r join public.broadcast_campaigns c on c.id = r.campaign_id where r.campaign_id = p_id group by c.channel;
$$;
comment on function public.broadcast_stats(uuid) is 'broadcast_v1: số liệu chiến dịch (nội bộ)';
revoke all on function public.broadcast_stats(uuid) from public, anon, authenticated;

create or replace function public.broadcast_campaigns(p_limit int default 30)
returns table(id uuid, channel text, audience_label text, title text, body text, status text, created_at timestamptz, finished_at timestamptz, eligible_total int, stats jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.broadcast_require_admin();
  return query
  select c.id, c.channel, c.audience_label, c.title, left(c.body, 200), c.status, c.created_at, c.finished_at, c.eligible_total, public.broadcast_stats(c.id)
    from public.broadcast_campaigns c order by c.created_at desc limit least(greatest(coalesce(p_limit, 30), 1), 100);
end $$;
comment on function public.broadcast_campaigns(int) is 'broadcast_v1: lịch sử chiến dịch';
revoke all on function public.broadcast_campaigns(int) from public, anon;
grant execute on function public.broadcast_campaigns(int) to authenticated;

create or replace function public.broadcast_campaign(p_id uuid)
returns table(id uuid, channel text, audience_label text, title text, body text, link text, status text, created_at timestamptz, started_at timestamptz,
              finished_at timestamptz, cancelled_at timestamptz, eligible_total int, excluded jsonb, stats jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.broadcast_require_admin();
  return query
  select c.id, c.channel, c.audience_label, c.title, c.body, c.link, c.status, c.created_at, c.started_at, c.finished_at, c.cancelled_at,
         c.eligible_total, c.excluded, public.broadcast_stats(c.id)
    from public.broadcast_campaigns c where c.id = p_id;
end $$;
comment on function public.broadcast_campaign(uuid) is 'broadcast_v1: chi tiết chiến dịch';
revoke all on function public.broadcast_campaign(uuid) from public, anon;
grant execute on function public.broadcast_campaign(uuid) to authenticated;

create or replace function public.broadcast_recipients_page(p_id uuid, p_status text default null, p_after uuid default null, p_limit int default 50)
returns table(user_id uuid, name text, status text, error text, attempts int, delivered_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.broadcast_require_admin();
  return query
  select r.user_id, idn.name, r.status, r.error, r.attempts, r.delivered_at
    from public.broadcast_recipients r cross join lateral public.class_public_identity(r.user_id) idn
   where r.campaign_id = p_id and (p_status is null or r.status = p_status) and (p_after is null or r.user_id > p_after)
   order by r.user_id limit least(greatest(coalesce(p_limit, 50), 1), 200);
end $$;
comment on function public.broadcast_recipients_page(uuid, text, uuid, int) is 'broadcast_v1: kết quả từng người nhận (admin)';
revoke all on function public.broadcast_recipients_page(uuid, text, uuid, int) from public, anon;
grant execute on function public.broadcast_recipients_page(uuid, text, uuid, int) to authenticated;

-- Chốt trạng thái chiến dịch từ số liệu người nhận (nội bộ)
create or replace function public.broadcast_refresh(p_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare c public.broadcast_campaigns%rowtype; v_p int; v_s int; v_f int; v_st text;
begin
  select * into c from public.broadcast_campaigns where id = p_id for update;
  if not found then return null; end if;
  if c.status in ('completed', 'partial_failed', 'failed', 'cancelled') then return c.status; end if;
  select count(*) filter (where status = 'pending'), count(*) filter (where status = 'sent'), count(*) filter (where status = 'failed')
    into v_p, v_s, v_f from public.broadcast_recipients where campaign_id = p_id;
  if v_p > 0 then return c.status; end if;
  v_st := case when v_f = 0 then 'completed' when v_s > 0 then 'partial_failed' else 'failed' end;
  update public.broadcast_campaigns set status = v_st, finished_at = now() where id = p_id;
  return v_st;
end $$;
comment on function public.broadcast_refresh(uuid) is 'broadcast_v1: chốt trạng thái (nội bộ)';
revoke all on function public.broadcast_refresh(uuid) from public, anon, authenticated;

-- Hủy phần CHƯA gửi. Đã gửi thì không thu hồi.
create or replace function public.broadcast_cancel(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_n int; v_status text;
begin
  perform public.broadcast_require_admin();
  select status into v_status from public.broadcast_campaigns where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy chiến dịch' using errcode = 'P0002'; end if;
  if v_status <> 'sending' then return jsonb_build_object('status', v_status, 'cancelled', 0); end if;
  update public.broadcast_recipients set status = 'cancelled' where campaign_id = p_id and status = 'pending';
  get diagnostics v_n = row_count;
  update public.broadcast_campaigns set status = 'cancelled', cancelled_at = now(), finished_at = now() where id = p_id;
  return jsonb_build_object('status', 'cancelled', 'cancelled', v_n);
end $$;
comment on function public.broadcast_cancel(uuid) is 'broadcast_v1: hủy phần chưa gửi';
revoke all on function public.broadcast_cancel(uuid) from public, anon;
grant execute on function public.broadcast_cancel(uuid) to authenticated;

-- 5) Phân phối MỘT người (nội bộ; gọi trong worker). Ném lỗi → worker retry. Trả (status, error, ref_seq, conversation).
create or replace function public.broadcast_deliver(c public.broadcast_campaigns, p_uid uuid)
returns table(status text, error text, ref_seq bigint, ref_conversation uuid) language plpgsql security definer set search_path = '' as $$
declare v_reason text; v_conv uuid; v_seq bigint; v_a uuid; v_b uuid;
begin
  v_reason := public.broadcast_classify(c.channel, c.audience_kind, p_uid, c.created_by);   -- kiểm lại NGAY trước khi phát
  if v_reason is not null then return query select 'skipped'::text, v_reason, null::bigint, null::uuid; return; end if;
  if c.channel = 'notice' then
    insert into public.class_system_notices (user_id, kind, body, ref_type, ref_key, dedupe_key, title, link)
    values (p_uid, 'broadcast', c.body, 'broadcast', c.id::text, 'broadcast:' || c.id::text, c.title, c.link)
    on conflict (user_id, dedupe_key) do nothing;
    select n.seq into v_seq from public.class_system_notices n where n.user_id = p_uid and n.dedupe_key = 'broadcast:' || c.id::text;
    return query select 'sent'::text, null::text, v_seq, null::uuid;
  else
    v_a := least(c.created_by, p_uid); v_b := greatest(c.created_by, p_uid);
    perform pg_advisory_xact_lock(hashtextextended(v_a::text || v_b::text, 11));   -- cùng khoá với dm_start: không tạo hội thoại trùng
    select d.id into v_conv from public.dm_conversations d where d.user_lo = v_a and d.user_hi = v_b;
    if v_conv is null then
      insert into public.dm_conversations (user_lo, user_hi) values (v_a, v_b) returning id into v_conv;
      insert into public.dm_participants (conversation_id, user_id) values (v_conv, c.created_by), (v_conv, p_uid);
    end if;
    v_seq := public.dm_append(v_conv, c.created_by, c.body);
    return query select 'sent'::text, null::text, v_seq, v_conv;
  end if;
end $$;
comment on function public.broadcast_deliver(public.broadcast_campaigns, uuid) is 'broadcast_v1: phân phối một người (nội bộ)';
revoke all on function public.broadcast_deliver(public.broadcast_campaigns, uuid) from public, anon, authenticated;

-- 6) Worker: lô nhỏ, mỗi người một khối con (lỗi một người không kéo cả lô), retry có backoff, tiếp tục được sau khi khởi động lại
create or replace function public.broadcast_tick(p_batch int default 200)
returns int language plpgsql security definer set search_path = '' as $$
declare c public.broadcast_campaigns%rowtype; r record; d record; v_done int := 0; v_att int;
begin
  for c in select * from public.broadcast_campaigns where status = 'sending' order by created_at limit 5 for update skip locked loop
    for r in select * from public.broadcast_recipients
              where campaign_id = c.id and status = 'pending' and next_attempt_at <= now()
              order by user_id limit least(greatest(coalesce(p_batch, 200), 1), 500) for update skip locked loop
      begin
        select * into d from public.broadcast_deliver(c, r.user_id);
        update public.broadcast_recipients set status = d.status, error = d.error, delivered_at = case when d.status = 'sent' then now() end,
               ref_seq = d.ref_seq, ref_conversation = d.ref_conversation, attempts = attempts + 1
         where campaign_id = r.campaign_id and user_id = r.user_id;
        v_done := v_done + 1;
      exception when others then
        v_att := r.attempts + 1;
        update public.broadcast_recipients
           set attempts = v_att, error = left(sqlstate || ': ' || sqlerrm, 300),
               status = case when v_att >= 3 then 'failed' else 'pending' end,
               next_attempt_at = now() + (case v_att when 1 then interval '1 minute' when 2 then interval '5 minutes' else interval '15 minutes' end)
         where campaign_id = r.campaign_id and user_id = r.user_id;
      end;
    end loop;
    perform public.broadcast_refresh(c.id);
  end loop;
  return v_done;
end $$;
comment on function public.broadcast_tick(int) is 'broadcast_v1: worker (pg_cron mỗi phút)';
revoke all on function public.broadcast_tick(int) from public, anon, authenticated;

-- 7) Lịch chạy worker (pg_cron có sẵn trên production; DB thử không có thì bỏ qua)
do $cron$
begin
  if to_regnamespace('cron') is not null then
    perform cron.unschedule(jobid) from cron.job where jobname = 'broadcast-worker';
    perform cron.schedule('broadcast-worker', '* * * * *', 'select public.broadcast_tick()');
  end if;
end $cron$;

-- 8) Cổng cuối: không có chiến dịch nào được tạo, không tin nhắn/hội thoại/thông báo nào thêm
do $after$
begin
  if (select (select count(*) from public.dm_messages)::text || ':' || (select count(*) from public.dm_conversations)::text
             || ':' || (select count(*) from public.class_system_notices)::text) is distinct from current_setting('broadcast_v1.fp', true) then
    raise exception 'DỪNG — dữ liệu chat/thông báo đổi trong migration';
  end if;
  if exists (select 1 from public.broadcast_campaigns) and not exists (select 1 from pg_class where relname = 'broadcast_campaigns' and obj_description(oid, 'pg_class') like 'broadcast_v1:%') then
    raise exception 'DỪNG — bất thường';
  end if;
end $after$;

notify pgrst, 'reload schema';
