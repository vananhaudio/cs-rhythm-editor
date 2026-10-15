-- BAND CHAT V1 — mỗi Band (teamlab_bands) có đúng MỘT nhóm chat trong Trò chuyện của /me. Chạy bằng scripts/prod-db.py (một transaction;
-- file KHÔNG có begin/commit). Idempotent, ADDITIVE: tạo 3 bảng + hàm MỚI (tiền tố bandchat_), không sửa bảng/hàm/policy nào đang có
-- (dm_*, teamlab_*, friendships, class_public_identity giữ nguyên).
--
-- Nguyên tắc (giống dm_v1):
--   • RLS BẬT, thu hồi MỌI grant, KHÔNG có policy → client không CRUD thẳng bảng. Mọi thao tác qua RPC SECURITY DEFINER
--     (search_path rỗng) dùng auth.uid(). Không CREATE POLICY ⇒ không dính khoá policy_grants.
--   • Quyền = MỘT chỗ duy nhất: bandchat_access(band) → 'send' | 'read' | null, tính ở thời điểm GỌI:
--       - Band đang hoạt động: thành viên HIỆN HÀNH (teamlab_band_members) = 'send'. Rời/bị gỡ → null. Người mới vào đọc được toàn bộ lịch sử.
--       - Band đã LƯU TRỮ (bandchat_rooms.archived_at): chỉ những người là thành viên LÚC LƯU TRỮ (ảnh chụp bandchat_frozen) = 'read'.
--         Khôi phục → xoá ảnh chụp, quyền theo thành viên hiện hành như cũ.
--       - Thầy/Admin (public.is_teacher() = app_users.role teacher|admin — nguồn quyền chuẩn hiện có) = 'read' mọi nhóm, để hỗ trợ/quản lý.
--         KHÔNG BAO GIỜ 'send' nếu không phải thành viên; không giả danh; xem không tạo/đổi trạng thái đọc của ai.
--     Hiện chưa có chức năng lưu trữ Band ở TeamLab (teamlab_bands không có cột trạng thái) → bandchat_set_archived (chỉ Thầy/Admin)
--     là móc nối: sau này TeamLab gọi nó khi lưu trữ/khôi phục Band.
--   • Không phải thành viên và nhóm không tồn tại → cùng một lỗi P0002 (không lộ sự tồn tại).
--   • Mỗi Band đúng một phòng: bandchat_rooms.band_id là PRIMARY KEY (tạo bằng INSERT … ON CONFLICT DO NOTHING → mở đồng thời không sinh trùng).
--     Phòng tạo lười khi có tin đầu; danh sách hiện mọi Band mình thuộc (kể cả chưa có phòng).
--   • Tên + ảnh Band lấy trực tiếp từ teamlab_bands / projects lúc đọc — không có bản sao để lệch.
--   • band_id KHÔNG có khoá ngoại tới teamlab_bands: xoá Band/Team KHÔNG cuốn theo lịch sử chat (V1 không xoá vĩnh viễn chat).
--     Band bị xoá → thành viên cũ không còn quyền; Thầy/Admin vẫn đọc được (nhóm hiện bằng tên đã lưu name_snapshot).
--   • seq tăng ổn định trong phòng (khoá hàng phòng khi gửi). last_read_seq theo (band, người). Gửi tin = đã đọc tới tin đó.
--     Người mới vào Band: tin có trước lúc họ vào Band KHÔNG tính chưa đọc (vẫn xem được).
--   • Chỉ text (1..2000 ký tự), giới hạn 30 tin/phút/người như DM. Polling như DM — không thêm realtime.

-- 0) Cổng drift
do $gate$
declare v_name text;
begin
  if to_regclass('public.teamlab_bands') is null or to_regclass('public.teamlab_band_members') is null or to_regclass('public.projects') is null
     or to_regprocedure('public.class_public_identity(uuid)') is null then
    raise exception 'DỪNG — thiếu bảng/hàm nền (teamlab_bands, teamlab_band_members, projects, class_public_identity)';
  end if;
  if (select count(*) from information_schema.columns where table_schema = 'public' and (table_name, column_name) in
        (('teamlab_bands', 'id'), ('teamlab_bands', 'project_id'), ('teamlab_bands', 'name'), ('teamlab_bands', 'cover_path'),
         ('teamlab_band_members', 'band_id'), ('teamlab_band_members', 'user_id'), ('teamlab_band_members', 'created_at'),
         ('projects', 'id'), ('projects', 'name'), ('projects', 'avatar_path'))) <> 10 then
    raise exception 'DỪNG — thiếu cột nền của Band (teamlab_bands.cover_path / projects.avatar_path / teamlab_band_members.created_at …)';
  end if;
  for v_name in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname in ('bandchat_rooms', 'bandchat_messages', 'bandchat_reads', 'bandchat_frozen')
       and coalesce(obj_description(c.oid, 'pg_class'), '') not like 'bandchat_v1:%'
  loop
    raise exception 'DỪNG — đã có bảng % không thuộc Band Chat V1', v_name;
  end loop;
  for v_name in
    select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in ('bandchat_access', 'bandchat_append', 'bandchat_rooms', 'bandchat_messages', 'bandchat_send',
                                                  'bandchat_mark_read', 'bandchat_unread_count', 'bandchat_members', 'bandchat_set_archived')
       and coalesce(obj_description(p.oid, 'pg_proc'), '') not like 'bandchat_v1:%'
  loop
    raise exception 'DỪNG — đã có hàm % không thuộc Band Chat V1', v_name;
  end loop;
end $gate$;

-- 1) Luật quyền — MỘT chỗ duy nhất (nội bộ; theo auth.uid() của người gọi). null | 'read' | 'send'
create or replace function public.bandchat_access(p_band uuid)
returns text language plpgsql security definer set search_path = '' stable as $$
begin
  if auth.uid() is null or p_band is null then return null; end if;
  if exists (select 1 from public.bandchat_rooms r where r.band_id = p_band and r.archived_at is not null) then
    if exists (select 1 from public.bandchat_frozen f where f.band_id = p_band and f.user_id = auth.uid()) or public.is_teacher() then return 'read'; end if;
    return null;
  end if;
  if exists (select 1 from public.teamlab_band_members m where m.band_id = p_band and m.user_id = auth.uid()) then return 'send'; end if;
  if public.is_teacher() then return 'read'; end if;
  return null;
end $$;
comment on function public.bandchat_access(uuid) is 'bandchat_v1: quyền của người gọi với nhóm (null|read|send)';
revoke all on function public.bandchat_access(uuid) from public, anon, authenticated;

-- 2) Ghi một tin (nội bộ): tìm-hoặc-tạo phòng (idempotent) → khoá hàng phòng → seq ổn định; giới hạn tốc độ; người gửi coi như đã đọc
create or replace function public.bandchat_append(p_band uuid, p_me uuid, p_body text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_body text := regexp_replace(coalesce(p_body, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g'); v_seq bigint; v_recent int;
begin
  if v_body = '' then raise exception 'Tin nhắn trống' using errcode = '22023'; end if;
  if char_length(v_body) > 2000 then raise exception 'Tin nhắn quá dài (tối đa 2000 ký tự)' using errcode = '22023'; end if;

  insert into public.bandchat_rooms (band_id) values (p_band) on conflict (band_id) do nothing;
  perform 1 from public.bandchat_rooms where band_id = p_band for update;
  select count(*) into v_recent from (
    select 1 from public.bandchat_messages
     where band_id = p_band and sender_id = p_me and created_at > now() - interval '1 minute'
     order by seq desc limit 30) s;
  if v_recent >= 30 then raise exception 'Bạn gửi quá nhanh. Hãy chờ một chút.' using errcode = '54000'; end if;

  update public.bandchat_rooms set last_seq = last_seq + 1, last_message_at = now(),
         name_snapshot = coalesce((select b.name from public.teamlab_bands b where b.id = p_band), name_snapshot)
   where band_id = p_band returning last_seq into v_seq;
  insert into public.bandchat_messages (band_id, seq, sender_id, body) values (p_band, v_seq, p_me, v_body);
  insert into public.bandchat_reads (band_id, user_id, last_read_seq) values (p_band, p_me, v_seq)
    on conflict (band_id, user_id) do update set last_read_seq = greatest(public.bandchat_reads.last_read_seq, excluded.last_read_seq);
  return v_seq;
end $$;
comment on function public.bandchat_append(uuid, uuid, text) is 'bandchat_v1: ghi tin (nội bộ)';
revoke all on function public.bandchat_append(uuid, uuid, text) from public, anon, authenticated;

-- 3) RPC cho client
-- Các nhóm Band của mình (mới nhất trước; nhóm chưa có tin xếp sau). Tên/ảnh lấy từ Band hiện hành.
-- Thầy/Admin thêm các nhóm đã có tin của Band họ KHÔNG thuộc (support = true; chỉ xem, không tính chưa đọc).
create or replace function public.bandchat_rooms(p_limit int default 50)
returns table(band_id uuid, band_name text, cover_path text, project_id uuid, project_name text, project_avatar_path text,
              last_seq bigint, last_body text, last_sender_name text, last_mine boolean, last_at timestamptz,
              unread int, member_count int, can_send boolean, archived boolean, support boolean)
language plpgsql security definer set search_path = '' stable as $$
declare v_me uuid := auth.uid(); v_lim int := least(greatest(coalesce(p_limit, 50), 1), 100); v_teacher boolean;
begin
  if v_me is null then raise exception 'Chưa đăng nhập' using errcode = '42501'; end if;
  v_teacher := public.is_teacher();
  return query
  select c.band_id, coalesce(b.name, r.name_snapshot, 'Band đã xoá'), b.cover_path, p.id, p.name, p.avatar_path,
         coalesce(r.last_seq, 0), left(lm.body, 160),
         (select i.name from public.class_public_identity(lm.sender_id) i where lm.sender_id is not null),
         (lm.sender_id = v_me), r.last_message_at,
         case when mem.is_member then
           greatest(coalesce(r.last_seq, 0) - coalesce(rd.last_read_seq,
             (select coalesce(max(x.seq), 0) from public.bandchat_messages x where x.band_id = c.band_id and x.created_at <= coalesce(me.created_at, now()))), 0)::int
         else 0 end,
         (select count(*)::int from public.teamlab_band_members k where k.band_id = c.band_id),
         (acc.a = 'send'), (r.archived_at is not null), not mem.is_member
    from (select m.band_id from public.teamlab_band_members m where m.user_id = v_me
          union select f.band_id from public.bandchat_frozen f where f.user_id = v_me
          union select rr.band_id from public.bandchat_rooms rr where v_teacher and rr.last_seq > 0) c
    cross join lateral (select public.bandchat_access(c.band_id) a) acc
    left join public.teamlab_bands b on b.id = c.band_id
    left join public.projects p on p.id = b.project_id
    left join public.bandchat_rooms r on r.band_id = c.band_id
    left join public.teamlab_band_members me on me.band_id = c.band_id and me.user_id = v_me
    left join public.bandchat_reads rd on rd.band_id = c.band_id and rd.user_id = v_me
    cross join lateral (select (me.user_id is not null or exists (select 1 from public.bandchat_frozen f2 where f2.band_id = c.band_id and f2.user_id = v_me)) is_member) mem
    left join lateral (select x.body, x.sender_id from public.bandchat_messages x where x.band_id = c.band_id and x.seq = r.last_seq) lm on true
   where acc.a is not null
   order by r.last_message_at desc nulls last, 2, c.band_id
   limit v_lim;
end $$;
comment on function public.bandchat_rooms(int) is 'bandchat_v1: các nhóm Band của mình (+ nhóm hỗ trợ cho Thầy/Admin)';
revoke all on function public.bandchat_rooms(int) from public, anon;
grant execute on function public.bandchat_rooms(int) to authenticated;

-- Tin của một nhóm, theo seq (luôn trả TĂNG DẦN). Cùng quy ước phân trang với dm_messages.
create or replace function public.bandchat_messages(p_band uuid, p_after_seq bigint default null, p_before_seq bigint default null, p_limit int default 30)
returns table(seq bigint, sender_id uuid, sender_name text, sender_avatar_url text, mine boolean, body text, created_at timestamptz)
language plpgsql security definer set search_path = '' stable as $$
declare v_me uuid := auth.uid(); v_lim int := least(greatest(coalesce(p_limit, 30), 1), 100);
begin
  if v_me is null or public.bandchat_access(p_band) is null then
    raise exception 'Không tìm thấy cuộc trò chuyện' using errcode = 'P0002';
  end if;
  return query
  select z.seq, z.sender_id, i.name, i.avatar_url, (z.sender_id = v_me), z.body, z.created_at
    from (
      select * from (
        select m.seq, m.sender_id, m.body, m.created_at
          from public.bandchat_messages m
         where m.band_id = p_band
           and (p_after_seq is null or m.seq > p_after_seq)
           and (p_before_seq is null or m.seq < p_before_seq)
         order by case when p_after_seq is null then m.seq end desc nulls last, m.seq asc
         limit v_lim) y
    ) z
    left join lateral public.class_public_identity(z.sender_id) i on z.sender_id is not null
   order by z.seq asc;
end $$;
comment on function public.bandchat_messages(uuid, bigint, bigint, int) is 'bandchat_v1: tin của nhóm theo seq';
revoke all on function public.bandchat_messages(uuid, bigint, bigint, int) from public, anon;
grant execute on function public.bandchat_messages(uuid, bigint, bigint, int) to authenticated;

-- Gửi tin: còn là thành viên của Band ĐANG HOẠT ĐỘNG ở thời điểm gửi mới được (lưu trữ / Thầy-Admin không phải thành viên → chỉ đọc)
create or replace function public.bandchat_send(p_band uuid, p_body text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_acc text := public.bandchat_access(p_band);
begin
  if v_me is null or v_acc is null then
    raise exception 'Không tìm thấy cuộc trò chuyện' using errcode = 'P0002';
  end if;
  if v_acc <> 'send' then
    raise exception 'Nhóm này đang ở chế độ chỉ đọc' using errcode = '42501';
  end if;
  return public.bandchat_append(p_band, v_me, p_body);
end $$;
comment on function public.bandchat_send(uuid, text) is 'bandchat_v1: gửi tin vào nhóm Band';
revoke all on function public.bandchat_send(uuid, text) from public, anon;
grant execute on function public.bandchat_send(uuid, text) to authenticated;

-- Đánh dấu đã đọc tới p_seq (chỉ tăng, không vượt tin cuối). Trả last_read_seq mới.
create or replace function public.bandchat_mark_read(p_band uuid, p_seq bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_last bigint; v_read bigint;
begin
  if v_me is null or public.bandchat_access(p_band) is null then
    raise exception 'Không tìm thấy cuộc trò chuyện' using errcode = 'P0002';
  end if;
  -- Thầy/Admin chỉ xem (không phải thành viên/không có ảnh chụp): không tạo trạng thái đọc
  if not exists (select 1 from public.teamlab_band_members m where m.band_id = p_band and m.user_id = v_me)
     and not exists (select 1 from public.bandchat_frozen f where f.band_id = p_band and f.user_id = v_me) then
    return 0;
  end if;
  select r.last_seq into v_last from public.bandchat_rooms r where r.band_id = p_band;
  if v_last is null or v_last = 0 then return 0; end if;
  insert into public.bandchat_reads (band_id, user_id, last_read_seq)
    values (p_band, v_me, least(greatest(coalesce(p_seq, 0), 0), v_last))
    on conflict (band_id, user_id) do update
      set last_read_seq = greatest(public.bandchat_reads.last_read_seq, excluded.last_read_seq)
  returning last_read_seq into v_read;
  return v_read;
end $$;
comment on function public.bandchat_mark_read(uuid, bigint) is 'bandchat_v1: đánh dấu đã đọc';
revoke all on function public.bandchat_mark_read(uuid, bigint) from public, anon;
grant execute on function public.bandchat_mark_read(uuid, bigint) to authenticated;

-- Số nhóm Band còn tin chưa đọc (cho badge) — cùng ngữ nghĩa dm_unread_count (đếm nhóm, không đếm tin). Chỉ nhóm mình là thành viên (hoặc từng là lúc lưu trữ).
create or replace function public.bandchat_unread_count()
returns int language plpgsql security definer set search_path = '' stable as $$
begin
  if auth.uid() is null then return 0; end if;
  return (select count(*)::int
            from (select m.band_id, m.created_at from public.teamlab_band_members m where m.user_id = auth.uid()
                  union all select f.band_id, null from public.bandchat_frozen f where f.user_id = auth.uid()) me
            join public.bandchat_rooms r on r.band_id = me.band_id
            left join public.bandchat_reads rd on rd.band_id = me.band_id and rd.user_id = auth.uid()
           where public.bandchat_access(me.band_id) is not null
             and r.last_seq > coalesce(rd.last_read_seq,
                   (select coalesce(max(x.seq), 0) from public.bandchat_messages x where x.band_id = me.band_id and x.created_at <= coalesce(me.created_at, now()))));
end $$;
comment on function public.bandchat_unread_count() is 'bandchat_v1: số nhóm Band chưa đọc';
revoke all on function public.bandchat_unread_count() from public, anon;
grant execute on function public.bandchat_unread_count() to authenticated;

-- Thành viên của nhóm (tên + ảnh công khai; không email/điện thoại). Band đang hoạt động: thành viên hiện hành; đã lưu trữ: ảnh chụp lúc lưu trữ.
create or replace function public.bandchat_members(p_band uuid)
returns table(user_id uuid, name text, avatar_url text, role text)
language plpgsql security definer set search_path = '' stable as $$
declare v_archived boolean;
begin
  if auth.uid() is null or public.bandchat_access(p_band) is null then
    raise exception 'Không tìm thấy cuộc trò chuyện' using errcode = 'P0002';
  end if;
  select (r.archived_at is not null) into v_archived from public.bandchat_rooms r where r.band_id = p_band;
  return query
  select u.uid, i.name, i.avatar_url, i.role
    from (select m.user_id uid from public.teamlab_band_members m where m.band_id = p_band and not coalesce(v_archived, false)
          union select f.user_id from public.bandchat_frozen f where f.band_id = p_band and coalesce(v_archived, false)) u
    cross join lateral public.class_public_identity(u.uid) i
   order by i.name, u.uid
   limit 200;
end $$;
comment on function public.bandchat_members(uuid) is 'bandchat_v1: thành viên nhóm';
revoke all on function public.bandchat_members(uuid) from public, anon;
grant execute on function public.bandchat_members(uuid) to authenticated;

-- Lưu trữ / khôi phục nhóm (CHỈ Thầy/Admin — móc nối cho chức năng lưu trữ Band của TeamLab).
-- Lưu trữ: chụp thành viên hiện hành → những người đó chỉ đọc; không ai gửi được. Khôi phục: quyền theo thành viên hiện hành. Không xoá tin nào.
create or replace function public.bandchat_set_archived(p_band uuid, p_archived boolean)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare v_at timestamptz;
begin
  if auth.uid() is null or not public.is_teacher() then raise exception 'Không có quyền' using errcode = '42501'; end if;
  if p_band is null then raise exception 'Thiếu Band' using errcode = '22023'; end if;
  if coalesce(p_archived, false) then
    if not exists (select 1 from public.teamlab_bands b where b.id = p_band) then
      raise exception 'Không tìm thấy Band' using errcode = 'P0002';
    end if;
    insert into public.bandchat_rooms (band_id) values (p_band) on conflict (band_id) do nothing;
    perform 1 from public.bandchat_rooms where band_id = p_band for update;
    insert into public.bandchat_frozen (band_id, user_id)
      select p_band, m.user_id from public.teamlab_band_members m where m.band_id = p_band
      on conflict do nothing;
    update public.bandchat_rooms
       set archived_at = coalesce(archived_at, now()), archived_by = coalesce(archived_by, auth.uid()),
           name_snapshot = (select b.name from public.teamlab_bands b where b.id = p_band)
     where band_id = p_band returning archived_at into v_at;
    return v_at;
  end if;
  perform 1 from public.bandchat_rooms where band_id = p_band for update;
  delete from public.bandchat_frozen where band_id = p_band;
  update public.bandchat_rooms set archived_at = null, archived_by = null where band_id = p_band;
  return null;
end $$;
comment on function public.bandchat_set_archived(uuid, boolean) is 'bandchat_v1: lưu trữ/khôi phục nhóm (Thầy/Admin)';
revoke all on function public.bandchat_set_archived(uuid, boolean) from public, anon;
grant execute on function public.bandchat_set_archived(uuid, boolean) to authenticated;

-- N) Bảng — đặt CUỐI, MỘT câu lệnh (khoá ngoại tới auth.users xin khoá ngắn nhất có thể; hàm ở trên là plpgsql/sql lười nên tạo trước được)
do $tables$
begin
create table if not exists public.bandchat_rooms (
  band_id         uuid primary key,
  last_seq        bigint not null default 0,
  last_message_at timestamptz,
  created_at      timestamptz not null default now(),
  archived_at     timestamptz,                 -- Band lưu trữ → chỉ đọc cho người trong bandchat_frozen (+ Thầy/Admin)
  archived_by     uuid,
  name_snapshot   text                         -- tên Band lần cuối thấy (hiện khi Band đã bị xoá)
);

create table if not exists public.bandchat_messages (
  band_id    uuid not null references public.bandchat_rooms(band_id),
  seq        bigint not null,
  sender_id  uuid references auth.users(id) on delete set null,
  body       text not null,
  created_at timestamptz not null default now(),
  primary key (band_id, seq),
  constraint bandchat_messages_body_check check (char_length(body) between 1 and 2000)
);

create table if not exists public.bandchat_reads (
  band_id       uuid not null references public.bandchat_rooms(band_id),
  user_id       uuid not null references auth.users(id) on delete cascade,
  last_read_seq bigint not null default 0,
  primary key (band_id, user_id)
);
create index if not exists bandchat_reads_user_idx on public.bandchat_reads (user_id);

-- Ảnh chụp thành viên lúc lưu trữ (xoá khi khôi phục)
create table if not exists public.bandchat_frozen (
  band_id uuid not null references public.bandchat_rooms(band_id),
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (band_id, user_id)
);
create index if not exists bandchat_frozen_user_idx on public.bandchat_frozen (user_id);

comment on table public.bandchat_rooms is 'bandchat_v1: một phòng cho mỗi Band (band_id không có FK: xoá Band không xoá lịch sử)';
comment on table public.bandchat_messages is 'bandchat_v1: tin nhắn text của nhóm Band';
comment on table public.bandchat_reads is 'bandchat_v1: last_read_seq theo (band, người)';
comment on table public.bandchat_frozen is 'bandchat_v1: thành viên lúc Band được lưu trữ';

alter table public.bandchat_rooms enable row level security;
alter table public.bandchat_messages enable row level security;
alter table public.bandchat_reads enable row level security;
alter table public.bandchat_frozen enable row level security;
revoke all on public.bandchat_rooms from public, anon, authenticated;
revoke all on public.bandchat_messages from public, anon, authenticated;
revoke all on public.bandchat_reads from public, anon, authenticated;
revoke all on public.bandchat_frozen from public, anon, authenticated;
end $tables$;

notify pgrst, 'reload schema';
