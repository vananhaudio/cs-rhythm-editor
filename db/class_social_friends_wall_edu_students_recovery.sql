-- ═══════════════════════════════════════════════════════════════════════════
-- GENERATOR khôi phục edu_students — READ-ONLY (chỉ SELECT, không đổi gì).
--
-- CHẠY TRÊN PRODUCTION *TRƯỚC* db/class_social_friends_wall_setup.sql, LƯU nguyên văn cột
-- `recovery_sql` (vd. dán vào ghi chú release). Đó là script dựng lại ĐÚNG policy + grant + trạng thái
-- RLS của edu_students tại thời điểm chụp — không đoán, không hard-code `FOR ALL USING (true)`.
--
-- Chỉ dùng script đã lưu khi CHỨNG MINH được một luồng thật hỏng vì RLS mới của edu_students.
-- ⚠ Script đó trả edu_students về trạng thái cũ — nếu trạng thái cũ là policy rộng thì MỞ LẠI việc học
--   sinh đọc/sửa email/SĐT của nhau. Rollback tính năng Bạn bè/Tường KHÔNG cần script này.
-- ═══════════════════════════════════════════════════════════════════════════
select concat_ws(E'\n',
  '-- KHÔI PHỤC edu_students về trạng thái chụp lúc ' || now()::text || ' (db ' || current_database() || ')',
  'begin;',
  'set local lock_timeout = ''5s'';',
  'set local statement_timeout = ''60s'';',
  'alter table public.edu_students ' || case when c.relrowsecurity then 'enable' else 'disable' end || ' row level security;',
  'do $r$ declare p record; begin for p in select policyname from pg_policies where schemaname = ''public'' and tablename = ''edu_students'' loop execute format(''drop policy %I on public.edu_students'', p.policyname); end loop; end $r$;',
  (select string_agg(format('create policy %I on public.edu_students as %s for %s to %s%s%s;',
            pp.policyname, pp.permissive, pp.cmd,
            (select string_agg(case when r = 'public' then 'public' else quote_ident(r) end, ', ') from unnest(pp.roles) r),
            case when pp.qual is not null then ' using (' || pp.qual || ')' else '' end,
            case when pp.with_check is not null then ' with check (' || pp.with_check || ')' else '' end),
          E'\n' order by pp.policyname)
     from pg_policies pp where pp.schemaname = 'public' and pp.tablename = 'edu_students'),
  'revoke all on public.edu_students from anon, authenticated;',
  (select string_agg(format('grant %s on public.edu_students to %I;', g.privs, g.grantee), E'\n' order by g.grantee)
     from (select grantee, string_agg(privilege_type, ', ' order by privilege_type) as privs
             from information_schema.role_table_grants
            where table_schema = 'public' and table_name = 'edu_students' and grantee in ('anon', 'authenticated')
            group by grantee) g),
  'notify pgrst, ''reload schema'';',
  'commit;'
) as recovery_sql
from pg_class c
where c.oid = 'public.edu_students'::regclass;
