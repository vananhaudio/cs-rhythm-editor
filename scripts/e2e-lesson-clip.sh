#!/usr/bin/env bash
# E2E G3 thẻ "Ôn nhanh" (/me, iPhone 390px): Feed chung + tab Lớp, đúng lớp, không URL/ID, mở đúng Trang Buổi. DB tạm cục bộ, KHÔNG production.
#   PUPPETEER_DIR=$HOME/.local/e2e-tools bash scripts/e2e-lesson-clip.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMPX="$(mktemp -d /tmp/tvag3e.XXXXXX)"; trap 'rm -rf "$TMPX"' EXIT
A=aaaaaaaa-0000-4000-8000-00000000000a
awk '/^create or replace function public.social_feed_safe/{p=1} p{print} /^grant execute on function public.social_feed_scoped_safe/{p=0}' "$ROOT/db/class_ugc_safety_v1_setup.sql" > "$TMPX/safe.sql"
{
  cat "$ROOT/db/tests/local/teamlab_publications_fixture.sql" "$ROOT/db/social_feed_teamlab_publications_v1_setup.sql" \
      "$ROOT/db/social_feed_teamlab_publications_v2_setup.sql" "$ROOT/db/tests/local/teamlab_publications_seed.sql"
  cat <<SQL
insert into public.class_posts (id, author_user_id, type, audience, body, created_at)
  values ('00000000-fa00-4000-8000-000000000001', '$A', 'practice', 'class', 'CLIPPOST bài luyện tập', now() - interval '1 minute');
SQL
  cat "$ROOT/db/tests/local/social_feed_safe_stub.sql"      # comments_safe stub (production có từ UGC Safety)
  cat "$ROOT/db/feed_likes_v1_setup.sql"
  cat "$ROOT/db/tests/local/ugc_safety_min_fixture.sql" "$TMPX/safe.sql"   # hàm _safe THẬT trích từ migration UGC Safety
  cat "$ROOT/db/lesson_clip_card_v1_setup.sql"
  cat <<'SQL'
-- dữ liệu thử (ID video GIẢ): TH01 buổi 1 + 2 có khối video; TH02 buổi 1 có khối video; TH01 buổi 3 KHÔNG added_at
update public.class_lesson_content set blocks = blocks || jsonb_build_array(jsonb_build_object('kind','video','title','CLIP-TH01-S1','url','https://youtu.be/ZZfakeE2E01','duration','2:07','note','NOTE_SENTINEL_E2E',
  'added_at', to_char((now() - interval '1 day') at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))) where session_id = '51000000-0000-4000-8000-000000000001';
update public.class_lesson_content set blocks = blocks || jsonb_build_array(jsonb_build_object('kind','video','title','CLIP-TH01-S2','url','https://youtu.be/ZZfakeE2E02','duration','1:30',
  'added_at', to_char((now() - interval '2 hours') at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))) where session_id = '51000000-0000-4000-8000-000000000002';
update public.class_lesson_content set blocks = blocks || jsonb_build_array(jsonb_build_object('kind','video','title','CLIP-TH02-S1','url','https://youtu.be/ZZfakeE2E03','duration','3:00',
  'added_at', to_char((now() - interval '1 hour') at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))) where session_id = '52000000-0000-4000-8000-000000000001';
update public.class_lesson_content set blocks = blocks || jsonb_build_array(jsonb_build_object('kind','video','title','CLIP-NOADDED','url','https://youtu.be/ZZfakeE2E04')) where session_id = '51000000-0000-4000-8000-000000000003';
SQL
} > "$TMPX/extra.sql"
E2E_CHECKPOINTS=1 E2E_SKIP_BASE=1 E2E_EXTRA_SQL="$TMPX/extra.sql" \
  E2E_EXTRA_RUNNER="$ROOT/tests/e2e-learning-thread/run-lesson-clip.mjs" bash "$ROOT/scripts/e2e-learning-thread.sh"
