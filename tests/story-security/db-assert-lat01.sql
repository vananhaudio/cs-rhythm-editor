\set ON_ERROR_STOP on
create function public.t_rows(q text) returns int language plpgsql as $$ declare n int; begin execute q; get diagnostics n = row_count; return n;
  exception when insufficient_privilege or check_violation then return -1; end $$;
grant execute on function public.t_rows(text) to anon, authenticated, service_role;
-- dữ liệu riêng cho Lát 0.1 (chủ cc; người khác bb)
insert into public.stories(id,user_id,status,title,pen_name) values
 ('00000000-0000-4000-8000-0000000000d1','00000000-0000-4000-8000-0000000000cc','user_review','Nháp','Cc'),
 ('00000000-0000-4000-8000-0000000000d2','00000000-0000-4000-8000-0000000000cc','telling','Xoá được','Cc');
insert into public.stories(id,user_id,status,title,slug,story_number,published_at,pen_name) values
 ('00000000-0000-4000-8000-0000000000d3','00000000-0000-4000-8000-0000000000cc','published','Đã đăng','da-dang-30',30,'2026-08-01','Cc'),
 ('00000000-0000-4000-8000-0000000000d4','00000000-0000-4000-8000-0000000000cc','unpublished','Đã gỡ','da-go-31',31,'2026-08-02','Cc');
-- người khác
set role authenticated; set t.uid='00000000-0000-4000-8000-0000000000bb';
select t_ok(t_rows($q$update public.stories set title='x' where id='00000000-0000-4000-8000-0000000000d1'$q$)=0, 'người khác không sửa được nháp');
select t_ok(t_rows($q$delete from public.stories where id='00000000-0000-4000-8000-0000000000d2'$q$)=0, 'người khác không xoá được nháp');
set role anon; set t.uid='';
select t_ok(t_rows($q$update public.stories set title='x'$q$)<=0, 'khách không sửa được');
select t_ok(t_rows($q$delete from public.stories$q$)<=0, 'khách không xoá được');
-- chủ bài
set role authenticated; set t.uid='00000000-0000-4000-8000-0000000000cc';
select t_ok(t_rows($q$update public.stories set title='Tên mới' where id='00000000-0000-4000-8000-0000000000d1'$q$)=1, 'chủ đổi tên nháp: lưu thật');
select t_ok(t_rows($q$update public.stories set status='published' where id='00000000-0000-4000-8000-0000000000d1'$q$)<=0, 'chủ không tự đăng bài');
select t_ok(t_rows($q$update public.stories set status='unpublished' where id='00000000-0000-4000-8000-0000000000d1'$q$)<=0, 'chủ không tự đặt trạng thái đã gỡ');
select t_ok(t_rows($q$update public.stories set user_id='00000000-0000-4000-8000-0000000000bb' where id='00000000-0000-4000-8000-0000000000d1'$q$)<=0, 'chủ không chuyển bài cho người khác');
select t_ok(t_rows($q$update public.stories set story_number=1, slug='a-1', published_at='2000-01-01', featured=true, ai_review='{}' where id='00000000-0000-4000-8000-0000000000d1'$q$)=1, 'lệnh sửa cột biên tập không gây lỗi');
reset role;
select t_ok((select story_number is null and slug is null and published_at is null and featured is false and ai_review is null from public.stories where id='00000000-0000-4000-8000-0000000000d1'), '…nhưng cột của Ban biên tập giữ nguyên');
set role authenticated;
insert into public.stories(id,user_id,status,story_number,slug,published_at,featured) values ('00000000-0000-4000-8000-0000000000d5', auth.uid(), 'telling', 99, 'chiem-slug', now(), true);
reset role;
select t_ok((select story_number is null and slug is null and published_at is null and featured is false from public.stories where id='00000000-0000-4000-8000-0000000000d5'), 'thêm nháp không tự đặt được số/đường dẫn/ngày/nổi bật');
set role authenticated;
select t_ok(t_rows($q$update public.stories set status='submitted', consent_publish=true, author_full_name='Họ Tên Cc', consent_bio_publish=false where id='00000000-0000-4000-8000-0000000000d1'$q$)=1, 'chủ gửi bài: lưu thật');
select t_ok((select status='submitted' from public.stories where id='00000000-0000-4000-8000-0000000000d1'), 'trạng thái đã gửi');
select t_ok(t_rows($q$update public.stories set title='sau khi gửi' where id='00000000-0000-4000-8000-0000000000d1'$q$)=0, 'đã gửi thì không sửa nữa');
select t_ok(t_rows($q$update public.stories set title='x' where id in ('00000000-0000-4000-8000-0000000000d3','00000000-0000-4000-8000-0000000000d4')$q$)=0, 'bài đã đăng/đã gỡ: chủ không sửa');
select t_ok(t_rows($q$delete from public.stories where id in ('00000000-0000-4000-8000-0000000000d3','00000000-0000-4000-8000-0000000000d4')$q$)=0, 'bài đã đăng/đã gỡ: chủ không xoá');
select t_ok(t_rows($q$delete from public.stories where id='00000000-0000-4000-8000-0000000000d2'$q$)=1, 'chủ xoá nháp: xoá thật');
-- quyền riêng tư tác giả
set role service_role;
update public.stories set status='published', story_number=32, slug='nhap-32', published_at='2026-09-01' where id='00000000-0000-4000-8000-0000000000d1';
set role anon;
select t_ok((select author_full_name is null from public.stories where id='00000000-0000-4000-8000-0000000000d1'), 'đăng khi CHƯA đồng ý: khách không đọc được đôi nét');
reset role;
select t_ok((select author_bio->>'author_full_name'='Họ Tên Cc' from public.story_private where story_id='00000000-0000-4000-8000-0000000000d1'), 'đôi nét được chuyển kín, không mất');
select t_ok((select slug='nhap-32' and story_number=32 and published_at='2026-09-01' and title='Tên mới' from public.stories where id='00000000-0000-4000-8000-0000000000d1'), 'niêm không đổi tiêu đề/số/đường dẫn/ngày');
set role service_role;
update public.stories set author_age=40 where id='00000000-0000-4000-8000-0000000000d1';
reset role;
select t_ok((select author_age is null and consent_bio_publish is false from public.stories where id='00000000-0000-4000-8000-0000000000d1')
        and (select author_bio->>'author_age'='40' and author_bio->>'author_full_name'='Họ Tên Cc' from public.story_private where story_id='00000000-0000-4000-8000-0000000000d1'), 'Ban biên tập bổ sung khi chưa đồng ý: vẫn kín, gộp đủ');
set role service_role;
update public.stories set consent_bio_publish=true where id='00000000-0000-4000-8000-0000000000d1';
set role anon;
select t_ok((select author_full_name='Họ Tên Cc' and author_age=40 from public.stories where id='00000000-0000-4000-8000-0000000000d1'), 'bật đồng ý: đôi nét hiện lại đầy đủ');
reset role;
select t_ok((select author_bio is null from public.story_private where story_id='00000000-0000-4000-8000-0000000000d1'), 'bản kín được dọn sau khi trả lại');
set role service_role;
update public.stories set consent_bio_publish=false where id='00000000-0000-4000-8000-0000000000d1';
reset role;
select t_ok((select author_full_name is null from public.stories where id='00000000-0000-4000-8000-0000000000d1') and (select author_bio->>'author_full_name'='Họ Tên Cc' from public.story_private where story_id='00000000-0000-4000-8000-0000000000d1'), 'rút đồng ý: kín lại');
select t_ok((select conversation->0->>'text'='RIENG' from public.story_private where story_id='00000000-0000-4000-8000-000000000001'), 'hội thoại niêm ở Lát 0 còn nguyên');
