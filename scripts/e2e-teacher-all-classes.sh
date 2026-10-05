#!/usr/bin/env bash
# E2E Teacher All Classes V1 trên stack LOCAL của scripts/e2e-learning-thread.sh (không production).
# DB tạm: + account_avatar_v1 (như production) + teacher_all_classes_v1 TRƯỚC mọi kịch bản; N = ADMIN không hồ sơ học sinh
# (đúng hình dạng tài khoản Thầy production). Danh sách lớp kỳ vọng xuất từ DB tạm (\copy) → runner so khớp.
#   PUPPETEER_DIR=/path/to/dir bash scripts/e2e-teacher-all-classes.sh            (chỉ kịch bản Thầy/khách/học sinh)
#   E2E_FULL=1 PUPPETEER_DIR=… bash scripts/e2e-teacher-all-classes.sh            (toàn bộ kịch bản cũ trên DB đã migrate)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMPX="$(mktemp -d /tmp/tvatax.XXXXXX)"; trap 'rm -rf "$TMPX"' EXIT
cat "$ROOT/db/account_avatar_v1_setup.sql" "$ROOT/db/teacher_all_classes_v1_setup.sql" > "$TMPX/pre.sql"
cat > "$TMPX/extra.sql" <<SQL
update public.app_users set role = 'admin', name = 'Quản trị' where id = 'eeeeeeee-0000-4000-8000-00000000000e';
delete from public.edu_students where user_id = 'eeeeeeee-0000-4000-8000-00000000000e';
\copy (select id from public.class_schedule where coalesce(status, '') not in ('cancelled', 'merged', 'draft') order by id) to '$TMPX/expected.txt'
SQL
if [ -n "${E2E_FULL:-}" ]; then SKIP=""; else SKIP=1; fi
OUT="$TMPX/out.log"
set +e
EXPECTED_FILE="$TMPX/expected.txt" E2E_CHECKPOINTS=1 E2E_SKIP_BASE="$SKIP" E2E_PRE_SQL="$TMPX/pre.sql" E2E_EXTRA_SQL="$TMPX/extra.sql" \
  E2E_EXTRA_RUNNER="$ROOT/tests/e2e-learning-thread/run-teacher-all-classes.mjs" bash "$ROOT/scripts/e2e-learning-thread.sh" 2>&1 | tee "$OUT"
RC=${PIPESTATUS[0]}
set -e
# Thầy/admin chỉ XEM: không được sinh tiến độ / thread (DBSTATE do e2e-learning-thread.sh in cuối)
if [ -z "${E2E_FULL:-}" ] && [ "$RC" = "0" ]; then
  grep -qx 'progress=0' "$OUT" && grep -qx 'threads=0' "$OUT" \
    && echo "PASS: DB sau kịch bản: Thầy/admin xem mọi lớp + buổi KHÔNG tạo tiến độ / thread (progress=0, threads=0)" \
    || { echo "FAIL: Thầy/admin xem lớp đã ghi dữ liệu học"; RC=1; }
fi
exit $RC
