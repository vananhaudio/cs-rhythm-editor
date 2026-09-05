-- Trang công cụ mở bằng URL trực tiếp vẫn hỏi resolver chung.
create or replace function public.my_tool_route_access(p_path text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_state jsonb;
begin
 if not exists(select 1 from public.edu_tools t where split_part(regexp_replace(t.route,'^https?://[^/]+',''), '?',1)=p_path) then return true; end if;
 v_state:=public.my_learning_state();
 if v_state->>'mode'='teacher' then return true; end if;
 return not exists(select 1 from public.edu_tools t
 where split_part(regexp_replace(t.route,'^https?://[^/]+',''), '?',1)=p_path
 and not coalesce((v_state->'flags'->'tools'->>t.id)::boolean,false));
end $$;
revoke all on function public.my_tool_route_access(text) from public;
grant execute on function public.my_tool_route_access(text) to anon,authenticated;
notify pgrst,'reload schema';
