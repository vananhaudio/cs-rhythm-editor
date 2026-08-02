-- TVA Daily Mail V1 — pg_cron / pg_net Setup
-- Chạy trong Supabase SQL Editor (có quyền superuser)
-- Sau khi đã deploy Edge Functions: daily-mail-scheduler và daily-mail-sender

-- ============================================================
-- 1. Bật extension (nếu chưa có)
-- ============================================================
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- ============================================================
-- 2. Kiểm tra Edge Function URL
-- ============================================================
-- Thay <project_ref> = wojmdilyflffvdtpovmq (Supabase project ID)
-- URL scheduler: https://wojmdilyflffvdtpovmq.supabase.co/functions/v1/daily-mail-scheduler

-- ============================================================
-- 3. Tạo cron job — chạy mỗi phút
-- ============================================================
-- LƯU Ý: Thay <ANON_KEY> bằng anon key thật của project
-- Lấy từ: Supabase Dashboard → Settings → API → anon public key

select cron.schedule(
  'daily-mail-scheduler',          -- tên job
  '* * * * *',                     -- mỗi phút
  $$
  select net.http_post(
    url := 'https://wojmdilyflffvdtpovmq.supabase.co/functions/v1/daily-mail-scheduler',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <ANON_KEY>"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 300000  -- 5 phút timeout (cho phép gửi ~1000 email)
  );
  $$
);

-- ============================================================
-- 4. Kiểm tra cron job đã được tạo
-- ============================================================
select * from cron.job where jobname = 'daily-mail-scheduler';

-- ============================================================
-- 5. Xem lịch sử chạy (sau khi job đã chạy vài lần)
-- ============================================================
-- select * from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'daily-mail-scheduler') order by start_time desc limit 10;

-- ============================================================
-- Huỷ cron job (nếu cần)
-- ============================================================
-- select cron.unschedule('daily-mail-scheduler');
