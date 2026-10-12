#!/usr/bin/env bash
# E2E Lớp học (Class Reading UI V1) trên stack LOCAL (không production). Dựa trên scripts/e2e-learning-thread.sh (E2E_CHECKPOINTS=1),
# nhưng nạp thêm đúng các migration production đã LIVE mà stack nền chưa có — để lớp "thành viên không quyền giáo trình" gọi được
# class_learning_entry và Home/Lớp của Thầy gọi được social_all_classes như production:
#   Class Membership Canonical V1 (cổng md5 production được test riêng: scripts/test-class-membership-canonical-db.sh)
#   + Join Code V1 (class_learning_entry) + Teacher All Classes V1 (social_all_classes).
# Dữ liệu là GIẢ; không đổi kỳ vọng nào của kịch bản. Dùng:
#   PUPPETEER_DIR=/path/to/dir bash scripts/e2e-class-reading.sh            # run.mjs + run-checkpoints.mjs
#   E2E_SKIP_BASE=1 E2E_EXTRA_RUNNER=tests/e2e-learning-thread/run-quiz.mjs PUPPETEER_DIR=... bash scripts/e2e-class-reading.sh   # chỉ quiz
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMPX="$(mktemp -d /tmp/tvacre2e.XXXXXX)"
trap 'rm -rf "$TMPX"' EXIT
{
  cat "$ROOT/db/tests/local/class_membership_canonical_fixture.sql"
  echo "update public.class_schedule set cohort_group_id = coalesce(cohort_group_id, group_id), group_id = coalesce(cohort_group_id, group_id);"
  sed '/^do \$gate\$/,/^end \$gate\$;/d' "$ROOT/db/class_membership_canonical_v1_setup.sql"
  cat "$ROOT/db/class_join_code_v1_setup.sql"
  cat "$ROOT/db/teacher_all_classes_v1_setup.sql"
} > "$TMPX/extra.sql"
E2E_CHECKPOINTS=1 E2E_EXTRA_SQL="$TMPX/extra.sql" bash "$ROOT/scripts/e2e-learning-thread.sh"
