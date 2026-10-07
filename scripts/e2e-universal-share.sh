#!/usr/bin/env bash
# E2E Class Universal Share (Nhịp & Phách lifecycle + Lớp học / Buổi học tham chiếu) trên stack LOCAL của scripts/e2e-learning-thread.sh (không production).
# DB tạm: + account_avatar_v1 + friends_ux_v2 + dm_v1 + dm_share_v1 + bms_share_lifecycle_v1 + universal_share_v1. A–B bạn, A–C bạn, B–C KHÔNG bạn.
# Lớp SOLO01.TH01 (A, B là thành viên; C KHÔNG) có buổi 1–2; C thuộc lớp khác. NP1/NP2 = bản Nhịp & Phách RIÊNG của A đã gửi cho B; NP3 = bản đã đăng cộng đồng.
#   PUPPETEER_DIR=/path/to/dir bash scripts/e2e-universal-share.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMPX="$(mktemp -d /tmp/tvauni.XXXXXX)"; trap 'rm -rf "$TMPX"' EXIT
cat > "$TMPX/extra.sql" <<'SQL'
delete from public.friendships;
insert into public.friendships (requester_id, addressee_id, status, responded_at) values
  ('aaaaaaaa-0000-4000-8000-00000000000a', 'bbbbbbbb-0000-4000-8000-00000000000b', 'accepted', now()),
  ('cccccccc-0000-4000-8000-00000000000c', 'aaaaaaaa-0000-4000-8000-00000000000a', 'accepted', now());
create function pg_temp.xml(p_title text) returns text language sql as $x$ select
'<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<score-partwise version="4.0"><work><work-title>' || p_title || '</work-title></work>
<part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>
<part id="P1"><measure number="1"><attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note></measure></part>
</score-partwise>' $x$;
create function pg_temp.np(p_id uuid, p_title text, p_vis text) returns void language plpgsql as $f$
declare v_xml text := pg_temp.xml(p_title);
begin
  insert into public.tool_artifacts (id, owner_id, tool, kind, schema_version, title, data, visibility, client_key, content, content_sha256)
  values (p_id, 'aaaaaaaa-0000-4000-8000-00000000000a', 'nhipphach', 'score', 1, p_title,
          jsonb_build_object('schema', 'nhipphach.score', 'v', 1, 'title', p_title, 'composer', null, 'meter', '4/4',
            'settings', jsonb_build_object('showBeats', true, 'countingLevel', 'beats', 'compoundCountingMode', 'pulses', 'orientation', 'portrait', 'color', '#dc2626', 'sizePt', 7, 'distance', 2, 'grouping', '{}'::jsonb)),
          p_vis, gen_random_uuid(), v_xml, encode(sha256(convert_to(v_xml, 'UTF8')), 'hex'));
end $f$;
select pg_temp.np('c1111111-0000-4000-8000-000000000001', 'Bản riêng một', 'shared');
select pg_temp.np('c2222222-0000-4000-8000-000000000002', 'Bản riêng hai', 'shared');
select pg_temp.np('c3333333-0000-4000-8000-000000000003', 'Bản đã đăng', 'shared');
-- NP3: đăng cộng đồng bằng RPC thật (promote + bài Feed)
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-00000000000a","role":"authenticated"}', false);
set role authenticated;
select public.social_publish_tool_artifact('c3333333-0000-4000-8000-000000000003');
reset role;
select set_config('request.jwt.claims', '{}', false);
-- NP1, NP2 đã gửi cho B (tin do chính chủ bài A gửi)
do $$
declare a uuid := 'aaaaaaaa-0000-4000-8000-00000000000a'; b uuid := 'bbbbbbbb-0000-4000-8000-00000000000b'; cid uuid;
begin
  insert into public.dm_conversations (user_lo, user_hi, last_seq, last_message_at) values (least(a, b), greatest(a, b), 2, now() - interval '5 minutes') returning id into cid;
  insert into public.dm_participants (conversation_id, user_id, last_read_seq) values (cid, a, 2), (cid, b, 0);
  insert into public.dm_messages (conversation_id, seq, sender_kind, sender_id, body, ref_type, ref_key, created_at) values
    (cid, 1, 'user', a, 'Đã chia sẻ một nội dung', 'tool_artifact', 'c1111111-0000-4000-8000-000000000001', now() - interval '6 minutes'),
    (cid, 2, 'user', a, 'Đã chia sẻ một nội dung', 'tool_artifact', 'c2222222-0000-4000-8000-000000000002', now() - interval '5 minutes');
end $$;
SQL
cat "$ROOT/db/account_avatar_v1_setup.sql" "$ROOT/db/friends_ux_v2_setup.sql" "$ROOT/db/dm_v1_setup.sql" "$ROOT/db/dm_share_v1_setup.sql" "$ROOT/db/bms_share_lifecycle_v1_setup.sql" "$ROOT/db/universal_share_v1_setup.sql" > "$TMPX/pre.sql"
E2E_CHECKPOINTS=1 E2E_SKIP_BASE=1 E2E_PRE_SQL="$TMPX/pre.sql" E2E_EXTRA_SQL="$TMPX/extra.sql" \
  E2E_EXTRA_RUNNER="$ROOT/tests/e2e-learning-thread/run-universal-share.mjs" bash "$ROOT/scripts/e2e-learning-thread.sh"
