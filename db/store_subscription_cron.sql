-- Điều kiện: secret Vault store_refresh_secret khớp Edge STORE_REFRESH_SECRET.
-- Không ghi service_role vào cron.job.
select cron.schedule('store-subscription-refresh','* * * * *',$cron$
 select net.http_post(
  url:='https://wojmdilyflffvdtpovmq.supabase.co/functions/v1/store-subscription-refresh',
  headers:=jsonb_build_object('Content-Type','application/json','x-store-refresh-secret',
   (select decrypted_secret from vault.decrypted_secrets where name='store_refresh_secret' limit 1)),
  body:='{}'::jsonb,timeout_milliseconds:=55000
 );
$cron$);
