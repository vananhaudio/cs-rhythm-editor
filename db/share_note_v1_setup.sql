-- Share Note V1 — "Chia sẻ tức thì": khoanh ô nhịp trong bản nhạc giáo trình (LessonScore) → chia sẻ qua Universal Share.
-- Thiết kế: docs/SHARE-NOTE-V1.md. Rollback: db/share_note_v1_rollback.sql. Test: bash scripts/test-share-note-db.sh.
-- Phần mở rộng của Universal Share V1 (KHÔNG hệ thống chia sẻ thứ hai):
--   • 1 bảng share_notes = THAM CHIẾU tới asset gốc (class_lesson_content.blocks[section] #> score_path) + dải ô nhịp + lời nhắn.
--     Không nội dung nhạc, không ảnh/PDF/âm thanh, không bản sao. Dấu vân tay sha256 của CHÍNH chuỗi alphaTex do SERVER tính.
--   • Chat: thêm ref_type 'share_note' vào CHECK + một nhánh dm_share (chỉ TÁC GIẢ gửi được).
--   • Feed: bài 'tool_share' (tool = 'share_note') qua RPC social_share_share_note — chỉ tác giả, một bài mỗi note.
--   • Hai mức quyền: THẤY câu hỏi (tác giả · người trong hội thoại có tin do CHÍNH tác giả gửi · thành viên Class khi tác giả đăng Feed)
--     ≠ MỞ bản nhạc tại đúng ô (thêm: quyền giáo trình của lớp + buổi đã xuất bản; Thầy luôn mở được).
--   • Bản nhạc đổi (sha khác / đường dẫn mất) → 'stale': KHÔNG trả dải ô ⇒ client không thể tô sai chỗ; câu hỏi vẫn giữ.
-- Không begin/commit. Không CREATE/ALTER POLICY, không FK ⇒ không khoá auth.users. Chạy lại an toàn (idempotent).
do $gate$
declare v_md5 text := (select md5(p.prosrc) from pg_proc p where p.oid = to_regprocedure('public.dm_share(uuid,text,text)')); v_chk text;
begin
  if to_regclass('public.dm_messages') is null or to_regclass('public.class_lesson_content') is null or to_regclass('public.class_sessions') is null
     or to_regclass('public.class_posts') is null or to_regprocedure('tva_private.can_read_class_curriculum(uuid)') is null
     or to_regprocedure('public.dm_open(uuid,uuid)') is null or to_regprocedure('public.dm_append(uuid,uuid,text,text,text)') is null
     or to_regprocedure('public.is_class_member()') is null or to_regprocedure('public.is_teacher()') is null
     or to_regprocedure('public.chord_share_ok(uuid)') is null then
    raise exception 'DỪNG — thiếu nền (dm_*, class_lesson_content, class_sessions, class_posts, can_read_class_curriculum, chord_share_ok)';
  end if;
  select pg_get_constraintdef(c.oid) into v_chk from pg_constraint c where c.conrelid = 'public.dm_messages'::regclass and c.conname = 'dm_messages_ref_valid_check';
  if obj_description(to_regprocedure('public.share_note_open(uuid)'), 'pg_proc') like 'share_note_v1:%' then
    -- đã cài: chỉ chấp nhận đúng trạng thái của chính bản này (chạy lại)
    if v_chk not like '%share_note%' then raise exception 'DỪNG — share_note đã cài nhưng CHECK thiếu share_note: %', v_chk; end if;
  else
    if v_md5 is distinct from '202766fca632bc9cf22d092b07f0251b' then raise exception 'DỪNG — dm_share khác baseline LIVE (chord_share_v1): %', v_md5; end if;
    if v_chk is null or v_chk not like '%chord_sheet%' or v_chk like '%share_note%' then raise exception 'DỪNG — dm_messages_ref_valid_check khác baseline: %', v_chk; end if;
  end if;
end $gate$;

-- 1) Bảng tham chiếu (≤ ~1 KB/hàng). Đóng: không grant, chỉ RPC SECURITY DEFINER đọc/ghi.
create table if not exists public.share_notes (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null,
  session_id   uuid not null,
  section_idx  integer not null,
  score_path   text[] not null,
  tex_sha      text not null,
  bar_from     integer not null,
  bar_to       integer not null,
  note         text not null,
  client_key   text not null,
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  constraint share_notes_client_key_unique unique (author_id, client_key),
  constraint share_notes_section_check check (section_idx between 0 and 999),
  constraint share_notes_path_check check (
    score_path = array['tex']
    or (cardinality(score_path) = 3 and score_path[1] in ('layers', 'pieces') and score_path[2] ~ '^[0-9]{1,3}$' and score_path[3] = 'tex')),
  constraint share_notes_sha_check check (tex_sha ~ '^[0-9a-f]{64}$'),
  constraint share_notes_bars_check check (bar_from >= 1 and bar_to >= bar_from and bar_to <= 1024 and bar_to - bar_from <= 63),
  constraint share_notes_note_check check (char_length(note) between 1 and 500),
  constraint share_notes_client_key_check check (char_length(client_key) between 8 and 64)
);
create index if not exists share_notes_session_idx on public.share_notes (session_id);
create index if not exists share_notes_author_idx on public.share_notes (author_id, created_at desc);
alter table public.share_notes enable row level security;
revoke all on public.share_notes from public, anon, authenticated;

-- 2) CHECK tham chiếu của Chat: thêm share_note (giữ nguyên các loại hiện có)
alter table public.dm_messages drop constraint if exists dm_messages_ref_valid_check;
alter table public.dm_messages add constraint dm_messages_ref_valid_check check (
  ref_type is null or (ref_type in ('tool_artifact', 'class', 'class_session', 'chord_sheet', 'share_note')
                       and ref_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'));

-- 3) Chuỗi alphaTex hiện tại của bản nhạc được tham chiếu (null = không còn). Nội bộ, không grant.
create or replace function public.share_note_tex(p_session uuid, p_section integer, p_path text[])
returns text language sql stable security definer set search_path = '' as $$
  select (c.blocks -> p_section) #>> p_path from public.class_lesson_content c
   where c.session_id = p_session and c.status = 'published' and jsonb_typeof(c.blocks -> p_section) = 'object'
     and jsonb_typeof((c.blocks -> p_section) #> p_path) = 'string';
$$;
revoke all on function public.share_note_tex(uuid, integer, text[]) from public, anon, authenticated;

-- 4) THẤY câu hỏi (mức 1) — tác giả · thành viên hội thoại có tin share_note DO CHÍNH TÁC GIẢ gửi · thành viên Class khi tác giả đã đăng Feed
create or replace function public.share_note_visible(p_note uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.share_notes n where n.id = p_note and n.deleted_at is null and (
      n.author_id = auth.uid()
      or exists (select 1 from public.dm_messages m join public.dm_participants p on p.conversation_id = m.conversation_id and p.user_id = auth.uid()
                  where m.ref_type = 'share_note' and m.ref_key = n.id::text and m.sender_id = n.author_id)
      or (public.is_class_member() and exists (select 1 from public.class_posts cp
                  where cp.type = 'tool_share' and cp.author_user_id = n.author_id
                    and cp.tool_share ->> 'tool' = 'share_note' and cp.tool_share ->> 'note_id' = n.id::text))));
$$;
revoke all on function public.share_note_visible(uuid) from public, anon;
grant execute on function public.share_note_visible(uuid) to authenticated;   -- chỉ tiết lộ quyền của CHÍNH người gọi

-- 5) MỞ bản nhạc (mức 2): Thầy, hoặc có quyền giáo trình của lớp và buổi đã xuất bản. Nội bộ.
create or replace function public.share_note_score_ok(p_session uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.class_sessions s where s.id = p_session and s.event_type = 'lesson'
       and (public.is_teacher() or (tva_private.can_read_class_curriculum(s.class_id)
            and exists (select 1 from public.class_lesson_content c where c.session_id = s.id and c.status = 'published'))));
$$;
revoke all on function public.share_note_score_ok(uuid) from public, anon, authenticated;

-- 6) Tạo (idempotent theo (tác giả, client_key)). Neo dựng ở SERVER từ tham số rời; sha từ chuỗi alphaTex đọc tại server.
create or replace function public.share_note_create(p_session uuid, p_section integer, p_path text[], p_from integer, p_to integer, p_note text, p_client_key text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_tex text; v_note text := btrim(coalesce(p_note, '')); v_id uuid; v_n integer;
begin
  if v_me is null or not public.is_class_member() then raise exception 'Chưa đăng nhập Class' using errcode = '42501'; end if;
  if char_length(v_note) not between 1 and 500 then raise exception 'Lời nhắn 1–500 ký tự' using errcode = '22023'; end if;
  if p_client_key is null or char_length(p_client_key) not between 8 and 64 then raise exception 'Thiếu khoá chống trùng' using errcode = '22023'; end if;
  if p_from is null or p_to is null or p_from < 1 or p_to < p_from or p_to > 1024 or p_to - p_from > 63
     or p_section is null or p_section not between 0 and 999 or p_path is null
     or not (p_path = array['tex'] or (cardinality(p_path) = 3 and p_path[1] in ('layers', 'pieces') and p_path[2] ~ '^[0-9]{1,3}$' and p_path[3] = 'tex')) then
    raise exception 'Vùng chọn không hợp lệ' using errcode = '22023';
  end if;
  select id into v_id from public.share_notes where author_id = v_me and client_key = p_client_key;
  if v_id is not null then return v_id; end if;                                          -- bấm đúp / thử lại
  -- một thông báo chung: không lộ buổi có tồn tại / có quyền hay không
  v_tex := case when public.share_note_score_ok(p_session) then public.share_note_tex(p_session, p_section, p_path) end;
  if v_tex is null or char_length(v_tex) not between 1 and 200000 then raise exception 'Nội dung này không thể chia sẻ' using errcode = '22023'; end if;
  select count(*) into v_n from public.share_notes where author_id = v_me and created_at > now() - interval '1 minute';
  if v_n >= 10 then raise exception 'Bạn chia sẻ quá nhiều trong thời gian ngắn' using errcode = '54000'; end if;
  insert into public.share_notes (author_id, session_id, section_idx, score_path, tex_sha, bar_from, bar_to, note, client_key)
    values (v_me, p_session, p_section, p_path, encode(sha256(convert_to(v_tex, 'UTF8')), 'hex'), p_from, p_to, v_note, p_client_key)
    on conflict (author_id, client_key) do nothing returning id into v_id;
  if v_id is null then select id into v_id from public.share_notes where author_id = v_me and client_key = p_client_key; end if;   -- đua đồng thời
  return v_id;
end $$;
revoke all on function public.share_note_create(uuid, integer, text[], integer, integer, text, text) from public, anon;
grant execute on function public.share_note_create(uuid, integer, text[], integer, integer, text, text) to authenticated;

-- 7) Mở: 0 hàng = "không còn khả dụng" (đã gỡ / không được thấy — KHÔNG phân biệt lý do).
--    status: ok (trả đường dẫn + dải ô) · stale (bản nhạc đã đổi: KHÔNG trả dải ô) · no_access (thấy câu hỏi, không mở được bản nhạc).
create or replace function public.share_note_open(p_id uuid)
returns table(status text, note text, author_id uuid, is_author boolean, class_id uuid, session_no integer,
              section_idx integer, score_path text[], bar_from integer, bar_to integer, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare r record; v_tex text;
begin
  if p_id is null or not public.share_note_visible(p_id) then return; end if;
  select n.*, s.class_id as cid, s.session_number as sno into r
    from public.share_notes n join public.class_sessions s on s.id = n.session_id where n.id = p_id;
  if not found then return; end if;
  if not public.share_note_score_ok(r.session_id) then
    return query select 'no_access'::text, r.note, r.author_id, r.author_id = auth.uid(), r.cid, r.sno, null::integer, null::text[], null::integer, null::integer, r.created_at;
    return;
  end if;
  v_tex := public.share_note_tex(r.session_id, r.section_idx, r.score_path);
  if v_tex is null or encode(sha256(convert_to(v_tex, 'UTF8')), 'hex') <> r.tex_sha then
    return query select 'stale'::text, r.note, r.author_id, r.author_id = auth.uid(), r.cid, r.sno, null::integer, null::text[], null::integer, null::integer, r.created_at;
    return;
  end if;
  return query select 'ok'::text, r.note, r.author_id, r.author_id = auth.uid(), r.cid, r.sno, r.section_idx, r.score_path, r.bar_from, r.bar_to, r.created_at;
end $$;
revoke all on function public.share_note_open(uuid) from public, anon;
grant execute on function public.share_note_open(uuid) to authenticated;
comment on function public.share_note_open(uuid) is 'share_note_v1: mở tham chiếu khoanh ô nhịp (ok | stale | no_access; 0 hàng = không khả dụng)';

-- 8) Thẻ trong Chat (theo lô ≤ 50): cùng luật THẤY như open; lời nhắn + buổi + dải ô. KHÔNG nội dung giáo án.
create or replace function public.share_note_card(p_ids uuid[])
returns table(id uuid, note text, author_id uuid, class_id uuid, session_no integer, bar_from integer, bar_to integer, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select n.id, n.note, n.author_id, s.class_id, s.session_number, n.bar_from, n.bar_to, n.created_at
    from public.share_notes n join public.class_sessions s on s.id = n.session_id
   where n.id = any (p_ids[1:50]) and public.share_note_visible(n.id);
$$;
revoke all on function public.share_note_card(uuid[]) from public, anon;
grant execute on function public.share_note_card(uuid[]) to authenticated;

-- 9) dm_share: GIỮ NGUYÊN mọi nhánh của baseline (chord_share_v1), thêm 'share_note' (chỉ TÁC GIẢ, còn sống, còn mở được bản nhạc).
create or replace function public.dm_share(p_user uuid, p_ref_type text, p_ref_key text)
returns table(conversation_id uuid, seq bigint) language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_key text := lower(coalesce(p_ref_key, '')); v_conv uuid; v_seq bigint; v_ok boolean := false;
begin
  if v_me is null or not public.is_class_member() then raise exception 'Chưa đăng nhập Class' using errcode = '42501'; end if;
  if not public.dm_rule(v_me, p_user) then raise exception 'Bạn chưa thể nhắn tin cho người này' using errcode = '42501'; end if;
  if v_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    if p_ref_type = 'tool_artifact' then
      v_ok := exists (select 1 from public.tool_artifacts a
                       where a.id = v_key::uuid and ((a.tool = 'bms' and a.kind = 'song') or (a.tool = 'nhipphach' and a.kind = 'score'))
                         and (a.owner_id = v_me or a.visibility = 'class'));
    elsif p_ref_type = 'class' then
      v_ok := exists (select 1 from public.class_schedule c where c.id = v_key::uuid)
              and (public.is_teacher() or public.social_class_is_member(v_key::uuid, v_me));
    elsif p_ref_type = 'class_session' then
      v_ok := exists (select 1 from public.class_sessions s where s.id = v_key::uuid and s.event_type = 'lesson'
                       and (public.is_teacher() or public.social_class_is_member(s.class_id, v_me)));
    elsif p_ref_type = 'chord_sheet' then
      v_ok := public.chord_share_ok(v_key::uuid);
    elsif p_ref_type = 'share_note' then
      v_ok := exists (select 1 from public.share_notes n where n.id = v_key::uuid and n.author_id = v_me and n.deleted_at is null
                         and public.share_note_score_ok(n.session_id));
    end if;
  end if;
  if not v_ok then raise exception 'Nội dung này không thể chia sẻ' using errcode = '22023'; end if;
  v_conv := public.dm_open(v_me, p_user);
  v_seq := public.dm_append(v_conv, v_me, null, p_ref_type, v_key);
  return query select v_conv, v_seq;
end $$;
comment on function public.dm_share(uuid, text, text) is 'universal_share_v1 + chord_share_v1 + share_note_v1: chia sẻ tham chiếu (artifact | lớp | buổi học | hợp âm | khoanh ô nhịp) cho bạn';
revoke all on function public.dm_share(uuid, text, text) from public, anon;
grant execute on function public.dm_share(uuid, text, text) to authenticated;

-- 10) Đăng Feed: chỉ tác giả, note còn sống và còn mở được bản nhạc; MỘT bài mỗi note (bấm đúp / đua → cùng bài).
--     Payload chỉ có tham chiếu + lời nhắn + buổi + dải ô (tác giả chủ động công khai lời nhắn) — KHÔNG nội dung giáo án.
create or replace function public.social_share_share_note(p_note uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_post uuid; r record;
begin
  if v_me is null or not public.is_class_member() then raise exception 'TS_NOT_MEMBER' using errcode = '42501'; end if;
  select n.*, s.class_id as cid, s.session_number as sno into r from public.share_notes n join public.class_sessions s on s.id = n.session_id
   where n.id = p_note and n.author_id = v_me and n.deleted_at is null;
  if not found or not public.share_note_score_ok(r.session_id) then raise exception 'TS_BAD_RESULT' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_me::text || ':share_note:' || p_note::text, 23));
  select p.id into v_post from public.class_posts p
   where p.type = 'tool_share' and p.author_user_id = v_me and p.tool_share ->> 'tool' = 'share_note' and p.tool_share ->> 'note_id' = p_note::text
   order by p.created_at limit 1;
  if v_post is not null then return v_post; end if;
  if (select count(*) from public.class_posts p where p.author_user_id = v_me and p.type = 'tool_share' and p.created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Bạn chia sẻ quá nhiều trong thời gian ngắn. Hãy chờ một chút.' using errcode = '54000';
  end if;
  insert into public.class_posts (author_user_id, type, audience, body, tool_share)
  values (v_me, 'tool_share', 'class', '', jsonb_build_object('v', 1, 'tool', 'share_note', 'kind', 'share_note', 'note_id', p_note::text,
            'note', r.note, 'class_id', r.cid::text, 'session_no', r.sno, 'bar_from', r.bar_from, 'bar_to', r.bar_to))
  returning id into v_post;
  return v_post;
end $$;
comment on function public.social_share_share_note(uuid) is 'share_note_v1: đăng một khoanh ô nhịp lên Feed (một bài mỗi note)';
revoke all on function public.social_share_share_note(uuid) from public, anon;
grant execute on function public.social_share_share_note(uuid) to authenticated;

-- 11) Gỡ: chỉ tác giả; xoá MỀM note + gỡ bài Feed của chính tác giả về note đó. Tin Chat còn (thẻ → "không còn khả dụng");
--     giáo trình / bản nhạc KHÔNG bị chạm.
create or replace function public.share_note_delete(p_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Chưa đăng nhập' using errcode = '42501'; end if;
  update public.share_notes set deleted_at = now() where id = p_id and author_id = v_me and deleted_at is null;
  if not found then return false; end if;
  delete from public.class_posts p where p.type = 'tool_share' and p.author_user_id = v_me
     and p.tool_share ->> 'tool' = 'share_note' and p.tool_share ->> 'note_id' = p_id::text;
  return true;
end $$;
revoke all on function public.share_note_delete(uuid) from public, anon;
grant execute on function public.share_note_delete(uuid) to authenticated;

notify pgrst, 'reload schema';
