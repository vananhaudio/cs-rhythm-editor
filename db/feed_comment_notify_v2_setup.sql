-- ═══════════════════════════════════════════════════════════════════════════
-- CLASS SOCIAL — FEED COMMENT NOTIFY V2: thông báo (System Chat / Thông báo V3) cho bình luận bài Social và bài TeamLab đã xuất bản.
-- Thread (bài trả học viên): GIỮ NGUYÊN hành vi V2 (cùng điều kiện, cùng nội dung, cùng dedupe).
-- Phạm vi tối thiểu, dùng lại class_system_notices — KHÔNG bảng mới, KHÔNG RPC mới, KHÔNG đổi RLS/quyền, KHÔNG push:
--   1) class_system_notices_ref_check: nới ref_type — vẫn 'thread' cho mọi kind; thêm ('post','teamlab_publication') CHỈ cho kind 'feed_comment'.
--   2) feed_comment_notify(): thêm nhánh teamlab_publication → người xuất bản (teamlab_publications.published_by).
--   3) Trigger MỚI class_post_comment_notify AFTER INSERT trên class_post_comments → tác giả bài Social (class_posts.author_user_id).
--      (Chỉ THÊM trigger; không đổi cấu trúc/policy/dữ liệu/hàm class_add_comment của class_post_comments.)
-- Quy tắc:
--   • Không tự báo cho chính mình · không báo khi hai người có chặn nhau (một trong hai chiều) · bình luận ẩn lúc tạo → không báo
--   • Bài Social đã ẩn / bài TeamLab không còn 'published' → không báo
--   • Gộp: tối đa MỘT thông báo cho mỗi (chủ bài, bài, người bình luận, ngày UTC). Người khác bình luận → thông báo riêng.
--   • Nội dung cố định "Có bình luận mới trên bài của bạn." — KHÔNG chứa nội dung bình luận (ẩn/xoá/báo cáo sau đó không lộ gì).
--   • Bình luận bị xoá/ẩn SAU khi đã báo: thông báo giữ nguyên (là bản ghi sự kiện); mở bài sẽ không thấy bình luận đó.
--   • Lỗi trong trigger chỉ cảnh báo (warning), KHÔNG làm hỏng việc gửi bình luận.
--   • KHÔNG thông báo trả lời (reply) cho người viết bình luận gốc.
-- Rollback: db/feed_comment_notify_v2_rollback.sql · Trước/sau: *_preflight.sql / *_postflight.sql. CHẠY: prod-db.py (file KHÔNG có begin/commit).
-- ═══════════════════════════════════════════════════════════════════════════

do $gate$
declare v_miss text[] := '{}'; v_src text;
begin
  if to_regprocedure('public.class_ugc_pair_blocked(uuid,uuid)') is null then v_miss := v_miss || 'class_ugc_pair_blocked'; end if;
  if to_regclass('public.class_system_notices') is null then v_miss := v_miss || 'class_system_notices'; end if;
  if to_regclass('public.class_posts') is null then v_miss := v_miss || 'class_posts'; end if;
  if to_regclass('public.class_post_comments') is null then v_miss := v_miss || 'class_post_comments'; end if;
  if to_regclass('public.teamlab_publications') is null then v_miss := v_miss || 'teamlab_publications'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'teamlab_publications' and column_name = 'published_by') then
    v_miss := v_miss || 'teamlab_publications.published_by'; end if;
  select p.prosrc into v_src from pg_proc p where p.oid = to_regprocedure('public.feed_comment_notify()');
  if v_src is null then v_miss := v_miss || 'feed_comment_notify (cài Feed Comments V2 trước)';
  -- chỉ thay thân hàm V2 đã biết (md5 production 30/10/2026) hoặc bản V2-notify đã cài (chạy lại)
  elsif md5(v_src) <> '7ac335a8a38a68326037023c1bc9f18b' and position('FEED_COMMENT_NOTIFY_V2' in v_src) = 0 then
    v_miss := v_miss || 'feed_comment_notify có thân hàm lạ (md5 ' || md5(v_src) || ') — DỪNG, không ghi đè'; end if;
  if cardinality(v_miss) > 0 then raise exception 'FEED_COMMENT_NOTIFY_V2_GATE_FAIL: thiếu/lệch %', array_to_string(v_miss, ', '); end if;
end
$gate$;

-- 1) ràng buộc ref: ref_type mới CHỈ đi với kind 'feed_comment'
alter table public.class_system_notices drop constraint if exists class_system_notices_ref_check;
alter table public.class_system_notices add constraint class_system_notices_ref_check
  check (ref_key ~ '^[0-9a-f-]{36}$' and (ref_type = 'thread' or (kind = 'feed_comment' and ref_type in ('post', 'teamlab_publication'))));

-- 2) thread (GIỮ NGUYÊN) + teamlab_publication (MỚI)
create or replace function public.feed_comment_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_owner uuid; v_ref text;   -- FEED_COMMENT_NOTIFY_V2
begin
  if new.hidden_at is not null then return new; end if;
  begin
    if new.target_kind = 'learning_thread' then
      select t.learner_user_id into v_owner from public.learning_threads t
       where t.id = new.target_id and t.hidden_at is null and t.archived_at is null and t.visibility = 'community';
      v_ref := 'thread';
    elsif new.target_kind = 'teamlab_publication' then
      select pb.published_by into v_owner from public.teamlab_publications pb
       where pb.id = new.target_id and pb.status = 'published' and pb.unpublished_at is null;
      v_ref := 'teamlab_publication';
      if v_owner is not null and public.class_ugc_pair_blocked(v_owner, new.author_user_id) then return new; end if;
    else
      return new;
    end if;
    if v_owner is null or v_owner = new.author_user_id then return new; end if;
    insert into public.class_system_notices (user_id, kind, body, ref_type, ref_key, dedupe_key)
    values (v_owner, 'feed_comment', 'Có bình luận mới trên bài của bạn.', v_ref, new.target_id::text,
            'fc:' || new.target_id::text || ':' || new.author_user_id::text || ':' || to_char(now() at time zone 'utc', 'YYYY-MM-DD'))
    on conflict (user_id, dedupe_key) do nothing;
  exception when others then
    raise warning 'feed_comment_notify: bỏ qua thông báo (comment %, SQLSTATE %)', new.id, sqlstate;
  end;
  return new;
end $$;
revoke all on function public.feed_comment_notify() from public, anon, authenticated;

-- 3) bài Social
create or replace function public.class_post_comment_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_owner uuid;
begin
  if new.hidden_at is not null then return new; end if;
  begin
    select p.author_user_id into v_owner from public.class_posts p where p.id = new.post_id and p.hidden_at is null;
    if v_owner is null or v_owner = new.author_user_id then return new; end if;
    if public.class_ugc_pair_blocked(v_owner, new.author_user_id) then return new; end if;
    insert into public.class_system_notices (user_id, kind, body, ref_type, ref_key, dedupe_key)
    values (v_owner, 'feed_comment', 'Có bình luận mới trên bài của bạn.', 'post', new.post_id::text,
            'pc:' || new.post_id::text || ':' || new.author_user_id::text || ':' || to_char(now() at time zone 'utc', 'YYYY-MM-DD'))
    on conflict (user_id, dedupe_key) do nothing;
  exception when others then
    raise warning 'class_post_comment_notify: bỏ qua thông báo (comment %, SQLSTATE %)', new.id, sqlstate;
  end;
  return new;
end $$;
revoke all on function public.class_post_comment_notify() from public, anon, authenticated;
drop trigger if exists class_post_comment_notify on public.class_post_comments;
create trigger class_post_comment_notify after insert on public.class_post_comments
  for each row execute function public.class_post_comment_notify();
