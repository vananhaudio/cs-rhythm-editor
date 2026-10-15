#!/usr/bin/env bash
# E2E Band Chat V1 (nhóm chat theo Band trong /me/chat) trên stack LOCAL của scripts/e2e-learning-thread.sh (không production).
# DB tạm: Chat V1a (dm_v1) + bảng Teamlab giả + band_chat_v1 TRƯỚC mọi kịch bản. A–B cùng Band X (tên dài), C ở Band Y (cùng Team), N ngoài mọi Band;
# A–B là bạn và đã có hội thoại cá nhân 2 tin (hồi quy chat cá nhân).
#   PUPPETEER_DIR=/path/to/dir bash scripts/e2e-band-chat-v1.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMPX="$(mktemp -d /tmp/tvabandchat.XXXXXX)"; trap 'rm -rf "$TMPX"' EXIT
cat > "$TMPX/teamlab.sql" <<'SQL'
create table public.projects (id uuid primary key, name text not null, avatar_path text);
create table public.teamlab_bands (id uuid primary key, project_id uuid not null references public.projects(id), name text not null, cover_path text);
create table public.teamlab_band_members (band_id uuid not null references public.teamlab_bands(id), user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(), primary key (band_id, user_id));
SQL
cat > "$TMPX/extra.sql" <<'SQL'
insert into public.projects values ('11111111-0000-4000-8000-0000000000b1', 'Team Một', null);
insert into public.teamlab_bands values
  ('11111111-0000-4000-8000-0000000000a1', '11111111-0000-4000-8000-0000000000b1', 'Lá Mùa Thu Acoustic Band Hà Nội 2026', null),
  ('11111111-0000-4000-8000-0000000000a2', '11111111-0000-4000-8000-0000000000b1', 'Band Y', null);
insert into public.teamlab_band_members (band_id, user_id, created_at) values
  ('11111111-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-00000000000a', now() - interval '30 days'),
  ('11111111-0000-4000-8000-0000000000a1', 'bbbbbbbb-0000-4000-8000-00000000000b', now() - interval '30 days'),
  ('11111111-0000-4000-8000-0000000000a2', 'cccccccc-0000-4000-8000-00000000000c', now() - interval '30 days');
delete from public.friendships;
insert into public.friendships (requester_id, addressee_id, status, responded_at)
  values ('aaaaaaaa-0000-4000-8000-00000000000a', 'bbbbbbbb-0000-4000-8000-00000000000b', 'accepted', now());
do $$
declare a uuid := 'aaaaaaaa-0000-4000-8000-00000000000a'; b uuid := 'bbbbbbbb-0000-4000-8000-00000000000b'; cid uuid;
begin
  insert into public.dm_conversations (user_lo, user_hi, last_seq, last_message_at) values (least(a, b), greatest(a, b), 2, now() - interval '5 minutes') returning id into cid;
  insert into public.dm_participants (conversation_id, user_id, last_read_seq) values (cid, a, 2), (cid, b, 2);
  insert into public.dm_messages (conversation_id, seq, sender_kind, sender_id, body, created_at)
    values (cid, 1, 'user', a, 'Chào Bình', now() - interval '6 minutes'), (cid, 2, 'user', b, 'Chào An, tin riêng của hai đứa', now() - interval '5 minutes');
end $$;
SQL
cat "$ROOT/db/account_avatar_v1_setup.sql" "$ROOT/db/friends_ux_v2_setup.sql" "$ROOT/db/dm_v1_setup.sql" "$TMPX/teamlab.sql" "$ROOT/db/band_chat_v1_setup.sql" > "$TMPX/pre.sql"
E2E_CHECKPOINTS=1 E2E_SKIP_BASE=1 E2E_PRE_SQL="$TMPX/pre.sql" E2E_EXTRA_SQL="$TMPX/extra.sql" \
  E2E_EXTRA_RUNNER="$ROOT/tests/e2e-learning-thread/run-band-chat-v1.mjs" bash "$ROOT/scripts/e2e-learning-thread.sh"
