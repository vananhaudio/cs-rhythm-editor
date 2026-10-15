-- MA TRẬN QUYỀN (chạy SAU setup, hoặc nối sau setup trong dryrun). Chỉ in kết quả đúng/sai, không in danh tính/nội dung.
-- Dùng lõi chord_video_export_eval(uid, version, mode) với dữ liệu thật; không giả lập phiên đăng nhập.
-- Ca "tắt công tắc" cần ghi bảng → chỉ chạy được trong dryrun (transaction rollback); khi chạy query chỉ-đọc ca đó bị bỏ qua.
create temp table _t as
select
  (select id from public.app_users where role = 'admin' and status = 'active' limit 1) as adm,
  (select v.id from public.chord_sheet_versions v join public.chord_sheets s on s.id = v.sheet_id
    where v.review_status = 'approved' and s.archived_at is null and s.band_id is not null
      and exists (select 1 from public.teamlab_band_members m where m.band_id = s.band_id) order by s.created_at limit 1) as ver_band,
  (select v.id from public.chord_sheet_versions v join public.chord_sheets s on s.id = v.sheet_id
    where v.review_status = 'approved' and s.archived_at is null and s.band_id is null limit 1) as ver_noband,
  (select v.id from public.chord_sheet_versions v join public.chord_sheets s on s.id = v.sheet_id
    where s.archived_at is not null limit 1) as ver_archived,
  (select v.id from public.chord_sheet_versions v where v.review_status <> 'approved' limit 1) as ver_draft;
alter table _t add column band uuid, add column member uuid, add column other_member uuid, add column outsider uuid;
update _t set band = (select s.band_id from public.chord_sheet_versions v join public.chord_sheets s on s.id = v.sheet_id where v.id = _t.ver_band);
update _t set member = (select m.user_id from public.teamlab_band_members m join public.app_users u on u.id = m.user_id
                         where m.band_id = _t.band and u.role <> 'admin' and u.status = 'active' limit 1);
update _t set other_member = (select m.user_id from public.teamlab_band_members m join public.app_users u on u.id = m.user_id
                               where m.band_id <> _t.band and u.role <> 'admin' and u.status = 'active'
                                 and not exists (select 1 from public.teamlab_band_members x where x.band_id = _t.band and x.user_id = m.user_id) limit 1);
update _t set outsider = (select u.id from public.app_users u where u.role <> 'admin' and u.status = 'active'
                           and not exists (select 1 from public.teamlab_band_members x where x.user_id = u.id) limit 1);

select c, expect_ok, expect_reason, actual->>'ok' as ok, actual->>'reason' as reason, actual->>'max_seconds' as max_s,
       case when (actual->>'ok')::boolean = expect_ok and coalesce(actual->>'reason','') = coalesce(expect_reason,'') then 'PASS' else 'FAIL' end as verdict
from (
  select 'admin clip' c, true expect_ok, null::text expect_reason, public.chord_video_export_eval((select adm from _t), (select ver_band from _t), 'clip') actual
  union all select 'admin full', true, null, public.chord_video_export_eval((select adm from _t), (select ver_band from _t), 'full')
  union all select 'admin bài không Band', true, null, public.chord_video_export_eval((select adm from _t), (select ver_noband from _t), 'clip')
  union all select 'thành viên đúng Band clip', true, null, public.chord_video_export_eval((select member from _t), (select ver_band from _t), 'clip')
  union all select 'thành viên đúng Band xin full', false, 'full_admin_only', public.chord_video_export_eval((select member from _t), (select ver_band from _t), 'full')
  union all select 'thành viên Band khác', false, 'not_member', public.chord_video_export_eval((select other_member from _t), (select ver_band from _t), 'clip')
  union all select 'người ngoài / cựu thành viên (không còn dòng thành viên)', false, 'not_member', public.chord_video_export_eval((select outsider from _t), (select ver_band from _t), 'clip')
  union all select 'bài không Band, người thường', false, 'no_band', public.chord_video_export_eval((select member from _t), (select ver_noband from _t), 'clip')
  union all select 'bài đã lưu trữ', false, 'not_shareable', public.chord_video_export_eval((select adm from _t), (select ver_archived from _t), 'clip')
  union all select 'bản chưa duyệt', false, 'not_shareable', public.chord_video_export_eval((select adm from _t), (select ver_draft from _t), 'clip')
  union all select 'uid lạ / tài khoản không tồn tại', false, 'account', public.chord_video_export_eval(gen_random_uuid(), (select ver_band from _t), 'clip')
  union all select 'chưa đăng nhập (uid null)', false, 'auth', public.chord_video_export_eval(null, (select ver_band from _t), 'clip')
  union all select 'mode lạ', false, 'bad_mode', public.chord_video_export_eval((select adm from _t), (select ver_band from _t), 'x')
) r;

-- Công tắc tổng (chỉ dryrun): tắt → thành viên bị chặn, Admin không ảnh hưởng.
do $kill$
begin
  begin
    update public.tool_capabilities set allowed = false where tool_id = 'chordlib' and capability = 'export_video';
  exception when others then
    raise notice 'bỏ qua ca công tắc (transaction chỉ-đọc)';
    return;
  end;
  raise notice 'tắt công tắc: thành viên=% ; admin=%',
    public.chord_video_export_eval((select member from _t), (select ver_band from _t), 'clip')->>'reason',
    public.chord_video_export_eval((select adm from _t), (select ver_band from _t), 'clip')->>'ok';
end $kill$;
