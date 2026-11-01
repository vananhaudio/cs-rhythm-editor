#!/usr/bin/env bash
# E2E Mira cạnh màn chấm bài trên stack LOCAL (không production): Class (PG tạm + PostgREST + Vite) + Mira THẬT (next start)
# + DB riêng của Mira (PG tạm + PostgREST) + OpenAI giả. Chrome thật: desktop 1366px và điện thoại 390px.
#   MIRA_DIR=/đường/dẫn/mira-grading PUPPETEER_DIR=~/.local/e2e-tools bash scripts/e2e-mira-grading.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PUPPETEER_DIR="${PUPPETEER_DIR:-$HOME/.local/e2e-tools}"
export MIRA_DIR="${MIRA_DIR:-$HOME/App/mira-grading}"
export MIRA_PORT="${MIRA_PORT:-$((57900 + RANDOM % 80))}"
export VITE_MIRA_GRADING_URL="http://mira.localhost:$MIRA_PORT/grading"   # bật tính năng ở build Vite của lần chạy này
export E2E_CHECKPOINTS=1 E2E_SKIP_BASE=1
export E2E_EXTRA_SQL="$ROOT/tests/e2e-mira-grading/extra.sql" E2E_EXTRA_RUNNER="$ROOT/tests/e2e-mira-grading/run.mjs"
exec bash "$ROOT/scripts/e2e-learning-thread.sh"
