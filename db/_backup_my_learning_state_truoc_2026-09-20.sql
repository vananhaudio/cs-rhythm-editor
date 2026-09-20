CREATE OR REPLACE FUNCTION public.my_learning_state()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_student record;
  v_student_id uuid := null;
  v_is_teacher boolean := false;
  v_tier text := 'free';           -- entitlement tier: free|khoi_dau_99|can_ban_396|nang_cao_499
  v_tier_idx int := 0;
  v_ht_member boolean := false;
  v_mode text := coalesce((select value from app_config where key = 'learning_state_mode'), 'server');
  v_completed uuid[] := '{}';
  v_completed_codes text[] := '{}';
  v_courses jsonb;
  v_tracks jsonb;
  v_tools jsonb;
begin
  -- ── Danh tính ──
  if v_uid is not null then
    v_is_teacher := coalesce(public.is_teacher(), false);
    select s.* into v_student from edu_students s
      where s.user_id = v_uid
         or (s.email is not null and lower(s.email) = lower(coalesce((select u.email from auth.users u where u.id = v_uid), '')))
      order by (s.user_id = v_uid) desc limit 1;
    if v_student.id is not null then
      v_student_id := v_student.id;
      v_ht_member := coalesce(v_student.ht_member, false);
      -- effective tier = max(entitlement RPC, level legacy) — y hệt client cũ
      select coalesce(
        (select case e.effective_tier
           when 'khoi_dau_99' then 'khoi_dau_99' when 'can_ban_396' then 'can_ban_396'
           when 'nang_cao_499' then 'nang_cao_499'
           when 'basic' then 'khoi_dau_99' when 'standard' then 'can_ban_396' when 'pro' then 'nang_cao_499'
           else 'free' end
         from public.get_effective_student_entitlement(v_student.id) e limit 1), 'free')
      into v_tier;
      v_tier_idx := array_position(array['free','khoi_dau_99','can_ban_396','nang_cao_499'], v_tier) - 1;
      select coalesce(array_agg(lesson_id), '{}') into v_completed
        from edu_lesson_progress where student_id = v_student.id and status = 'completed';
    end if;
  end if;

  -- ── Mã năng lực đã hoàn thành (mọi bài của khoá xong) — cho prereq hành trình ──
  select coalesce(array_agg(x.code), '{}') into v_completed_codes from (
    select upper(trim(c.code)) as code
    from edu_courses c
    join edu_modules m on m.course_id = c.id
    join edu_course_lessons l on l.module_id = m.id
    where c.code is not null and trim(c.code) <> ''
    group by c.id, c.code
    having count(*) > 0 and count(*) = count(*) filter (where l.id = any(v_completed))
  ) x;

  -- ── Courses + modules + lessons: quyết định visible/access/reason từng cấp ──
  with course_src as (
    select c.*,
      jc.subject, jc.level as j_level, jc.sort_order as j_order,
      public.has_course_access(v_student_id,c.id) as enrolled,
      public.has_course_access(v_student_id,c.id) as granted
    from edu_courses c
    left join journey_curriculum jc on jc.course_id = c.id
  ),
  course_resolved as (
    select cs.*,
      -- policy mới (access_policy_enabled) ưu tiên; không thì luật legacy — port từ resolveCourseAccess
      case when coalesce(cs.access_policy_enabled, false)
           then coalesce(cs.visibility, 'visible') = 'visible'
           else coalesce(cs.status, 'on') <> 'off' end as r_visible,
      case when coalesce(cs.access_policy_enabled, false)
           then coalesce(cs.availability, 'available') = 'available'
           else coalesce(cs.status, 'on') <> 'coming_soon' end as r_available,
      case when coalesce(cs.access_policy_enabled, false)
           then greatest(coalesce(array_position(array['free','khoi_dau_99','can_ban_396','nang_cao_499'],
                  case coalesce(cs.required_tier, 'free')
                    when 'basic' then 'khoi_dau_99' when 'standard' then 'can_ban_396' when 'pro' then 'nang_cao_499'
                    when 'khoi_dau_99' then 'khoi_dau_99' when 'can_ban_396' then 'can_ban_396' when 'nang_cao_499' then 'nang_cao_499'
                    else 'free' end), 1) - 1, 0)
           else case when cs.is_free = false then 1 else 0 end end as req_idx,
      (v_is_teacher or cs.enrolled or cs.granted or coalesce(cs.is_free, true) is not false) as legacy_unlocked,
      -- prereq hành trình (chỉ áp cho học viên HT). QUAN TRỌNG: tiên quyết chỉ chặn
      -- BƯỚC VÀO khoá mới — KHÔNG chặn khoá học viên đã ghi danh / được cấp quyền /
      -- ĐÃ HỌC DỞ (có bài hoàn thành trong khoá). Fix bug "đã học xong bài trước
      -- vẫn bị đòi hoàn thành" (học viên lớp HT học DH2 trực tiếp khi DH1 chưa xong).
      case when v_ht_member and cs.code is not null
                and not (cs.enrolled or cs.granted)
                and not exists (
                  select 1 from edu_lesson_progress p
                  join edu_course_lessons l2 on l2.id = p.lesson_id
                  join edu_modules m2 on m2.id = l2.module_id
                  where m2.course_id = cs.id and p.student_id = v_student_id and p.status = 'completed')
           then
        coalesce((select array(select r from unnest(p.requires) r where r <> 'NM' and not (r = any(v_completed_codes)))
                  from course_prereqs p where p.code = upper(trim(cs.code))), '{}')
      else '{}' end as missing_prereqs
    from course_src cs
  )
  select jsonb_agg(
    jsonb_build_object(
      'id', cr.id, 'name', cr.name, 'code', cr.code, 'track', cr.track,
      'type', cr.type, 'icon', cr.icon, 'image_url', cr.image_url,
      'sort_order', cr.sort_order, 'status', cr.status, 'is_free', cr.is_free,
      'subject', cr.subject, 'level', cr.j_level, 'journey_order', cr.j_order,
      'enrolled', cr.enrolled, 'granted', cr.granted,
      'source', case when v_is_teacher then 'teacher' when cr.enrolled then 'enrollment'
                     when cr.granted then 'grant' when coalesce(cr.is_free, true) then 'free' else 'public' end,
      'visible', cr.r_visible,
      'access', case
        when not cr.r_visible then 'hidden'
        when not cr.r_available then 'coming_soon'
        when array_length(cr.missing_prereqs, 1) > 0 then 'prereq'
        when v_is_teacher or cr.legacy_unlocked or v_tier_idx >= cr.req_idx then 'open'
        else 'upgrade' end,
      'missing_prereqs', to_jsonb(cr.missing_prereqs),
      'completed', (cr.code is not null and upper(trim(cr.code)) = any(v_completed_codes)),
      'modules', coalesce((
        select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'order_index', m.order_index, 'level', m.level,
                                            'is_free', coalesce(m.is_free, false))
               order by m.order_index)
        from edu_modules m where m.course_id = cr.id), '[]'::jsonb),
      'lessons', coalesce((
        select jsonb_agg(jsonb_build_object(
            'id', l.id, 'module_id', l.module_id, 'title', l.title,
            'order_index', l.order_index, 'lesson_type', l.lesson_type, 'content_url', l.content_url,
            'visible', case when coalesce(cr.access_policy_enabled, false) and coalesce(l.access_policy_mode, 'inherit') = 'override'
                            then coalesce(l.visibility, 'visible') = 'visible' else cr.r_visible end,
            'completed', (l.id = any(v_completed)),
            -- Cờ FREE cho UI badge "MIỄN PHÍ" (chương free / bài free / khoá free)
            'free', (coalesce(m.is_free, false)
              or case when coalesce(cr.access_policy_enabled, false)
                   then case when coalesce(l.access_policy_mode, 'inherit') = 'override'
                          then coalesce(l.required_tier, 'free') = 'free'
                               and coalesce(l.visibility, 'visible') = 'visible'
                               and coalesce(l.availability, 'available') = 'available'
                          else coalesce(cr.required_tier, 'free') = 'free' end
                   else coalesce(cr.is_free, true) or coalesce(l.tier, 'free') = 'free' end),
            'access', case
              when not cr.r_visible then 'hidden'
              when not cr.r_available then 'coming_soon'
              when array_length(cr.missing_prereqs, 1) > 0 then 'prereq'
              when v_is_teacher then 'open'
              -- CHƯƠNG FREE (edu_modules.is_free) → mở mọi bài trong chương (Admin quyết,
              -- db/free_content_setup.sql) — TRỪ bài Admin đã override ẩn/sắp có.
              when coalesce(m.is_free, false)
                   and not (coalesce(cr.access_policy_enabled, false)
                            and coalesce(l.access_policy_mode, 'inherit') = 'override'
                            and (coalesce(l.visibility, 'visible') <> 'visible'
                                 or coalesce(l.availability, 'available') <> 'available'))
                then 'open'
              -- lesson override policy
              when coalesce(cr.access_policy_enabled, false) and coalesce(l.access_policy_mode, 'inherit') = 'override' then
                case when coalesce(l.visibility, 'visible') <> 'visible' then 'hidden'
                     when coalesce(l.availability, 'available') <> 'available' then 'coming_soon'
                     when v_tier_idx >= greatest(coalesce(array_position(array['free','khoi_dau_99','can_ban_396','nang_cao_499'],
                            case coalesce(l.required_tier, 'free')
                              when 'basic' then 'khoi_dau_99' when 'standard' then 'can_ban_396' when 'pro' then 'nang_cao_499'
                              when 'khoi_dau_99' then 'khoi_dau_99' when 'can_ban_396' then 'can_ban_396' when 'nang_cao_499' then 'nang_cao_499'
                              else 'free' end), 1) - 1, 0)
                          or cr.legacy_unlocked then 'open'
                     else 'upgrade' end
              -- kế thừa: luật legacy theo lesson.tier — port từ resolveLessonAccess nhánh legacy
              when not coalesce(cr.access_policy_enabled, false) then
                case when cr.legacy_unlocked
                          or v_tier_idx >= greatest(coalesce(array_position(array['free','khoi_dau_99','can_ban_396','nang_cao_499'],
                               case coalesce(l.tier, case when cr.is_free = false then 'basic' else 'free' end)
                                 when 'basic' then 'khoi_dau_99' when 'standard' then 'can_ban_396' when 'pro' then 'nang_cao_499'
                                 else 'free' end), 1) - 1, 0)
                     then 'open' else 'upgrade' end
              when cr.legacy_unlocked or v_tier_idx >= cr.req_idx then 'open'
              else 'upgrade' end
          ) order by m.order_index, l.order_index)
        from edu_course_lessons l join edu_modules m on m.id = l.module_id
        where m.course_id = cr.id), '[]'::jsonb)
    ) order by coalesce(cr.j_order, 9000 + coalesce(cr.sort_order, 99)))
  into v_courses
  from course_resolved cr
  where cr.r_visible or v_is_teacher;

  select jsonb_agg(jsonb_build_object('key', t.key, 'title', t.title, 'hint', t.hint) order by t.sort_order)
    into v_tracks from journey_tracks t;

  select jsonb_object_agg(t.id, coalesce(t.enabled, true) and (v_is_teacher or v_tier_idx >= case coalesce(t.tier,'free') when 'basic' then 1 when 'standard' then 2 when 'pro' then 3 else 0 end)) into v_tools from edu_tools t;

  -- Không gửi URL nội dung của bài đang khóa trong metadata công khai.
  select coalesce(jsonb_agg(jsonb_set(c,'{lessons}',
    (select coalesce(jsonb_agg(case when l->>'access'='open' then l else jsonb_set(l,'{content_url}','null'::jsonb) end),'[]'::jsonb)
     from jsonb_array_elements(c->'lessons') l))),'[]'::jsonb)
  into v_courses from jsonb_array_elements(coalesce(v_courses,'[]'::jsonb)) c;

  return jsonb_build_object(
    'enabled', v_mode = 'server',
    'mode', case when v_is_teacher then 'teacher' when v_student_id is not null then 'student' else 'guest' end,
    'student_id', v_student_id,
    'effective_tier', v_tier,
    'ht_member', v_ht_member,
    'tracks', coalesce(v_tracks, '[]'::jsonb),
    'courses', coalesce(v_courses, '[]'::jsonb),
    'completed_lesson_ids', to_jsonb(v_completed),
    'flags', jsonb_build_object('tools', coalesce(v_tools, '{}'::jsonb)),
    'valid_until', (select min(boundary) from (select ends_at as boundary from public.student_entitlement_sources where student_id=v_student_id and ends_at>now() union all select renews_at from public.student_packages where student_id=v_student_id and renews_at>now() union all select starts_at from public.student_packages where student_id=v_student_id and starts_at>now()) b),
    'generated_at', now()
  );
end $function$

