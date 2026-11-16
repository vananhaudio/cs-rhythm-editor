#!/usr/bin/env bash
# E2E Chat Lớp V1 (phòng chat theo lớp trong /me/chat) trên stack LOCAL của scripts/e2e-learning-thread.sh (không production).
# DB tạm: dm_v1 + nền an toàn UGC + Band Chat V1.x + Chat List V2 + Class Room Chat V1 (đủ 3 file) TRƯỚC mọi kịch bản → đường production (Hộp thư V2).
# Lớp K1 = A, B, T(Thầy phụ trách) · lớp K2 = C · A–B là bạn + có chat cá nhân 2 tin (hồi quy).
#   PUPPETEER_DIR=/path/to/dir bash scripts/e2e-class-room-chat.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMPX="$(mktemp -d /tmp/tvaclassroom.XXXXXX)"; trap 'rm -rf "$TMPX"' EXIT
cat > "$TMPX/teamlab.sql" <<'SQL'
create table public.projects (id uuid primary key, name text not null, avatar_path text);
create table public.teamlab_bands (id uuid primary key, project_id uuid not null references public.projects(id), name text not null, cover_path text);
create table public.teamlab_band_members (band_id uuid not null references public.teamlab_bands(id), user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(), primary key (band_id, user_id));
create table public.teamlab_band_roles (band_id uuid not null references public.teamlab_bands(id), project_id uuid not null, user_id uuid not null,
  role text not null check (role in ('leader','deputy','music_editor')), granted_by uuid, created_at timestamptz not null default now(),
  primary key (band_id, user_id, role));
SQL
cat > "$TMPX/blocked.sql" <<'SQL'
alter table public.edu_students add column if not exists blocked_at timestamptz, add column if not exists blocked_reason text;   -- production: db/story_reports.sql (cần bảng stories, ngoài phạm vi E2E)
SQL
cat > "$TMPX/view.sql" <<'SQL'
create schema if not exists tva_private;
create or replace view tva_private.class_memberships as
  select cs.id as class_id, gm.group_id, gm.user_id, gm.source, gm.created_at as joined_at
  from public.class_schedule cs join public.edu_group_members gm on gm.group_id = cs.cohort_group_id and gm.status = 'active';
SQL
cat > "$TMPX/extra.sql" <<'SQL'
insert into public.edu_groups (id, name, group_type, code) values
  ('33333333-0000-4000-8000-0000000000c1', 'G K1', 'class', 'KD21'), ('33333333-0000-4000-8000-0000000000c2', 'G K2', 'class', 'KD22');
insert into public.class_schedule (id, code, name, status, cohort_group_id) values
  ('22222222-0000-4000-8000-0000000000c1', 'KD21', 'Guitar Cơ Bản KD21 — Thứ 3 · 19h00 · Hà Nội 2026', 'active', '33333333-0000-4000-8000-0000000000c1'),
  ('22222222-0000-4000-8000-0000000000c2', 'KD22', 'Lớp KD22', 'active', '33333333-0000-4000-8000-0000000000c2');
insert into public.edu_group_members (user_id, group_id, status, created_at) values
  ('aaaaaaaa-0000-4000-8000-00000000000a', '33333333-0000-4000-8000-0000000000c1', 'active', now() - interval '30 days'),
  ('bbbbbbbb-0000-4000-8000-00000000000b', '33333333-0000-4000-8000-0000000000c1', 'active', now() - interval '30 days'),
  ('dddddddd-0000-4000-8000-00000000000d', '33333333-0000-4000-8000-0000000000c1', 'active', now() - interval '30 days'),
  ('cccccccc-0000-4000-8000-00000000000c', '33333333-0000-4000-8000-0000000000c2', 'active', now() - interval '30 days');
insert into public.projects values ('11111111-0000-4000-8000-0000000000b1', 'Team Một', null);
insert into public.teamlab_bands values ('11111111-0000-4000-8000-0000000000a1', '11111111-0000-4000-8000-0000000000b1', 'Band X', null);
insert into public.teamlab_band_members (band_id, user_id, created_at) values
  ('11111111-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-00000000000a', now() - interval '30 days'),
  ('11111111-0000-4000-8000-0000000000a1', 'bbbbbbbb-0000-4000-8000-00000000000b', now() - interval '30 days');
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
cat "$ROOT/db/account_avatar_v1_setup.sql" "$ROOT/db/friends_ux_v2_setup.sql" "$ROOT/db/dm_v1_setup.sql" "$ROOT/db/dm_share_v1_setup.sql" "$ROOT/db/bms_share_lifecycle_v1_setup.sql" "$ROOT/db/universal_share_v1_setup.sql" "$TMPX/teamlab.sql" \
    "$ROOT/db/band_chat_v1_setup.sql" "$ROOT/db/band_chat_v1_1_roles_setup.sql" "$ROOT/db/band_chat_v1_2_support_list_setup.sql" "$ROOT/db/band_chat_v1_3_companion_setup.sql" \
    "$TMPX/blocked.sql" "$ROOT/db/class_ugc_safety_v1_setup.sql" \
    "$ROOT/db/chat_list_v2_setup.sql" "$TMPX/view.sql" "$ROOT/db/class_room_chat_v1_setup.sql" "$ROOT/db/class_room_chat_v1_safety_setup.sql" \
    "$ROOT/db/class_room_chat_v1_inbox_setup.sql" > "$TMPX/pre.sql"
E2E_CHECKPOINTS=1 E2E_SKIP_BASE=1 E2E_PRE_SQL="$TMPX/pre.sql" E2E_EXTRA_SQL="$TMPX/extra.sql" \
  E2E_EXTRA_RUNNER="$ROOT/tests/e2e-learning-thread/run-class-room-chat.mjs" bash "$ROOT/scripts/e2e-learning-thread.sh"
