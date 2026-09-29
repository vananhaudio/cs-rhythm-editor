#!/usr/bin/env python3
"""Sinh db/learning_threads_p1_post_migration.sql từ smoke (db/tests/learning_threads_p1_prod_smoke.sql).

File sinh ra = MỘT lần dán vào Supabase SQL Editor, chạy SAU migration:
  1) cổng hậu migration (bảng/RLS/quyền/hàm/phụ thuộc)  2) smoke tự huỷ (trong savepoint → rollback)
  3) CHỈ KHI 1+2 PASS: bật Trả/Hỏi bài cho 3 bài DH2 thật (kiểm đúng id + tên bài + khoá)  4) bảng báo cáo.
Bất kỳ bước nào lỗi → RAISE → toàn bộ rollback (không cấu hình gì).
Chạy lại generator khi sửa smoke:  python3 scripts/build-lt-post-migration.py   (test DB kiểm đồng bộ)
"""
import pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
smoke = (ROOT / "db/tests/learning_threads_p1_prod_smoke.sql").read_text()

m = re.search(r"do \$smoke\$\ndeclare\n(?P<decl>.*?)\nbegin\n(?P<body>.*?)\n  if cardinality\(bad\) = 0 then", smoke, re.S)
if not m:
    sys.exit("không tách được thân smoke")
decl = m.group("decl")
body = "\n".join("  " + l if l.strip() else l for l in m.group("body").split("\n"))

DH2 = "c7ab2fcb-aff1-4485-a381-4edc83e4a62b"
LESSONS = [
    ("5f7acacd-9214-48f3-9349-93cc382649fb", "Bài 4.3 — Bolero móc kiểu 1"),
    ("a85592d5-b519-470d-84d0-4d9182d224b3", "Bài 4.4 — Bolero móc kiểu 2"),
    ("d2c00805-0000-4000-8000-000000000000", "Bài 6.3 — Dự án cuối khoá: tự chọn 1 bài, tự đệm và thu lại nộp"),
]
PROMPT = "Bạn có thể gửi phần thực hành của bài này hoặc đặt câu hỏi cho Thầy."
lessons_json = "[" + ", ".join('{"id": "%s", "title": "%s"}' % (i, t) for i, t in LESSONS) + "]"

out = f"""/*
LEARNING THREAD P1 — SAU MIGRATION: cổng kiểm + smoke tự huỷ + bật 3 bài DH2. MỘT lần dán, chạy SAU
db/learning_threads_p1_setup.sql. FILE SINH TỰ ĐỘNG bởi scripts/build-lt-post-migration.py — đừng sửa tay.
1) Cổng hậu migration: 3 bảng learning_*, RLS bật, 0 policy, anon/authenticated 0 quyền bảng; 15 hàm lt_*
   (10 RPC cho authenticated, 5 hàm nội bộ không ai gọi thẳng, anon không EXECUTE hàm nào); hàm phụ thuộc không lệch.
2) Smoke (giống db/tests/learning_threads_p1_prod_smoke.sql) chạy trong savepoint rồi HUỶ → không để lại dữ liệu.
3) Chỉ khi 1+2 PASS: Thầy/admin bật Trả bài + Hỏi bài (allowed/allowed) cho 3 bài DH2 thật, kiểm đúng id + tên bài
   + thuộc khoá DH2. Không bật "required". Không ghi tiến độ.
Lỗi ở bất kỳ bước nào → RAISE → toàn bộ rollback, không cấu hình gì. Kết quả: bảng (section, item, detail, status).
⚠ Bảng kết quả này đọc TRONG CÙNG transaction → KHÔNG phải bằng chứng đã lưu. Bằng chứng duy nhất: chạy tiếp
db/learning_threads_p1_diag.sql (lần chạy RIÊNG) → dòng cuối CONFIG_GATE = PASS. (29/09: lần chạy đầu báo "ok"
nhưng production có 0 dòng cấu hình → CTA ẩn.)
Không có comment '--' (an toàn khi copy).
*/
do $post$
declare
{decl}
  v_admin uuid; gate_bad text[] := '{{}}'; n_fn int; r record;
  v_lessons constant jsonb := '{lessons_json}';
  v_dh2 constant uuid := '{DH2}';
  v_prompt constant text := '{PROMPT}';
  fn_expected constant jsonb := '{{"class_public_identity": "9bda0938889c533040fb52f3301f3152", "is_class_member": "459786921eb5bbd4ff07c83bdb4db480", "is_teacher": "19b164504b4ce59b9bbdb4b0b64e48ad"}}';
  report jsonb := '[]';
begin
  for r in select t.name, c.oid, c.relrowsecurity from unnest(array['learning_lesson_settings', 'learning_threads', 'learning_thread_events']) t(name)
           left join pg_class c on c.relname = t.name and c.relnamespace = 'public'::regnamespace loop
    if r.oid is null then gate_bad := gate_bad || ('thiếu bảng ' || r.name); continue; end if;
    if not r.relrowsecurity then gate_bad := gate_bad || ('RLS tắt: ' || r.name); end if;
    if exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = r.name) then gate_bad := gate_bad || ('có policy trên ' || r.name); end if;
    if exists (select 1 from pg_class c2, aclexplode(c2.relacl) x where c2.oid = r.oid and (x.grantee = 0 or x.grantee in ('anon'::regrole, 'authenticated'::regrole))) then
      gate_bad := gate_bad || ('anon/authenticated còn quyền bảng ' || r.name);
    end if;
  end loop;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'learning_threads_open_uq') then gate_bad := gate_bad || 'thiếu unique thread đang mở'::text; end if;
  select count(*) into n_fn from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'lt\\_%';
  if n_fn <> 15 then gate_bad := gate_bad || format('hàm lt_*: %s (cần 15)', n_fn); end if;
  for r in select p.oid, p.proname, p.prosecdef from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'lt\\_%' loop
    if has_function_privilege('anon', r.oid, 'EXECUTE') then gate_bad := gate_bad || ('anon EXECUTE ' || r.proname); end if;
    if r.proname in ('lt_lesson_open_for_me', 'lt_can_view', 'lt_check_media', 'lt_normalize_resources', 'lt_identity_snapshot') then
      if has_function_privilege('authenticated', r.oid, 'EXECUTE') then gate_bad := gate_bad || ('hàm nội bộ mở cho authenticated: ' || r.proname); end if;
    else
      if not has_function_privilege('authenticated', r.oid, 'EXECUTE') then gate_bad := gate_bad || ('RPC thiếu quyền authenticated: ' || r.proname); end if;
      if not r.prosecdef then gate_bad := gate_bad || ('RPC không SECURITY DEFINER: ' || r.proname); end if;
    end if;
  end loop;
  for r in select e.key, e.value #>> '{{}}' as md5 from jsonb_each(fn_expected) e loop
    if coalesce((select string_agg(md5(p.prosrc), ',') from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = r.key), '') <> r.md5 then
      gate_bad := gate_bad || ('hàm phụ thuộc lệch: ' || r.key);
    end if;
  end loop;
  if cardinality(gate_bad) > 0 then
    raise exception 'DỪNG — cổng hậu migration STOP: %', array_to_string(gate_bad, '; ');
  end if;
  report := report || jsonb_build_array(jsonb_build_object('section', 'post_gate', 'item', 'bảng/RLS/quyền/hàm/phụ thuộc', 'detail', '3 bảng · 15 hàm lt_* · 0 policy · 0 quyền bảng anon/authenticated', 'status', 'OK'));

  begin
{body}
    raise exception 'LT_SMOKE_ROLLBACK';
  exception when others then
    if sqlerrm <> 'LT_SMOKE_ROLLBACK' then bad := bad || ('smoke dừng giữa chừng: ' || sqlerrm); end if;
  end;
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '{{}}', true);
  if cardinality(bad) > 0 then
    raise exception 'DỪNG — SMOKE FAIL % lỗi (không cấu hình gì): % || đạt: %', cardinality(bad), array_to_string(bad, ' | '), array_to_string(ok, ' | ');
  end if;
  if (select count(*) from public.learning_threads) + (select count(*) from public.learning_thread_events) + (select count(*) from public.learning_lesson_settings) <> 0 then
    raise exception 'DỪNG — smoke để lại dữ liệu';
  end if;
  report := report || jsonb_build_array(jsonb_build_object('section', 'smoke', 'item', format('SMOKE PASS %s/%s (đã huỷ, 0 dữ liệu còn lại)', cardinality(ok), cardinality(ok)), 'detail', array_to_string(ok, ' | '), 'status', 'OK'));

  for r in select x ->> 'id' as id, x ->> 'title' as title from jsonb_array_elements(v_lessons) x loop
    if not exists (select 1 from public.edu_course_lessons l join public.edu_modules m on m.id = l.module_id
                   where l.id = r.id::uuid and l.title = r.title and m.course_id = v_dh2) then
      raise exception 'DỪNG — bài DH2 không khớp (id/tên/khoá): % "%"', r.id, r.title;
    end if;
  end loop;
  select a.id into v_admin from public.app_users a where a.role in ('admin', 'teacher') order by (a.role = 'admin') desc, a.id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  for r in select x ->> 'id' as id, x ->> 'title' as title from jsonb_array_elements(v_lessons) x loop
    perform public.lt_set_lesson_settings(r.id::uuid, 'allowed', 'allowed', v_prompt);
    report := report || jsonb_build_array(jsonb_build_object('section', 'config_dh2', 'item', r.title, 'detail', r.id || ' · submission=allowed · question=allowed', 'status', 'OK'));
  end loop;
  perform set_config('request.jwt.claims', '{{}}', true);
  perform set_config('lt.post_report', report::text, false);
end $post$;

select section, item, detail, status from (
  select 1 as ord, x.section, x.item, x.detail, x.status
  from jsonb_to_recordset(current_setting('lt.post_report')::jsonb) as x(section text, item text, detail text, status text)
  union all
  select 2, 'counts', 'learning_lesson_settings / learning_threads / learning_thread_events',
         (select count(*) from public.learning_lesson_settings)::text || ' / ' || (select count(*) from public.learning_threads)::text
           || ' / ' || (select count(*) from public.learning_thread_events)::text, 'OK'
  union all
  select 3, 'GATE', 'PASS', 'CHƯA là bằng chứng đã lưu — chạy tiếp db/learning_threads_p1_diag.sql → CONFIG_GATE phải = PASS', ''
) z order by ord;
"""
(ROOT / "db/learning_threads_p1_post_migration.sql").write_text(out)
print("OK db/learning_threads_p1_post_migration.sql")
