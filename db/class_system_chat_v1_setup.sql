-- CLASS SYSTEM CHAT V1 — "Class 2.0": thông báo hệ thống hiện trong Trò chuyện. *** BẢN NHÁP — CHƯA CHẠY PRODUCTION, chờ Owner duyệt. ***
-- Chạy bằng scripts/prod-db.py (một transaction; file KHÔNG có begin/commit). Idempotent, ADDITIVE: tiền tố class_system_*.
-- Thiết kế: docs/CLASS-SYSTEM-CHAT-V1.md.
--   • KHÔNG sửa dm_* / lt_* / bảng nào đang có. Nguồn sự kiện = trigger AFTER INSERT trên learning_thread_events (kèm lt_respond: Thầy chấm/nhận xét/trả lời).
--     Trigger chạy CÙNG transaction với lưu kết quả chấm → lưu thất bại thì không có thông báo; không có ai khác ghi được bảng này.
--   • Chống trùng: unique (user_id, dedupe_key) với dedupe_key = 'event:' || id sự kiện → một sự kiện chấm = tối đa một thông báo.
--   • RLS bật, thu hồi mọi grant, KHÔNG policy → client chỉ đi qua RPC SECURITY DEFINER (auth.uid()); người A không đọc được của B.
--   • Chưa đọc = seq > last_read_seq của CHÍNH người dùng (cùng mô hình dm_participants.last_read_seq) — tách hẳn với tin nhắn cá nhân.
--   • KHÔNG backfill: chỉ sự kiện chấm SAU khi migration chạy mới có thông báo.

-- 0) Cổng nền
do $gate$
begin
  if to_regclass('public.learning_threads') is null or to_regclass('public.learning_thread_events') is null
     or to_regprocedure('public.is_class_member()') is null then
    raise exception 'DỪNG — thiếu nền (Learning Thread P1, is_class_member)';
  end if;
end $gate$;

-- 1) RPC cho client (hàm tạo TRƯỚC bảng: plpgsql chỉ tham chiếu bảng lúc chạy; bảng đặt cuối để khoá auth.users ngắn nhất)
-- Danh sách thông báo của mình, mới nhất trước; p_before_seq để cuộn lên xem cũ
create or replace function public.class_system_notices(p_before_seq bigint default null, p_limit int default 30)
returns table(seq bigint, kind text, body text, ref_type text, ref_key text, created_at timestamptz, unread boolean)
language plpgsql security definer set search_path = '' stable as $$
declare v_me uuid := auth.uid(); v_lim int := least(greatest(coalesce(p_limit, 30), 1), 100); v_read bigint;
begin
  if v_me is null or not public.is_class_member() then raise exception 'Chưa đăng nhập Class' using errcode = '42501'; end if;
  select coalesce((select r.last_read_seq from public.class_system_notice_reads r where r.user_id = v_me), 0) into v_read;
  return query
  select n.seq, n.kind, n.body, n.ref_type, n.ref_key, n.created_at, n.seq > v_read
    from public.class_system_notices n
   where n.user_id = v_me and (p_before_seq is null or n.seq < p_before_seq)
   order by n.seq desc limit v_lim;
end $$;
comment on function public.class_system_notices(bigint, int) is 'class_system_chat_v1: thông báo của mình';
revoke all on function public.class_system_notices(bigint, int) from public, anon;
grant execute on function public.class_system_notices(bigint, int) to authenticated;

-- Một dòng cho mục "Class 2.0" trong danh sách Trò chuyện: thông báo mới nhất + số chưa đọc (null last_seq = chưa có thông báo → ẩn mục)
create or replace function public.class_system_notice_summary()
returns table(last_seq bigint, last_body text, last_at timestamptz, unread int)
language plpgsql security definer set search_path = '' stable as $$
declare v_me uuid := auth.uid(); v_read bigint;
begin
  if v_me is null or not public.is_class_member() then raise exception 'Chưa đăng nhập Class' using errcode = '42501'; end if;
  select coalesce((select r.last_read_seq from public.class_system_notice_reads r where r.user_id = v_me), 0) into v_read;
  return query
  select l.seq, l.body, l.created_at,
         (select count(*)::int from public.class_system_notices x where x.user_id = v_me and x.seq > v_read)
    from (select 1) one
    left join lateral (select n.seq, n.body, n.created_at from public.class_system_notices n
                        where n.user_id = v_me order by n.seq desc limit 1) l on true;
end $$;
comment on function public.class_system_notice_summary() is 'class_system_chat_v1: dòng tóm tắt + chưa đọc';
revoke all on function public.class_system_notice_summary() from public, anon;
grant execute on function public.class_system_notice_summary() to authenticated;

-- Đánh dấu đã đọc tới p_seq (chỉ tăng, không vượt thông báo mới nhất của mình). Không đụng dm_participants.
create or replace function public.class_system_notice_mark_read(p_seq bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_max bigint; v_read bigint;
begin
  if v_me is null or not public.is_class_member() then raise exception 'Chưa đăng nhập Class' using errcode = '42501'; end if;
  select coalesce(max(n.seq), 0) into v_max from public.class_system_notices n where n.user_id = v_me;
  insert into public.class_system_notice_reads (user_id, last_read_seq) values (v_me, least(greatest(coalesce(p_seq, 0), 0), v_max))
  on conflict (user_id) do update set last_read_seq = greatest(public.class_system_notice_reads.last_read_seq, excluded.last_read_seq)
  returning last_read_seq into v_read;
  return v_read;
end $$;
comment on function public.class_system_notice_mark_read(bigint) is 'class_system_chat_v1: đánh dấu đã đọc';
revoke all on function public.class_system_notice_mark_read(bigint) from public, anon;
grant execute on function public.class_system_notice_mark_read(bigint) to authenticated;

-- 2) Nguồn sự kiện: Thầy chấm / nhận xét / trả lời (kind teacher_*) → thông báo cho CHÍNH học viên của thread
create or replace function public.class_system_notice_on_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_t public.learning_threads%rowtype; v_kind text; v_label text; v_body text;
begin
  if new.author_role is distinct from 'teacher' or new.hidden_at is not null then return new; end if;
  select * into v_t from public.learning_threads where id = new.thread_id;
  if not found or v_t.learner_user_id is null then return new; end if;
  v_kind := case
    when new.kind = 'teacher_feedback' and new.verdict = 'pass'  then 'checkpoint_passed'
    when new.kind = 'teacher_feedback' and new.verdict = 'retry' then 'checkpoint_retry'
    when new.kind = 'teacher_feedback'                          then 'checkpoint_commented'
    when new.kind = 'teacher_answer'                            then 'teacher_answered' end;
  if v_kind is null then return new; end if;
  v_label := case when v_t.session_no is not null then 'Buổi ' || lpad(v_t.session_no::text, 2, '0') else 'bài học' end;
  v_body := case v_kind
    when 'checkpoint_passed'    then 'Bài trả ' || v_label || ' của bạn đã được Thầy chấm Đạt.'
    when 'checkpoint_retry'     then 'Bài trả ' || v_label || ' của bạn cần làm lại. Thầy đã để lại nhận xét.'
    when 'checkpoint_commented' then 'Bài trả ' || v_label || ' của bạn đã được Thầy nhận xét.'
    else                             'Thầy đã trả lời câu hỏi của bạn về ' || v_label || '.' end;
  insert into public.class_system_notices (user_id, kind, body, ref_type, ref_key, dedupe_key)
  values (v_t.learner_user_id, v_kind, v_body, 'thread', v_t.id::text, 'event:' || new.id::text)
  on conflict (user_id, dedupe_key) do nothing;
  return new;
end $$;
comment on function public.class_system_notice_on_event() is 'class_system_chat_v1: trigger nguồn thông báo chấm bài';
revoke all on function public.class_system_notice_on_event() from public, anon, authenticated;

-- N) Bảng + trigger — đặt CUỐI, MỘT câu lệnh (khoá ngoại auth.users xin khoá tới COMMIT; cùng lý do dm_v1_setup.sql)
do $tables$
begin
create table if not exists public.class_system_notices (
  seq        bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null,
  body       text not null,
  ref_type   text not null,
  ref_key    text not null,
  dedupe_key text not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint class_system_notices_kind_check check (kind in ('checkpoint_passed', 'checkpoint_retry', 'checkpoint_commented', 'teacher_answered')),
  constraint class_system_notices_body_check check (char_length(body) between 1 and 300),
  constraint class_system_notices_ref_check check (ref_type = 'thread' and ref_key ~ '^[0-9a-f-]{36}$'),
  constraint class_system_notices_dedupe_uq unique (user_id, dedupe_key)
);
create index if not exists class_system_notices_user_idx on public.class_system_notices (user_id, seq desc);
create table if not exists public.class_system_notice_reads (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  last_read_seq bigint not null default 0
);
alter table public.class_system_notices enable row level security;
alter table public.class_system_notice_reads enable row level security;
revoke all on public.class_system_notices from public, anon, authenticated;
revoke all on public.class_system_notice_reads from public, anon, authenticated;
comment on table public.class_system_notices is 'class_system_chat_v1: thông báo hệ thống (chỉ trigger ghi)';
drop trigger if exists class_system_notice_on_event on public.learning_thread_events;
create trigger class_system_notice_on_event after insert on public.learning_thread_events
  for each row execute function public.class_system_notice_on_event();
end $tables$;

notify pgrst, 'reload schema';
