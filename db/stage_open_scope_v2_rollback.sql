-- Hoàn tác STAGE_OPEN_SCOPE_V2: trả session_needs_stage_open về bản STAGE_OPEN_V1 (áp cho MỌI lớp có khai chặng).
-- GIỮ bảng stage_open_program (không còn được đọc). Không đụng khoá / bản ghi mở / tiến độ.
set local lock_timeout = '5s';

create or replace function tva_private.session_needs_stage_open(p_session uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select coalesce(c.unlock_policy, 'sequential') <> 'open'
       and tva_private.session_stage_id(s.id) is not null
       and exists (select 1 from public.class_sessions e where e.class_id = s.class_id and e.event_type = 'lesson'
                    and e.session_number >= 1 and e.session_number < s.session_number)
       and not exists (select 1 from public.class_sessions e where e.class_id = s.class_id and e.event_type = 'lesson'
                    and e.session_number >= 1 and e.session_number < s.session_number
                    and tva_private.session_stage_id(e.id) = tva_private.session_stage_id(s.id))
       and exists (select 1 from public.class_sessions x join public.class_lesson_content lc on lc.session_id = x.id
                    where x.class_id = s.class_id and x.event_type = 'lesson' and lc.status = 'published'
                      and lc.blocks @> '[{"kind":"checkpoint"}]'::jsonb)
      from public.class_sessions s join public.class_schedule c on c.id = s.class_id
     where s.id = p_session and s.event_type = 'lesson' and s.session_number >= 1), false);
$$;
revoke all on function tva_private.session_needs_stage_open(uuid) from public, anon, authenticated;
