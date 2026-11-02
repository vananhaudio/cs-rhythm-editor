#!/usr/bin/env bash
# Test G3 "Ôn nhanh" (db/lesson_clip_card_v1_*) ở tầng DB trên cluster PostgreSQL 17 TẠM (tự xoá khi xong). KHÔNG kết nối production.
#   bash scripts/test-lesson-clip-card-db.sh
# Phủ: nền = đúng md5 production (social_feed 2697eb50…, scoped 47bf0f5f…) · cổng drift (dừng, không ghi) · migration ×2 · postflight · quyền theo lớp
# (for_you / my_classes / friends, hàm _safe THẬT) · payload sạch URL/ID · sắp xếp ổn định · phân trang keyset · HỒI QUY loại Feed cũ · hiệu năng · rollback ×2 + cổng.
set -euo pipefail
export LC_ALL=C LANG=C
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
TMP="$(mktemp -d /tmp/tvag3.XXXXXX)"
PORT="${PORT:-$((58000 + RANDOM % 300))}"
cleanup() { "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
"$PGBIN/initdb" -D "$TMP/data" -U postgres --auth=trust --encoding=UTF8 --locale=C >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/pg.log" -w start >/dev/null || { cat "$TMP/pg.log"; exit 1; }
psqld() { local db=$1; shift; PGOPTIONS="-c client_min_messages=warning" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d "$db" -v ON_ERROR_STOP=1 "$@"; }
q() { psqld "$1" -tA -c "$2"; }
mig() { psqld "$1" -1 -f "$2"; }   # như prod-db.py: cả file trong MỘT transaction
fail() { echo "FAIL: $*"; exit 1; }
ok() { echo "PASS: $*"; }
stops() { # db file errfile marker msg : migration PHẢI thất bại với marker
  if psqld "$1" -1 -f "$2" >/dev/null 2>"$3"; then fail "$5 — migration lại chạy được"; fi
  grep -q "$4" "$3" || { cat "$3"; fail "$5 — lỗi sai lý do"; }
  ok "$5"
}
run_test() { # db file
  PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d "$1" -v ON_ERROR_STOP=1 -f "$2" 2>&1 \
    | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //' | tee "$TMP/test.out"
  [ "${PIPESTATUS[0]}" = "0" ] || fail "test SQL $2"
  if grep -q '^FAIL' "$TMP/test.out"; then fail "có FAIL trong $2"; fi
}
MD_FEED="q DB select string_agg(md5(prosrc),',') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=" # (dùng hàm bên dưới)
md5of() { q "$1" "select string_agg(md5(p.prosrc), ',') from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = '$2'"; }
PROD_FEED=2697eb50daaf7c085da22adaddc2baa2; PROD_SCOPED=47bf0f5f3382086d19ad6d0b184644cc
NEW_FEED="$(grep -o 'social_feed = [0-9a-f]*' "$ROOT/db/lesson_clip_card_v1_setup.sql" | head -1 | awk '{print $3}')"
NEW_SCOPED="$(grep -o 'social_feed_scoped = [0-9a-f]*' "$ROOT/db/lesson_clip_card_v1_setup.sql" | head -1 | awk '{print $3}')"
GATE() { local f=$1 db=$2; q "$db" "select item from ($(sed 's/;[[:space:]]*$//' "$f")) z where section = 'GATE'"; }

echo "── Tĩnh"
for f in setup rollback; do
  grep -qiE '^\s*(begin|commit|rollback)\s*;' "$ROOT/db/lesson_clip_card_v1_$f.sql" && fail "$f có begin/commit" || true
done
ok "setup/rollback không có begin/commit (prod-db.py bọc transaction)"
if grep -v '^[[:space:]]*--' "$ROOT/db/lesson_clip_card_v1_setup.sql" | grep -qiE 'create (table|policy|index|trigger|schema|type)|alter (table|policy)|drop |insert |update |delete |truncate'; then
  fail "setup có DDL bảng/policy/ghi dữ liệu"; else ok "setup KHÔNG tạo bảng/cột/policy/trigger/chỉ mục và KHÔNG ghi dữ liệu (chỉ create or replace function)"; fi
if grep -v '^[[:space:]]*--' "$ROOT/db/lesson_clip_card_v1_setup.sql" | grep -qiE "youtu|https?://"; then fail "setup nhắc URL/YouTube"; else ok "setup không chứa URL/YouTube"; fi

echo "── Nền = production giả lập (md5 phải KHỚP production)"
grep -v '^create role\|^grant anon, authenticated to authenticator' "$ROOT/db/tests/local/social_fixture.sql" >/dev/null
"$PGBIN/createdb" -h "$TMP" -p "$PORT" -U postgres base
psqld base -f "$ROOT/db/tests/local/social_fixture.sql" >/dev/null
for f in package_student_identity_guard community_setup group_code_setup class_social_posts_setup class_social_learning_loop_setup profile_media_setup class_social_friends_wall_setup; do psqld base -f "$ROOT/db/$f.sql" >/dev/null; done
psqld base -f "$ROOT/db/tests/local/learning_threads_fixture.sql" >/dev/null
for f in learning_threads_p1_setup learning_threads_p2_setup social_classes_v1_setup social_feed_v1_setup; do psqld base -f "$ROOT/db/$f.sql" >/dev/null; done
psqld base -f "$ROOT/db/tests/local/teamlab_publications_fixture.sql" >/dev/null
psqld base -f "$ROOT/db/tests/local/teamlab_publications_seed.sql" >/dev/null
for f in social_feed_teamlab_publications_v1_setup social_feed_teamlab_publications_v2_setup; do mig base "$ROOT/db/$f.sql" >/dev/null; done
psqld base -f "$ROOT/db/tests/local/class_checkpoints_fixture.sql" >/dev/null
psqld base -f "$ROOT/db/tests/local/class_checkpoints_fixture_data.sql" >/dev/null
psqld base -f "$ROOT/db/tests/local/ugc_safety_min_fixture.sql" >/dev/null
# hàm _safe THẬT trích nguyên văn từ migration UGC Safety (không viết lại)
awk '/^create or replace function public.social_feed_safe/{p=1} p{print} /^grant execute on function public.social_feed_scoped_safe/{p=0}' "$ROOT/db/class_ugc_safety_v1_setup.sql" > "$TMP/safe.sql"
grep -q 'social_feed_scoped_safe' "$TMP/safe.sql" && grep -q 'class_ugc_pair_blocked' "$TMP/safe.sql" || fail "không trích được hàm _safe thật"
psqld base -f "$TMP/safe.sql" >/dev/null
[ "$(md5of base social_feed)" = "$PROD_FEED" ] && ok "nền: social_feed md5 = production ($PROD_FEED)" || fail "nền social_feed md5 $(md5of base social_feed)"
[ "$(md5of base social_feed_scoped)" = "$PROD_SCOPED" ] && ok "nền: social_feed_scoped md5 = production ($PROD_SCOPED)" || fail "nền social_feed_scoped md5 $(md5of base social_feed_scoped)"
[ "$(GATE "$ROOT/db/lesson_clip_card_v1_preflight.sql" base)" = "PASS" ] && ok "preflight trên nền production: GATE = PASS" || { psqld base -c "$(sed 's/;[[:space:]]*$//' "$ROOT/db/lesson_clip_card_v1_preflight.sql")"; fail "preflight"; }

echo "── Cổng drift: hàm Feed lệch → DỪNG, không ghi gì"
"$PGBIN/createdb" -h "$TMP" -p "$PORT" -U postgres -T base drift1
psqld drift1 -c "$(python3 - <<'PY'
import re,subprocess
t=subprocess.run(['git','-C','.','show','HEAD:db/social_feed_teamlab_publications_v2_setup.sql'],capture_output=True,text=True).stdout
m=re.search(r'(create or replace function public\.social_feed\s*\(.*?\bas\s+\$\$)(.*?)(\$\$;)',t,re.S)
print(m.group(1)+m.group(2).replace('limit least','/* dự án khác đã sửa */ limit least')+m.group(3))
PY
)" >/dev/null
D0="$(md5of drift1 social_feed)"
[ "$D0" != "$PROD_FEED" ] || fail "không tạo được drift"
stops drift1 "$ROOT/db/lesson_clip_card_v1_setup.sql" "$TMP/d1.err" LESSON_CLIP_GATE_FAIL "social_feed lệch → migration DỪNG (LESSON_CLIP_GATE_FAIL)"
[ "$(md5of drift1 social_feed)" = "$D0" ] && [ "$(q drift1 "select count(*) from pg_proc where proname in ('social_feed_clip_items','social_clip_added_at')")" = "0" ] && ok "drift: không ghi gì (hàm giữ nguyên, không hàm mới)" || fail "drift đã ghi"
"$PGBIN/createdb" -h "$TMP" -p "$PORT" -U postgres -T base drift2
psqld drift2 -c "create or replace function public.social_feed_scoped(p_scope text, p_before timestamptz default null, p_before_key text default null, p_limit int default 20) returns table(kind text, sort_at timestamptz, sort_key text, post jsonb, thread jsonb) language sql as \$\$ select null::text, null::timestamptz, null::text, null::jsonb, null::jsonb where false \$\$" >/dev/null
stops drift2 "$ROOT/db/lesson_clip_card_v1_setup.sql" "$TMP/d2.err" LESSON_CLIP_GATE_FAIL "social_feed_scoped lệch → migration DỪNG"
"$PGBIN/createdb" -h "$TMP" -p "$PORT" -U postgres -T base drift3
psqld drift3 -c "drop function tva_private.can_read_class_curriculum(uuid) cascade" >/dev/null
stops drift3 "$ROOT/db/lesson_clip_card_v1_setup.sql" "$TMP/d3.err" LESSON_CLIP_GATE_FAIL "thiếu can_read_class_curriculum → DỪNG"

echo "── Dữ liệu thử + ảnh chụp bằng hàm CŨ"
"$PGBIN/createdb" -h "$TMP" -p "$PORT" -U postgres -T base t
run_test t "$ROOT/db/tests/lesson_clip_card_v1_pre.sql"
"$PGBIN/createdb" -h "$TMP" -p "$PORT" -U postgres -T t perf_old   # bản cũ + dữ liệu, để đo hiệu năng so sánh

echo "── Migration ×2 + postflight"
mig t "$ROOT/db/lesson_clip_card_v1_setup.sql" >/dev/null || fail "migration 1"; ok "migration lần 1"
mig t "$ROOT/db/lesson_clip_card_v1_setup.sql" >/dev/null || fail "migration 2"; ok "migration lần 2 (idempotent, cổng nhận bản G3)"
[ "$(md5of t social_feed)" = "$NEW_FEED" ] && [ "$(md5of t social_feed_scoped)" = "$NEW_SCOPED" ] && ok "md5 sau migration = md5 ghi trong file ($NEW_FEED / $NEW_SCOPED)" || fail "md5 sau migration lệch file"
[ "$(GATE "$ROOT/db/lesson_clip_card_v1_postflight.sql" t)" = "PASS" ] && ok "postflight: GATE = PASS" || { psqld t -c "$(sed 's/;[[:space:]]*$//' "$ROOT/db/lesson_clip_card_v1_postflight.sql")"; fail "postflight"; }
[ "$(GATE "$ROOT/db/lesson_clip_card_v1_preflight.sql" t)" = "PASS" ] && ok "preflight vẫn PASS sau migration (nhận bản G3)" || fail "preflight sau migration"
psqld t -f "$ROOT/db/rls_setup.sql" >/dev/null && ok "rls_setup.sql chạy lại được" || fail "rls_setup"
[ "$(md5of t social_feed)" = "$NEW_FEED" ] && ok "rls_setup không đụng hàm Feed" || fail "rls_setup đổi hàm Feed"

[ -n "${DEBUG_SQL:-}" ] && { PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -h "$TMP" -p "$PORT" -U postgres -d t -f "$DEBUG_SQL"; exit 0; }
echo "── Test SQL theo identity (quyền, payload, sắp xếp, phân trang, hồi quy)"
run_test t "$ROOT/db/tests/lesson_clip_card_v1_test.sql"

echo "── Backfill added_at (một lần, cho khối đã xuất bản trước G3)"
( cd "$ROOT" && run_test t db/tests/lesson_clip_card_v1_backfill_test.sql )
"$PGBIN/createdb" -h "$TMP" -p "$PORT" -U postgres -T base bf_nomig   # chưa cài migration → backfill phải DỪNG
stops bf_nomig "$ROOT/db/lesson_clip_card_v1_backfill_added_at.sql" "$TMP/bf1.err" BACKFILL_GATE_FAIL "backfill khi CHƯA có migration → DỪNG (không ghi)"
if grep -v '^[[:space:]]*--' "$ROOT/db/lesson_clip_card_v1_backfill_added_at.sql" | grep -qiE 'youtu|https?://'; then fail "backfill nhắc URL/YouTube"; else ok "backfill không chứa URL/YouTube/ID"; fi
echo "── Hiệu năng (dữ liệu lớn: 1 lớp 400 buổi × 4 khối video, 90 ngày) — so sánh hàm cũ / mới"
for db in perf_old; do
psqld $db -c "
insert into public.class_sessions (id, class_id, session_number, title, start_at, event_type, status)
  select gen_random_uuid(), 'b1000000-0000-4000-8000-000000000001', 1000 + g, 'perf ' || g, now() - (g || ' hours')::interval, 'lesson', 'scheduled' from generate_series(1, 400) g;
insert into public.class_lesson_content (session_id, status, blocks)
  select s.id, 'published',
    (select jsonb_agg(jsonb_build_object('kind', 'study', 'title', 'k' || i, 'text', repeat('x', 400))) from generate_series(1, 20) i)
    || (select jsonb_agg(jsonb_build_object('kind', 'video', 'title', 'Ôn nhanh ' || s.session_number || '/' || j, 'url', 'https://youtu.be/ZZperf' || j,
         'added_at', to_char((now() - ((s.session_number % 80) || ' days')::interval - (j || ' minutes')::interval) at time zone 'utc', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'))) from generate_series(1, 4) j)
  from public.class_sessions s where s.session_number > 1000;
analyze;" >/dev/null
done
"$PGBIN/createdb" -h "$TMP" -p "$PORT" -U postgres -T perf_old perf_new
mig perf_new "$ROOT/db/lesson_clip_card_v1_setup.sql" >/dev/null
timeit() { # db → ms trung vị 7 lần gọi social_feed_safe (trang 20) + scoped my_classes
  psqld "$1" -tA <<'SQL'
select set_config('request.jwt.claims', json_build_object('sub', 'aaaaaaaa-0000-4000-8000-00000000000a', 'role', 'authenticated')::text, false);
set role authenticated;
do $$ declare i int; t0 timestamptz; a numeric[] := '{}'; b numeric[] := '{}'; n int;
begin
  for i in 1..8 loop
    t0 := clock_timestamp(); select count(*) into n from public.social_feed_safe(null, null, 20); a := a || (extract(epoch from clock_timestamp() - t0) * 1000)::numeric;
    t0 := clock_timestamp(); select count(*) into n from public.social_feed_scoped_safe('my_classes', null, null, 20); b := b || (extract(epoch from clock_timestamp() - t0) * 1000)::numeric;
  end loop;
  perform set_config('t.perf', (select round((percentile_cont(0.5) within group (order by x))::numeric, 1) from unnest(a[2:]) x) || '/' || (select round((percentile_cont(0.5) within group (order by x))::numeric, 1) from unnest(b[2:]) x), false);
end $$;
select current_setting('t.perf');
SQL
}
P_OLD="$(timeit perf_old | tail -1)"; P_NEW="$(timeit perf_new | tail -1)"
echo "   trung vị ms (for_you_safe/my_classes_safe, trang 20): CŨ = $P_OLD · MỚI = $P_NEW  [1.600 khối video, 400 buổi × 24 khối]"
NEW_YOU="${P_NEW%/*}"; NEW_MY="${P_NEW#*/}"
python3 -c "import sys; sys.exit(0 if float('$NEW_YOU') < 500 and float('$NEW_MY') < 500 else 1)" && ok "hiệu năng: for_you ${NEW_YOU}ms · my_classes ${NEW_MY}ms (< 500ms với dữ liệu lớn hơn production nhiều lần)" || fail "hiệu năng chậm: $P_NEW"
CNT="$(psqld perf_new -tA -c "select set_config('request.jwt.claims', json_build_object('sub','aaaaaaaa-0000-4000-8000-00000000000a','role','authenticated')::text,false); set role authenticated; select count(*) from public.social_feed(null,null,50) where kind='lesson_clip'" | tail -1)"
[ "$CNT" -gt 0 ] && ok "dữ liệu lớn: Feed vẫn trả thẻ clip ($CNT/trang 50)" || fail "dữ liệu lớn không có thẻ"

echo "── Rollback ×2 → đúng md5 production; cổng rollback; cài lại"
DATA0="$(q t "select md5(string_agg(session_id::text || status || blocks::text || coalesce(updated_at::text,''), '|' order by session_id)) from public.class_lesson_content")"
mig t "$ROOT/db/lesson_clip_card_v1_rollback.sql" >/dev/null || fail "rollback 1"
mig t "$ROOT/db/lesson_clip_card_v1_rollback.sql" >/dev/null || fail "rollback 2"; ok "rollback ×2 (idempotent)"
[ "$(md5of t social_feed)" = "$PROD_FEED" ] && [ "$(md5of t social_feed_scoped)" = "$PROD_SCOPED" ] && ok "sau rollback: md5 hai hàm Feed = production (nguyên văn)" || fail "rollback không về md5 gốc"
[ "$(q t "select count(*) from pg_proc where proname in ('social_feed_clip_items','social_clip_added_at')")" = "0" ] && ok "rollback gỡ hai hàm nội bộ" || fail "còn hàm nội bộ"
q t "select has_function_privilege('authenticated','public.social_feed(timestamptz,text,int)','execute') and not has_function_privilege('anon','public.social_feed(timestamptz,text,int)','execute')" | grep -q '^t$' && ok "ACL Feed sau rollback đúng" || fail "ACL sau rollback"
[ "$(q t "select md5(string_agg(session_id::text || status || blocks::text || coalesce(updated_at::text,''), '|' order by session_id)) from public.class_lesson_content")" = "$DATA0" ] && ok "rollback không đụng dữ liệu giáo trình (md5 toàn bảng giữ nguyên)" || fail "rollback đổi dữ liệu"
mig t "$ROOT/db/lesson_clip_card_v1_setup.sql" >/dev/null && ok "cài lại sau rollback"
psqld t -c "create or replace function public.social_feed_scoped(p_scope text, p_before timestamptz default null, p_before_key text default null, p_limit int default 20) returns table(kind text, sort_at timestamptz, sort_key text, post jsonb, thread jsonb) language sql as \$\$ select null::text, null::timestamptz, null::text, null::jsonb, null::jsonb where false \$\$" >/dev/null
T0="$(md5of t social_feed_scoped)"
stops t "$ROOT/db/lesson_clip_card_v1_rollback.sql" "$TMP/rb.err" LESSON_CLIP_ROLLBACK_GATE_FAIL "dự án khác đổi hàm sau G3 → rollback DỪNG, không ghi đè"
[ "$(md5of t social_feed_scoped)" = "$T0" ] && ok "cổng rollback: không ghi gì" || fail "rollback ghi dù cổng"
echo "── XONG: toàn bộ cổng DB đạt"
