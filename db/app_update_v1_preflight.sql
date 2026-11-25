-- CHỈ ĐỌC. Kỳ vọng trước migration: has_is_admin = true, policy_table = null, log_table = null.
select to_regprocedure('public.is_admin()') is not null as has_is_admin,
       to_regclass('public.app_update_policy') as policy_table,
       to_regclass('public.app_update_policy_log') as log_table;
