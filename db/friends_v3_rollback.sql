-- Rollback Friends V3: gỡ 4 hàm mới (chỉ hàm thuộc Friends V3). Không đụng dữ liệu.
drop function if exists public.friend_suggestions(int);
drop function if exists public.friend_search(text, int);
drop function if exists public.friends_ctx();
drop function if exists public.friends_fold(text);
notify pgrst, 'reload schema';
