#!/usr/bin/env bash
# E2E Chat V1b (Share nội bộ BMS artifact) trên stack LOCAL của scripts/e2e-learning-thread.sh (không production).
# DB tạm: + account_avatar_v1 + friends_ux_v2 + dm_v1 + dm_share_v1 TRƯỚC mọi kịch bản. A–B bạn, A–C bạn, B–C KHÔNG là bạn, T không là bạn ai.
# Dữ liệu: ART1/ART2 (A, class) · ART_PRIV (C, private — A không đọc được) · hội thoại A–C có sẵn tin share tới ART_PRIV · một bài Feed BMS của A.
#   PUPPETEER_DIR=/path/to/dir bash scripts/e2e-chat-share-v1b.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMPX="$(mktemp -d /tmp/tvashare.XXXXXX)"; trap 'rm -rf "$TMPX"' EXIT
cat > "$TMPX/extra.sql" <<'SQL'
delete from public.friendships;
update public.edu_students set display_name = 'Chi Nguyễn Hoàng Bảo Ngọc Phương Thảo Minh Châu' where user_id = 'cccccccc-0000-4000-8000-00000000000c';
insert into public.friendships (requester_id, addressee_id, status, responded_at) values
  ('aaaaaaaa-0000-4000-8000-00000000000a', 'bbbbbbbb-0000-4000-8000-00000000000b', 'accepted', now()),
  ('cccccccc-0000-4000-8000-00000000000c', 'aaaaaaaa-0000-4000-8000-00000000000a', 'accepted', now());
-- test-only: dựng ca "artifact không ai ngoài chủ đọc được"
alter table public.tool_artifacts drop constraint tool_artifacts_visibility_check;
create function pg_temp.song(p_title text) returns jsonb language sql as $$
  select public.bms_song_normalize(jsonb_build_object(
    'title', p_title, 'video_id', 'dQw4w9WgXcQ', 'lyrics', E'Có chàng trai viết lên cây\nlời yêu thương',
    'fit', jsonb_build_object('bpm', 76.4, 'beat_duration', 0.7853, 'grid_offset', 1.25),
    'time_signature', 4, 'downbeat_position', 1, 'group_beats', true,
    'anchors', '[{"word_index":0,"beat_index":0},{"word_index":6,"beat_index":8}]'::jsonb,
    'chords', '[{"word_index":0,"name":"Am"},{"word_index":3,"name":"F"},{"word_index":6,"name":"Am"},{"word_index":7,"name":"G/B"}]'::jsonb)) $$;
insert into public.tool_artifacts (id, owner_id, tool, kind, schema_version, title, data, visibility, client_key) values
  ('a1111111-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-00000000000a', 'bms', 'song', 1, 'Có Chàng Trai Viết Lên Cây', pg_temp.song('Có Chàng Trai Viết Lên Cây'), 'class', gen_random_uuid()),
  ('a2222222-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-00000000000a', 'bms', 'song', 1, 'Bài sẽ bị gỡ', pg_temp.song('Bài sẽ bị gỡ'), 'class', gen_random_uuid()),
  ('a3333333-0000-4000-8000-000000000003', 'cccccccc-0000-4000-8000-00000000000c', 'bms', 'song', 1, 'Bài riêng của Chi', pg_temp.song('Bài riêng của Chi'), 'private', gen_random_uuid());
-- Bài Feed BMS của A (qua RPC thật: artifact + class_posts tool_share)
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-00000000000a","role":"authenticated"}', false);
set role authenticated;
select public.social_share_tool_result('bms', jsonb_build_object('kind', 'song', 'song', jsonb_build_object(
    'title', 'Bài trên Feed của An', 'video_id', 'dQw4w9WgXcQ', 'lyrics', 'la la la',
    'fit', jsonb_build_object('bpm', 90, 'beat_duration', 0.6667, 'grid_offset', 0.5),
    'time_signature', 4, 'downbeat_position', 1, 'group_beats', true,
    'anchors', '[{"word_index":0,"beat_index":0}]'::jsonb, 'chords', '[{"word_index":0,"name":"C"}]'::jsonb)), gen_random_uuid());
reset role;
select set_config('request.jwt.claims', '{}', false);
-- Hội thoại A–C có sẵn: C nhắn text rồi share bài riêng của C (A không đọc được artifact này)
do $$
declare a uuid := 'aaaaaaaa-0000-4000-8000-00000000000a'; c uuid := 'cccccccc-0000-4000-8000-00000000000c'; cid uuid;
begin
  insert into public.dm_conversations (user_lo, user_hi, last_seq, last_message_at) values (least(a, c), greatest(a, c), 3, now() - interval '5 minutes') returning id into cid;
  insert into public.dm_participants (conversation_id, user_id, last_read_seq) values (cid, a, 0), (cid, c, 3);
  insert into public.dm_messages (conversation_id, seq, sender_kind, sender_id, body, ref_type, ref_key, created_at) values
    (cid, 1, 'user', c, 'Xin chào An', null, null, now() - interval '7 minutes'),
    (cid, 2, 'user', c, 'Đã chia sẻ một nội dung', 'tool_artifact', 'a3333333-0000-4000-8000-000000000003', now() - interval '6 minutes'),
    (cid, 3, 'user', c, 'Bài đó hay lắm', null, null, now() - interval '5 minutes');
end $$;
SQL
cat "$ROOT/db/account_avatar_v1_setup.sql" "$ROOT/db/friends_ux_v2_setup.sql" "$ROOT/db/dm_v1_setup.sql" "$ROOT/db/dm_share_v1_setup.sql" > "$TMPX/pre.sql"
E2E_CHECKPOINTS=1 E2E_SKIP_BASE=1 E2E_PRE_SQL="$TMPX/pre.sql" E2E_EXTRA_SQL="$TMPX/extra.sql" \
  E2E_EXTRA_RUNNER="$ROOT/tests/e2e-learning-thread/run-chat-share-v1b.mjs" bash "$ROOT/scripts/e2e-learning-thread.sh"
