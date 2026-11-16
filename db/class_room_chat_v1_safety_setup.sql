-- CLASS ROOM CHAT V1 — AN TOÀN NỘI DUNG (chạy SAU db/class_room_chat_v1_setup.sql). ADDITIVE: hàm + trigger MỚI tiền tố classchat_;
-- KHÔNG sửa class_ugc_guard_write / class_report_submit / bandchat_* — chỉ GỌI các helper có sẵn của class_ugc_safety_v1.
--   • Trigger classchat_guard_write (trên classchat_messages): cùng luật Band chat — Thầy/Admin miễn; học viên bị đình chỉ → account_suspended (UGC03);
--     từ cấm → ugc_blocked (UGC01). Chặn người (pair_blocked) KHÔNG chặn gửi vào phòng nhóm (như Band), chỉ ẩn tin ở người đọc.
--   • classchat_messages_safe: classchat_messages đã lọc tin của người mình chặn / chặn mình (cùng quy ước phân trang bandchat_messages_safe).
--   • Báo cáo TIN trong phòng lớp: chưa có (class_report_submit/class_reports.kind là hạ tầng dùng chung — mở rộng là thay đổi riêng, cần Owner duyệt).
--     V1: người dùng báo cáo/chặn NGƯỜI GỬI qua kind 'profile' + class_block_user có sẵn.

do $gate$
begin
  if to_regclass('public.classchat_messages') is null or to_regprocedure('public.classchat_messages(uuid,bigint,bigint,integer)') is null then
    raise exception 'DỪNG — chưa cài Class Room Chat V1 (db/class_room_chat_v1_setup.sql)';
  end if;
  if to_regprocedure('public.class_ugc_text_blocked(text)') is null or to_regprocedure('public.class_ugc_pair_blocked(uuid,uuid)') is null
     or to_regclass('public.edu_students') is null then
    raise exception 'DỪNG — thiếu nền an toàn UGC (class_ugc_safety_v1)';
  end if;
end $gate$;

create or replace function public.classchat_guard_write()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.sender_id is null then return new; end if;
  if exists (select 1 from public.app_users au where au.id = new.sender_id and au.role in ('teacher', 'admin')) then return new; end if;
  if exists (select 1 from public.edu_students s where s.user_id = new.sender_id and s.blocked_at is not null) then
    raise exception 'account_suspended' using errcode = 'UGC03', hint = 'Tài khoản đang bị tạm dừng tương tác';
  end if;
  if public.class_ugc_text_blocked(new.body) then
    raise exception 'ugc_blocked' using errcode = 'UGC01', hint = 'Nội dung chưa phù hợp với quy tắc cộng đồng';
  end if;
  return new;
end $$;
comment on function public.classchat_guard_write() is 'classchat_v1: trigger chặn ghi (đình chỉ / từ cấm)';
revoke all on function public.classchat_guard_write() from public, anon, authenticated;

drop trigger if exists classchat_guard_ins on public.classchat_messages;
create trigger classchat_guard_ins before insert on public.classchat_messages for each row execute function public.classchat_guard_write();

create or replace function public.classchat_messages_safe(p_class uuid, p_after_seq bigint default null, p_before_seq bigint default null, p_limit int default 30)
returns table(seq bigint, sender_id uuid, sender_name text, sender_avatar_url text, mine boolean, body text, created_at timestamptz)
language plpgsql security definer set search_path = '' stable as $$
declare
  v_me uuid := auth.uid(); v_lim int := least(greatest(coalesce(p_limit, 30), 1), 100);
  v_after bigint := p_after_seq; v_before bigint := p_before_seq; v_kept jsonb := '[]'::jsonb; v_page jsonb; v_flt jsonb; v_raw int; i int;
begin
  for i in 1..5 loop
    select coalesce(jsonb_agg(to_jsonb(m) order by m.seq), '[]'::jsonb), count(*)::int into v_page, v_raw
      from public.classchat_messages(p_class, v_after, v_before, v_lim) m;
    exit when v_raw = 0;
    select coalesce(jsonb_agg(j order by (j ->> 'seq')::bigint), '[]'::jsonb) into v_flt
      from jsonb_array_elements(v_page) j
     where not public.class_ugc_pair_blocked(v_me, nullif(j ->> 'sender_id', '')::uuid);
    if p_after_seq is not null then
      v_kept := v_kept || v_flt; v_after := (v_page -> (v_raw - 1) ->> 'seq')::bigint;
    else
      v_kept := v_flt || v_kept; v_before := (v_page -> 0 ->> 'seq')::bigint;
    end if;
    exit when v_raw < v_lim or jsonb_array_length(v_kept) >= v_lim;
  end loop;
  if p_after_seq is not null then
    return query
    select x.seq, x.sender_id, x.sender_name, x.sender_avatar_url, x.mine, x.body, x.created_at
      from jsonb_to_recordset(v_kept) as x(seq bigint, sender_id uuid, sender_name text, sender_avatar_url text, mine boolean, body text, created_at timestamptz)
     order by x.seq asc limit v_lim;
  else
    return query
    select z.seq, z.sender_id, z.sender_name, z.sender_avatar_url, z.mine, z.body, z.created_at
      from (select x.* from jsonb_to_recordset(v_kept) as x(seq bigint, sender_id uuid, sender_name text, sender_avatar_url text, mine boolean, body text, created_at timestamptz)
             order by x.seq desc limit v_lim) z
     order by z.seq asc;
  end if;
end $$;
comment on function public.classchat_messages_safe(uuid, bigint, bigint, int) is 'classchat_v1: classchat_messages đã lọc tin người chặn/bị chặn';
revoke all on function public.classchat_messages_safe(uuid, bigint, bigint, int) from public, anon;
grant execute on function public.classchat_messages_safe(uuid, bigint, bigint, int) to authenticated;

notify pgrst, 'reload schema';
