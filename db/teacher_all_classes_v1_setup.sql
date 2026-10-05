-- TEACHER ALL CLASSES V1 — Thầy/admin thấy TẤT CẢ lớp ở /me/classes bằng QUYỀN (is_teacher), không bằng membership.
-- Chạy bằng scripts/prod-db.py (một transaction; file không có begin/commit). Idempotent. ADDITIVE:
--   • Chỉ thêm MỘT RPC đọc. Không đổi social_my_classes / social_discover_classes / membership / tiến độ / giáo trình.
--   • Capability = public.is_teacher() (app_users.role in teacher/admin) — cùng hàm mọi RPC lớp/giáo trình đang dùng
--     (class_learning_state, class_learning_entry, social_class_members, RLS class_lesson_content_teacher_all).
--   • Cùng bộ lọc với social_my_classes / social_class_detail (bỏ cancelled/merged/draft) → mọi lớp trong danh sách
--     đều mở được; lớp mới tạo tự xuất hiện (đọc thẳng class_schedule, không danh sách cứng).

do $gate$
declare v_comment text := (select coalesce(obj_description(p.oid, 'pg_proc'), '') from pg_proc p join pg_namespace s on s.oid = p.pronamespace
                             where s.nspname = 'public' and p.proname = 'social_all_classes');
begin
  if to_regprocedure('public.is_teacher()') is null or to_regprocedure('public.social_class_card(uuid)') is null then
    raise exception 'DỪNG — thiếu is_teacher() / social_class_card(uuid)';
  end if;
  if v_comment is not null and v_comment not like 'teacher_all_classes_v1:%' then
    raise exception 'DỪNG — đã có hàm social_all_classes không thuộc Teacher All Classes V1';
  end if;
end $gate$;

create or replace function public.social_all_classes()
returns setof jsonb
language plpgsql security definer set search_path = '' stable as $$
begin
  if not coalesce(public.is_teacher(), false) then
    raise exception 'SC_TEACHER_ONLY' using errcode = '42501';
  end if;
  return query
  select public.social_class_card(cs.id)
  from public.class_schedule cs
  where coalesce(cs.status, '') not in ('cancelled', 'merged', 'draft')
  order by (cs.status in ('active', 'ending_soon')) desc, cs.start_date desc nulls last, cs.name, cs.id;
end $$;
comment on function public.social_all_classes() is 'teacher_all_classes_v1: Thầy/admin — mọi lớp (bỏ huỷ/gộp/nháp), quyền is_teacher()';
revoke all on function public.social_all_classes() from public, anon;
grant execute on function public.social_all_classes() to authenticated;

notify pgrst, 'reload schema';
