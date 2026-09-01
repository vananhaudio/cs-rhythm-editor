-- FIRST-SESSION REMINDER (Email 3) — vòng 11
-- Nhắc buổi học đầu tiên trước 1–4 ngày, chỉ khi resolve được buổi thật từ class_sessions.
-- Pattern: cron pg_cron mỗi sáng 06:00 → queue_first_session_reminders() → queue_mail
-- (security definer, tự gọi http_post mail-worker như trigger Email 1/2).
--
-- Quyết định thiết kế:
--  - Chỉ gửi cho học viên class/both (có class_name + student_id + buổi thật sắp tới).
--  - Học viên practice-only KHÔNG gửi Email 3 (buổi thực hành tự chọn, không có
--    "buổi đầu tiên" cố định — Email 2 đã dẫn tới lịch thực hành).
--  - Không gửi nếu chưa resolve được buổi thật (không dùng fallback "theo lịch đã
--    thông báo" cho cron — tránh email vô nghĩa; preview/resend vẫn cho phép).
--  - NOT EXISTS chặn queue lại sau khi đã có row (sent/failed) → không spam;
--    gửi lại tay qua mail_resend (Admin).
--  - Idempotency: unique (mail_type, lead_id, attempt) của mail_log chặn trùng.

-- ── 1) AUDIT — lưu session thật đã resolve (để biết email nhắc buổi nào) ──
alter table public.mail_log add column if not exists resolved_session_name  text;
alter table public.mail_log add column if not exists resolved_session_label text;

-- ── 2) QUEUE FIRST-SESSION REMINDERS ─────────────────────────────────────
create or replace function public.queue_first_session_reminders()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_queued int := 0;
  v_lead record;
  v_code text;
  v_class_id uuid;
  v_next_start timestamptz;
begin
  for v_lead in
    select l.id, l.class_name
    from public.leads l
    where l.status = 'Đã đóng phí'
      and l.student_id is not null
      and l.class_name is not null
      and not exists (
        select 1 from public.mail_log ml
        where ml.lead_id = l.id and ml.mail_type = 'first_session_reminder'
      )
  loop
    -- code lớp từ class_name "Tên · CODE"
    v_code := (regexp_match(v_lead.class_name, '·\s*([A-Z0-9.]+)\s*$'))[1];
    if v_code is null then
      continue;
    end if;
    -- buổi học thật tiếp theo (bỏ break/cancelled/holiday, start_at trong tương lai)
    select cs.id into v_class_id
      from public.class_schedule cs where cs.code = v_code limit 1;
    if v_class_id is null then
      continue;
    end if;
    select s.start_at into v_next_start
      from public.class_sessions s
      where s.class_id = v_class_id
        and s.start_at > now()
        and coalesce(s.event_type, '') <> 'break'
        and coalesce(s.status, '') not in ('cancelled', 'holiday')
      order by s.start_at
      limit 1;
    if v_next_start is null then
      continue;
    end if;
    -- chỉ queue khi buổi đầu tiên nằm trong 1–4 ngày tới (nhắc sát ngày)
    if v_next_start <= now() + interval '4 days' then
      perform public.queue_mail(v_lead.id, 'first_session_reminder');
      v_queued := v_queued + 1;
    end if;
  end loop;
  return v_queued;
end;
$$;

grant execute on function public.queue_first_session_reminders() to service_role;

-- ── 3) CRON MỖI SÁNG 06:00 ICT (pg_cron chạy theo timezone server = UTC → 23:00 UTC) ──
select cron.unschedule('mail-first-session-cron') where exists (select 1 from cron.job where jobname = 'mail-first-session-cron');
select cron.schedule(
  'mail-first-session-cron',
  '0 23 * * *',
  $$ select public.queue_first_session_reminders(); $$
);
