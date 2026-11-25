-- CHỈ ĐỌC. Kỳ vọng ngay sau migration: mọi cột kiểm = true.
select (select count(*) = 2 and bool_and(not enabled and not force_enabled) from public.app_update_policy) as seeded_off,
       not has_table_privilege('anon', 'public.app_update_policy', 'select,insert,update,delete') as anon_no_table,
       not has_table_privilege('authenticated', 'public.app_update_policy', 'select,insert,update,delete') as auth_no_table,
       has_function_privilege('anon', 'public.app_update_policy_get(text)', 'execute') as anon_can_read_rpc,
       not has_function_privilege('anon', 'public.app_update_policy_save(text,boolean,text,integer,text,integer,boolean,text,timestamptz)', 'execute') as anon_cannot_save,
       public.app_update_policy_get('ios') is null and public.app_update_policy_get('android') is null as nothing_shown;
