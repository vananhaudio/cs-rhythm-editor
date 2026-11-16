-- CLASS ROOM CHAT V1.1 — Thầy/Admin thấy MỌI lớp còn hoạt động ở mục Hỗ trợ (kể cả lớp chưa có phòng/chưa có tin).
-- Lỗi V1: danh sách hỗ trợ chỉ gồm phòng đã có tin (classchat_rooms.last_seq > 0) → Owner (admin, không thuộc lớp nào) thấy tab "Lớp học" trống.
-- Band V1.2 đã sửa y hệt (bandchat_rooms thêm mọi Band cho Thầy/Admin). Chỉ vá MỘT mệnh đề union trong 2 hàm hiện hành
-- (classchat_rooms, chat_inbox_base) — KHÔNG đổi quyền (classchat_access giữ nguyên), KHÔNG bảng/dữ liệu, KHÔNG tạo phòng để hiển thị.
-- Lớp nháp/đã huỷ không tự hiện (chỉ hiện khi đã có tin, như V1). Idempotent. Chạy bằng scripts/prod-db.py (KHÔNG begin/commit).

do $m$
declare
  r record; d text; v_old text; v_new text; k int := 0;
begin
  if to_regprocedure('public.classchat_rooms(int)') is null or to_regprocedure('public.chat_inbox_base(text)') is null
     or to_regprocedure('public.classchat_access(uuid)') is null then
    raise exception 'DỪNG — chưa cài Class Room Chat V1 (setup + inbox)';
  end if;
  for r in select * from (values
      ('public.classchat_rooms(int)'::regprocedure, $f$union select rr.class_id from public.classchat_rooms rr where v_teacher and rr.last_seq > 0) c$f$,
       $f$union select cs2.id from public.class_schedule cs2 where v_teacher and coalesce(cs2.status, '') not in ('draft', 'cancelled')
          union select rr.class_id from public.classchat_rooms rr where v_teacher and rr.last_seq > 0) c$f$),
      ('public.chat_inbox_base(text)'::regprocedure, $f$union select rr.class_id from public.classchat_rooms rr where p_scope = 'support' and rr.last_seq > 0) c$f$,
       $f$union select cs2.id from public.class_schedule cs2 where p_scope = 'support' and coalesce(cs2.status, '') not in ('draft', 'cancelled')
          union select rr.class_id from public.classchat_rooms rr where p_scope = 'support' and rr.last_seq > 0) c$f$)
    ) as t(fn, o, n)
  loop
    d := pg_get_functiondef(r.fn); v_old := r.o; v_new := r.n;
    if position(v_new in d) > 0 then continue; end if;           -- đã vá (chạy lại)
    if (length(d) - length(replace(d, v_old, ''))) <> length(v_old) then
      raise exception 'DỪNG — thân hàm % không còn đúng bản V1 (drift), không vá', r.fn;
    end if;
    execute replace(d, v_old, v_new);
    k := k + 1;
  end loop;
  raise notice 'classchat_v1_1: đã vá % hàm', k;
end $m$;

notify pgrst, 'reload schema';
