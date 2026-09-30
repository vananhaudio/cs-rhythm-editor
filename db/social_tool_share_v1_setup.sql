-- ═══════════════════════════════════════════════════════════════════════════
-- CLASS SOCIAL — TOOL SHARE V1 (chia sẻ kết quả từ CÔNG CỤ lên Feed) — Metronome là công cụ đầu tiên.
-- Thiết kế: docs/SOCIAL-TOOL-SHARE-V1.md. Rollback: db/social_tool_share_v1_rollback.sql.
--
-- KHÔNG hệ bài đăng thứ hai: mở rộng class_posts (Feed · Tường · bình luận · ẩn/xoá dùng lại nguyên vẹn):
--   • type 'tool_share' + cột tool_share jsonb (có phiên bản "v") — chỉ khi type = 'tool_share'.
--   • audience 'class' = "Cộng đồng học tập" (đúng luật đọc class_posts_member_read hiện có).
--   • GHI CHỈ qua RPC social_share_tool_result (SECURITY DEFINER): server kiểm payload theo DANH SÁCH CÔNG CỤ
--     (V1: metronome · practice_session: bpm 30–260, seconds 60–21600 — đúng dải Metronome hỗ trợ). Policy insert
--     trực tiếp hiện có KHÔNG cho type 'tool_share' → client không tự chèn payload tuỳ ý.
--   • Chống bấm 2 lần: client_key (uuid do client sinh cho MỘT kết quả) — unique index; gọi lại → trả bài đã có.
--   • ĐỌC: Feed/Tường trả type 'tool_share' như bài thường; client lấy payload bằng select class_posts(tool_share)
--     theo id — vẫn qua RLS đọc hiện có (không sửa social_feed / user_wall / social_post_card).
-- Không sửa/xoá bài hiện có, không đụng Learning Thread. Idempotent.
-- CHẠY bằng scripts/prod-db.py (prod-db sở hữu transaction — file KHÔNG có begin/commit).
-- ═══════════════════════════════════════════════════════════════════════════
set local lock_timeout = '5s';

-- ── 0) Cổng: đúng hiện trạng production đã kiểm (30/09) ───────────────────────
do $gate$
declare fn_expected constant jsonb := '{"is_class_member": ["459786921eb5bbd4ff07c83bdb4db480"]}';
  k text; allowed jsonb; actual text; drift text[] := '{}'; tdef text;
begin
  for k, allowed in select * from jsonb_each(fn_expected) loop
    select string_agg(md5(p.prosrc), ',') into actual from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = k;
    if actual is null then drift := drift || format('thiếu hàm %s', k);
    elsif not allowed ? actual then drift := drift || format('hàm %s (md5 %s)', k, actual); end if;
  end loop;
  foreach k in array array['id', 'author_user_id', 'type', 'audience', 'body', 'created_at', 'hidden_at'] loop
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'class_posts' and column_name = k) then
      drift := drift || format('thiếu cột class_posts.%s', k);
    end if;
  end loop;
  select pg_get_constraintdef(oid) into tdef from pg_constraint where conrelid = 'public.class_posts'::regclass and conname = 'class_posts_type_check';
  if tdef is null or (position('''tool_share''' in tdef) = 0
      and tdef <> 'CHECK ((type = ANY (ARRAY[''assignment''::text, ''question''::text, ''practice''::text, ''status''::text])))') then
    drift := drift || format('class_posts_type_check khác dự kiến: %s', coalesce(tdef, 'thiếu'));
  end if;
  if cardinality(drift) > 0 then
    raise exception 'DỪNG — production khác repo, KHÔNG migration: %', array_to_string(drift, '; ');
  end if;
end $gate$;

-- ── 1) Mở rộng class_posts ────────────────────────────────────────────────────
alter table public.class_posts add column if not exists tool_share jsonb;
alter table public.class_posts drop constraint if exists class_posts_type_check;
alter table public.class_posts add constraint class_posts_type_check
  check (type in ('assignment', 'question', 'practice', 'status', 'tool_share'));
alter table public.class_posts drop constraint if exists class_posts_tool_share_check;
alter table public.class_posts add constraint class_posts_tool_share_check check (
  (type = 'tool_share') = (tool_share is not null)
  and (tool_share is null or (jsonb_typeof(tool_share) = 'object' and tool_share ? 'v' and tool_share ? 'tool'
                              and pg_column_size(tool_share) <= 2048)));
create unique index if not exists class_posts_tool_share_client_key
  on public.class_posts ((tool_share ->> 'client_key')) where type = 'tool_share';

-- ── 2) Ghi: MỘT RPC, server kiểm payload theo danh sách công cụ ─────────────────
create or replace function public.social_share_tool_result(p_tool text, p_result jsonb, p_client_key uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_id uuid; v_author uuid; v_payload jsonb; v_bpm int; v_sec int;
begin
  if v_me is null or not public.is_class_member() then raise exception 'TS_NOT_MEMBER' using errcode = '42501'; end if;
  if p_client_key is null or p_result is null or jsonb_typeof(p_result) <> 'object' then
    raise exception 'TS_BAD_RESULT' using errcode = '22023';
  end if;
  -- Cùng một kết quả (client_key) gửi lại → trả đúng bài đã có của CHÍNH người đó (không tạo bản thứ hai)
  select p.id, p.author_user_id into v_id, v_author from public.class_posts p
   where p.type = 'tool_share' and p.tool_share ->> 'client_key' = p_client_key::text;
  if v_id is not null then
    if v_author <> v_me then raise exception 'TS_BAD_RESULT' using errcode = '22023'; end if;
    return v_id;
  end if;

  case p_tool
    when 'metronome' then
      -- Metronome V1: một phiên luyện tập đo thật (Bắt đầu → Dừng) ở BPM dùng lâu nhất
      if p_result ->> 'kind' is distinct from 'practice_session'
         or coalesce(p_result ->> 'bpm', '') !~ '^[0-9]{1,3}$' or coalesce(p_result ->> 'seconds', '') !~ '^[0-9]{1,5}$' then
        raise exception 'TS_BAD_RESULT' using errcode = '22023';
      end if;
      v_bpm := (p_result ->> 'bpm')::int; v_sec := (p_result ->> 'seconds')::int;
      if v_bpm not between 30 and 260 or v_sec not between 60 and 21600 then
        raise exception 'TS_BAD_RESULT' using errcode = '22023';
      end if;
      v_payload := jsonb_build_object('v', 1, 'tool', 'metronome', 'kind', 'practice_session',
                                      'bpm', v_bpm, 'seconds', v_sec, 'client_key', p_client_key::text);
    else
      raise exception 'TS_UNKNOWN_TOOL' using errcode = '22023';
  end case;

  begin
    insert into public.class_posts (author_user_id, type, audience, body, tool_share)
    values (v_me, 'tool_share', 'class', '', v_payload)
    returning id into v_id;
  exception when unique_violation then   -- bấm đúp đua nhau: bản kia đã chèn trước
    select p.id into v_id from public.class_posts p
     where p.type = 'tool_share' and p.tool_share ->> 'client_key' = p_client_key::text and p.author_user_id = v_me;
    if v_id is null then raise; end if;
  end;
  return v_id;
end $$;

revoke all on function public.social_share_tool_result(text, jsonb, uuid) from public, anon;
grant execute on function public.social_share_tool_result(text, jsonb, uuid) to authenticated;

notify pgrst, 'reload schema';
