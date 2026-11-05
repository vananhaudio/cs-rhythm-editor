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
  # Nền production: Buổi 0 + Unlock Policy (class_learning_state bản hiện hành), rồi Share Note V1 + RPC khoá buổi của Feed Preview
  cat "$ROOT/db/class_session_zero_intro.sql" "$ROOT/db/class_unlock_policy_v1_setup.sql"
  cat "$TMPX/chord_part.sql" "$ROOT/db/share_note_v1_setup.sql" "$ROOT/db/share_note_session_open_v1_setup.sql"
} > "$TMPX/pre.sql"
TEX="$(cd "$ROOT" && node --experimental-strip-types --no-warnings -e "import('./src/data/solo01/works.ts').then(m => process.stdout.write(m.WORK_THANH_PHO_BUON))")"
[ -n "$TEX" ] || { echo "FAIL: không đọc được WORK_THANH_PHO_BUON"; exit 1; }
TEX_LY="$(cd "$ROOT" && node --experimental-strip-types --no-warnings -e "import('./src/data/solo01/works.ts').then(m => process.stdout.write(m.WORK_DIEM_XUA))")"
[ -n "$TEX_LY" ] || { echo "FAIL: không đọc được WORK_DIEM_XUA"; exit 1; }
{
  cat "$ROOT/db/tests/local/teamlab_publications_fixture.sql" "$ROOT/db/social_feed_teamlab_publications_v1_setup.sql" \
      "$ROOT/db/social_feed_teamlab_publications_v2_setup.sql" "$ROOT/db/tests/local/teamlab_publications_seed.sql"
  cat "$ROOT/db/tests/local/social_feed_safe_stub.sql" "$ROOT/db/tests/local/chat_safe_stub.sql"
  cat "$ROOT/db/class_system_chat_v1_setup.sql" "$ROOT/db/feed_likes_v1_setup.sql" "$ROOT/db/feed_comments_v2_setup.sql" \
      "$ROOT/db/tests/local/ugc_safety_min_fixture.sql" "$ROOT/db/feed_comments_safety_v1_setup.sql"
  # ── Chat List V2 (tái dùng nền có sẵn: Band Chat V1.x + UGC Safety V1 thật + chat_list_v2_setup thật) ──
  cat <<'SQL2'
drop function if exists public.bandchat_rooms(int); drop function if exists public.bandchat_unread_count();
alter table public.teamlab_bands add column if not exists project_id uuid, add column if not exists cover_path text;
create table if not exists public.teamlab_band_members (band_id uuid not null references public.teamlab_bands(id), user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(), primary key (band_id, user_id));
create table if not exists public.teamlab_band_roles (band_id uuid not null references public.teamlab_bands(id), project_id uuid not null, user_id uuid not null,
  role text not null check (role in ('leader','deputy','music_editor')), granted_by uuid, created_at timestamptz not null default now(),
  primary key (band_id, user_id, role));
SQL2
  for f in band_chat_v1_setup band_chat_v1_1_roles_setup band_chat_v1_2_support_list_setup band_chat_v1_3_companion_setup; do cat "$ROOT/db/$f.sql"; done
  echo "drop function if exists public.dm_conversations_safe(int); drop function if exists public.dm_messages_safe(uuid, bigint, bigint, int);"
  sed -n '/^create or replace function public.dm_conversations_safe/,/^grant execute on function public.dm_conversations_safe/p' "$ROOT/db/class_ugc_safety_v1_setup.sql"
  sed -n '/^create or replace function public.dm_messages_safe/,/^grant execute on function public.dm_messages_safe/p' "$ROOT/db/class_ugc_safety_v1_setup.sql"
  cat "$ROOT/db/chat_list_v2_setup.sql"
  cat <<SQL
delete from public.friendships;
insert into public.friendships (requester_id, addressee_id, status, responded_at) values
  ('$A', '$B', 'accepted', now()), ('$A', '$C', 'accepted', now()), ('$B', '$C', 'accepted', now());
-- Buổi 1 lớp SOLO01.TH01 (A, B có quyền giáo trình; C thuộc TH02): thêm MỘT khối bản nhạc THẬT ở cuối (kind 'score')
update public.class_lesson_content
   set blocks = blocks || jsonb_build_array(
     jsonb_build_object('kind', 'score', 'subtitle', 'Tác phẩm', 'title', 'Thành phố buồn', 'lead', 'Đoạn dẫn nguyên văn của Thầy cho bản nhạc này.', 'tempo', '♩ = 66', 'tex', \$tex\$$TEX\$tex\$::text))
 where session_id = '51000000-0000-4000-8000-000000000001';
-- Buổi 2 (cùng lớp TH01): MỘT khối bản nhạc CÓ LỜI hát (Diễm xưa) cho E2E Feed Preview trên điện thoại (bản có lời: 1 ô/dòng)
update public.class_lesson_content
   set blocks = blocks || jsonb_build_array(
     jsonb_build_object('kind', 'score', 'subtitle', 'Tác phẩm', 'title', 'Diễm xưa', 'tex', \$tex\$$TEX_LY\$tex\$::text),
     -- Khối hỗn hợp (Contextual Share): đúng dạng Owner nêu — Tác phẩm + Dự kiến + tên/tác giả/ghi chú/nhịp độ + bản nhạc
     jsonb_build_object('kind', 'repertoire', 'title', 'Tác phẩm thực hành', 'status', 'ready',
       'candidates', jsonb_build_array('Thành Phố Buồn – Lam Phương (Am)', 'Diễm Xưa – Trịnh Công Sơn (Am)'),
       'pieces', jsonb_build_array(
         jsonb_build_object('title', 'Thành Phố Buồn', 'composer', 'Lam Phương · chuyển về Am', 'note', 'Đoạn mô tả nguyên văn của tác phẩm thực hành. Thầy dặn: nghe kỹ nhịp chùm ba ở ô 2 và ô 3, đếm một-và-a hai-và-a, giữ ngón cái đều tay trước khi thêm lời hát; đây là đoạn nhiều bạn hay vội nhất trong cả bài.', 'tempo', 'Slow rock · chậm, đủ chỗ cho nhịp chùm ba', 'marks', jsonb_build_array(jsonb_build_object('at', 'Ô 2', 'text', 'vào nhịp chùm ba')), 'guidance', jsonb_build_array('Giữ nhịp chùm ba thật đều tay.'), 'tex', \$tex\$$TEX\$tex\$::text),
         jsonb_build_object('title', 'Diễm Xưa', 'composer', 'Trịnh Công Sơn', 'note', 'TÁC PHẨM KHÁC KHÔNG ĐƯỢC KÉO VÀO KHUNG', 'tex', \$tex\$$TEX_LY\$tex\$::text)))
   )
 where session_id = '51000000-0000-4000-8000-000000000002';
-- Buổi 2 đang KHOÁ với học viên (phải trả bài Buổi 1 — server class_learning_state quyết). Mở sẵn Buổi 2 cho An và Bình (dòng tiến độ thật, như
-- khi đã trả bài) để E2E bản có lời đo trên buổi MỞ. Buổi 3 vẫn KHOÁ với Bình: có khối nhạc để E2E chứng minh Feed không tải/vẽ nhạc buổi khoá.
update public.class_lesson_content
   set blocks = blocks || jsonb_build_array(jsonb_build_object('kind', 'score', 'subtitle', 'Tác phẩm', 'title', 'Thành phố buồn', 'tex', \$tex\$$TEX\$tex\$::text))
 where session_id = '51000000-0000-4000-8000-000000000003';
insert into public.learning_session_progress (learner_user_id, program_code, session_no, class_schedule_id)
  values ('$A', 'SOLO01', 2, 'b1000000-0000-4000-8000-000000000001'), ('$B', 'SOLO01', 2, 'b1000000-0000-4000-8000-000000000001') on conflict do nothing;
SQL
} > "$TMPX/extra.sql"
# Contextual Share V2 (E2E_SHARE_TEXT=1): thêm khối VĂN BẢN vào Buổi 1; migration V2 KHÔNG nằm trong pre.sql — runner DB tự áp (vòng đời: dữ liệu V1 trước/sau,
# idempotent, rollback, áp lại) rồi để DB ở trạng thái ĐÃ migrate cho các kịch bản trình duyệt. Mặc định (không đặt biến) = kịch bản V1.3 như cũ.
RUNNER=run-share-note-all.mjs
if [ -n "${E2E_SHARE_TEXT:-}" ]; then cat "$ROOT/db/tests/local/share_text_fixture.sql" >> "$TMPX/extra.sql"; RUNNER=run-share-text-all.mjs; fi
E2E_CHECKPOINTS=1 E2E_SKIP_BASE=1 E2E_PRE_SQL="$TMPX/pre.sql" E2E_EXTRA_SQL="$TMPX/extra.sql" \
  E2E_EXTRA_RUNNER="$ROOT/tests/e2e-learning-thread/$RUNNER" bash "$ROOT/scripts/e2e-learning-thread.sh"
