#!/usr/bin/env bash
# Tích hợp RPC mira_grading_context('curriculum') V2 trên stack TẠM của E2E (không production, không Chrome thật, không OpenAI):
#   PUPPETEER_DIR chỉ để thoả harness (không dùng Chrome). OUT_DIR = nơi ghi kết quả RPC (làm fixture cho test phía Mira).
#   bash scripts/test-mira-grading-curriculum-rpc.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PUPPETEER_DIR="${PUPPETEER_DIR:-$HOME/.local/e2e-tools}" ROOT_DIR="$ROOT" OUT_DIR="${OUT_DIR:-/tmp/mira-curriculum-rpc-out}"
export E2E_CHECKPOINTS=1 E2E_SKIP_BASE=1
export E2E_EXTRA_SQL="$ROOT/tests/mira-grading-curriculum/extra.sql" E2E_EXTRA_RUNNER="$ROOT/tests/mira-grading-curriculum/rpc-e2e.mjs"
exec bash "$ROOT/scripts/e2e-learning-thread.sh"
