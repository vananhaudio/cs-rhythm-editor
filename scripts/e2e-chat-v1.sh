#!/usr/bin/env bash
# E2E Chat V1a (Text 1-1) trên stack LOCAL của scripts/e2e-learning-thread.sh (không production).
# DB tạm: + account_avatar_v1 + friends_ux_v2 + dm_v1 TRƯỚC mọi kịch bản; trước kịch bản Chat: A–B bạn, A–C bạn (C tên rất dài),
# hội thoại A–C dài sẵn 70 tin (3 tin cuối của C chưa đọc với A). B–C KHÔNG là bạn, T (Thầy) KHÔNG là bạn của ai.
#   PUPPETEER_DIR=/path/to/dir bash scripts/e2e-chat-v1.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMPX="$(mktemp -d /tmp/tvachat.XXXXXX)"; trap 'rm -rf "$TMPX"' EXIT
cat > "$TMPX/extra.sql" <<'SQL'
delete from public.friendships;
update public.edu_students set display_name = 'Chi Nguyễn Hoàng Bảo Ngọc Phương Thảo Minh Châu' where user_id = 'cccccccc-0000-4000-8000-00000000000c';
insert into public.friendships (requester_id, addressee_id, status, responded_at) values
  ('aaaaaaaa-0000-4000-8000-00000000000a', 'bbbbbbbb-0000-4000-8000-00000000000b', 'accepted', now()),
  ('cccccccc-0000-4000-8000-00000000000c', 'aaaaaaaa-0000-4000-8000-00000000000a', 'accepted', now());
do $$
declare a uuid := 'aaaaaaaa-0000-4000-8000-00000000000a'; c uuid := 'cccccccc-0000-4000-8000-00000000000c'; cid uuid;
begin
  insert into public.dm_conversations (user_lo, user_hi, last_seq, last_message_at)
    values (least(a, c), greatest(a, c), 70, now() - interval '2 minutes') returning id into cid;
  insert into public.dm_participants (conversation_id, user_id, last_read_seq) values (cid, a, 67), (cid, c, 70);
  insert into public.dm_messages (conversation_id, seq, sender_kind, sender_id, body, created_at)
    select cid, s, 'user', case when s >= 68 or s % 2 = 1 then c else a end,
           'Tin số ' || s || case when s % 7 = 0 then ' — dòng này khá dài để kiểm tra việc xuống dòng tự nhiên của bong bóng tin nhắn trên màn hình điện thoại hẹp 320px' else '' end,
           now() - interval '2 minutes' - ((70 - s) % 10) * interval '1 minute' - ((70 - s) / 10) * interval '3 hours'
      from generate_series(1, 70) s;
end $$;
SQL
cat "$ROOT/db/account_avatar_v1_setup.sql" "$ROOT/db/friends_ux_v2_setup.sql" "$ROOT/db/dm_v1_setup.sql" > "$TMPX/pre.sql"
# CHAT_V1B=1: hồi quy V1a trên DB đã lên V1b (migration V1b nối sau V1a) + frontend V1b
[ -n "${CHAT_V1B:-}" ] && cat "$ROOT/db/dm_share_v1_setup.sql" >> "$TMPX/pre.sql"
E2E_CHECKPOINTS=1 E2E_SKIP_BASE=1 E2E_PRE_SQL="$TMPX/pre.sql" E2E_EXTRA_SQL="$TMPX/extra.sql" \
  E2E_EXTRA_RUNNER="$ROOT/tests/e2e-learning-thread/run-chat-v1.mjs" bash "$ROOT/scripts/e2e-learning-thread.sh"
