#!/bin/sh
# Chạy test membership trên production TRONG MỘT TRANSACTION ROLLBACK (không để lại dữ liệu).
# Cần token Supabase CLI trong keychain (xem bộ nhớ chay-sql-production-supabase).
set -e
cd "$(dirname "$0")/.."
T=db/tests/class_membership_test.sql
if [ "$1" = "public" ]; then
  mig=$(sed -e '/^begin;$/d' -e '/^commit;$/d' db/class_public_products_trung_cap.sql)
  sql="begin;
$mig
$(cat db/tests/class_public_products_test.sql)
rollback;"
elif [ "$1" = "lead" ]; then
  sql="begin;
$(cat db/tests/class_lead_insert_test.sql)
rollback;"
else
snap=$(sed -n '/@@SNAPSHOT/,/@@END_SNAPSHOT/p' "$T")
test=$(sed -n '/@@TEST/,/@@END_TEST/p' "$T")
sql="begin;
$snap
$(cat db/class_membership_setup.sql)
$test
rollback;"
fi
TOKEN=$(security find-generic-password -s "Supabase CLI" -w)
curl -s -X POST "https://api.supabase.com/v1/projects/wojmdilyflffvdtpovmq/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "$(jq -n --arg q "$sql" '{query:$q}')"
echo
