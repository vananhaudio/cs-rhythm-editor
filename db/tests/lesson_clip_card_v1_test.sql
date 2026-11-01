-- ═══ G3 lesson_clip_card_v1 — SAU MIGRATION (nối tiếp lesson_clip_card_v1_pre.sql trên cùng DB). Cluster PG TẠM. KHÔNG production. ═══
\set ON_ERROR_STOP on
\o /dev/null
-- helper: chỉ các hàng lesson_clip
create function t.clips(k text, p_scope text) returns table(sort_at timestamptz, sort_key text, post jsonb) language sql as $$
  select f.sort_at, f.sort_key, f.post from (select * from t.feed(k, p_scope, 50)) f where f.kind = 'lesson_clip' $$;
create function t.clips_you(k text) returns table(sort_at timestamptz, sort_key text, post jsonb) language sql as $$
  select f.sort_at, f.sort_key, f.post from (select * from t.feed_you(k, 50)) f where f.kind = 'lesson_clip' $$;
grant execute on all functions in schema t to anon, authenticated;

-- ═ 1) QUYỀN — Feed chung (for_you), my_classes, friends; hàm _safe THẬT ═══════════════════════════
select t.ok((select count(*) from t.clips('A', 'for_you')) = 2, 'A (TH01, có quyền) / for_you: 2 thẻ (S1, S2; khối tương lai bị ẩn)');
select t.ok((select count(*) from t.clips_you('A')) = 2, 'A / social_feed_safe: 2 thẻ');
select t.ok((select count(*) from t.clips('A', 'my_classes')) = 2, 'A / my_classes: 2 thẻ');
select t.ok((select count(*) from t.clips('A', 'friends')) = 0, 'A / friends: 0 thẻ (friends không có thẻ clip)');
select t.ok((select count(*) from t.clips('B', 'for_you')) = 2 and (select count(*) from t.clips('B', 'my_classes')) = 2, 'B (cùng lớp, có quyền): 2 + 2');
select t.ok((select count(*) from t.clips('C', 'for_you')) = 1 and (select payload_class from (select post ->> 'class_code' as payload_class from t.clips('C', 'for_you')) z) = 'SOLO01.TH02',
  'C (lớp TH02) chỉ thấy thẻ của lớp TH02');
select t.ok((select count(*) from t.clips('C', 'my_classes')) = 1, 'C / my_classes: 1 thẻ');
select t.ok(not exists (select 1 from t.clips('C', 'for_you') where post ->> 'class_code' = 'SOLO01.TH01'), 'C KHÔNG thấy thẻ lớp TH01 (khác lớp)');
select t.ok(not exists (select 1 from t.clips('A', 'for_you') where post ->> 'class_code' = 'SOLO01.TH02'), 'A KHÔNG thấy thẻ lớp TH02 (khác lớp)');
select t.ok((select count(*) from t.clips('T', 'for_you')) = 0 and (select count(*) from t.clips('T', 'my_classes')) = 0,
  'Thầy (không là thành viên có quyền giáo trình) KHÔNG thấy thẻ — đúng vị từ can_read_class_curriculum');
select t.ok((select count(*) from t.feed('N', 'for_you', 50)) = 0, 'N (ngoài Class): Feed rỗng, không thẻ');
select t.fails_as('anon', $$select * from public.social_feed_safe(null, null, 20)$$, 'anon không gọi được social_feed_safe');
select t.fails_as('anon', $$select * from public.social_feed(null, null, 20)$$, 'anon không gọi được social_feed');
select t.fails_as('anon', $$select * from public.social_feed_scoped('my_classes', null, null, 20)$$, 'anon không gọi được social_feed_scoped');
select t.fails_as('anon', $$select * from public.social_feed_scoped_safe('my_classes', null, null, 20)$$, 'anon không gọi được social_feed_scoped_safe');
select t.fails_as('A', $$select * from public.social_feed_clip_items(null)$$, 'authenticated KHÔNG gọi trực tiếp được social_feed_clip_items');
select t.fails_as('A', $$select public.social_clip_added_at('2026-01-01T00:00:00Z')$$, 'authenticated KHÔNG gọi trực tiếp được social_clip_added_at');

-- ═ 2) Thu hồi quyền / gỡ xuất bản / nháp / lớp huỷ ═══════════════════════════════════════════════
update public.class_curriculum_access set status = 'revoked' where user_id = t.u('B');
select t.ok((select count(*) from t.clips('B', 'for_you')) = 0 and (select count(*) from t.clips('B', 'my_classes')) = 0 and (select count(*) from t.clips_you('B')) = 0,
  'B bị thu hồi quyền giáo trình → thẻ biến mất ngay (cả for_you, my_classes, _safe)');
select t.ok((select count(*) from t.clips('A', 'for_you')) = 2, 'thu hồi B không ảnh hưởng A');
update public.class_curriculum_access set status = 'active' where user_id = t.u('B');
select t.ok((select count(*) from t.clips('B', 'for_you')) = 2, 'cấp lại quyền → thẻ trở lại');
update public.class_lesson_content set status = 'draft' where session_id = '51000000-0000-4000-8000-000000000001';
select t.ok((select count(*) from t.clips('A', 'for_you')) = 1, 'S1 gỡ xuất bản (nháp) → thẻ S1 biến mất ngay');
update public.class_lesson_content set status = 'published' where session_id = '51000000-0000-4000-8000-000000000001';
update public.class_schedule set status = 'cancelled' where id = 'b1000000-0000-4000-8000-000000000002';
select t.ok((select count(*) from t.clips('C', 'my_classes')) = 0, 'lớp TH02 bị huỷ → my_classes của C không còn thẻ (mảng lớp rỗng KHÔNG thành "mọi lớp")');
select t.ok((select count(*) from t.clips('A', 'my_classes')) = 2, 'huỷ TH02 không ảnh hưởng A');
select t.ok((select count(*) from t.clips('C', 'for_you')) = 1, 'for_you theo đúng RLS giáo trình (quyền còn) — khác my_classes, ghi nhận có chủ đích');
update public.class_schedule set status = 'scheduled' where id = 'b1000000-0000-4000-8000-000000000002';
delete from public.class_curriculum_access where user_id = t.u('C');
select t.ok((select count(*) from t.clips('C', 'for_you')) = 0, 'C mất hàng quyền giáo trình → không thẻ');
insert into public.class_curriculum_access (class_id, user_id, status) values ('b1000000-0000-4000-8000-000000000002', t.u('C'), 'active');
select t.ok((select count(*) from t.clips('C', 'for_you')) = 1, 'khôi phục quyền C');
-- chặn người dùng không ảnh hưởng (thẻ không có tác giả)
insert into public.class_user_blocks (blocker_id, blocked_id) values (t.u('A'), t.u('B')), (t.u('A'), t.u('C')), (t.u('A'), t.u('T'));
select t.ok((select count(*) from t.clips('A', 'for_you')) = 2 and (select count(*) from t.clips_you('A')) = 2, 'A chặn mọi người → vẫn thấy thẻ (nội dung Thầy, không tác giả; kiểm duyệt _safe không nuốt)');
delete from public.class_user_blocks;

-- ═ 3) Payload: chỉ tham chiếu, không URL / video id / ghi chú / nội dung ═══════════════════════════
select t.ok((select bool_and((select array_agg(k order by k) from jsonb_object_keys(post) k) = array['added_at','class_code','class_id','class_name','duration','session_id','session_no','title'])
               from t.clips('A', 'for_you')), 'payload CHỈ có đúng 8 khoá tham chiếu');
select t.ok(not exists (select 1 from t.clips('A', 'for_you') c where c.post::text ~* '(youtu|http|ZZfakeVID|NOTE_SENTINEL|"url"|"note"|"blocks"|v=)')
        and not exists (select 1 from t.clips('C', 'for_you') c where c.post::text ~* '(youtu|http|ZZfakeVID|NOTE_SENTINEL|"url"|"note"|"blocks"|v=)'),
  'payload KHÔNG chứa URL YouTube / video id / ghi chú / blocks');
select t.ok(not exists (select 1 from t.feed('A', 'for_you', 50) f where f.kind = 'lesson_clip' and (f.thread is not null)), 'thẻ không mang cột thread');
select t.ok((select count(*) from t.clips('A', 'for_you') where post ->> 'title' = 'Ôn nhanh S1' and post ->> 'duration' = '2:07' and (post ->> 'session_no')::int = 1
               and post ->> 'class_id' = 'b1000000-0000-4000-8000-000000000001') = 1, 'thẻ S1: tiêu đề, thời lượng, buổi, lớp đúng');

-- ═ 4) Khối không đủ điều kiện KHÔNG hiện và KHÔNG làm vỡ Feed ═══════════════════════════════════════
select t.ok(not exists (select 1 from t.clips('A', 'for_you') where post ->> 'title' in ('S2 thiếu added_at','S2 sai định dạng','S2 ngày không tồn tại','S2 tương lai','S3 quá cũ','S4 bản nháp','added_at không phải chuỗi')),
  'thiếu added_at / sai định dạng / ngày không tồn tại / tương lai / quá 90 ngày / nháp / added_at không phải chuỗi → KHÔNG hiện');
select t.ok(not exists (select 1 from t.clips('A', 'for_you') where btrim(post ->> 'title') = ''), 'tiêu đề rỗng → KHÔNG hiện');
select t.ok((select count(*) from t.clips('A', 'for_you') where post ->> 'title' = 'S2 tương lai') = 0 and (select max(sort_at) from t.clips('A', 'for_you')) <= now() + interval '5 minutes',
  'added_at tương lai (> 5 phút) → ẨN, không nổi vĩnh viễn trên đầu Feed');
select t.ok(public.social_clip_added_at('2026-02-31T00:00:00.000Z') is null and public.social_clip_added_at('x') is null and public.social_clip_added_at(null) is null
        and public.social_clip_added_at('2026-11-01T05:30:12.123Z') = '2026-11-01 05:30:12.123+00'::timestamptz and public.social_clip_added_at('2026-11-01T05:30:12+07:00') is null,
  'social_clip_added_at: hợp lệ → thời điểm; hỏng/NULL/offset → NULL, không ném lỗi');

-- ═ 5) Sắp xếp ổn định — sửa giáo trình KHÔNG làm thẻ nổi lại ═══════════════════════════════════════
create temp table before_edit as select sort_at, sort_key from t.clips('A', 'for_you');
update public.class_lesson_content set updated_at = now() + interval '1 hour',
  blocks = jsonb_build_array(jsonb_build_object('kind', 'note', 'text', 'chèn trước, sửa lỗi chính tả')) || blocks || '[{"kind":"note","text":"thêm sau"}]'::jsonb
 where session_id in ('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000002');
select t.ok((select array_agg(sort_at order by sort_key) from t.clips('A', 'for_you')) = (select array_agg(sort_at order by sort_key) from before_edit)
        and (select array_agg(sort_key order by sort_key) from t.clips('A', 'for_you')) = (select array_agg(sort_key order by sort_key) from before_edit),
  'sửa nội dung + đổi updated_at + chèn khối trước/sau → sort_at và sort_key của mọi thẻ KHÔNG đổi');
select t.ok((select array_agg(sort_key order by sort_at desc, sort_key desc) from t.clips('A', 'for_you')) = (select array_agg(sort_key order by sort_at desc, sort_key desc) from before_edit),
  'thứ tự thẻ không đổi sau khi sửa');
select t.ok((select count(distinct sort_key) from t.clips('A', 'for_you')) = (select count(*) from t.clips('A', 'for_you')), 'sort_key duy nhất');
-- hai khối cùng tiêu đề + cùng added_at trong một buổi: không trùng khoá (distinct on)
update public.class_lesson_content set blocks = blocks || jsonb_build_array(
  jsonb_build_object('kind', 'video', 'title', 'Trùng', 'added_at', t.iso('3 hours')), jsonb_build_object('kind', 'video', 'title', 'Trùng', 'added_at', t.iso('3 hours')))
 where session_id = '51000000-0000-4000-8000-000000000002';
update public.class_lesson_content set blocks = (select jsonb_agg(e) from jsonb_array_elements(blocks) e where e ->> 'title' is distinct from 'Trùng') where session_id = '51000000-0000-4000-8000-000000000002';

-- ═ 6) Phân trang keyset trộn nhiều loại: không trùng, không sót, đúng thứ tự ═════════════════════════
select t.ok((select count(*) from t.feed('A', 'for_you', 2)) = (select count(*) from t.feed('A', 'for_you', 50)), 'A: duyệt trang size 2 = trang size 50 (không sót)');
select t.ok((select count(*) = count(distinct sort_key) from t.feed('A', 'for_you', 2)), 'A: không trùng khi phân trang size 2');
select t.ok((select array_agg(sort_key) from t.feed('A', 'for_you', 1)) = (select array_agg(sort_key) from t.feed('A', 'for_you', 50)), 'A: size 1 và size 50 cho CÙNG thứ tự');
select t.ok((select bool_and(a.sort_at >= b.sort_at) from (select sort_at, row_number() over () r from t.feed('A', 'for_you', 50)) a join (select sort_at, row_number() over () r from t.feed('A', 'for_you', 50)) b on b.r = a.r + 1),
  'thứ tự sort_at giảm dần');
select t.ok((select count(*) from t.feed('A', 'for_you', 50) where kind = 'lesson_clip') = 2 and (select count(*) from t.feed('A', 'for_you', 50) where kind = 'post') >= 2,
  'Feed trộn: thẻ clip + bài Social cùng xuất hiện');
select t.ok((select count(*) from t.feed('A', 'my_classes', 2) where kind = 'lesson_clip') = 2, 'my_classes phân trang size 2 vẫn đủ 2 thẻ');

-- ═ 7) HỒI QUY: các loại Feed cũ GIỮ NGUYÊN hành vi (so với ảnh chụp trước migration) ═══════════════════
create function t.old_only(k text, s text) returns jsonb language sql as $$
  select coalesce(jsonb_agg(jsonb_build_object('kind', f.kind, 'at', f.sort_at, 'key', f.sort_key, 'post', f.post, 'thread', f.thread) order by f.sort_at desc, f.sort_key desc), '[]'::jsonb)
    from t.feed(k, s, 3) f where f.kind <> 'lesson_clip' $$;
create function t.old_only_you(k text) returns jsonb language sql as $$
  select coalesce(jsonb_agg(jsonb_build_object('kind', f.kind, 'at', f.sort_at, 'key', f.sort_key, 'post', f.post, 'thread', f.thread) order by f.sort_at desc, f.sort_key desc), '[]'::jsonb)
    from t.feed_you(k, 3) f where f.kind <> 'lesson_clip' $$;
grant execute on all functions in schema t to anon, authenticated;
do $$ declare r record; n int := 0; begin
  for r in select * from t.snap loop
    if r.scope = 'you_safe' then
      if t.old_only_you(r.who) is distinct from r.rows then raise exception 'FAIL: hồi quy social_feed_safe khác ảnh chụp trước migration (người %)', r.who; end if;
    else
      if t.old_only(r.who, r.scope) is distinct from r.rows then raise exception 'FAIL: hồi quy scoped % khác ảnh chụp trước migration (người %)', r.scope, r.who; end if;
    end if;
    n := n + 1;
  end loop;
  raise notice 'PASS: hồi quy — % bộ (người × góc nhìn) KHÁC LOẠI clip giống HỆT trước migration (mọi trang size 3, post/thread/teamlab/kiểm duyệt)', n;
end $$;

-- ═ 8) Cấu trúc: không bảng / cột / policy mới; ACL ═════════════════════════════════════════════════
select t.ok(has_function_privilege('authenticated', 'public.social_feed(timestamptz,text,int)', 'execute') and not has_function_privilege('anon', 'public.social_feed(timestamptz,text,int)', 'execute')
        and has_function_privilege('authenticated', 'public.social_feed_scoped(text,timestamptz,text,int)', 'execute') and not has_function_privilege('anon', 'public.social_feed_scoped(text,timestamptz,text,int)', 'execute'),
  'ACL hai hàm Feed giữ nguyên (authenticated có, anon không)');
select t.ok(not has_function_privilege('authenticated', 'public.social_feed_clip_items(uuid[])', 'execute') and not has_function_privilege('anon', 'public.social_feed_clip_items(uuid[])', 'execute')
        and not has_function_privilege('public', 'public.social_feed_clip_items(uuid[])', 'execute'), 'hàm nội bộ không ai ngoài owner gọi được');
select t.ok((select bool_and(p.prosecdef and p.proconfig @> array['search_path=""']) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname in ('social_feed', 'social_feed_scoped', 'social_feed_clip_items')), 'SECURITY DEFINER + search_path rỗng');
