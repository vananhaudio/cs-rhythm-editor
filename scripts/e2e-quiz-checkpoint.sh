#!/usr/bin/env bash
# E2E QUIZ CHECKPOINT V1 trên stack LOCAL (không production): Buổi 02 thật của SOLO01 (2.1 trắc nghiệm 1 đáp án ·
# 2.2 nhiều đáp án · 2.3 video + chữ) — sai → làm lại → đúng → ✓ Đạt · tải lại giữ · không Hàng đợi/Không gian lớp ·
# 3/3 Đạt → xong Buổi 02 → mở Buổi 03. ĐÁP ÁN là dữ liệu PRIVATE: truyền thư mục sinh bởi prod-migrations/solo01-buoi02-quiz/gen.mts
#   PUPPETEER_DIR=… E2E_QUIZ_PRIVATE=~/Projects/cs-prod-db-infra/prod-migrations/solo01-buoi02-quiz bash scripts/e2e-quiz-checkpoint.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
: "${E2E_QUIZ_PRIVATE:?đặt E2E_QUIZ_PRIVATE = thư mục có local-e2e.sql + answers.e2e.json (private)}"
[ -f "$E2E_QUIZ_PRIVATE/local-e2e.sql" ] && [ -f "$E2E_QUIZ_PRIVATE/answers.e2e.json" ] || { echo "thiếu file private"; exit 1; }
E2E_CHECKPOINTS=1 E2E_SKIP_BASE=1 E2E_EXTRA_SQL="$E2E_QUIZ_PRIVATE/local-e2e.sql" E2E_QUIZ_ANSWERS="$E2E_QUIZ_PRIVATE/answers.e2e.json" \
  E2E_EXTRA_RUNNER="$ROOT/tests/e2e-learning-thread/run-quiz.mjs" bash "$ROOT/scripts/e2e-learning-thread.sh"
