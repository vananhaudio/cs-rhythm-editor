#!/usr/bin/env bash
# Test Thư viện hợp âm chuẩn hoá V1 — Lát 1 ở tầng DB trên cluster PostgreSQL 17 TẠM (tự xoá khi xong).
# KHÔNG kết nối production. Cần: postgresql@17 (Homebrew), node.
#   bash scripts/test-chord-library-db.sh
# Phủ: migration ×2 (idempotent, một transaction) · kho MusicXML không đổi một byte (bảng thế thân)
# · chord_fold_vi đối chiếu foldVi THẬT của repo · chạy lại rls_setup.sql (self_managed) · quyền bảng/EXECUTE
# · test SQL theo identity (A–G) · ca ĐỒNG THỜI (2 phiên psql + pgbench) · rollback chặn khi có dữ liệu
# · rollback ×2 + cài lại · cổng drift.
# SRC = nơi chứa file chord_library (mặc định = repo); ROOT = repo (file sẵn có). Tách ra để chạy được
# bộ file từ thư mục khác trước khi chép vào repo.
set -euo pipefail
export LC_ALL=C LANG=C

ROOT="${ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
SRC="${SRC:-$ROOT}"
RLS="${RLS:-$ROOT/db/rls_setup.sql}"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
TMP="$(mktemp -d /tmp/tvachord.XXXXXX)"
PORT="${PORT:-$((55800 + RANDOM % 90))}"
cleanup() { "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT

"$PGBIN/initdb" -D "$TMP/data" -U postgres --auth=trust --encoding=UTF8 --locale=C >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/pg.log" -w start >/dev/null \
  || { cat "$TMP/pg.log"; exit 1; }

psqld() { local db=$1; shift; PGOPTIONS="-c client_min_messages=warning" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d "$db" -v ON_ERROR_STOP=1 "$@"; }
q() { psqld "$1" -tA -c "$2"; }
mig() { psqld "$1" -1 -f "$2"; }   # cả file trong MỘT transaction, như khi chạy production
fail() { echo "FAIL: $*"; exit 1; }
ok() { echo "PASS: $*"; }

SETUP="$SRC/db/chord_library_v1_setup.sql"
ROLLBACK="$SRC/db/chord_library_v1_rollback.sql"
grep -v '^create role\|^grant anon, authenticated to authenticator' "$ROOT/db/tests/local/social_fixture.sql" > "$TMP/fixture_noroles.sql"
grep -v '^create role' "$SRC/db/tests/local/chord_library_fixture.sql" > "$TMP/chord_fixture_noroles.sql"
FIRST=1
baseline() {
  local db=$1
  "$PGBIN/createdb" -h "$TMP" -p "$PORT" -U postgres "$db"
  if [ "$FIRST" = 1 ]; then
    psqld "$db" -f "$ROOT/db/tests/local/social_fixture.sql" >/dev/null
  else psqld "$db" -f "$TMP/fixture_noroles.sql" >/dev/null; fi
  for f in package_student_identity_guard community_setup; do psqld "$db" -f "$ROOT/db/$f.sql" >/dev/null; done
  if [ "$FIRST" = 1 ]; then psqld "$db" -f "$SRC/db/tests/local/chord_library_fixture.sql" >/dev/null; FIRST=0
  else psqld "$db" -f "$TMP/chord_fixture_noroles.sql" >/dev/null; fi
  psqld "$db" -f "$ROOT/db/nhipphach_capabilities_setup.sql" >/dev/null
}
# Dấu vân tay kho MusicXML: cột + dữ liệu + policy + cờ RLS + quyền bảng + trigger.
mxl() { q "$1" "select md5(
    coalesce((select string_agg(a::text, '|' order by id) from public.musicxml_library a), '')
 || (select string_agg(column_name || ':' || data_type || ':' || is_nullable, ',' order by ordinal_position)
       from information_schema.columns where table_schema = 'public' and table_name = 'musicxml_library')
 || coalesce((select string_agg(policyname || cmd || roles::text || coalesce(qual, '') || coalesce(with_check, ''), ',' order by policyname)
       from pg_policies where schemaname = 'public' and tablename = 'musicxml_library'), '')
 || (select relrowsecurity::text || coalesce(relacl::text, '') from pg_class where oid = 'public.musicxml_library'::regclass)
 || coalesce((select string_agg(tgname, ',' order by tgname) from pg_trigger where tgrelid = 'public.musicxml_library'::regclass), ''))"; }
# Mọi object có sẵn KHÁC (hàm + policy + bảng ngoài chord_*) — migration chỉ được THÊM.
others() { q "$1" "select md5(
    coalesce((select string_agg(p.proname || md5(p.prosrc) || coalesce(p.proacl::text, ''), ',' order by p.proname, p.oid::regprocedure::text)
       from pg_proc p join pg_namespace s on s.oid = p.pronamespace
      where s.nspname in ('public', 'storage', 'auth') and p.proname not like 'chord%' and p.proname <> 'my_chordlib_caps'), '')
 || coalesce((select string_agg(schemaname || tablename || policyname || cmd || roles::text || coalesce(qual, '') || coalesce(with_check, ''), ',' order by schemaname, tablename, policyname)
       from pg_policies where policyname not like 'chord sheet sources%'), '')
 || coalesce((select string_agg(c.relname || coalesce(c.relacl::text, '') || c.relrowsecurity::text, ',' order by c.relname)
       from pg_class c join pg_namespace s on s.oid = c.relnamespace
      where s.nspname = 'public' and c.relkind = 'r' and c.relname not like 'chord\_sheet%'), ''))"; }

echo "── Rào chắn tĩnh"
for f in "$SETUP" "$ROLLBACK"; do
  [ "$(grep -v '^[[:space:]]*--' "$f" | grep -ci 'musicxml' || true)" = "0" ] || fail "$(basename "$f") có câu lệnh nhắc tới musicxml"
done
ok "setup + rollback: KHÔNG câu lệnh nào nhắc tới musicxml_library"
[ "$(grep -v '^[[:space:]]*--' "$SETUP" | grep -ciE '^[[:space:]]*(begin|commit)[[:space:]]*;' || true)" = "0" ] && ok "setup không tự begin/commit" || fail "setup có begin/commit"

echo "── Baseline (fixture + community_setup + nhipphach_capabilities_setup như production)"
baseline tva_chord
[ "$(q tva_chord "select md5(prosrc) from pg_proc where proname = 'is_teacher'")" = "19b164504b4ce59b9bbdb4b0b64e48ad" ] \
  && ok "md5 is_teacher bản repo = production" || fail "md5 is_teacher lệch"
MXL0="$(mxl tva_chord)"; OTH0="$(others tva_chord)"

echo "── Migration ×2"
mig tva_chord "$SETUP" >/dev/null || fail "migration 1"; ok "migration lần 1"
mig tva_chord "$SETUP" >/dev/null || fail "migration 2"; ok "migration lần 2 (idempotent)"
[ "$(mxl tva_chord)" = "$MXL0" ] && ok "MusicXML Library KHÔNG đổi (cột, dữ liệu, policy, RLS, quyền, trigger)" || fail "musicxml_library bị đổi"
[ "$(others tva_chord)" = "$OTH0" ] && ok "không hàm / policy / quyền bảng sẵn có nào bị đổi — migration chỉ THÊM" || fail "object sẵn có bị đổi"
[ "$(q tva_chord "select count(*) from public.tool_capabilities where tool_id = 'chordlib'")/$(q tva_chord "select enabled::text || status || coalesce(route, 'null') from public.edu_tools where id = 'chordlib'")" = "6/falseoff" ] \
  && ok "6 dòng capability chordlib; dòng edu_tools ẨN (enabled=false, status=off, route rỗng)" || fail "capability / edu_tools sai"
q tva_chord "update public.tool_capabilities set allowed = false where tool_id = 'chordlib' and role = 'teacher' and capability = 'contribute'" >/dev/null
mig tva_chord "$SETUP" >/dev/null
[ "$(q tva_chord "select allowed from public.tool_capabilities where tool_id = 'chordlib' and role = 'teacher' and capability = 'contribute'")" = "f" ] \
  && ok "chạy lại migration KHÔNG đè cấu hình Admin đã chỉnh" || fail "migration đè cấu hình Admin"
q tva_chord "update public.tool_capabilities set allowed = true where tool_id = 'chordlib' and role = 'teacher' and capability = 'contribute'" >/dev/null

echo "── Quyền bảng + EXECUTE"
[ "$(q tva_chord "select count(*) from information_schema.role_table_grants where table_schema = 'public' and table_name in ('chord_sheets', 'chord_sheet_versions') and grantee in ('anon', 'authenticated', 'PUBLIC')")" = "0" ] \
  && ok "anon/authenticated: 0 quyền trên 2 bảng" || fail "còn quyền bảng"
[ "$(q tva_chord "select count(*) from pg_class where relname in ('chord_sheets', 'chord_sheet_versions') and relrowsecurity")/$(q tva_chord "select count(*) from pg_policies where tablename in ('chord_sheets', 'chord_sheet_versions')")" = "2/0" ] \
  && ok "2 bảng bật RLS, 0 policy" || fail "RLS/policy sai"
[ "$(q tva_chord "select count(*) from pg_proc p where (p.proname like 'chord%' or p.proname = 'my_chordlib_caps') and has_function_privilege('anon', p.oid, 'execute')")" = "0" ] \
  && ok "anon: 0 hàm chord_* gọi được" || fail "anon gọi được hàm"
[ "$(q tva_chord "select string_agg(p.proname, ',' order by p.proname) from pg_proc p where (p.proname like 'chord%' or p.proname = 'my_chordlib_caps') and has_function_privilege('authenticated', p.oid, 'execute')")" \
  = "chord_fold_vi,chord_sheet_approve,chord_sheet_contribute,chord_sheet_get,chord_sheet_reject,chord_sheet_search,chord_source_can_write,chordlib_can,my_chordlib_caps" ] \
  && ok "authenticated: đúng 9 hàm (5 RPC + caps + 3 hàm phụ)" || fail "danh sách EXECUTE của authenticated lệch"
[ "$(q tva_chord "select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and (p.proname like 'chord%' or p.proname = 'my_chordlib_caps') and coalesce(obj_description(p.oid, 'pg_proc'), '') not like 'chord_library_v1:%'")" = "0" ] \
  && ok "mọi hàm đều mang nhãn chord_library_v1 (cổng drift nhận ra)" || fail "hàm thiếu nhãn"

echo "── chord_fold_vi (SQL) đối chiếu foldVi THẬT (src/class-social/comments/khoAdapter.ts)"
node - "$ROOT/src/class-social/comments/khoAdapter.ts" > "$TMP/fold.sql" <<'NODE'
const src = require('fs').readFileSync(process.argv[2], 'utf8')
const m = src.match(/export function foldVi\(s: string\): string \{\n([\s\S]*?)\n\}/)
if (!m) { console.error('không tìm thấy foldVi'); process.exit(1) }
const foldVi = new Function('s', m[1])
const fold = t => foldVi(t).replace(/\s+/g, ' ').trim()   // như `fold` của src/thuvien/masterLibrary.ts
const cases = [
  'Con đường xưa em đi', 'CON ĐƯỜNG XƯA EM ĐI', 'con duong xua em di', '  Con   Đường\tXưa  Em Đi  ',
  'Chuyến Tàu Hoàng Hôn', 'Diễm Xưa', 'DIỄM  Xưa', 'Nắng Thuỷ Tinh', 'Nắng Thủy Tinh', 'Ướt Mi', 'Hạ Trắng',
  'Đêm Đông', 'đ Đ ð', 'Ngẫu Hứng Lý Qua Cầu', 'Thương Quá Việt Nam!', 'Em ơi! Hà Nội phố…', 'Bài 1 (bản 2) — [Am]',
  'ắằẳẵặ ấầẩẫậ éèẻẽẹ ếềểễệ íìỉĩị óòỏõọ ốồổỗộ ớờởỡợ úùủũụ ứừửữự ýỳỷỹỵ',
  'ẮẰẲẴẶ ẤẦẨẪẬ ÉÈẺẼẸ ẾỀỂỄỆ ÍÌỈĨỊ ÓÒỎÕỌ ỐỒỔỖỘ ỚỜỞỠỢ ÚÙỦŨỤ ỨỪỬỮỰ ÝỲỶỸỴ',
  'Con đường xưa em đi'.normalize('NFD'), 'Trịnh Công Sơn', 'Châu Kỳ – Hồ Đình Phương', 'Yesterday', 'Hotel California',
  'a b　c', 'dòng 1\ndòng 2', '', '   ',
]
const lit = t => { let tag = 'c'; while (t.includes('$' + tag + '$')) tag += 'x'; return '$' + tag + '$' + t + '$' + tag + '$' }
for (const c of cases) console.log(`select case when public.chord_fold_vi(${lit(c)}) = ${lit(fold(c))} then 'ok' else 'LECH: ' || ${lit(c)} || ' → sql=' || public.chord_fold_vi(${lit(c)}) || ' ts=' || ${lit(fold(c))} end;`)
NODE
FOLD="$(psqld tva_chord -tA -f "$TMP/fold.sql")"
NCASE="$(grep -c '^select case when public.chord_fold_vi' "$TMP/fold.sql")"
[ "$NCASE" -ge 28 ] && [ "$(echo "$FOLD" | grep -c '^ok$')" = "$NCASE" ] && [ "$(echo "$FOLD" | grep -vc '^ok$' || true)" = "0" ] \
  && ok "chord_fold_vi = foldVi trên $NCASE ca (đủ bảng nguyên âm có dấu, NFD/NFC, khoảng trắng lạ)" \
  || { echo "$FOLD" | grep -v '^ok$'; fail "chord_fold_vi lệch foldVi"; }

echo "── Chạy lại rls_setup.sql (2 bảng mới trong self_managed)"
psqld tva_chord -f "$RLS" >/dev/null || fail "rls_setup"
[ "$(q tva_chord "select count(*) from pg_policies where tablename in ('chord_sheets', 'chord_sheet_versions')")" = "0" ] \
  && ok "sau rls_setup.sql: 2 bảng chord_* VẪN 0 policy (không bị áp policy rộng)" || fail "rls_setup áp policy lên bảng chord_*"

echo "── Test SQL (A–G: quyền / phiên bản / chuẩn hoá / storage)"
PGOPTIONS="-c client_min_messages=notice" "$PGBIN/psql" -X -q -h "$TMP" -p "$PORT" -U postgres -d tva_chord -v ON_ERROR_STOP=1 \
  -f "$SRC/db/tests/chord_library_v1_test.sql" 2>&1 | sed -E 's/^psql:[^:]*:[0-9]*: (NOTICE|ERROR):  //' | tee "$TMP/t.log" | grep -v '^$' || true
grep -q "ALL PASS" "$TMP/t.log" || fail "test SQL"
echo "  ($(grep -c '^PASS' "$TMP/t.log") assertion PASS)"

# >>> CONCURRENCY — hồi quy cho các lỗi chỉ lộ khi hai request chạy cùng lúc (review 04/10: H1, M1, M5)
echo "── Đồng thời: H1 deadlock · M1 giới hạn/trùng · M5 xoá file ↔ đóng góp"
UB=bbbbbbbb-0000-4000-8000-00000000000b; UT=dddddddd-0000-4000-8000-00000000000d; UX=ffffffff-0000-4000-8000-00000000000f
as() { printf "select set_config('request.jwt.claims', '{\"sub\":\"%s\",\"role\":\"authenticated\"}', false); set role authenticated;" "$1"; }
sess() { "$PGBIN/psql" -X -q -tA -h "$TMP" -p "$PORT" -U postgres -d tva_chord "$@" 2>&1 || true; }   # lỗi là kết quả cần đọc, không phải lý do dừng
uuid() { q tva_chord "select gen_random_uuid()"; }

# M1a — giới hạn 30 bản chờ: B đang có 29, hai phiên cùng gửi → đúng MỘT bản lọt.
NFILL=$(q tva_chord "select greatest(29 - count(*), 0) from chord_sheet_versions where contributed_by = '$UB' and review_status = 'private'")
sess -c "$(as $UB) do \$\$ begin for i in 1..$NFILL loop perform public.chord_sheet_contribute(p_text => 'lấp ' || i, p_title => 'Lấp chỗ ' || i); end loop; end \$\$;" >/dev/null
[ "$(q tva_chord "select count(*) from chord_sheet_versions where contributed_by = '$UB' and review_status = 'private'")" = "29" ] || fail "không dựng được 29 bản chờ"
( sess -c "$(as $UB) begin; select public.chord_sheet_contribute(p_text => 'đua 1', p_title => 'Đua 1'); select pg_sleep(1.5); commit;" >/dev/null ) &
sleep 0.4
OUT="$(sess -c "$(as $UB) select public.chord_sheet_contribute(p_text => 'đua 2', p_title => 'Đua 2');")"; wait
[ "$(q tva_chord "select count(*) from chord_sheet_versions where contributed_by = '$UB' and review_status = 'private'")" = "30" ] && echo "$OUT" | grep -q CHORDLIB_LIMIT \
  && ok "M1: 29 bản chờ + 2 request đồng thời → dừng đúng 30, request sau nhận CHORDLIB_LIMIT" || { echo "$OUT"; fail "M1: vượt giới hạn 30 khi gửi đồng thời"; }

# M1b — dò trùng: hai phiên cùng gửi y hệt → một bài, request sau nhận duplicate.
( sess -c "$(as $UX) begin; select public.chord_sheet_contribute(p_text => 'trùng đồng thời', p_title => 'Trùng Đồng Thời'); select pg_sleep(1.5); commit;" >/dev/null ) &
sleep 0.4
OUT="$(sess -c "$(as $UX) select public.chord_sheet_contribute(p_text => 'trùng đồng thời', p_title => 'trùng đồng thời') ->> 'duplicate';" | tail -1)"; wait
[ "$(q tva_chord "select count(*) from chord_sheets where title_key = 'trung dong thoi'")/$OUT" = "1/true" ] \
  && ok "M1: 2 request y hệt đồng thời → 1 bài, request sau nhận duplicate" || fail "M1: tạo bài trùng khi gửi đồng thời ($OUT)"

# M5a — xoá file đang chạy, đóng góp tới sau: phải chờ rồi thấy file đã mất → từ chối.
V1=$(uuid); SRC1="[{\"path\": \"$UX/$V1/1.png\", \"mime\": \"image/png\", \"sha256\": \"$(printf 'a%.0s' $(seq 64))\"}]"
sess -c "$(as $UX) insert into storage.objects (bucket_id, name) values ('chord-sheet-sources', '$UX/$V1/1.png');" >/dev/null
( sess -c "$(as $UX) begin; delete from storage.objects where name = '$UX/$V1/1.png'; select pg_sleep(1.5); commit;" >/dev/null ) &
sleep 0.4
OUT="$(sess -c "$(as $UX) select public.chord_sheet_contribute(p_text => 'm5a', p_title => 'M5a', p_version_id => '$V1', p_sources => '$SRC1');")"; wait
[ "$(q tva_chord "select count(*) from chord_sheet_versions where id = '$V1'")" = "0" ] && echo "$OUT" | grep -q 'chưa được tải lên' \
  && ok "M5: xoá file ↔ đóng góp đồng thời (xoá trước) → đóng góp bị từ chối, không ghi phiên bản trỏ tới file đã mất" \
  || { echo "$OUT"; fail "M5: phiên bản trỏ tới file đã bị xoá"; }
# M5b — đóng góp đang chạy, xoá + tải thêm tới sau: phải chờ rồi bị chặn, file còn nguyên.
V2=$(uuid); SRC2="[{\"path\": \"$UX/$V2/1.png\", \"mime\": \"image/png\", \"sha256\": \"$(printf 'a%.0s' $(seq 64))\"}]"
sess -c "$(as $UX) insert into storage.objects (bucket_id, name) values ('chord-sheet-sources', '$UX/$V2/1.png');" >/dev/null
( sess -c "$(as $UX) begin; select public.chord_sheet_contribute(p_text => 'm5b', p_title => 'M5b', p_version_id => '$V2', p_sources => '$SRC2'); select pg_sleep(1.5); commit;" >/dev/null ) &
sleep 0.4
sess -c "$(as $UX) delete from storage.objects where name = '$UX/$V2/1.png';" >/dev/null
OUT="$(sess -c "$(as $UX) insert into storage.objects (bucket_id, name) values ('chord-sheet-sources', '$UX/$V2/2.png');")"; wait
[ "$(q tva_chord "select count(*) from storage.objects where name like '$UX/$V2/%'")/$(q tva_chord "select jsonb_array_length(sources) from chord_sheet_versions where id = '$V2'")" = "1/1" ] && echo "$OUT" | grep -q 'row-level security' \
  && ok "M5: đóng góp ↔ xoá/tải thêm đồng thời (đóng góp trước) → file còn nguyên, không thêm được file mồ côi" || { echo "$OUT"; fail "M5: file nguồn bị xoá/thêm sau khi phiên bản đã ghi"; }

# H1 — approve ↔ contribute (cha = bản đang được duyệt) dưới tải: không deadlock, không client nào chết.
HS=$(sess -c "$(as $UT) select public.chord_sheet_contribute(p_text => 'h1 gốc', p_title => 'H1 deadlock');" | tail -1)
H_SHEET=$(q tva_chord "select ('$HS'::jsonb) ->> 'sheet_id'"); H_VER=$(q tva_chord "select ('$HS'::jsonb) ->> 'version_id'")
H_VER2=$(sess -c "$(as $UT) select public.chord_sheet_contribute(p_text => 'h1 bản hai', p_sheet_id => '$H_SHEET') ->> 'version_id';" | tail -1)
PRE="begin; select set_config('request.jwt.claims', '{\"sub\":\"$UT\",\"role\":\"authenticated\"}', true); set local role authenticated;"
printf '%s\nselect public.chord_sheet_approve(%s);\ncommit;\n' "$PRE" "'$H_VER'" > "$TMP/h1_approve.sql"
printf '%s\nselect public.chord_sheet_approve(%s);\ncommit;\n' "$PRE" "'$H_VER2'" > "$TMP/h1_approve2.sql"
printf '\\set r random(1, 2000000000)\n%s\nselect public.chord_sheet_contribute(p_text => %s || :r, p_sheet_id => %s, p_parent_version_id => %s);\ncommit;\n' "$PRE" "'h1 '" "'$H_SHEET'" "'$H_VER'" > "$TMP/h1_contribute.sql"
DL0=$(grep -c 'deadlock detected' "$TMP/pg.log" || true)
"$PGBIN/pgbench" -n -h "$TMP" -p "$PORT" -U postgres -c 6 -j 2 -T 5 -f "$TMP/h1_approve.sql" -f "$TMP/h1_approve2.sql" -f "$TMP/h1_contribute.sql" tva_chord > "$TMP/pgb.log" 2>&1 || true
DL1=$(grep -c 'deadlock detected' "$TMP/pg.log" || true)
NTX=$(sed -n 's/^number of transactions actually processed: \([0-9]*\).*/\1/p' "$TMP/pgb.log")
[ "$DL1" = "$DL0" ] && ! grep -q 'aborted' "$TMP/pgb.log" && [ "${NTX:-0}" -gt 50 ] \
  && ok "H1: approve ↔ contribute dưới tải (6 client, 5s, $NTX giao dịch) → 0 deadlock, 0 client chết" \
  || { tail -5 "$TMP/pgb.log"; fail "H1: deadlock approve ↔ contribute ($((DL1 - DL0)) lần)"; }
[ "$(q tva_chord "select count(*) from chord_sheets s where s.id = '$H_SHEET' and s.canonical_version_id in ('$H_VER', '$H_VER2')")/$(q tva_chord "select count(*) = count(distinct version_number) from chord_sheet_versions where sheet_id = '$H_SHEET'")" = "1/t" ] \
  && ok "H1: sau tải — con trỏ canonical hợp lệ, version_number không trùng" || fail "H1: trạng thái sai sau tải"
# <<< CONCURRENCY

echo "── Rollback"
if mig tva_chord "$ROLLBACK" >/dev/null 2>&1; then fail "rollback lẽ ra phải DỪNG khi có đóng góp"; fi
[ "$(q tva_chord "select count(*) from chord_sheet_versions")" -gt 0 ] && ok "rollback DỪNG khi có đóng góp thật — dữ liệu còn nguyên" || fail "mất dữ liệu"
"$PGBIN/dropdb" -h "$TMP" -p "$PORT" -U postgres tva_chord
baseline tva_rb
MXL1="$(mxl tva_rb)"; OTH1="$(others tva_rb)"
mig tva_rb "$SETUP" >/dev/null || fail "cài trước rollback"
mig tva_rb "$ROLLBACK" >/dev/null || fail "rollback lần 1"; ok "rollback lần 1 (chưa có đóng góp)"
mig tva_rb "$ROLLBACK" >/dev/null || fail "rollback lần 2"; ok "rollback lần 2 (idempotent)"
[ "$(q tva_rb "select count(*) from pg_proc where proname like 'chord%' or proname = 'my_chordlib_caps'")/$(q tva_rb "select count(*) from pg_class where relname like 'chord\_sheet%'")/$(q tva_rb "select count(*) from pg_policies where policyname like 'chord sheet sources%'")/$(q tva_rb "select (select count(*) from tool_capabilities where tool_id = 'chordlib') + (select count(*) from edu_tools where id = 'chordlib')")" = "0/0/0/0" ] \
  && ok "rollback gỡ sạch hàm + bảng + policy storage + capability" || fail "rollback còn sót"
[ "$(mxl tva_rb)" = "$MXL1" ] && [ "$(others tva_rb)" = "$OTH1" ] && ok "sau rollback: MusicXML Library + mọi object sẵn có nguyên vẹn" || fail "rollback đụng object khác"
mig tva_rb "$SETUP" >/dev/null && [ "$(q tva_rb "select count(*) from pg_class where relname in ('chord_sheets', 'chord_sheet_versions')")" = "2" ] && ok "cài lại sau rollback" || fail "cài lại"

echo "── Cổng drift"
baseline tva_drift1
q tva_drift1 "create or replace function public.is_teacher() returns boolean language sql security definer set search_path = '' stable as \$\$ select true \$\$" >/dev/null
if mig tva_drift1 "$SETUP" >/dev/null 2>&1; then fail "migration lẽ ra phải dừng (is_teacher lệch)"; fi
[ "$(q tva_drift1 "select count(*) from pg_class where relname = 'chord_sheets'")" = "0" ] && ok "is_teacher bị sửa tay → migration DỪNG, không tạo nửa chừng" || fail "nửa migration"
baseline tva_drift2
q tva_drift2 "create table public.chord_sheets (id int)" >/dev/null
if mig tva_drift2 "$SETUP" >/dev/null 2>&1; then fail "migration lẽ ra phải dừng (bảng lạ)"; fi
ok "đã có bảng chord_sheets lạ → migration DỪNG"
baseline tva_drift3
q tva_drift3 "create function public.chord_fold_vi(text) returns text language sql as \$\$ select \$1 \$\$" >/dev/null
if mig tva_drift3 "$SETUP" >/dev/null 2>&1; then fail "migration lẽ ra phải dừng (hàm lạ)"; fi
ok "đã có hàm chord_fold_vi lạ → migration DỪNG, không ghi đè"
echo "ALL DB TESTS PASS"
