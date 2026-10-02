#!/usr/bin/env bash
# E2E Class Membership Canonical V1 + Join by Code V1 trên stack LOCAL (không production). Dựa trên
# scripts/e2e-learning-thread.sh (E2E_CHECKPOINTS=1): toàn bộ kịch bản Learning Thread + Lớp của tôi cũ chạy lại TRƯỚC
# (hồi quy), rồi nạp canonical + join code + dữ liệu GIẢ (lớp Zalo cũ ZZ.T9 có C; lớp JOIN.T1 có mã K7PM-QXD3)
# và chạy tests/e2e-learning-thread/run-canonical.mjs.
#   PUPPETEER_DIR=/path/to/dir bash scripts/e2e-class-canonical.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMPX="$(mktemp -d /tmp/tvaccme2e.XXXXXX)"
trap 'rm -rf "$TMPX"' EXIT
{
  cat "$ROOT/db/tests/local/class_membership_canonical_fixture.sql"
  cat <<'SQL'
insert into public.edu_groups (id, name, group_type, code, zalo_url) values
  ('f9000000-0000-4000-8000-000000000001', 'Nhóm Zalo ZZ', 'zalo', 'Z-CODE-ZZ', 'https://zalo.me/g/zz'),
  ('f9000000-0000-4000-8000-000000000004', 'Nhóm JOIN', 'zalo', 'JOIN.T1', null);
insert into public.class_schedule (id, code, name, status, group_id, main_course_id, course_ids, start_date) values
  ('b9000000-0000-4000-8000-000000000001', 'ZZ.T9', 'Lớp Zalo cũ', 'active', 'f9000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-0000000000d2', '{}', current_date - 3),
  ('b9000000-0000-4000-8000-000000000004', 'JOIN.T1', 'Lớp mở bằng mã', 'upcoming', 'f9000000-0000-4000-8000-000000000004', null, '{}', current_date + 7);
insert into public.edu_group_members (user_id, group_id, source, status) values
  ('cccccccc-0000-4000-8000-00000000000c', 'f9000000-0000-4000-8000-000000000001', 'admin', 'active');
insert into public.edu_course_access (student_id, course_id, active)
  select id, 'c0000000-0000-4000-8000-0000000000d2', true from public.edu_students where user_id = 'cccccccc-0000-4000-8000-00000000000c';
-- phần dữ liệu tổng quát (production dùng mapping chốt ở private)
update public.class_schedule set cohort_group_id = coalesce(cohort_group_id, group_id), group_id = coalesce(cohort_group_id, group_id);
SQL
  # Cổng md5 production được test riêng (scripts/test-class-membership-canonical-db.sh); stack E2E bỏ khối cổng.
  sed '/^do \$gate\$/,/^end \$gate\$;/d' "$ROOT/db/class_membership_canonical_v1_setup.sql"
  cat "$ROOT/db/class_join_code_v1_setup.sql"
  echo "insert into public.edu_group_claim_tokens (group_id, token, is_active) values ('f9000000-0000-4000-8000-000000000004', 'K7PMQXD3', true);"
} > "$TMPX/extra.sql"
E2E_CHECKPOINTS=1 E2E_EXTRA_SQL="$TMPX/extra.sql" E2E_EXTRA_RUNNER="$ROOT/tests/e2e-learning-thread/run-canonical.mjs" \
  bash "$ROOT/scripts/e2e-learning-thread.sh"
