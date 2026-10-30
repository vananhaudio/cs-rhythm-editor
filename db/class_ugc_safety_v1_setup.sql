-- CLASS UGC SAFETY V1 — báo cáo nội dung · chặn người dùng · đồng ý quy tắc cộng đồng · bộ lọc từ cấm (Apple Guideline 1.2).
-- Hợp đồng API: docs/CLASS-UGC-SAFETY-V1.md. Chạy bằng scripts/prod-db.py (MỘT transaction; file KHÔNG có begin/commit — chạy tay: psql -1 -f).
-- Idempotent, ADDITIVE: tạo 4 bảng + hàm + trigger MỚI. KHÔNG sửa/ghi đè hàm production (class_feed, class_comments_for_posts, class_moderate,
-- lt_moderate, dm_*, bandchat_*, send_friend_request, class_public_identity …) — chỉ GỌI chúng. KHÔNG xoá/sửa dữ liệu cũ.
--
-- Nguyên tắc (giống dm_v1 / band_chat_v1):
--   • 4 bảng: RLS BẬT, thu hồi MỌI grant, KHÔNG có policy ⇒ client không CRUD thẳng; mọi thao tác qua RPC SECURITY DEFINER
--     (search_path rỗng, schema đầy đủ) dùng auth.uid(). Không CREATE POLICY ⇒ không dính khoá policy_grants.
--     (Hợp đồng ghi "RLS hẹp: Thầy select/update, chủ chặn select" — thay bằng RPC class_reports_list/class_report_resolve/class_my_blocks: chặt hơn.)
--   • ⚠ 4 bảng đã thêm vào self_managed của db/rls_setup.sql (cùng đợt) — nếu không, chạy lại rls_setup sẽ áp policy rộng lên chúng.
--   • Ghi chặn = trigger BEFORE INSERT (posts/comments còn BEFORE UPDATE OF body) trên bảng sẵn có; đọc chặn = hàm bọc *_safe (client đổi sang gọi).
--     Lỗi trigger: message đúng 'ugc_blocked' (SQLSTATE UGC01) / 'user_blocked' (UGC02) / 'account_suspended' (UGC03).
--   • Chặn người dùng CHỈ ảnh hưởng tương tác + hiển thị (kết bạn, nhắn DM, feed, bình luận, tin Band); KHÔNG đụng quyền học / thành viên lớp / thành viên Band.
--   • Thầy/Admin (app_users.role) không bị trigger chặn tin/lọc từ, và không thể bị chặn/đình chỉ qua chức năng này.
--   • Đình chỉ (hide_and_block) = edu_students.blocked_at (cột sẵn có từ db/story_reports.sql). Học viên KHÔNG tự gỡ được: trigger
--     class_ugc_guard_student giữ nguyên blocked_at/blocked_reason nếu người sửa không phải Thầy (SQL Editor / service role: auth.uid() null → được sửa).
--   • Danh sách từ cấm (class_ugc_blocklist) là DỮ LIỆU do Thầy quản lý (SQL Editor/service role), KHÔNG phải bộ lọc đầy đủ. Seed khiêm tốn.
--     Khớp theo RANH GIỚI TỪ (không khớp một phần từ: "Scunthorpe", "Chặng", hợp âm "Dm" không bị chặn).
--   • Bảng đặt CUỐI, một câu lệnh (khoá ngoại tới auth.users xin khoá ngắn nhất có thể) — nên mọi hàm tham chiếu bảng là plpgsql.

-- 0) Cổng drift
do $gate$
declare
  v_name text;
  v_cols int;
  v_res text;
  k text;
begin
  -- hàm nền phải có
  foreach k in array array['public.is_teacher()', 'public.is_class_member()', 'public.is_class_member_user(uuid)', 'public.class_public_identity(uuid)',
      'public.class_post_visible(uuid)', 'public.class_moderate(text,uuid,boolean)', 'public.lt_moderate(text,uuid,boolean)',
      'public.lt_can_view(uuid,text,timestamp with time zone)', 'public.bandchat_access(uuid)',
      'public.class_feed(timestamp with time zone,uuid,integer)', 'public.class_comments_for_posts(uuid[],integer)',
      'public.dm_messages(uuid,bigint,bigint,integer)', 'public.dm_conversations(integer)', 'public.bandchat_messages(uuid,bigint,bigint,integer)',
      'public.social_feed(timestamp with time zone,text,integer)', 'public.social_feed_scoped(text,timestamp with time zone,text,integer)'] loop
    if to_regprocedure(k) is null then raise exception 'DỪNG — thiếu hàm nền %', k; end if;
  end loop;
  -- kiểu trả về của 5 hàm được bọc *_safe phải ĐÚNG như repo (hàm *_safe khai báo cùng cột)
  for k, v_res in select * from (values
    ('public.class_feed(timestamp with time zone,uuid,integer)',
     'TABLE(id uuid, type text, body text, media_type text, media_provider text, media_url text, external_media_id text, created_at timestamp with time zone, updated_at timestamp with time zone, author_user_id uuid, author_name text, author_avatar_url text, author_role text, author_ht_member boolean, is_mine boolean, is_hidden boolean, comment_count integer)'),
    ('public.class_comments_for_posts(uuid[],integer)',
     'TABLE(id uuid, post_id uuid, parent_comment_id uuid, body text, created_at timestamp with time zone, updated_at timestamp with time zone, author_user_id uuid, author_name text, author_avatar_url text, author_role text, is_mine boolean, is_hidden boolean, tags jsonb, resources jsonb, post_comment_count integer)'),
    ('public.dm_messages(uuid,bigint,bigint,integer)',
     'TABLE(seq bigint, sender_id uuid, mine boolean, body text, created_at timestamp with time zone, ref_type text, ref_key text)'),
    ('public.dm_conversations(integer)',
     'TABLE(conversation_id uuid, peer_id uuid, peer_name text, peer_avatar_url text, peer_role text, last_seq bigint, last_body text, last_mine boolean, last_at timestamp with time zone, unread integer, can_send boolean)'),
    ('public.bandchat_messages(uuid,bigint,bigint,integer)',
     'TABLE(seq bigint, sender_id uuid, sender_name text, sender_avatar_url text, mine boolean, body text, created_at timestamp with time zone)'),
    ('public.social_feed(timestamp with time zone,text,integer)',
     'TABLE(kind text, sort_at timestamp with time zone, sort_key text, post jsonb, thread jsonb)'),
    ('public.social_feed_scoped(text,timestamp with time zone,text,integer)',
     'TABLE(kind text, sort_at timestamp with time zone, sort_key text, post jsonb, thread jsonb)')
  ) x(k, v) loop
    if pg_get_function_result(to_regprocedure(k)) is distinct from v_res then
      raise exception 'DỪNG — kiểu trả về của % khác repo (hàm *_safe sẽ lệch cột): %', k, pg_get_function_result(to_regprocedure(k));
    end if;
  end loop;
  -- cột nền
  select count(*) into v_cols from information_schema.columns where table_schema = 'public' and (table_name, column_name) in (
    ('class_posts', 'id'), ('class_posts', 'author_user_id'), ('class_posts', 'body'), ('class_posts', 'hidden_at'),
    ('class_post_comments', 'id'), ('class_post_comments', 'post_id'), ('class_post_comments', 'author_user_id'), ('class_post_comments', 'body'), ('class_post_comments', 'hidden_at'),
    ('friendships', 'requester_id'), ('friendships', 'addressee_id'), ('friendships', 'status'),
    ('dm_messages', 'conversation_id'), ('dm_messages', 'seq'), ('dm_messages', 'sender_kind'), ('dm_messages', 'sender_id'), ('dm_messages', 'body'), ('dm_messages', 'ref_type'),
    ('dm_conversations', 'id'), ('dm_conversations', 'user_lo'), ('dm_conversations', 'user_hi'),
    ('dm_participants', 'conversation_id'), ('dm_participants', 'user_id'),
    ('bandchat_messages', 'band_id'), ('bandchat_messages', 'seq'), ('bandchat_messages', 'sender_id'), ('bandchat_messages', 'body'),
    ('learning_thread_events', 'id'), ('learning_thread_events', 'thread_id'), ('learning_thread_events', 'author_user_id'), ('learning_thread_events', 'body'), ('learning_thread_events', 'hidden_at'),
    ('learning_threads', 'id'), ('learning_threads', 'learner_user_id'), ('learning_threads', 'visibility'), ('learning_threads', 'hidden_at'),
    ('edu_students', 'user_id'), ('edu_students', 'blocked_at'), ('edu_students', 'blocked_reason'),
    ('app_users', 'id'), ('app_users', 'role'));
  if v_cols <> 41 then
    raise exception 'DỪNG — thiếu cột nền (có %/41). edu_students.blocked_at cần db/story_reports.sql; dm_messages.ref_type cần db/dm_share_v1_setup.sql', v_cols;
  end if;
  -- va chạm tên: đã có đối tượng cùng tên mà KHÔNG thuộc UGC Safety V1 → dừng
  for v_name in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname in ('class_reports', 'class_user_blocks', 'class_ugc_consent', 'class_ugc_blocklist')
       and coalesce(obj_description(c.oid, 'pg_class'), '') not like 'class_ugc_safety_v1:%'
  loop raise exception 'DỪNG — đã có bảng % không thuộc UGC Safety V1', v_name; end loop;
  for v_name in
    select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in ('class_report_submit', 'class_block_user', 'class_unblock_user', 'class_my_blocks', 'class_is_blocked_pair',
       'class_ugc_status', 'class_ugc_accept', 'class_ugc_required_version', 'class_ugc_pair_blocked', 'class_ugc_text_blocked',
       'class_ugc_guard_write', 'class_ugc_guard_friend', 'class_ugc_guard_student', 'class_feed_safe', 'class_comments_for_posts_safe',
       'dm_messages_safe', 'dm_conversations_safe', 'bandchat_messages_safe', 'social_feed_safe', 'social_feed_scoped_safe', 'class_reports_list', 'class_report_resolve')
       and coalesce(obj_description(p.oid, 'pg_proc'), '') not like 'class_ugc_safety_v1:%'
  loop raise exception 'DỪNG — đã có hàm % không thuộc UGC Safety V1', v_name; end loop;
  for v_name in
    select t.tgname || ' on ' || t.tgrelid::regclass::text from pg_trigger t join pg_proc f on f.oid = t.tgfoid
     where not t.tgisinternal and t.tgname in ('class_ugc_guard_ins', 'class_ugc_guard_upd', 'class_ugc_guard_friend', 'class_ugc_guard_student')
       and coalesce(obj_description(f.oid, 'pg_proc'), '') not like 'class_ugc_safety_v1:%'
  loop raise exception 'DỪNG — đã có trigger % không thuộc UGC Safety V1', v_name; end loop;
end $gate$;

-- 1) Hàm nội bộ (không ai ngoài owner gọi được)
-- 1a) Hai người có chặn nhau (một trong hai chiều) không
create or replace function public.class_ugc_pair_blocked(p_a uuid, p_b uuid)
returns boolean language plpgsql security definer set search_path = '' stable as $$
begin
  if p_a is null or p_b is null or p_a = p_b then return false; end if;
  return exists (select 1 from public.class_user_blocks b where b.blocker_id = p_a and b.blocked_id = p_b)
      or exists (select 1 from public.class_user_blocks b where b.blocker_id = p_b and b.blocked_id = p_a);
end $$;
comment on function public.class_ugc_pair_blocked(uuid, uuid) is 'class_ugc_safety_v1: có chặn một trong hai chiều (nội bộ)';
revoke all on function public.class_ugc_pair_blocked(uuid, uuid) from public, anon, authenticated;

-- 1b) Văn bản có khớp từ cấm đang bật không. Khớp theo RANH GIỚI TỪ: ký tự liền trước/sau không được là chữ/số (Latin + tiếng Việt).
--     Mẫu là chuỗi THƯỜNG (đã escape regex); khoảng trắng trong cụm khớp mọi khoảng trắng liên tiếp. Không phân biệt hoa/thường, chuẩn hoá NFC.
create or replace function public.class_ugc_text_blocked(p_text text)
returns boolean language plpgsql security definer set search_path = '' stable as $$
declare v_t text; v_l constant text := 'a-z0-9_À-ɏḀ-ỿ';
begin
  if p_text is null or btrim(p_text) = '' then return false; end if;
  v_t := lower(normalize(p_text, nfc));
  return exists (
    select 1 from public.class_ugc_blocklist b
     where b.active and b.severity = 'block'
       and v_t ~ ('(^|[^' || v_l || '])'
                  || regexp_replace(regexp_replace(lower(normalize(b.pattern, nfc)), '([\\.^$|?*+(){}\[\]-])', '\\\1', 'g'), '\s+', '\\s+', 'g')
                  || '([^' || v_l || ']|$)'));
end $$;
comment on function public.class_ugc_text_blocked(text) is 'class_ugc_safety_v1: văn bản khớp từ cấm (nội bộ)';
revoke all on function public.class_ugc_text_blocked(text) from public, anon, authenticated;

-- 2) Trigger chặn ghi
-- 2a) posts / comments / DM / Band chat / thread events: (1) đình chỉ → account_suspended, (2) DM: hai bên chặn nhau → user_blocked, (3) từ cấm → ugc_blocked
create or replace function public.class_ugc_guard_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_sender uuid; v_text text; v_peer uuid;
begin
  if tg_table_name = 'class_posts' then v_sender := new.author_user_id; v_text := new.body;
  elsif tg_table_name = 'class_post_comments' then v_sender := new.author_user_id; v_text := new.body;
  elsif tg_table_name = 'dm_messages' then
    if new.sender_kind <> 'user' then return new; end if;
    v_sender := new.sender_id; v_text := new.body;
    select case when c.user_lo = new.sender_id then c.user_hi else c.user_lo end into v_peer
      from public.dm_conversations c where c.id = new.conversation_id;
  elsif tg_table_name = 'bandchat_messages' then v_sender := new.sender_id; v_text := new.body;
  elsif tg_table_name = 'learning_thread_events' then v_sender := new.author_user_id; v_text := new.body;
  else return new;
  end if;
  if v_sender is null then return new; end if;
  if exists (select 1 from public.app_users au where au.id = v_sender and au.role in ('teacher', 'admin')) then return new; end if;
  if exists (select 1 from public.edu_students s where s.user_id = v_sender and s.blocked_at is not null) then
    raise exception 'account_suspended' using errcode = 'UGC03', hint = 'Tài khoản đang bị tạm dừng tương tác';
  end if;
  if v_peer is not null and public.class_ugc_pair_blocked(v_sender, v_peer) then
    raise exception 'user_blocked' using errcode = 'UGC02', hint = 'Bạn không thể tương tác với người này';
  end if;
  if public.class_ugc_text_blocked(v_text) then
    raise exception 'ugc_blocked' using errcode = 'UGC01', hint = 'Nội dung chưa phù hợp với quy tắc cộng đồng';
  end if;
  return new;
end $$;
comment on function public.class_ugc_guard_write() is 'class_ugc_safety_v1: trigger chặn ghi (đình chỉ / chặn / từ cấm)';
revoke all on function public.class_ugc_guard_write() from public, anon, authenticated;

-- 2b) friendships: hai bên có chặn → user_blocked (lời mời mới hoặc mở lại lời mời); người gửi bị đình chỉ → account_suspended
create or replace function public.class_ugc_guard_friend()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.status not in ('pending', 'accepted') then return new; end if;
    if old.status = new.status and old.requester_id = new.requester_id and old.addressee_id = new.addressee_id then return new; end if;
  end if;
  if public.class_ugc_pair_blocked(new.requester_id, new.addressee_id) then
    raise exception 'user_blocked' using errcode = 'UGC02', hint = 'Bạn không thể tương tác với người này';
  end if;
  if (tg_op = 'INSERT' or new.requester_id is distinct from old.requester_id)
     and exists (select 1 from public.edu_students s where s.user_id = new.requester_id and s.blocked_at is not null)
     and not exists (select 1 from public.app_users au where au.id = new.requester_id and au.role in ('teacher', 'admin')) then
    raise exception 'account_suspended' using errcode = 'UGC03', hint = 'Tài khoản đang bị tạm dừng tương tác';
  end if;
  return new;
end $$;
comment on function public.class_ugc_guard_friend() is 'class_ugc_safety_v1: trigger chặn kết bạn khi có chặn / đình chỉ';
revoke all on function public.class_ugc_guard_friend() from public, anon, authenticated;

-- 2c) edu_students: người dùng KHÔNG tự gỡ đình chỉ. Chỉ Thầy (hoặc ngữ cảnh không có auth.uid(): SQL Editor / service role) đổi blocked_at / blocked_reason.
create or replace function public.class_ugc_guard_student()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (new.blocked_at is distinct from old.blocked_at or new.blocked_reason is distinct from old.blocked_reason)
     and auth.uid() is not null and not public.is_teacher() then
    new.blocked_at := old.blocked_at;
    new.blocked_reason := old.blocked_reason;
  end if;
  return new;
end $$;
comment on function public.class_ugc_guard_student() is 'class_ugc_safety_v1: chỉ Thầy đổi blocked_at/blocked_reason';
revoke all on function public.class_ugc_guard_student() from public, anon, authenticated;

-- 3) Phiên bản quy tắc cộng đồng hiện hành
create or replace function public.class_ugc_required_version()
returns int language sql security definer set search_path = '' immutable as $$ select 1 $$;
comment on function public.class_ugc_required_version() is 'class_ugc_safety_v1: phiên bản quy tắc cộng đồng hiện hành';
revoke all on function public.class_ugc_required_version() from public, anon;
grant execute on function public.class_ugc_required_version() to authenticated;

-- 4) RPC cho client
-- 4a) Gửi báo cáo. Server tự lấy auth.uid(), tự suy target_user_id + trích đoạn (chụp lúc báo cáo để Thầy còn bằng chứng khi nội dung bị xoá).
--     target_id theo kind: post/comment = uuid · profile = uuid người dùng · thread = uuid lượt (learning_thread_events) hoặc thread ·
--     dm_message = '<uuid hội thoại>:<seq>' · band_message = 'band:<uuid band>:<seq>' (nhận cả '<uuid band>:<seq>'; lưu dạng chuẩn có 'band:').
create or replace function public.class_report_submit(p_kind text, p_target_id text, p_reason text, p_note text default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_kind text := lower(btrim(coalesce(p_kind, '')));
  v_tid text := lower(btrim(coalesce(p_target_id, '')));
  v_reason text := lower(btrim(coalesce(p_reason, '')));
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_user uuid; v_excerpt text; v_found boolean := false; v_id bigint; v_n int; v_ref uuid; v_seq bigint;
  c_uuid constant text := '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
begin
  if v_me is null or not public.is_class_member() then raise exception 'Chưa đăng nhập Class' using errcode = '42501'; end if;
  if v_kind not in ('post', 'comment', 'profile', 'dm_message', 'band_message', 'thread') then raise exception 'Loại nội dung không hợp lệ' using errcode = '22023'; end if;
  if v_reason not in ('spam', 'harassment', 'inappropriate', 'hate', 'sexual', 'violence', 'other') then raise exception 'Lý do không hợp lệ' using errcode = '22023'; end if;
  if v_note is not null and char_length(v_note) > 500 then raise exception 'Ghi chú quá dài (tối đa 500 ký tự)' using errcode = '22023'; end if;
  if v_tid = '' or char_length(v_tid) > 100 then raise exception 'Thiếu đối tượng báo cáo' using errcode = '22023'; end if;

  -- Tìm đối tượng + kiểm người báo cáo THẤY được nó (không báo cáo nội dung mình không xem được; lỗi chung: không lộ sự tồn tại)
  if v_kind = 'post' then
    if v_tid ~ ('^' || c_uuid || '$') then
      select p.author_user_id, left(p.body, 200) into v_user, v_excerpt from public.class_posts p
       where p.id = v_tid::uuid and public.class_post_visible(p.id);
      v_found := found;
    end if;
  elsif v_kind = 'comment' then
    if v_tid ~ ('^' || c_uuid || '$') then
      select c.author_user_id, left(c.body, 200) into v_user, v_excerpt from public.class_post_comments c
       where c.id = v_tid::uuid and (c.hidden_at is null or public.is_teacher()) and public.class_post_visible(c.post_id);
      v_found := found;
    end if;
  elsif v_kind = 'profile' then
    if v_tid ~ ('^' || c_uuid || '$') and public.is_class_member_user(v_tid::uuid) then
      v_user := v_tid::uuid; v_found := true;
    end if;
  elsif v_kind = 'dm_message' then
    v_tid := regexp_replace(v_tid, '^dm:', '');
    if v_tid ~ ('^' || c_uuid || ':[0-9]{1,18}$') then
      v_ref := split_part(v_tid, ':', 1)::uuid; v_seq := split_part(v_tid, ':', 2)::bigint;
      select m.sender_id, case when m.ref_type is null then left(m.body, 200) else '[nội dung chia sẻ]' end into v_user, v_excerpt
        from public.dm_messages m
       where m.conversation_id = v_ref and m.seq = v_seq and m.sender_kind = 'user'
         and exists (select 1 from public.dm_participants p where p.conversation_id = v_ref and p.user_id = v_me);
      v_found := found;
    end if;
  elsif v_kind = 'band_message' then
    -- client gửi 'band:<id>:<seq>' (conversationId = 'band:<id>'); cũng nhận '<id>:<seq>'. Lưu dạng chuẩn 'band:<id>:<seq>'.
    v_tid := regexp_replace(v_tid, '^band:', '');
    if v_tid ~ ('^' || c_uuid || ':[0-9]{1,18}$') then
      v_ref := split_part(v_tid, ':', 1)::uuid; v_seq := split_part(v_tid, ':', 2)::bigint;
      v_tid := 'band:' || v_tid;
      if public.bandchat_access(v_ref) is not null then
        select m.sender_id, left(m.body, 200) into v_user, v_excerpt from public.bandchat_messages m
         where m.band_id = v_ref and m.seq = v_seq and m.sender_id is not null;
        v_found := found;
      end if;
    end if;
  else  -- thread: ưu tiên lượt (event); nếu không phải thì coi là thread
    if v_tid ~ ('^' || c_uuid || '$') then
      select e.author_user_id, left(e.body, 200) into v_user, v_excerpt
        from public.learning_thread_events e join public.learning_threads t on t.id = e.thread_id
       where e.id = v_tid::uuid and e.hidden_at is null and public.lt_can_view(t.learner_user_id, t.visibility, t.hidden_at);
      v_found := found;
      if not v_found then
        select t.learner_user_id, null into v_user, v_excerpt from public.learning_threads t
         where t.id = v_tid::uuid and public.lt_can_view(t.learner_user_id, t.visibility, t.hidden_at);
        v_found := found;
      end if;
    end if;
  end if;
  if not v_found then raise exception 'Không tìm thấy nội dung cần báo cáo' using errcode = 'P0002'; end if;
  if v_user = v_me then raise exception 'Không thể báo cáo chính mình' using errcode = '22023'; end if;

  -- Khoá theo (người báo, đối tượng): bấm đúp / hai thiết bị không sinh hai báo cáo
  perform pg_advisory_xact_lock(hashtextextended(v_me::text || '|' || v_kind || '|' || v_tid, 21));
  select r.id into v_id from public.class_reports r
   where r.reporter_id = v_me and r.kind = v_kind and r.target_id = v_tid and r.status = 'new';
  if v_id is not null then return v_id; end if;   -- trùng báo cáo đang mở → trả id cũ (không tính vào giới hạn)

  select count(*) into v_n from public.class_reports r where r.reporter_id = v_me and r.created_at > now() - interval '1 hour';
  if v_n >= 20 then raise exception 'Bạn gửi báo cáo quá nhanh. Hãy thử lại sau.' using errcode = '54000'; end if;

  insert into public.class_reports (reporter_id, kind, target_id, target_user_id, reason, note, excerpt)
  values (v_me, v_kind, v_tid, v_user, v_reason, v_note, v_excerpt)
  returning id into v_id;
  return v_id;
end $$;
comment on function public.class_report_submit(text, text, text, text) is 'class_ugc_safety_v1: gửi báo cáo nội dung/người dùng';
revoke all on function public.class_report_submit(text, text, text, text) from public, anon;
grant execute on function public.class_report_submit(text, text, text, text) to authenticated;

-- 4b) Chặn người dùng: tạo chặn + huỷ quan hệ bạn bè (mọi trạng thái, hai chiều). KHÔNG đụng lớp/khoá học/Band.
create or replace function public.class_block_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null or not public.is_class_member() then raise exception 'Chưa đăng nhập Class' using errcode = '42501'; end if;
  if p_user_id is null or p_user_id = v_me then raise exception 'Không thể chặn chính mình' using errcode = '22023'; end if;
  if not public.is_class_member_user(p_user_id) then raise exception 'Không tìm thấy thành viên' using errcode = 'P0002'; end if;
  if exists (select 1 from public.app_users au where au.id = p_user_id and au.role in ('teacher', 'admin')) then
    raise exception 'Không thể chặn Thầy/Admin — hãy báo cáo nếu cần' using errcode = '22023';
  end if;
  -- cùng khoá cặp với send_friend_request: không có cửa sổ vừa chặn vừa gửi lời mời
  perform pg_advisory_xact_lock(hashtextextended(least(v_me, p_user_id)::text || greatest(v_me, p_user_id)::text, 7));
  insert into public.class_user_blocks (blocker_id, blocked_id) values (v_me, p_user_id) on conflict do nothing;
  delete from public.friendships f
   where least(f.requester_id, f.addressee_id) = least(v_me, p_user_id)
     and greatest(f.requester_id, f.addressee_id) = greatest(v_me, p_user_id);
end $$;
comment on function public.class_block_user(uuid) is 'class_ugc_safety_v1: chặn người dùng (+ huỷ bạn bè)';
revoke all on function public.class_block_user(uuid) from public, anon;
grant execute on function public.class_block_user(uuid) to authenticated;

create or replace function public.class_unblock_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_class_member() then raise exception 'Chưa đăng nhập Class' using errcode = '42501'; end if;
  delete from public.class_user_blocks b where b.blocker_id = auth.uid() and b.blocked_id = p_user_id;
end $$;
comment on function public.class_unblock_user(uuid) is 'class_ugc_safety_v1: bỏ chặn (không khôi phục bạn bè)';
revoke all on function public.class_unblock_user(uuid) from public, anon;
grant execute on function public.class_unblock_user(uuid) to authenticated;

create or replace function public.class_my_blocks()
returns table(user_id uuid, name text, avatar_url text, created_at timestamptz)
language plpgsql security definer set search_path = '' stable as $$
begin
  if auth.uid() is null or not public.is_class_member() then raise exception 'Chưa đăng nhập Class' using errcode = '42501'; end if;
  return query
  select b.blocked_id, i.name, i.avatar_url, b.created_at
    from public.class_user_blocks b
    cross join lateral public.class_public_identity(b.blocked_id) i
   where b.blocker_id = auth.uid()
   order by b.created_at desc, b.blocked_id
   limit 200;
end $$;
comment on function public.class_my_blocks() is 'class_ugc_safety_v1: danh sách người mình đã chặn';
revoke all on function public.class_my_blocks() from public, anon;
grant execute on function public.class_my_blocks() to authenticated;

-- Hai người có chặn nhau không (một trong hai chiều). Chỉ trả đúng khi người gọi là một trong hai (hoặc Thầy) — không dò quan hệ chặn của người khác.
create or replace function public.class_is_blocked_pair(a uuid, b uuid)
returns boolean language plpgsql security definer set search_path = '' stable as $$
begin
  if auth.uid() is null then return false; end if;
  if auth.uid() is distinct from a and auth.uid() is distinct from b and not public.is_teacher() then return false; end if;
  return public.class_ugc_pair_blocked(a, b);
end $$;
comment on function public.class_is_blocked_pair(uuid, uuid) is 'class_ugc_safety_v1: hai người có chặn nhau không';
revoke all on function public.class_is_blocked_pair(uuid, uuid) from public, anon;
grant execute on function public.class_is_blocked_pair(uuid, uuid) to authenticated;

-- 4c) Đồng ý quy tắc cộng đồng
create or replace function public.class_ugc_status()
returns table(accepted_version int, required_version int)
language plpgsql security definer set search_path = '' stable as $$
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập' using errcode = '42501'; end if;
  return query select (select c.version from public.class_ugc_consent c where c.user_id = auth.uid()), public.class_ugc_required_version();
end $$;
comment on function public.class_ugc_status() is 'class_ugc_safety_v1: phiên bản đã đồng ý / hiện hành';
revoke all on function public.class_ugc_status() from public, anon;
grant execute on function public.class_ugc_status() to authenticated;

create or replace function public.class_ugc_accept(p_version int)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_class_member() then raise exception 'Chưa đăng nhập Class' using errcode = '42501'; end if;
  if p_version is null or p_version < 1 or p_version > public.class_ugc_required_version() then
    raise exception 'Phiên bản quy tắc không hợp lệ' using errcode = '22023';
  end if;
  insert into public.class_ugc_consent (user_id, version, accepted_at) values (auth.uid(), p_version, now())
  on conflict (user_id) do update
    set version = greatest(public.class_ugc_consent.version, excluded.version),
        accepted_at = case when excluded.version > public.class_ugc_consent.version then now() else public.class_ugc_consent.accepted_at end;
end $$;
comment on function public.class_ugc_accept(int) is 'class_ugc_safety_v1: đồng ý quy tắc cộng đồng';
revoke all on function public.class_ugc_accept(int) from public, anon;
grant execute on function public.class_ugc_accept(int) to authenticated;

-- 5) Hàm bọc *_safe — CÙNG cột với bản gốc; bản gốc không bị sửa. Lọc người chặn/bị chặn HAI CHIỀU; lặp lấy tiếp để đủ trang.
-- 5a) Feed: duyệt keyset theo bản gốc, bỏ bài của người bị chặn hai chiều, lấy tiếp trang kế (tối đa 10 vòng) cho đủ p_limit
create or replace function public.class_feed_safe(p_before timestamptz default null, p_before_id uuid default null, p_limit int default 20)
returns table(
  id uuid, type text, body text,
  media_type text, media_provider text, media_url text, external_media_id text,
  created_at timestamptz, updated_at timestamptz,
  author_user_id uuid, author_name text, author_avatar_url text,
  author_role text, author_ht_member boolean, is_mine boolean,
  is_hidden boolean, comment_count int)
language plpgsql security definer set search_path = '' stable as $$
declare
  v_me uuid := auth.uid(); v_lim int := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_t timestamptz := p_before; v_cid uuid := p_before_id; v_out int := 0; v_raw int; r record; i int;
begin
  for i in 1..10 loop
    v_raw := 0;
    for r in select * from public.class_feed(v_t, v_cid, v_lim) loop
      v_raw := v_raw + 1; v_t := r.created_at; v_cid := r.id;
      continue when public.class_ugc_pair_blocked(v_me, r.author_user_id);
      id := r.id; type := r.type; body := r.body;
      media_type := r.media_type; media_provider := r.media_provider; media_url := r.media_url; external_media_id := r.external_media_id;
      created_at := r.created_at; updated_at := r.updated_at;
      author_user_id := r.author_user_id; author_name := r.author_name; author_avatar_url := r.author_avatar_url;
      author_role := r.author_role; author_ht_member := r.author_ht_member; is_mine := r.is_mine;
      is_hidden := r.is_hidden; comment_count := r.comment_count;
      return next;
      v_out := v_out + 1;
      if v_out >= v_lim then return; end if;
    end loop;
    exit when v_raw < v_lim;
  end loop;
end $$;
comment on function public.class_feed_safe(timestamptz, uuid, int) is 'class_ugc_safety_v1: class_feed đã lọc người chặn/bị chặn';
revoke all on function public.class_feed_safe(timestamptz, uuid, int) from public, anon;
grant execute on function public.class_feed_safe(timestamptz, uuid, int) to authenticated;

-- 5b) Bình luận theo lô: bản gốc lấy p_per_post bình luận MỚI NHẤT mỗi bài; nếu lọc làm thiếu thì gọi lại với số lớn hơn (tối đa 200) rồi cắt về p_per_post
create or replace function public.class_comments_for_posts_safe(p_post_ids uuid[], p_per_post int default 3)
returns table(
  id uuid, post_id uuid, parent_comment_id uuid, body text,
  created_at timestamptz, updated_at timestamptz,
  author_user_id uuid, author_name text, author_avatar_url text, author_role text,
  is_mine boolean, is_hidden boolean, tags jsonb, resources jsonb,
  post_comment_count int)
language plpgsql security definer set search_path = '' stable as $$
declare
  v_me uuid := auth.uid(); v_per int := least(greatest(coalesce(p_per_post, 3), 1), 200); v_n int; v_raw jsonb; v_more boolean;
begin
  v_n := v_per;
  loop
    select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) into v_raw from public.class_comments_for_posts(p_post_ids, v_n) c;
    select exists (
      select 1 from (
        select j ->> 'post_id' as pid, count(*) as total,
               count(*) filter (where not public.class_ugc_pair_blocked(v_me, nullif(j ->> 'author_user_id', '')::uuid)) as kept
          from jsonb_array_elements(v_raw) j group by 1) g
       where g.total >= v_n and g.kept < v_per) into v_more;
    exit when not v_more or v_n >= 200;
    v_n := least(200, v_n * 3);
  end loop;
  return query
  select x.id, x.post_id, x.parent_comment_id, x.body, x.created_at, x.updated_at,
         x.author_user_id, x.author_name, x.author_avatar_url, x.author_role,
         x.is_mine, x.is_hidden, x.tags, x.resources, x.post_comment_count
    from (
      select y.*, e.ord,
             row_number() over (partition by y.post_id order by e.ord desc) as rn
        from jsonb_array_elements(v_raw) with ordinality e(j, ord)
        cross join lateral jsonb_to_record(e.j) as y(
          id uuid, post_id uuid, parent_comment_id uuid, body text, created_at timestamptz, updated_at timestamptz,
          author_user_id uuid, author_name text, author_avatar_url text, author_role text,
          is_mine boolean, is_hidden boolean, tags jsonb, resources jsonb, post_comment_count int)
       where not public.class_ugc_pair_blocked(v_me, y.author_user_id)) x
   where x.rn <= v_per
   order by x.ord;
end $$;
comment on function public.class_comments_for_posts_safe(uuid[], int) is 'class_ugc_safety_v1: class_comments_for_posts đã lọc người chặn/bị chặn';
revoke all on function public.class_comments_for_posts_safe(uuid[], int) from public, anon;
grant execute on function public.class_comments_for_posts_safe(uuid[], int) to authenticated;

-- 5c) DM: hội thoại 1-1 — hai bên chặn nhau thì KHÔNG trả tin nào (lịch sử vẫn nằm nguyên trong DB). Lỗi/quyền giữ như dm_messages.
create or replace function public.dm_messages_safe(p_conversation uuid, p_after_seq bigint default null, p_before_seq bigint default null, p_limit int default 30)
returns table(seq bigint, sender_id uuid, mine boolean, body text, created_at timestamptz, ref_type text, ref_key text)
language plpgsql security definer set search_path = '' stable as $$
declare v_me uuid := auth.uid(); v_peer uuid;
begin
  if v_me is null or not public.is_class_member() then raise exception 'Chưa đăng nhập Class' using errcode = '42501'; end if;
  if not exists (select 1 from public.dm_participants p where p.conversation_id = p_conversation and p.user_id = v_me) then
    raise exception 'Không tìm thấy cuộc trò chuyện' using errcode = 'P0002';
  end if;
  select p.user_id into v_peer from public.dm_participants p where p.conversation_id = p_conversation and p.user_id <> v_me;
  if public.class_ugc_pair_blocked(v_me, v_peer) then return; end if;
  return query select * from public.dm_messages(p_conversation, p_after_seq, p_before_seq, p_limit);
end $$;
comment on function public.dm_messages_safe(uuid, bigint, bigint, int) is 'class_ugc_safety_v1: dm_messages ẩn hội thoại với người chặn/bị chặn';
revoke all on function public.dm_messages_safe(uuid, bigint, bigint, int) from public, anon;
grant execute on function public.dm_messages_safe(uuid, bigint, bigint, int) to authenticated;

-- 5c') Danh sách hội thoại: bỏ hội thoại với người chặn/bị chặn (nếu không, tin cuối của người bị chặn vẫn hiện ở danh sách)
create or replace function public.dm_conversations_safe(p_limit int default 50)
returns table(conversation_id uuid, peer_id uuid, peer_name text, peer_avatar_url text, peer_role text,
              last_seq bigint, last_body text, last_mine boolean, last_at timestamptz, unread int, can_send boolean)
language plpgsql security definer set search_path = '' stable as $$
declare v_me uuid := auth.uid(); v_lim int := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  return query
  select c.* from public.dm_conversations(100) c
   where not public.class_ugc_pair_blocked(v_me, c.peer_id)
   limit v_lim;
end $$;
comment on function public.dm_conversations_safe(int) is 'class_ugc_safety_v1: dm_conversations bỏ hội thoại với người chặn/bị chặn';
revoke all on function public.dm_conversations_safe(int) from public, anon;
grant execute on function public.dm_conversations_safe(int) to authenticated;

-- 5d) Band chat: chỉ lọc TIN của người mình chặn / chặn mình (phòng, thành viên, quyền giữ nguyên). Cùng quy ước phân trang với bản gốc:
--     có p_after_seq → tiến tới (lấy p_limit tin cũ nhất sau mốc); ngược lại → lùi (p_limit tin mới nhất trước mốc). Lặp tối đa 5 vòng cho đủ trang.
create or replace function public.bandchat_messages_safe(p_band uuid, p_after_seq bigint default null, p_before_seq bigint default null, p_limit int default 30)
returns table(seq bigint, sender_id uuid, sender_name text, sender_avatar_url text, mine boolean, body text, created_at timestamptz)
language plpgsql security definer set search_path = '' stable as $$
declare
  v_me uuid := auth.uid(); v_lim int := least(greatest(coalesce(p_limit, 30), 1), 100);
  v_after bigint := p_after_seq; v_before bigint := p_before_seq; v_kept jsonb := '[]'::jsonb; v_page jsonb; v_flt jsonb; v_raw int; i int;
begin
  for i in 1..5 loop
    select coalesce(jsonb_agg(to_jsonb(m) order by m.seq), '[]'::jsonb), count(*)::int into v_page, v_raw
      from public.bandchat_messages(p_band, v_after, v_before, v_lim) m;
    exit when v_raw = 0;
    select coalesce(jsonb_agg(j order by (j ->> 'seq')::bigint), '[]'::jsonb) into v_flt
      from jsonb_array_elements(v_page) j
     where not public.class_ugc_pair_blocked(v_me, nullif(j ->> 'sender_id', '')::uuid);
    if p_after_seq is not null then
      v_kept := v_kept || v_flt; v_after := (v_page -> (v_raw - 1) ->> 'seq')::bigint;
    else
      v_kept := v_flt || v_kept; v_before := (v_page -> 0 ->> 'seq')::bigint;
    end if;
    exit when v_raw < v_lim or jsonb_array_length(v_kept) >= v_lim;
  end loop;
  if p_after_seq is not null then
    return query
    select x.seq, x.sender_id, x.sender_name, x.sender_avatar_url, x.mine, x.body, x.created_at
      from jsonb_to_recordset(v_kept) as x(seq bigint, sender_id uuid, sender_name text, sender_avatar_url text, mine boolean, body text, created_at timestamptz)
     order by x.seq asc limit v_lim;
  else
    return query
    select z.seq, z.sender_id, z.sender_name, z.sender_avatar_url, z.mine, z.body, z.created_at
      from (select x.* from jsonb_to_recordset(v_kept) as x(seq bigint, sender_id uuid, sender_name text, sender_avatar_url text, mine boolean, body text, created_at timestamptz)
             order by x.seq desc limit v_lim) z
     order by z.seq asc;
  end if;
end $$;
comment on function public.bandchat_messages_safe(uuid, bigint, bigint, int) is 'class_ugc_safety_v1: bandchat_messages đã lọc tin người chặn/bị chặn';
revoke all on function public.bandchat_messages_safe(uuid, bigint, bigint, int) from public, anon;
grant execute on function public.bandchat_messages_safe(uuid, bigint, bigint, int) to authenticated;

-- 5e) Feed /me (social_feed / social_feed_scoped): bỏ bài của tác giả và thread của người học bị chặn hai chiều; mục không có tác giả
--     (teamlab_publication) giữ nguyên. Duyệt keyset (sort_at, sort_key) theo bản gốc, lặp tối đa 10 vòng cho đủ trang.
create or replace function public.social_feed_safe(p_before timestamptz default null, p_before_key text default null, p_limit int default 20)
returns table(kind text, sort_at timestamptz, sort_key text, post jsonb, thread jsonb)
language plpgsql security definer set search_path = '' stable as $$
declare
  v_me uuid := auth.uid(); v_lim int := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_t timestamptz := p_before; v_k text := p_before_key; v_out int := 0; v_raw int; r record; i int; v_who uuid;
begin
  for i in 1..10 loop
    v_raw := 0;
    for r in select * from public.social_feed(v_t, v_k, v_lim) loop
      v_raw := v_raw + 1; v_t := r.sort_at; v_k := r.sort_key;
      v_who := coalesce(nullif(r.post ->> 'author_user_id', ''), nullif(r.thread -> 'learner' ->> 'user_id', ''))::uuid;
      continue when public.class_ugc_pair_blocked(v_me, v_who);
      kind := r.kind; sort_at := r.sort_at; sort_key := r.sort_key; post := r.post; thread := r.thread;
      return next;
      v_out := v_out + 1;
      if v_out >= v_lim then return; end if;
    end loop;
    exit when v_raw < v_lim;
  end loop;
end $$;
comment on function public.social_feed_safe(timestamptz, text, int) is 'class_ugc_safety_v1: social_feed đã lọc người chặn/bị chặn';
revoke all on function public.social_feed_safe(timestamptz, text, int) from public, anon;
grant execute on function public.social_feed_safe(timestamptz, text, int) to authenticated;

create or replace function public.social_feed_scoped_safe(p_scope text, p_before timestamptz default null, p_before_key text default null, p_limit int default 20)
returns table(kind text, sort_at timestamptz, sort_key text, post jsonb, thread jsonb)
language plpgsql security definer set search_path = '' stable as $$
declare
  v_me uuid := auth.uid(); v_lim int := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_t timestamptz := p_before; v_k text := p_before_key; v_out int := 0; v_raw int; r record; i int; v_who uuid;
begin
  for i in 1..10 loop
    v_raw := 0;
    for r in select * from public.social_feed_scoped(p_scope, v_t, v_k, v_lim) loop
      v_raw := v_raw + 1; v_t := r.sort_at; v_k := r.sort_key;
      v_who := coalesce(nullif(r.post ->> 'author_user_id', ''), nullif(r.thread -> 'learner' ->> 'user_id', ''))::uuid;
      continue when public.class_ugc_pair_blocked(v_me, v_who);
      kind := r.kind; sort_at := r.sort_at; sort_key := r.sort_key; post := r.post; thread := r.thread;
      return next;
      v_out := v_out + 1;
      if v_out >= v_lim then return; end if;
    end loop;
    exit when v_raw < v_lim;
  end loop;
end $$;
comment on function public.social_feed_scoped_safe(text, timestamptz, text, int) is 'class_ugc_safety_v1: social_feed_scoped đã lọc người chặn/bị chặn';
revoke all on function public.social_feed_scoped_safe(text, timestamptz, text, int) from public, anon;
grant execute on function public.social_feed_scoped_safe(text, timestamptz, text, int) to authenticated;

-- 6) Thầy: xem + xử lý báo cáo
create or replace function public.class_reports_list(p_status text default 'new', p_limit int default 100)
returns table(id bigint, kind text, target_id text, target_user_id uuid, target_user_name text, reporter_name text, reason text, note text,
              status text, created_at timestamptz, handled_at timestamptz, handled_action text, excerpt text)
language plpgsql security definer set search_path = '' stable as $$
declare v_status text := lower(btrim(coalesce(p_status, 'all'))); v_lim int := least(greatest(coalesce(p_limit, 100), 1), 200);
begin
  if auth.uid() is null or not public.is_teacher() then raise exception 'Không có quyền' using errcode = '42501'; end if;
  if v_status not in ('all', 'new', 'handled', 'dismissed') then raise exception 'Trạng thái không hợp lệ' using errcode = '22023'; end if;
  return query
  select r.id, r.kind, r.target_id, r.target_user_id,
         case when r.target_user_id is null then null else ti.name end, ri.name,
         r.reason, r.note, r.status, r.created_at, r.handled_at, r.handled_action, r.excerpt
    from public.class_reports r
    left join lateral public.class_public_identity(r.target_user_id) ti on true
    left join lateral public.class_public_identity(r.reporter_id) ri on true
   where v_status = 'all' or r.status = v_status
   order by case when r.status = 'new' then r.created_at end asc nulls last, r.created_at desc, r.id desc
   limit v_lim;
end $$;
comment on function public.class_reports_list(text, int) is 'class_ugc_safety_v1: Thầy xem báo cáo';
revoke all on function public.class_reports_list(text, int) from public, anon;
grant execute on function public.class_reports_list(text, int) to authenticated;

-- Xử lý báo cáo: dismiss | handled (chỉ đóng) · hide (ẩn nội dung qua class_moderate / lt_moderate sẵn có — chỉ post/comment/thread)
-- · hide_and_block (ẩn nếu ẩn được + đình chỉ người bị báo cáo qua edu_students.blocked_at). Đóng CẢ các báo cáo đang mở khác cùng đối tượng.
create or replace function public.class_report_resolve(p_id bigint, p_action text, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid(); v_action text := lower(btrim(coalesce(p_action, ''))); v_note text := nullif(btrim(coalesce(p_note, '')), '');
  r record; v_status text; v_hide boolean := false;
begin
  if v_me is null or not public.is_teacher() then raise exception 'Không có quyền' using errcode = '42501'; end if;
  if v_action not in ('dismiss', 'hide', 'hide_and_block', 'handled') then raise exception 'Hành động không hợp lệ' using errcode = '22023'; end if;
  if v_note is not null and char_length(v_note) > 500 then raise exception 'Ghi chú quá dài (tối đa 500 ký tự)' using errcode = '22023'; end if;
  select * into r from public.class_reports where id = p_id for update;
  if not found then raise exception 'Không tìm thấy báo cáo' using errcode = 'P0002'; end if;
  if r.status <> 'new' then raise exception 'Báo cáo đã được xử lý' using errcode = '22023'; end if;

  if v_action in ('hide', 'hide_and_block') then
    v_hide := r.kind in ('post', 'comment', 'thread');
    if v_action = 'hide' and not v_hide then
      raise exception 'Loại nội dung này không có chức năng ẩn — dùng handled hoặc hide_and_block' using errcode = '22023';
    end if;
    if v_hide then
      begin
        if r.kind = 'post' then perform public.class_moderate('post', r.target_id::uuid, true);
        elsif r.kind = 'comment' then perform public.class_moderate('comment', r.target_id::uuid, true);
        elsif exists (select 1 from public.learning_thread_events e where e.id = r.target_id::uuid) then perform public.lt_moderate('event', r.target_id::uuid, true);
        else perform public.lt_moderate('thread', r.target_id::uuid, true);
        end if;
      exception when others then
        -- nội dung đã bị chủ xoá → coi như đã gỡ; lỗi khác thì dừng cả giao dịch
        if sqlstate <> 'P0002' and sqlerrm <> 'LT_NOT_FOUND' then raise; end if;
      end;
    end if;
    if v_action = 'hide_and_block' then
      if r.target_user_id is null then raise exception 'Báo cáo không xác định được người cần đình chỉ' using errcode = '22023'; end if;
      if exists (select 1 from public.app_users au where au.id = r.target_user_id and au.role in ('teacher', 'admin')) then
        raise exception 'Không thể đình chỉ Thầy/Admin' using errcode = '22023';
      end if;
      update public.edu_students s
         set blocked_at = coalesce(s.blocked_at, now()),
             blocked_reason = coalesce(s.blocked_reason, 'class_ugc_safety: ' || r.reason)
       where s.user_id = r.target_user_id;
      if not found then raise exception 'Không có hồ sơ học viên để đình chỉ' using errcode = '22023'; end if;
    end if;
  end if;

  v_status := case when v_action = 'dismiss' then 'dismissed' else 'handled' end;
  update public.class_reports
     set status = v_status, handled_by = v_me, handled_at = now(), handled_action = v_action, handled_note = v_note
   where kind = r.kind and target_id = r.target_id and status = 'new';
end $$;
comment on function public.class_report_resolve(bigint, text, text) is 'class_ugc_safety_v1: Thầy xử lý báo cáo';
revoke all on function public.class_report_resolve(bigint, text, text) from public, anon;
grant execute on function public.class_report_resolve(bigint, text, text) to authenticated;

-- N) Bảng — đặt CUỐI, MỘT câu lệnh (khoá ngoại tới auth.users xin khoá ShareRowExclusive ngắn nhất có thể)
do $tables$
begin
create table if not exists public.class_reports (
  id             bigint generated always as identity primary key,
  reporter_id    uuid not null references auth.users(id) on delete cascade,
  kind           text not null,
  target_id      text not null,
  target_user_id uuid references auth.users(id) on delete set null,
  reason         text not null,
  note           text,
  excerpt        text,                                   -- trích đoạn chụp lúc báo cáo (≤200 ký tự) — bằng chứng khi nội dung bị xoá
  status         text not null default 'new',
  created_at     timestamptz not null default now(),
  handled_by     uuid references auth.users(id) on delete set null,
  handled_at     timestamptz,
  handled_action text,
  handled_note   text,
  constraint class_reports_kind_check check (kind in ('post', 'comment', 'profile', 'dm_message', 'band_message', 'thread')),
  constraint class_reports_reason_check check (reason in ('spam', 'harassment', 'inappropriate', 'hate', 'sexual', 'violence', 'other')),
  constraint class_reports_status_check check (status in ('new', 'handled', 'dismissed')),
  constraint class_reports_note_check check (note is null or char_length(note) <= 500),
  constraint class_reports_target_check check (char_length(target_id) between 1 and 100),
  constraint class_reports_action_check check (handled_action is null or handled_action in ('dismiss', 'hide', 'hide_and_block', 'handled')),
  constraint class_reports_handled_check check ((status = 'new') = (handled_at is null))
);
-- chống trùng: một người chỉ có MỘT báo cáo đang mở cho mỗi đối tượng
create unique index if not exists class_reports_open_uq on public.class_reports (reporter_id, kind, target_id) where status = 'new';
create index if not exists class_reports_status_idx on public.class_reports (status, created_at);
create index if not exists class_reports_reporter_idx on public.class_reports (reporter_id, created_at desc);
create index if not exists class_reports_target_idx on public.class_reports (kind, target_id);

create table if not exists public.class_user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint class_user_blocks_not_self check (blocker_id <> blocked_id)
);
create index if not exists class_user_blocks_blocked_idx on public.class_user_blocks (blocked_id);

create table if not exists public.class_ugc_consent (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  version     int not null,
  accepted_at timestamptz not null default now(),
  constraint class_ugc_consent_version_check check (version >= 1)
);

create table if not exists public.class_ugc_blocklist (
  id         bigint generated always as identity primary key,
  pattern    text not null,
  kind       text not null,
  severity   text not null default 'block',
  active     boolean not null default true,
  note       text,
  created_at timestamptz not null default now(),
  constraint class_ugc_blocklist_pattern_check check (char_length(btrim(pattern)) between 1 and 80),
  constraint class_ugc_blocklist_kind_check check (kind in ('word', 'phrase')),
  constraint class_ugc_blocklist_kind_pattern_check check ((kind = 'phrase') = (pattern ~ '[[:space:]]')),
  constraint class_ugc_blocklist_severity_check check (severity in ('block', 'flag'))   -- 'flag' chỉ để dành: bộ lọc hiện chỉ chặn 'block'
);
create unique index if not exists class_ugc_blocklist_pattern_uq on public.class_ugc_blocklist (lower(pattern));

comment on table public.class_reports is 'class_ugc_safety_v1: báo cáo nội dung/người dùng (chỉ qua RPC)';
comment on table public.class_user_blocks is 'class_ugc_safety_v1: người dùng chặn nhau (chỉ qua RPC)';
comment on table public.class_ugc_consent is 'class_ugc_safety_v1: đồng ý quy tắc cộng đồng theo phiên bản';
comment on table public.class_ugc_blocklist is 'class_ugc_safety_v1: từ/cụm bị chặn — DỮ LIỆU do Thầy quản lý, không phải bộ lọc đầy đủ';

alter table public.class_reports enable row level security;
alter table public.class_user_blocks enable row level security;
alter table public.class_ugc_consent enable row level security;
alter table public.class_ugc_blocklist enable row level security;
revoke all on public.class_reports from public, anon, authenticated;
revoke all on public.class_user_blocks from public, anon, authenticated;
revoke all on public.class_ugc_consent from public, anon, authenticated;
revoke all on public.class_ugc_blocklist from public, anon, authenticated;
end $tables$;

-- 7) Seed từ cấm KHIÊM TỐN — chỉ từ/cụm rõ ràng phản cảm (tiếng Việt + Anh). Khớp theo ranh giới từ (xem class_ugc_text_blocked).
--    Cố ý KHÔNG đưa: "dm"/"Dm" (hợp âm Rê thứ), "cc", "lon", "cac", "ngu", "chó", từ có thể là lời ca/tên bài hát/từ thường ngày.
--    Thầy thêm/bớt/tắt bằng SQL Editor (active=false), không cần phát hành app. Chạy lại setup không ghi đè dòng đã có (kể cả dòng Thầy đã tắt).
insert into public.class_ugc_blocklist (pattern, kind, note)
select v.pattern, case when v.pattern ~ '[[:space:]]' then 'phrase' else 'word' end,
       'seed UGC Safety V1 (khiêm tốn) — dữ liệu do Thầy quản lý, không phải bộ lọc đầy đủ'
  from (values
    ('địt'), ('địt mẹ'), ('địt con mẹ'), ('đụ'), ('đụ má'), ('đụ mẹ'), ('lồn'), ('cặc'), ('buồi'), ('đéo'), ('đĩ'), ('con đĩ'),
    ('đm'), ('đmm'), ('đcm'), ('vcl'), ('vkl'), ('đồ chó'), ('thằng chó'), ('giết mày'), ('đập chết mày'),
    ('dit me'), ('dit con me'), ('du ma'), ('du me'), ('dcm'), ('dmm'),
    ('fuck'), ('fucked'), ('fucker'), ('fucking'), ('motherfucker'), ('cunt'), ('nigger'), ('nigga'), ('faggot'), ('whore'), ('slut'),
    ('kys'), ('kill yourself'), ('kill urself')
  ) v(pattern)
on conflict do nothing;

notify pgrst, 'reload schema';

-- 8) Trigger — đặt SAU bảng. Tên bắt đầu bằng class_ugc_ nên chạy SAU trigger chuẩn hoá của bài/bình luận (class_post_*), thấy nội dung đã btrim.
drop trigger if exists class_ugc_guard_ins on public.class_posts;
create trigger class_ugc_guard_ins before insert on public.class_posts for each row execute function public.class_ugc_guard_write();
drop trigger if exists class_ugc_guard_upd on public.class_posts;
create trigger class_ugc_guard_upd before update of body on public.class_posts for each row
  when (old.body is distinct from new.body) execute function public.class_ugc_guard_write();

drop trigger if exists class_ugc_guard_ins on public.class_post_comments;
create trigger class_ugc_guard_ins before insert on public.class_post_comments for each row execute function public.class_ugc_guard_write();
drop trigger if exists class_ugc_guard_upd on public.class_post_comments;
create trigger class_ugc_guard_upd before update of body on public.class_post_comments for each row
  when (old.body is distinct from new.body) execute function public.class_ugc_guard_write();

drop trigger if exists class_ugc_guard_ins on public.dm_messages;
create trigger class_ugc_guard_ins before insert on public.dm_messages for each row execute function public.class_ugc_guard_write();
drop trigger if exists class_ugc_guard_ins on public.bandchat_messages;
create trigger class_ugc_guard_ins before insert on public.bandchat_messages for each row execute function public.class_ugc_guard_write();
drop trigger if exists class_ugc_guard_ins on public.learning_thread_events;
create trigger class_ugc_guard_ins before insert on public.learning_thread_events for each row execute function public.class_ugc_guard_write();

drop trigger if exists class_ugc_guard_friend on public.friendships;
create trigger class_ugc_guard_friend before insert or update on public.friendships for each row execute function public.class_ugc_guard_friend();

drop trigger if exists class_ugc_guard_student on public.edu_students;
create trigger class_ugc_guard_student before update of blocked_at, blocked_reason on public.edu_students for each row
  execute function public.class_ugc_guard_student();

notify pgrst, 'reload schema';
