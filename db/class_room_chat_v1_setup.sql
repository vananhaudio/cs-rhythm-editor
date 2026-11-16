-- CLASS ROOM CHAT V1 — mỗi lớp (class_schedule) có đúng MỘT phòng chat trong Trò chuyện của /me. Chạy bằng scripts/prod-db.py
-- (một transaction; file KHÔNG có begin/commit). Idempotent, ADDITIVE: chỉ tạo bảng + hàm MỚI tiền tố classchat_
-- (bandchat_*, dm_*, chat_*, class_schedule, edu_group_members … giữ nguyên).
--
-- Mô hình = Band Chat V1 (docs/BAND-CHAT-V1.md), thay "thành viên Band" bằng "thành viên lớp canonical":
--   tva_private.class_memberships (class_schedule.cohort_group_id → edu_group_members active) — nguồn DUY NHẤT (CLASS-MEMBERSHIP-CANONICAL).
--   • RLS BẬT, thu hồi MỌI grant, KHÔNG policy → client không CRUD thẳng bảng; mọi thao tác qua RPC SECURITY DEFINER (search_path rỗng) theo auth.uid().
--   • Quyền = MỘT chỗ: classchat_access(lớp) → 'send' | 'read' | null, tính lúc GỌI:
--       - Thành viên HIỆN HÀNH của lớp (học viên, và Thầy/Admin có trong nhóm lớp = Thầy phụ trách) → 'send'.
--         Rời lớp / bị gỡ khỏi nhóm → null (mất đọc/gửi; tin đã gửi giữ nguyên). Người mới vào đọc được lịch sử.
--       - Lớp 'draft' / 'cancelled' / 'merged' → thành viên hiện hành chỉ 'read'. Lịch sử giữ nguyên. Lớp mới sau khi gộp có phòng RIÊNG
--         (class_id khác); KHÔNG tự chuyển hay nhân đôi tin.
--       - Thầy/Admin KHÔNG thuộc lớp (public.is_teacher()) → 'read'. Riêng Thầy đồng hành (bandchat_is_companion(), Band V1.3) → 'send'
--         ở lớp còn tồn tại và chưa draft/cancelled/merged. Không giả danh; xem không tạo/đổi trạng thái đọc của ai.
--   • Không phải thành viên và lớp không tồn tại → CÙNG một lỗi P0002 (không lộ sự tồn tại). Có quyền đọc mà gửi → 42501 "chỉ đọc".
--   • class_id KHÔNG có khoá ngoại tới class_schedule: xoá lớp không cuốn theo lịch sử chat (Thầy/Admin vẫn đọc; tên lưu name_snapshot).
--   • Mỗi lớp đúng một phòng: classchat_rooms.class_id là PRIMARY KEY (INSERT … ON CONFLICT DO NOTHING). Phòng tạo lười khi có tin đầu.
--   • Tên lớp lấy từ class_schedule lúc đọc (không bản sao). seq tăng ổn định (khoá hàng phòng). Gửi tin = đã đọc tới tin đó.
--     Người mới vào lớp: tin có trước lúc vào (class_memberships.joined_at) KHÔNG tính chưa đọc (vẫn xem được).
--   • Chỉ text (1..2000 ký tự), 30 tin/phút/người như DM/Band. Polling như DM — không thêm realtime.
--   • An toàn nội dung (chặn người, từ cấm, đình chỉ): db/class_room_chat_v1_safety_setup.sql (chạy SAU file này).
--   • Hộp thư V2 (lọc "Lớp học", ghim, đếm): db/class_room_chat_v1_inbox_setup.sql (chạy SAU file này).

-- 0) Cổng drift
do $gate$
declare v_name text;
begin
  if to_regclass('public.class_schedule') is null or to_regclass('tva_private.class_memberships') is null or to_regclass('public.app_users') is null
     or to_regprocedure('public.class_public_identity(uuid)') is null or to_regprocedure('public.is_teacher()') is null
     or to_regprocedure('public.bandchat_is_companion()') is null then
    raise exception 'DỪNG — thiếu nền (class_schedule, tva_private.class_memberships, app_users, class_public_identity, is_teacher, bandchat_is_companion V1.3)';
  end if;
  if (select count(*) from information_schema.columns where (table_schema, table_name, column_name) in
        (('public', 'class_schedule', 'id'), ('public', 'class_schedule', 'name'), ('public', 'class_schedule', 'code'), ('public', 'class_schedule', 'status'),
         ('tva_private', 'class_memberships', 'class_id'), ('tva_private', 'class_memberships', 'user_id'), ('tva_private', 'class_memberships', 'joined_at'))) <> 7 then
    raise exception 'DỪNG — thiếu cột nền của lớp/thành viên lớp';
  end if;
  for v_name in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname in ('classchat_rooms', 'classchat_messages', 'classchat_reads')
       and coalesce(obj_description(c.oid, 'pg_class'), '') not like 'classchat_v1:%'
  loop
    raise exception 'DỪNG — đã có bảng % không thuộc Class Room Chat V1', v_name;
  end loop;
  for v_name in
    select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in ('classchat_access', 'classchat_append', 'classchat_rooms', 'classchat_messages', 'classchat_send',
                                                  'classchat_mark_read', 'classchat_unread_count', 'classchat_members')
       and coalesce(obj_description(p.oid, 'pg_proc'), '') not like 'classchat_v1:%'
  loop
    raise exception 'DỪNG — đã có hàm % không thuộc Class Room Chat V1', v_name;
  end loop;
end $gate$;

-- 1) Luật quyền — MỘT chỗ duy nhất (nội bộ; theo auth.uid()). null | 'read' | 'send'
create or replace function public.classchat_access(p_class uuid)
returns text language plpgsql security definer set search_path = '' stable as $$
declare v_status text; v_exists boolean; v_readonly boolean;
begin
  if auth.uid() is null or p_class is null then return null; end if;
  select cs.status, true into v_status, v_exists from public.class_schedule cs where cs.id = p_class;
  v_readonly := coalesce(v_status, '') in ('draft', 'cancelled', 'merged');
  if coalesce(v_exists, false) and exists (select 1 from tva_private.class_memberships m where m.class_id = p_class and m.user_id = auth.uid()) then
    return case when v_readonly then 'read' else 'send' end;
  end if;
  if public.is_teacher() then
    if coalesce(v_exists, false) and not v_readonly and public.bandchat_is_companion() then return 'send'; end if;
    return 'read';
  end if;
  return null;
end $$;
comment on function public.classchat_access(uuid) is 'classchat_v1: quyền của người gọi với phòng lớp (null|read|send)';
revoke all on function public.classchat_access(uuid) from public, anon, authenticated;

-- 2) Ghi một tin (nội bộ): tìm-hoặc-tạo phòng → khoá hàng phòng → seq ổn định; giới hạn tốc độ; người gửi coi như đã đọc
create or replace function public.classchat_append(p_class uuid, p_me uuid, p_body text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_body text := regexp_replace(coalesce(p_body, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g'); v_seq bigint; v_recent int;
begin
  if v_body = '' then raise exception 'Tin nhắn trống' using errcode = '22023'; end if;
  if char_length(v_body) > 2000 then raise exception 'Tin nhắn quá dài (tối đa 2000 ký tự)' using errcode = '22023'; end if;

  insert into public.classchat_rooms (class_id) values (p_class) on conflict (class_id) do nothing;
  perform 1 from public.classchat_rooms where class_id = p_class for update;
  select count(*) into v_recent from (
    select 1 from public.classchat_messages
     where class_id = p_class and sender_id = p_me and created_at > now() - interval '1 minute'
     order by seq desc limit 30) s;
  if v_recent >= 30 then raise exception 'Bạn gửi quá nhanh. Hãy chờ một chút.' using errcode = '54000'; end if;

  update public.classchat_rooms set last_seq = last_seq + 1, last_message_at = now(),
         name_snapshot = coalesce((select nullif(btrim(cs.name), '') from public.class_schedule cs where cs.id = p_class),
                                  (select cs.code from public.class_schedule cs where cs.id = p_class), name_snapshot)
   where class_id = p_class returning last_seq into v_seq;
  insert into public.classchat_messages (class_id, seq, sender_id, body) values (p_class, v_seq, p_me, v_body);
  insert into public.classchat_reads (class_id, user_id, last_read_seq) values (p_class, p_me, v_seq)
    on conflict (class_id, user_id) do update set last_read_seq = greatest(public.classchat_reads.last_read_seq, excluded.last_read_seq);
  return v_seq;
end $$;
comment on function public.classchat_append(uuid, uuid, text) is 'classchat_v1: ghi tin (nội bộ)';
revoke all on function public.classchat_append(uuid, uuid, text) from public, anon, authenticated;

-- 3) RPC cho client
-- Các phòng lớp của mình (mới nhất trước; chưa có tin xếp sau). Thầy/Admin thêm phòng đã có tin của lớp họ KHÔNG thuộc (support = true; chỉ xem).
create or replace function public.classchat_rooms(p_limit int default 50)
returns table(class_id uuid, class_name text, last_seq bigint, last_body text, last_sender_name text, last_mine boolean, last_at timestamptz,
              unread int, member_count int, can_send boolean, archived boolean, support boolean)
language plpgsql security definer set search_path = '' stable as $$
declare v_me uuid := auth.uid(); v_lim int := least(greatest(coalesce(p_limit, 50), 1), 100); v_teacher boolean;
begin
  if v_me is null then raise exception 'Chưa đăng nhập' using errcode = '42501'; end if;
  v_teacher := public.is_teacher();
  return query
  select c.class_id, coalesce(nullif(btrim(cs.name), ''), cs.code, r.name_snapshot, 'Lớp đã xoá'),
         coalesce(r.last_seq, 0), left(lm.body, 160),
         (select i.name from public.class_public_identity(lm.sender_id) i where lm.sender_id is not null),
         (lm.sender_id = v_me), r.last_message_at,
         case when me.user_id is not null then
           greatest(coalesce(r.last_seq, 0) - coalesce(rd.last_read_seq,
             (select coalesce(max(x.seq), 0) from public.classchat_messages x where x.class_id = c.class_id and x.created_at <= coalesce(me.joined_at, now()))), 0)::int
         else 0 end,
         (select count(*)::int from tva_private.class_memberships k where k.class_id = c.class_id),
         (acc.a = 'send'), (coalesce(cs.status, '') in ('draft', 'cancelled', 'merged')), (me.user_id is null)
    from (select m.class_id from tva_private.class_memberships m where m.user_id = v_me
          union select rr.class_id from public.classchat_rooms rr where v_teacher and rr.last_seq > 0) c
    cross join lateral (select public.classchat_access(c.class_id) a) acc
    left join public.class_schedule cs on cs.id = c.class_id
    left join public.classchat_rooms r on r.class_id = c.class_id
    left join tva_private.class_memberships me on me.class_id = c.class_id and me.user_id = v_me
    left join public.classchat_reads rd on rd.class_id = c.class_id and rd.user_id = v_me
    left join lateral (select x.body, x.sender_id from public.classchat_messages x where x.class_id = c.class_id and x.seq = r.last_seq) lm on true
   where acc.a is not null and (cs.id is not null or r.class_id is not null)
   order by r.last_message_at desc nulls last, 2, c.class_id
   limit v_lim;
end $$;
comment on function public.classchat_rooms(int) is 'classchat_v1: các phòng lớp của mình (+ phòng hỗ trợ cho Thầy/Admin)';
revoke all on function public.classchat_rooms(int) from public, anon;
grant execute on function public.classchat_rooms(int) to authenticated;

-- Tin của một phòng, theo seq (luôn trả TĂNG DẦN). Cùng quy ước phân trang với bandchat_messages.
create or replace function public.classchat_messages(p_class uuid, p_after_seq bigint default null, p_before_seq bigint default null, p_limit int default 30)
returns table(seq bigint, sender_id uuid, sender_name text, sender_avatar_url text, mine boolean, body text, created_at timestamptz)
language plpgsql security definer set search_path = '' stable as $$
declare v_me uuid := auth.uid(); v_lim int := least(greatest(coalesce(p_limit, 30), 1), 100);
begin
  if v_me is null or public.classchat_access(p_class) is null then
    raise exception 'Không tìm thấy cuộc trò chuyện' using errcode = 'P0002';
  end if;
  return query
  select z.seq, z.sender_id, i.name, i.avatar_url, (z.sender_id = v_me), z.body, z.created_at
    from (
      select * from (
        select m.seq, m.sender_id, m.body, m.created_at
          from public.classchat_messages m
         where m.class_id = p_class
           and (p_after_seq is null or m.seq > p_after_seq)
           and (p_before_seq is null or m.seq < p_before_seq)
         order by case when p_after_seq is null then m.seq end desc nulls last, m.seq asc
         limit v_lim) y
    ) z
    left join lateral public.class_public_identity(z.sender_id) i on z.sender_id is not null
   order by z.seq asc;
end $$;
comment on function public.classchat_messages(uuid, bigint, bigint, int) is 'classchat_v1: tin của phòng lớp theo seq';
revoke all on function public.classchat_messages(uuid, bigint, bigint, int) from public, anon;
grant execute on function public.classchat_messages(uuid, bigint, bigint, int) to authenticated;

-- Gửi tin
create or replace function public.classchat_send(p_class uuid, p_body text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_acc text := public.classchat_access(p_class);
begin
  if v_me is null or v_acc is null then
    raise exception 'Không tìm thấy cuộc trò chuyện' using errcode = 'P0002';
  end if;
  if v_acc <> 'send' then
    raise exception 'Nhóm này đang ở chế độ chỉ đọc' using errcode = '42501';
  end if;
  return public.classchat_append(p_class, v_me, p_body);
end $$;
comment on function public.classchat_send(uuid, text) is 'classchat_v1: gửi tin vào phòng lớp';
revoke all on function public.classchat_send(uuid, text) from public, anon;
grant execute on function public.classchat_send(uuid, text) to authenticated;

-- Đánh dấu đã đọc tới p_seq (chỉ tăng, không vượt tin cuối). Thầy/Admin chỉ xem (không là thành viên) → không tạo trạng thái đọc.
create or replace function public.classchat_mark_read(p_class uuid, p_seq bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_last bigint; v_read bigint;
begin
  if v_me is null or public.classchat_access(p_class) is null then
    raise exception 'Không tìm thấy cuộc trò chuyện' using errcode = 'P0002';
  end if;
  if not exists (select 1 from tva_private.class_memberships m where m.class_id = p_class and m.user_id = v_me) then return 0; end if;
  select r.last_seq into v_last from public.classchat_rooms r where r.class_id = p_class;
  if v_last is null or v_last = 0 then return 0; end if;
  insert into public.classchat_reads (class_id, user_id, last_read_seq)
    values (p_class, v_me, least(greatest(coalesce(p_seq, 0), 0), v_last))
    on conflict (class_id, user_id) do update
      set last_read_seq = greatest(public.classchat_reads.last_read_seq, excluded.last_read_seq)
  returning last_read_seq into v_read;
  return v_read;
end $$;
comment on function public.classchat_mark_read(uuid, bigint) is 'classchat_v1: đánh dấu đã đọc';
revoke all on function public.classchat_mark_read(uuid, bigint) from public, anon;
grant execute on function public.classchat_mark_read(uuid, bigint) to authenticated;

-- Số phòng lớp còn tin chưa đọc (badge) — đếm phòng, không đếm tin. Chỉ lớp mình là thành viên hiện hành.
create or replace function public.classchat_unread_count()
returns int language plpgsql security definer set search_path = '' stable as $$
begin
  if auth.uid() is null then return 0; end if;
  return (select count(*)::int
            from tva_private.class_memberships me
            join public.classchat_rooms r on r.class_id = me.class_id
            left join public.classchat_reads rd on rd.class_id = me.class_id and rd.user_id = auth.uid()
           where me.user_id = auth.uid()
             and r.last_seq > coalesce(rd.last_read_seq,
                   (select coalesce(max(x.seq), 0) from public.classchat_messages x where x.class_id = me.class_id and x.created_at <= coalesce(me.joined_at, now()))));
end $$;
comment on function public.classchat_unread_count() is 'classchat_v1: số phòng lớp chưa đọc';
revoke all on function public.classchat_unread_count() from public, anon;
grant execute on function public.classchat_unread_count() to authenticated;

-- Thành viên của phòng (tên + ảnh công khai; không email/điện thoại). Học viên hiện hành + Thầy phụ trách (role teacher/admin trong nhóm lớp).
create or replace function public.classchat_members(p_class uuid)
returns table(user_id uuid, name text, avatar_url text, role text)
language plpgsql security definer set search_path = '' stable as $$
begin
  if auth.uid() is null or public.classchat_access(p_class) is null then
    raise exception 'Không tìm thấy cuộc trò chuyện' using errcode = 'P0002';
  end if;
  return query
  select m.user_id, i.name, i.avatar_url, i.role
    from tva_private.class_memberships m
    cross join lateral public.class_public_identity(m.user_id) i
   where m.class_id = p_class
   order by (i.role in ('teacher', 'admin')) desc, i.name, m.user_id
   limit 300;
end $$;
comment on function public.classchat_members(uuid) is 'classchat_v1: thành viên phòng lớp';
revoke all on function public.classchat_members(uuid) from public, anon;
grant execute on function public.classchat_members(uuid) to authenticated;

-- N) Bảng — đặt CUỐI, MỘT câu lệnh (khoá ngoại tới auth.users xin khoá ngắn nhất có thể)
do $tables$
begin
create table if not exists public.classchat_rooms (
  class_id        uuid primary key,
  last_seq        bigint not null default 0,
  last_message_at timestamptz,
  created_at      timestamptz not null default now(),
  name_snapshot   text                         -- tên lớp lần cuối thấy (hiện khi lớp đã bị xoá)
);

create table if not exists public.classchat_messages (
  class_id   uuid not null references public.classchat_rooms(class_id),
  seq        bigint not null,
  sender_id  uuid references auth.users(id) on delete set null,
  body       text not null,
  created_at timestamptz not null default now(),
  primary key (class_id, seq),
  constraint classchat_messages_body_check check (char_length(body) between 1 and 2000)
);

create table if not exists public.classchat_reads (
  class_id      uuid not null references public.classchat_rooms(class_id),
  user_id       uuid not null references auth.users(id) on delete cascade,
  last_read_seq bigint not null default 0,
  primary key (class_id, user_id)
);
create index if not exists classchat_reads_user_idx on public.classchat_reads (user_id);

comment on table public.classchat_rooms is 'classchat_v1: một phòng cho mỗi lớp (class_id không có FK: xoá lớp không xoá lịch sử)';
comment on table public.classchat_messages is 'classchat_v1: tin nhắn text của phòng lớp';
comment on table public.classchat_reads is 'classchat_v1: last_read_seq theo (lớp, người)';

alter table public.classchat_rooms enable row level security;
alter table public.classchat_messages enable row level security;
alter table public.classchat_reads enable row level security;
revoke all on public.classchat_rooms from public, anon, authenticated;
revoke all on public.classchat_messages from public, anon, authenticated;
revoke all on public.classchat_reads from public, anon, authenticated;
end $tables$;

notify pgrst, 'reload schema';
