#!/usr/bin/env bash
# E2E System Chat Sound V1 (Class 2.0) trên stack LOCAL của scripts/e2e-learning-thread.sh (DB tạm, KHÔNG production, không thông báo thật).
#   PUPPETEER_DIR=/path/to/dir bash scripts/e2e-class-system-sound.sh
# DB tạm: nền mặc định (Chat/Share/…) + db/class_system_chat_v1_setup.sql TRƯỚC mọi kịch bản. Chấm bài đi qua UI + lt_respond THẬT.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMPX="$(mktemp -d /tmp/tvasce.XXXXXX)"; trap 'rm -rf "$TMPX"' EXIT
cat "$ROOT/db/account_avatar_v1_setup.sql" "$ROOT/db/friends_ux_v2_setup.sql" "$ROOT/db/dm_v1_setup.sql" "$ROOT/db/dm_share_v1_setup.sql" \
    "$ROOT/db/bms_share_lifecycle_v1_setup.sql" "$ROOT/db/universal_share_v1_setup.sql" "$ROOT/db/class_system_chat_v1_setup.sql" > "$TMPX/pre.sql"
cat > "$TMPX/seed.sql" <<'SQL'
-- B có 2 hội thoại (A, C) → danh sách Trò chuyện có 3 hàng (Class 2.0 + 2) để kiểm bố cục
delete from public.friendships;
insert into public.friendships (requester_id, addressee_id, status, responded_at) values
  ('aaaaaaaa-0000-4000-8000-00000000000a','bbbbbbbb-0000-4000-8000-00000000000b','accepted',now()),
  ('cccccccc-0000-4000-8000-00000000000c','bbbbbbbb-0000-4000-8000-00000000000b','accepted',now());
do $$
declare b uuid:='bbbbbbbb-0000-4000-8000-00000000000b'; o uuid; cid uuid; i int:=0;
begin
  foreach o in array array['aaaaaaaa-0000-4000-8000-00000000000a'::uuid,'cccccccc-0000-4000-8000-00000000000c'::uuid] loop
    i:=i+1;
    insert into public.dm_conversations (user_lo,user_hi,last_seq,last_message_at) values (least(b,o),greatest(b,o),2,now()-i*interval '1 hour') returning id into cid;
    insert into public.dm_participants (conversation_id,user_id,last_read_seq) values (cid,b,2),(cid,o,2);
    insert into public.dm_messages (conversation_id,seq,sender_kind,sender_id,body) select cid,s,'user',o,'Tin số '||s from generate_series(1,2) s;
  end loop;
end $$;
SQL
E2E_CHECKPOINTS=1 E2E_SKIP_BASE=1 E2E_PRE_SQL="$TMPX/pre.sql" E2E_EXTRA_SQL="$TMPX/seed.sql" \
  E2E_EXTRA_RUNNER="$ROOT/tests/e2e-learning-thread/run-system-sound.mjs" bash "$ROOT/scripts/e2e-learning-thread.sh"
