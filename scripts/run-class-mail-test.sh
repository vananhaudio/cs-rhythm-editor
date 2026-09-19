#!/bin/sh
# Test email xác nhận đăng ký Class (Email 1) trên DỮ LIỆU THẬT production (chỉ đọc):
# packages CLASS_*, membership_benefits, class_schedule/class_stages 4 lớp, app_config ngân hàng.
set -e
cd "$(dirname "$0")/.."
TOKEN=$(security find-generic-password -s "Supabase CLI" -w)
Q="select json_build_object(
 'plans',(select json_agg(json_build_object('name',name,'config',config)) from packages where package_code in ('CLASS_MONTHLY','CLASS_SIXMONTH') and status='active'),
 'benefits',(select json_object_agg(key,label) from membership_benefits),
 'cfg',(select json_object_agg(key,value) from app_config where key in ('bank_name','bank_account_number','bank_account_name','payment_qr','class_site_url','zalo_url')),
 'classes',(select json_agg(json_build_object('row',to_jsonb(c)-'metadata','stages',(select coalesce(json_agg(s order by s.stage_no),'[]') from class_stages s where s.class_id=c.id)))
   from class_schedule c where c.code in ('CB1.T3','CB2.T3','SOLO.T4','DEM.T4'))) as f"
curl -s -X POST "https://api.supabase.com/v1/projects/wojmdilyflffvdtpovmq/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "$(jq -n --arg q "$Q" '{query:$q}')" | jq '.[0].f' > tests/class-mail/.fixture.json
deno test -A tests/class-mail/
