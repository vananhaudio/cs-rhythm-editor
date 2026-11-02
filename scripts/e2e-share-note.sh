#!/usr/bin/env bash
# E2E Share Note V1 ("Chia sẻ tức thì") trên stack LOCAL của scripts/e2e-learning-thread.sh (KHÔNG production):
#   Học viên khoanh ô nhịp trong LessonScore (alphaTab thật) → Hỏi/Chia sẻ → gửi bạn qua Chat (Universal Share) | đăng Feed
#   → người nhận mở đúng đoạn (?note=) → trả lời trong Trò chuyện / bình luận bài Feed · Thầy sửa bản nhạc → stale, không tô sai.
# DB tạm: nền Chat + Universal Share + đoạn dm_share/CHECK của chord_share_v1 (+ stub chord_share_ok) + share_note_v1 (qua cổng drift)
#   + Feed bình luận (như scripts/e2e-feed-comments.sh). Bản nhạc thật: WORK_THANH_PHO_BUON (src/data/solo01/works.ts).
#   PUPPETEER_DIR=/path/to/dir [PLAYWRIGHT_DIR=/path/to/dir] bash scripts/e2e-share-note.sh   (Chrome + WebKit)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMPX="$(mktemp -d /tmp/tvasne.XXXXXX)"; trap 'rm -rf "$TMPX"' EXIT
A=aaaaaaaa-0000-4000-8000-00000000000a; B=bbbbbbbb-0000-4000-8000-00000000000b; C=cccccccc-0000-4000-8000-00000000000c
python3 - "$ROOT/db/chord_share_v1_setup.sql" > "$TMPX/chord_part.sql" <<'PY'
import sys
t = open(sys.argv[1]).read()
c = t[t.index('alter table public.dm_messages drop constraint if exists dm_messages_ref_valid_check;'):t.index('create or replace function public.chord_share_ok')]
end = 'grant execute on function public.dm_share(uuid, text, text) to authenticated;'
print(c); print(t[t.index('create or replace function public.dm_share'):t.index(end) + len(end)])
PY
{
  cat "$ROOT/db/account_avatar_v1_setup.sql" "$ROOT/db/friends_ux_v2_setup.sql" "$ROOT/db/dm_v1_setup.sql" "$ROOT/db/dm_share_v1_setup.sql" \
      "$ROOT/db/bms_share_lifecycle_v1_setup.sql" "$ROOT/db/universal_share_v1_setup.sql"
  echo "create or replace function public.chord_share_ok(p uuid) returns boolean language sql stable as \$\$ select false \$\$;   -- TEST-ONLY stub"
  cat "$TMPX/chord_part.sql" "$ROOT/db/share_note_v1_setup.sql"
} > "$TMPX/pre.sql"
TEX="$(cd "$ROOT" && node --experimental-strip-types --no-warnings -e "import('./src/data/solo01/works.ts').then(m => process.stdout.write(m.WORK_THANH_PHO_BUON))")"
[ -n "$TEX" ] || { echo "FAIL: không đọc được WORK_THANH_PHO_BUON"; exit 1; }
{
  cat "$ROOT/db/tests/local/teamlab_publications_fixture.sql" "$ROOT/db/social_feed_teamlab_publications_v1_setup.sql" \
      "$ROOT/db/social_feed_teamlab_publications_v2_setup.sql" "$ROOT/db/tests/local/teamlab_publications_seed.sql"
  cat "$ROOT/db/tests/local/social_feed_safe_stub.sql" "$ROOT/db/tests/local/chat_safe_stub.sql"
  cat "$ROOT/db/class_system_chat_v1_setup.sql" "$ROOT/db/feed_likes_v1_setup.sql" "$ROOT/db/feed_comments_v2_setup.sql" \
      "$ROOT/db/tests/local/ugc_safety_min_fixture.sql" "$ROOT/db/feed_comments_safety_v1_setup.sql"
  cat <<SQL
delete from public.friendships;
insert into public.friendships (requester_id, addressee_id, status, responded_at) values
  ('$A', '$B', 'accepted', now()), ('$A', '$C', 'accepted', now()), ('$B', '$C', 'accepted', now());
-- Buổi 1 lớp SOLO01.TH01 (A, B có quyền giáo trình; C thuộc TH02): thêm MỘT khối bản nhạc THẬT ở cuối (kind 'score')
update public.class_lesson_content
   set blocks = blocks || jsonb_build_array(jsonb_build_object('kind', 'score', 'subtitle', 'Tác phẩm', 'title', 'Thành phố buồn', 'tex', \$tex\$$TEX\$tex\$::text))
 where session_id = '51000000-0000-4000-8000-000000000001';
SQL
} > "$TMPX/extra.sql"
E2E_CHECKPOINTS=1 E2E_SKIP_BASE=1 E2E_PRE_SQL="$TMPX/pre.sql" E2E_EXTRA_SQL="$TMPX/extra.sql" \
  E2E_EXTRA_RUNNER="$ROOT/tests/e2e-learning-thread/run-share-note-all.mjs" bash "$ROOT/scripts/e2e-learning-thread.sh"
