\set ON_ERROR_STOP on
create function public.t_denied(q text) returns boolean language plpgsql as $$ begin execute q; return false; exception when insufficient_privilege then return true; end $$;
create function public.t_ok(c boolean, m text) returns void language plpgsql as $$ begin if c is not true then raise exception 'FAIL: %', m; end if; raise notice 'PASS: %', m; end $$;
grant execute on function public.t_denied(text), public.t_ok(boolean,text) to anon, authenticated;
-- người đăng nhập KHÁC chủ bài
set role authenticated; set t.uid='00000000-0000-4000-8000-0000000000bb';
select t_ok((select conversation from public.stories where status='published')='[]'::jsonb, 'người khác không đọc được hội thoại bài đã đăng');
select t_ok((select count(*) from public.stories)=1, 'người khác không thấy bản nháp');
select t_ok(t_denied('select zalo from public.stories'), 'zalo bị chặn đọc');
select t_ok(t_denied('select ai_review from public.stories'), 'ai_review bị chặn đọc');
select t_ok(t_denied('select * from public.story_private'), 'story_private đóng với authenticated');
select t_ok((select count(*) from public.story_chunks)=0, 'người khác không đọc được lời kể thô');
select t_ok(t_denied($q$insert into public.story_comments(story_id,user_id,content) values ('00000000-0000-4000-8000-000000000001', auth.uid(), 'spam')$q$), 'không ghi được story_comments');
-- khách
set role anon; set t.uid='';
select t_ok(t_denied('select * from public.story_chunks'), 'khách không đọc được story_chunks');
select t_ok(t_denied('select * from public.story_private'), 'khách không đọc được story_private');
select t_ok((select count(*) from (select id,title,slug,content,pen_name,published_at from public.stories) s)=1, 'khách vẫn đọc bài đã đăng');
-- chủ bài: client cũ giữ nguyên truy vấn
set role authenticated; set t.uid='00000000-0000-4000-8000-0000000000aa';
select t_ok((select count(*) from (select id,status,title,conversation,content from public.stories where user_id=auth.uid()) s)=2, 'chủ bài: truy vấn Phòng viết cũ vẫn chạy');
select t_ok((select conversation->0->>'text' from public.stories where status='telling')='NHAP', 'hội thoại bản nháp còn nguyên');
select t_ok((select count(*) from public.story_chunks)=1, 'chủ bài vẫn đọc lời kể của mình');
-- tạo bài mới vẫn chạy; trigger không cản
insert into public.stories(id,user_id,status,conversation) values ('00000000-0000-4000-8000-000000000003', auth.uid(), 'telling', '[{"t":1}]');
select t_ok((select jsonb_array_length(conversation) from public.stories where id='00000000-0000-4000-8000-000000000003')=1, 'bản mới giữ hội thoại');
reset role;
-- dữ liệu & định danh
select t_ok((select conversation->0->>'text' from public.story_private where story_id='00000000-0000-4000-8000-000000000001')='RIENG', 'hội thoại được CHUYỂN, không mất');
select t_ok((select pen_name='Người kể chuyện' and author_name='Người kể chuyện' and slug='a-1' and story_number=1 and published_at='2026-07-01' from public.stories where id='00000000-0000-4000-8000-000000000001'), 'che email, giữ slug/số/ngày');
select t_ok((select original_names->>'pen_name'='x@y.com' from public.story_private where story_id='00000000-0000-4000-8000-000000000001'), 'tên cũ được lưu kín');
-- Ban biên tập (service role) đăng bài sau này → tự niêm
set role service_role;
update public.stories set status='published' where id='00000000-0000-4000-8000-000000000002';
select t_ok((select conversation from public.stories where id='00000000-0000-4000-8000-000000000002')='[]'::jsonb and (select conversation->0->>'text' from public.story_private where story_id='00000000-0000-4000-8000-000000000002')='NHAP', 'đăng mới tự niêm hội thoại');
update public.stories set status='unpublished' where id='00000000-0000-4000-8000-000000000002';
update public.stories set status='published' where id='00000000-0000-4000-8000-000000000002';
select t_ok((select conversation->0->>'text' from public.story_private where story_id='00000000-0000-4000-8000-000000000002')='NHAP', 'ẩn/hiện lại không ghi đè bằng rỗng');
reset role;
select t_ok((select allowed_mime_types is not null and file_size_limit=15728640 from storage.buckets where id='story-photos'), 'bucket giới hạn ảnh');
