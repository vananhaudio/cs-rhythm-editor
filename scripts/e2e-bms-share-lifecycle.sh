#!/usr/bin/env bash
# E2E BMS Share Lifecycle (local → shared → class) trên stack LOCAL của scripts/e2e-learning-thread.sh (không production).
# DB tạm: + account_avatar_v1 + friends_ux_v2 + dm_v1 + dm_share_v1 + bms_share_lifecycle_v1 + universal_share_v1. A–B bạn, A–C bạn, B–C KHÔNG là bạn.
# Dữ liệu: SH1, SH2 = bài RIÊNG của A (visibility 'shared'), đã gửi cho B qua DM (tin do A gửi).
#   PUPPETEER_DIR=/path/to/dir bash scripts/e2e-bms-share-lifecycle.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMPX="$(mktemp -d /tmp/tvalife.XXXXXX)"; trap 'rm -rf "$TMPX"' EXIT
cat > "$TMPX/extra.sql" <<'SQL'
delete from public.friendships;
insert into public.friendships (requester_id, addressee_id, status, responded_at) values
  ('aaaaaaaa-0000-4000-8000-00000000000a', 'bbbbbbbb-0000-4000-8000-00000000000b', 'accepted', now()),
  ('cccccccc-0000-4000-8000-00000000000c', 'aaaaaaaa-0000-4000-8000-00000000000a', 'accepted', now());
create function pg_temp.song(p_title text) returns jsonb language sql as $$
  select public.bms_song_normalize(jsonb_build_object(
    'title', p_title, 'video_id', 'dQw4w9WgXcQ', 'lyrics', E'Có chàng trai viết lên cây\nlời yêu thương',
    'fit', jsonb_build_object('bpm', 76.4, 'beat_duration', 0.7853, 'grid_offset', 1.25),
    'time_signature', 4, 'downbeat_position', 1, 'group_beats', true,
    'anchors', '[{"word_index":0,"beat_index":0},{"word_index":6,"beat_index":8}]'::jsonb,
    'chords', '[{"word_index":0,"name":"Am"},{"word_index":3,"name":"F"},{"word_index":6,"name":"Am"},{"word_index":7,"name":"G/B"}]'::jsonb)) $$;
insert into public.tool_artifacts (id, owner_id, tool, kind, schema_version, title, data, visibility, client_key) values
  ('b1111111-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-00000000000a', 'bms', 'song', 1, 'Bài riêng một', pg_temp.song('Bài riêng một'), 'shared', gen_random_uuid()),
  ('b2222222-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-00000000000a', 'bms', 'song', 1, 'Bài riêng hai', pg_temp.song('Bài riêng hai'), 'shared', gen_random_uuid());
do $$
declare a uuid := 'aaaaaaaa-0000-4000-8000-00000000000a'; b uuid := 'bbbbbbbb-0000-4000-8000-00000000000b'; cid uuid;
begin
  insert into public.dm_conversations (user_lo, user_hi, last_seq, last_message_at) values (least(a, b), greatest(a, b), 2, now() - interval '5 minutes') returning id into cid;
  insert into public.dm_participants (conversation_id, user_id, last_read_seq) values (cid, a, 2), (cid, b, 0);
  insert into public.dm_messages (conversation_id, seq, sender_kind, sender_id, body, ref_type, ref_key, created_at) values
    (cid, 1, 'user', a, 'Đã chia sẻ một nội dung', 'tool_artifact', 'b1111111-0000-4000-8000-000000000001', now() - interval '6 minutes'),
    (cid, 2, 'user', a, 'Đã chia sẻ một nội dung', 'tool_artifact', 'b2222222-0000-4000-8000-000000000002', now() - interval '5 minutes');
end $$;
SQL
cat "$ROOT/db/account_avatar_v1_setup.sql" "$ROOT/db/friends_ux_v2_setup.sql" "$ROOT/db/dm_v1_setup.sql" "$ROOT/db/dm_share_v1_setup.sql" "$ROOT/db/bms_share_lifecycle_v1_setup.sql" "$ROOT/db/universal_share_v1_setup.sql" > "$TMPX/pre.sql"
E2E_CHECKPOINTS=1 E2E_SKIP_BASE=1 E2E_PRE_SQL="$TMPX/pre.sql" E2E_EXTRA_SQL="$TMPX/extra.sql" \
  E2E_EXTRA_RUNNER="$ROOT/tests/e2e-learning-thread/run-bms-share-lifecycle.mjs" bash "$ROOT/scripts/e2e-learning-thread.sh"
