-- ROLLBACK Class Room Chat V1.1 — trả classchat_rooms + chat_inbox_base về bản V1 (chỉ danh sách hỗ trợ có tin). Không đụng dữ liệu. Idempotent.
do $m$
declare r record; d text;
begin
  for r in select * from (values
      ('public.classchat_rooms(int)'::regprocedure, $f$union select cs2.id from public.class_schedule cs2 where v_teacher and coalesce(cs2.status, '') not in ('draft', 'cancelled')
          $f$),
      ('public.chat_inbox_base(text)'::regprocedure, $f$union select cs2.id from public.class_schedule cs2 where p_scope = 'support' and coalesce(cs2.status, '') not in ('draft', 'cancelled')
          $f$)) as t(fn, frag)
  loop
    d := pg_get_functiondef(r.fn);
    if position(r.frag in d) > 0 then execute replace(d, r.frag, ''); end if;
  end loop;
end $m$;
notify pgrst, 'reload schema';
