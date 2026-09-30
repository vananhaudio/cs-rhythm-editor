-- ═══════════════════════════════════════════════════════════════════════════
-- CLASS SOCIAL — LEARNING IDENTITY V1 ("Danh tính học tập") — CHỈ ĐỌC, KHÔNG BẢNG MỚI. Idempotent.
-- Thiết kế: docs/SOCIAL-LEARNING-IDENTITY-V1.md. Rollback: db/social_learning_identity_v1_rollback.sql.
--
-- MỘT hàm đọc: social_learning_identities(p_users uuid[]) → mỗi người: các LỚP họ đang là thành viên
-- (ĐÚNG luật thành viên của Lớp học V1 = social_class_members_of) + trạng thái lớp + khoá chính + mã chương trình.
-- Nhãn thân thiện / gộp trùng / Đang học · Sắp học · Đã tốt nghiệp / bậc hiển thị do MỘT helper client suy ra
-- (src/class-social/identity/learningIdentity.ts) — DB chỉ trả sự thật, không đặt tên.
--   • Lấy lớp ở mọi trạng thái trừ cancelled · merged · draft. Client quyết Đang học / Sắp học / Đã tốt nghiệp theo
--     status + NGÀY (preflight production 30/09: status thường KHÔNG được cập nhật — lớp đã học vẫn 'upcoming',
--     lớp đã xong vẫn 'ending_soon') → trả start_date + end_date.
--   • Hành trình: ngoài nhóm lớp, cờ edu_students.ht_member (nguồn "Lớp Hành trình" Social đang dùng, hàng hồ sơ mới
--     nhất như class_public_identity) gắn người đó vào lớp Hành trình (program_code HTyyyy) ĐANG DIỄN RA.
--   • Thầy/admin: không có danh tính học sinh (thành viên nhóm để quản lý lớp, không phải học).
--   • Chỉ thông tin lớp công khai trong Class (mã/tên lớp, khoá) — không tiến độ, không gói, không email/SĐT.
--   • Không đụng Learning Thread (danh tính LỊCH SỬ của thread là chuyện khác, không đổi).
-- CHẠY: dán NGUYÊN FILE vào Supabase SQL Editor — file tự mở/đóng MỘT giao dịch.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- ── 0) Cổng phụ thuộc ─────────────────────────────────────────────────────────
do $gate$
declare
  fn_expected constant jsonb := '{"is_class_member": ["459786921eb5bbd4ff07c83bdb4db480"], "social_class_is_member": ["85167bc26d7c87dfbd7227b2b9687411"], "social_class_members_of": ["b434c0e8478ec8ed62c004fffe6668d0"]}';
  col_required constant jsonb := '{"app_users": ["id", "role"], "class_schedule": ["id", "code", "name", "status", "program_code", "start_date", "end_date", "main_course_id", "cohort_group_id", "group_id"], "edu_courses": ["id", "code", "name", "track"], "edu_group_members": ["user_id", "group_id", "status"], "edu_groups": ["id", "code"], "edu_students": ["user_id", "ht_member", "enrolled_at"]}';
  k text; allowed jsonb; actual text; c text; drift text[] := '{}';
begin
  for k, allowed in select * from jsonb_each(fn_expected) loop
    select string_agg(md5(p.prosrc), ',') into actual from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = k;
    if actual is null then drift := drift || format('thiếu hàm %s', k);
    elsif not allowed ? actual then drift := drift || format('hàm %s (md5 %s)', k, actual); end if;
  end loop;
  for k, allowed in select * from jsonb_each(col_required) loop
    for c in select jsonb_array_elements_text(allowed) loop
      if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = k and column_name = c) then
        drift := drift || format('thiếu cột %s.%s', k, c);
      end if;
    end loop;
  end loop;
  if cardinality(drift) > 0 then
    raise exception 'DỪNG — production khác repo, KHÔNG migration: %', array_to_string(drift, '; ')
      using hint = 'Chạy db/social_learning_identity_v1_preflight.sql, gửi kết quả cho người review.';
  end if;
end $gate$;

-- ── 1) Danh tính học tập của nhiều người một lần (tối đa 200) — không N+1 trên Feed ────────────
create or replace function public.social_learning_identities(p_users uuid[])
returns table(user_id uuid, memberships jsonb)
language sql stable security definer set search_path = '' as $$
  with u as (
    select distinct x as uid
    from unnest((coalesce(p_users, '{}'::uuid[]))[1:200]) x
    where x is not null and public.is_class_member()
      and not exists (select 1 from public.app_users a where a.id = x and a.role in ('teacher', 'admin'))
  ),
  m as (   -- ĐÚNG luật social_class_members_of: nhóm cohort | nhóm gắn lớp | nhóm cùng mã lớp, thành viên active
    select distinct gm.user_id as uid, cs.id as class_id
    from u
    join public.edu_group_members gm on gm.user_id = u.uid and gm.status = 'active'
    join public.edu_groups g on g.id = gm.group_id
    join public.class_schedule cs on g.id = cs.cohort_group_id or g.id = cs.group_id
                                  or (g.code is not null and cs.code is not null and upper(g.code) = upper(cs.code))
    where cs.status in ('active', 'ending_soon', 'paused', 'recruiting', 'ready_to_open', 'scheduled', 'upcoming', 'completed')
  ),
  ht as (  -- cờ Hành trình → lớp Hành trình ĐANG DIỄN RA (đã bắt đầu, chưa kết thúc; không gắn vào khoá HT chưa mở)
    select u.uid, cs.id as class_id
    from u
    cross join lateral (select es.ht_member from public.edu_students es where es.user_id = u.uid
                        order by es.enrolled_at desc nulls last limit 1) s
    join public.class_schedule cs on cs.program_code ~ '^HT[0-9]{4}$'
      and (cs.status in ('active', 'ending_soon', 'paused')
           or (cs.status in ('recruiting', 'ready_to_open', 'scheduled', 'upcoming') and cs.start_date <= current_date))
      and (cs.end_date is null or cs.end_date >= current_date)
    where coalesce(s.ht_member, false)
  ),
  mm as (select uid, class_id from m union select uid, class_id from ht)
  select u.uid,
         coalesce(jsonb_agg(jsonb_build_object(
           'class_id', cs.id, 'class_code', cs.code, 'class_name', cs.name, 'status', cs.status,
           'program_code', cs.program_code, 'start_date', cs.start_date, 'end_date', cs.end_date,
           'course_code', c.code, 'course_name', c.name, 'track', c.track)
           order by cs.start_date desc nulls last, cs.id) filter (where cs.id is not null), '[]'::jsonb)
  from u
  left join mm on mm.uid = u.uid
  left join public.class_schedule cs on cs.id = mm.class_id
  left join public.edu_courses c on c.id = cs.main_course_id
  group by u.uid;
$$;

revoke all on function public.social_learning_identities(uuid[]) from public, anon;
grant execute on function public.social_learning_identities(uuid[]) to authenticated;

notify pgrst, 'reload schema';
commit;
