#!/usr/bin/env bash
# Xem tay Feed Comments A–D trên iPhone thật, trong LAN — DB/backend TẠM, KHÔNG production.
#   bash scripts/feed-comments-preview.sh start | stop | status
# Dựng: PostgreSQL 17 tạm (migration Feed Comments V2 + Safety + PAGING D + dữ liệu mẫu) → PostgREST → proxy auth giả → Vite (mã nguồn nhánh này).
# Địa chỉ: http://class.<IP-LAN>.nip.io:57800/me  (tên 'class.' để app vào đúng giao diện Class; nip.io trỏ về IP LAN của máy này).
# Đăng nhập: email a@ / b@ / c@ / t@test.local (t = Thầy) + MẬT KHẨU BẤT KỲ. Toàn dữ liệu giả, mất khi dừng.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE=/tmp/tva-fc-preview; mkdir -p "$STATE"
PORT_BASE=56900
ip() { ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || ifconfig | awk '/inet 192\.168\.|inet 10\./{print $2; exit}'; }
case "${1:-status}" in
  start)
    [ -f "$STATE/pid" ] && kill -0 "$(cat "$STATE/pid")" 2>/dev/null && { echo "Đang chạy rồi (dừng: bash scripts/feed-comments-preview.sh stop)"; exec bash "$0" status; }
    IP="$(ip)"; [ -n "$IP" ] || { echo "Không tìm thấy IP LAN"; exit 1; }
    HOSTN="class.$IP.nip.io"
    rm -f "$STATE/ports" "$STATE/ready"
    {
      cat "$ROOT/db/tests/local/teamlab_publications_fixture.sql" "$ROOT/db/social_feed_teamlab_publications_v1_setup.sql" \
          "$ROOT/db/social_feed_teamlab_publications_v2_setup.sql" "$ROOT/db/tests/local/teamlab_publications_seed.sql"
      cat "$ROOT/db/tests/local/social_feed_safe_stub.sql"
      cat "$ROOT/db/class_system_chat_v1_setup.sql" "$ROOT/db/feed_likes_v1_setup.sql" "$ROOT/db/feed_comments_v2_setup.sql" \
          "$ROOT/db/tests/local/ugc_safety_min_fixture.sql" "$ROOT/db/feed_comments_safety_v1_setup.sql" \
          "$ROOT/db/feed_comments_paging_v1_setup.sql"
      cat <<SQL
insert into public.class_posts (id, author_user_id, type, audience, body, created_at)
  values ('00000000-fa00-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-00000000000a', 'practice', 'class', 'CMTPOST bài luyện tập (ít bình luận)', now() - interval '1 minute');
insert into public.learning_threads (id, learner_user_id, content_key, identity, visibility, status, last_event_at, last_student_event_at, event_count)
  values ('00000000-fb00-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-00000000000a', 'L:' || gen_random_uuid(), '{"lesson":{"title":"THỬ BÌNH LUẬN (Thread): 70 gốc + trả lời"}}', 'community', 'waiting_teacher', now() - interval '45 seconds', now() - interval '45 seconds', 1);
SQL
      cat "$ROOT/db/tests/local/feed_comments_preview_seed.sql"
    } > "$STATE/extra.sql"
    E2E_SERVE="$STATE/ports" E2E_CHECKPOINTS=1 E2E_BIND=0.0.0.0 E2E_PUBLIC_HOST="$IP" E2E_PORT_BASE=$PORT_BASE \
      E2E_VITE_CONFIG="$ROOT/scripts/vite.lan.config.ts" E2E_EXTRA_SQL="$STATE/extra.sql" \
      nohup bash "$ROOT/scripts/e2e-learning-thread.sh" > "$STATE/log" 2>&1 &
    echo $! > "$STATE/pid"
    for _ in $(seq 1 240); do grep -q "── READY" "$STATE/log" 2>/dev/null && break; kill -0 "$(cat "$STATE/pid")" 2>/dev/null || { echo "Dựng thất bại:"; tail -20 "$STATE/log"; exit 1; }; sleep 1; done
    grep -q "── READY" "$STATE/log" || { echo "Quá thời gian chờ"; tail -20 "$STATE/log"; exit 1; }
    echo "$HOSTN" > "$STATE/host"; exec bash "$0" status ;;
  stop)
    if [ -f "$STATE/pid" ]; then kill "$(cat "$STATE/pid")" 2>/dev/null || true; sleep 2; fi
    if [ -f "$STATE/ports" ]; then read -r V P A D T < "$STATE/ports"; pkill -f "vite .*--port $V --strictPort" 2>/dev/null || true; pkill -f "postgrest $T/pgrst.conf" 2>/dev/null || true
      /opt/homebrew/opt/postgresql@17/bin/pg_ctl -D "$T/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$T"; fi
    pkill -f "e2e-learning-thread-proxy.mjs" 2>/dev/null || true
    rm -f "$STATE/pid" "$STATE/ports" "$STATE/host"; echo "Đã dừng và xoá DB tạm." ;;
  status)
    if [ -f "$STATE/pid" ] && kill -0 "$(cat "$STATE/pid")" 2>/dev/null && [ -f "$STATE/ports" ]; then
      read -r V P A D T < "$STATE/ports"; IP="$(ip)"
      echo "ĐANG CHẠY:  http://class.$IP.nip.io:$V/me     (dự phòng nếu DNS nip.io bị chặn: http://$IP:$V/me — nhưng có thể vào nhầm giao diện)"
      echo "Đăng nhập:  a@test.local · b@test.local · c@test.local · t@test.local (Thầy) — mật khẩu bất kỳ"
    else echo "Không chạy."; fi ;;
  *) echo "dùng: start | stop | status" ;;
esac
