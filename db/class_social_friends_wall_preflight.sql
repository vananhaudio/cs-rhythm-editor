/*
═══════════════════════════════════════════════════════════════════════════
PREFLIGHT Bạn bè + Tường — READ-ONLY (một câu SELECT, không đổi gì). Chạy TRÊN PRODUCTION trước migration.
SQL Editor chỉ hiện kết quả câu cuối → mọi kiểm tra gộp trong MỘT bảng kết quả; dòng cuối là GATE.
GATE = PASS → được phép chạy db/class_social_friends_wall_setup.sql (migration cũng tự kiểm lại y hệt).
GATE = STOP → DỪNG, gửi toàn bộ bảng kết quả cho người review. KHÔNG migration.
Kèm theo: chạy db/class_social_friends_wall_edu_students_recovery.sql và LƯU kết quả (khôi phục khẩn cấp).

Kiểm (object mà migration sẽ CREATE OR REPLACE / DROP POLICY / đổi quyền):
• md5(prosrc) các hàm — phải là bản repo TRƯỚC migration (hoặc bản SAU nếu đã chạy rồi)
• policy của edu_students, class_posts, class_post_comments, class_comment_tags, class_comment_resources,
friendships — dấu vân tay (tên + lệnh + role + biểu thức chuẩn hoá) phải là bộ TRƯỚC hoặc SAU
• hàm bắt buộc có mặt + trigger guard của edu_students (policy INSERT chính chủ dựa vào nó)
• thông tin: grants, friendships_exists, cột audience, số bài theo loại, realtime publication, phiên bản
Hằng kỳ vọng GIỐNG HỆT mục 0 của migration (test tests/class-social/friends-wall.test.tsx kiểm).
═══════════════════════════════════════════════════════════════════════════

  An toàn khi copy: không có comment '--' (chỉ khối này), nhãn kết quả ASCII → vẫn chạy đúng kể cả khi
  trình duyệt/khung chat làm mất dấu xuống dòng. Cách copy tốt nhất: nút "Copy raw file" trên GitHub.
*/
with
fn_expected as (select '{"can_view_wall": ["72be0399a709b62fb512bbf0be34294b"], "class_comments_for_posts": ["45df86f32edc6b33d3ab720ffc69816b", "ca979b78d58fc4e4a2b47ddcb6d5a8f1"], "class_feed": ["3c7591e4a805979180b7759f73893e87", "7dfc39dfd2e14df7684c9cc5a1c4a3d1"], "class_post_visible": ["12335e2436f4cea845707dde5c5f924b", "aa09b646d430d8d4e1fdfe10b6acee9d"], "class_posts_before_update": ["12a765f91c8e26575b29e1c0e0e4c3f0", "7c02b8d001174fed8b6d4e1dd16a90ce"], "class_public_identity": ["9bda0938889c533040fb52f3301f3152"], "friendship_status": ["9f653ba0b1fbcb58c69acaba880906fc"], "get_user_profile": ["80b1f46a76e2de6a4e713fc862805451"], "get_user_wall": ["db195b5d49110b16db274dd3ebc37f1d"], "guard_student_package_identity": ["600fcbbc5d7b9eb34948dee498e05ead"], "incoming_friend_requests": ["861e1bd1b3c3086f2b462bc1731b4689"], "is_class_member": ["459786921eb5bbd4ff07c83bdb4db480"], "is_class_member_user": ["09b747d3ec6be35cc8e9f77c5c4e0b8a"], "is_friend_of": ["c5281e64105ae14e008445ba7fb5c354"], "is_teacher": ["19b164504b4ce59b9bbdb4b0b64e48ad"], "my_friends": ["6f637084496eba57c0a1ec3ac31c2c80"], "respond_friend_request": ["a09b7ad5f7f402a2a35a7b262f3dd40a"], "send_friend_request": ["885956b746b8359b9c528f9132c12f6d"], "unfriend": ["40a11c11605014200b3ab9c106d6018e"]}'::jsonb as j),
pol_expected as (select '{"class_comment_resources": ["74638efc16a0780fb2e4a2fe11fd5270", "ce29d52feb18688a8432c1e5667a4efd"], "class_comment_tags": ["ce320e9506bc1cc83790638fc09049cb", "e448db1205d168ec14acba75f1fac981"], "class_post_comments": ["cc15b6f4e95e8e67c685732c8651929f"], "class_posts": ["61ce912c19e5bba1fd713f9e79ee96fd", "b425b787e3d4cda5066f766b89567aac"], "edu_students": ["39148c749be36581e050ca4b92ad7a5f", "b9d95ff7110c1c36a3cbc8cb28bf8398"], "friendships": ["d41d8cd98f00b204e9800998ecf8427e"]}'::jsonb as j),
fn_rows as (
  select 'function'::text as section, e.key as item,
         coalesce((select string_agg(md5(p.prosrc), ',') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = e.key), 'absent') as detail,
         case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                            where n.nspname = 'public' and p.proname = e.key and not (e.value ? md5(p.prosrc)))
              then 'STOP' else 'OK' end as status
  from fn_expected, jsonb_each(fn_expected.j) e
),
required_rows as (
  select 'required'::text, r, case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                                  where n.nspname = 'public' and p.proname = r) then 'present' else 'MISSING' end,
         case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                            where n.nspname = 'public' and p.proname = r) then 'OK' else 'STOP' end
  from unnest(array['class_feed', 'class_comments_for_posts', 'class_post_visible', 'class_posts_before_update',
                    'is_class_member', 'is_teacher', 'class_public_identity', 'guard_student_package_identity']) r
  union all
  select 'required', 'trigger student_package_identity_guard (edu_students)',
         coalesce((select 'tgenabled=' || t.tgenabled::text from pg_trigger t
                    where t.tgrelid = 'public.edu_students'::regclass and t.tgname = 'student_package_identity_guard' and not t.tgisinternal), 'MISSING'),
         case when exists (select 1 from pg_trigger t where t.tgrelid = 'public.edu_students'::regclass
                            and t.tgname = 'student_package_identity_guard' and t.tgenabled <> 'D' and not t.tgisinternal)
              then 'OK' else 'STOP' end
),
pol_rows as (
  select 'policy'::text, e.key,
         coalesce((select string_agg(policyname || ' ' || cmd, ', ' order by policyname) from pg_policies
                    where schemaname = 'public' and tablename = e.key), '(none)') || '  fp=' || f.fp,
         case when e.value ? f.fp then 'OK' else 'STOP' end
  from pol_expected, jsonb_each(pol_expected.j) e
  cross join lateral (
    select md5(coalesce(string_agg(x.fp, '|' order by x.fp), '')) as fp from (
      select policyname || ':' || cmd || ':' || array_to_string(roles, ',') || ':'
             || regexp_replace(lower(coalesce(qual, '')), '[[:space:]()]', '', 'g') || ':'
             || regexp_replace(lower(coalesce(with_check, '')), '[[:space:]()]', '', 'g') as fp
      from pg_policies where schemaname = 'public' and tablename = e.key) x
  ) f
),
info_rows as (
  select 'info'::text, 'postgres'::text, version(), 'INFO'::text
  union all select 'info', 'grants edu_students',
    coalesce((select string_agg(grantee || '=' || privs, '  ' order by grantee) from (
      select grantee, string_agg(privilege_type, ',' order by privilege_type) privs from information_schema.role_table_grants
       where table_schema = 'public' and table_name = 'edu_students' and grantee in ('anon', 'authenticated') group by grantee) g), '(none)'), 'INFO'
  union all select 'info', 'grants class_posts',
    coalesce((select string_agg(grantee || '=' || privs, '  ' order by grantee) from (
      select grantee, string_agg(privilege_type, ',' order by privilege_type) privs from information_schema.role_table_grants
       where table_schema = 'public' and table_name = 'class_posts' and grantee in ('anon', 'authenticated') group by grantee) g), '(none)'), 'INFO'
  union all select 'info', 'friendships_exists', (to_regclass('public.friendships') is not null)::text, 'INFO'
  union all select 'info', 'class_posts.audience', (select count(*)::text from information_schema.columns
                    where table_schema = 'public' and table_name = 'class_posts' and column_name = 'audience'), 'INFO'
  union all select 'info', 'posts_by_type', coalesce((select jsonb_object_agg(type, n)::text from
                    (select type, count(*) n from public.class_posts group by type) x), '{}'), 'INFO'
  union all select 'info', 'realtime_publication(class_posts, friendships, edu_students)',
    coalesce((select string_agg(pubname || ':' || tablename, ', ') from pg_publication_tables
               where schemaname = 'public' and tablename in ('class_posts', 'friendships', 'edu_students')), '(none)'), 'INFO'
),
all_rows as (
  select * from fn_rows union all select * from required_rows union all select * from pol_rows union all select * from info_rows
)
select section, item, detail, status from (
  select section, item, detail, status from all_rows
  union all
  select 'GATE', case when exists (select 1 from all_rows where status = 'STOP') then 'STOP - DO NOT MIGRATE' else 'PASS' end,
         (select count(*) || ' STOP item(s)' from all_rows where status = 'STOP'), 'GATE'
) z
order by section = 'GATE', section, item;
