-- DỰ THẢO — Contextual Share V3 "Khoanh vùng hỗn hợp" (docs/CONTEXTUAL-SHARE-V3-REGION.md). CHƯA CHẠY PRODUCTION. Chỉ áp trên DB tạm / staging cô lập.
-- Nền: V2 đã migrate (db/share_text_v2_setup.sql). CỘNG THÊM, không sửa hàm V1/V2:
--   share_notes.anchor_kind += 'region'; cột region jsonb = danh sách PHẦN (mỗi phần = một khối giáo trình bị khung chạm tới).
--   Mỗi phần lưu: sec (chỉ số gợi ý) · fp (loại+tiêu đề khối) · sha (băm TOÀN KHỐI lúc khoanh, server tự tính) · box (khung, đơn vị ‰ của hộp khối — chỉ dùng khi KHÔNG có phần tử gốc)
--   · leaves (đường dẫn các lá văn bản bị chạm) · scores (đường dẫn bản nhạc + dải ô 1-based).
--   KHÔNG lưu pixel màn hình làm neo, KHÔNG lưu nội dung/ảnh chụp, KHÔNG nhân đôi asset.
-- Mở lại: từng phần phải còn NGUYÊN VĂN (cùng sha) ở đúng chỉ số, hoặc duy nhất ở chỉ số khác (moved). Bất kỳ phần nào lệch ⇒ stale cho CẢ vùng (fail-closed, không trả toạ độ).
-- Không begin/commit. Idempotent.
do $gate$
begin
  if to_regprocedure('public.share_note_open_v2(uuid)') is null or to_regprocedure('public.share_text_leaves(jsonb)') is null
     or to_regprocedure('public.share_note_tex(uuid,integer,text[])') is null or to_regprocedure('public.share_text_fp(jsonb)') is null then
    raise exception 'DỪNG — thiếu nền Contextual Share V2';
  end if;
end $gate$;

alter table public.share_notes add column if not exists region jsonb;
alter table public.share_notes drop constraint if exists share_notes_anchor_shape_check;
alter table public.share_notes add constraint share_notes_anchor_shape_check check (
  (anchor_kind = 'bars' and region is null
     and score_path is not null and tex_sha is not null and bar_from is not null and bar_to is not null
     and text_path is null and char_from is null and char_to is null and text_sha is null and ctx_sha is null and block_fp is null)
  or
  (anchor_kind = 'text' and region is null
     and score_path is null and tex_sha is null and bar_from is null and bar_to is null
     and text_path is not null and char_from is not null and char_to is not null and text_sha is not null and ctx_sha is not null and block_fp is not null
     and cardinality(text_path) between 1 and 5
     and char_from >= 0 and char_to > char_from and char_to - char_from <= 500
     and text_sha ~ '^[0-9a-f]{64}$' and ctx_sha ~ '^[0-9a-f]{64}$' and block_fp ~ '^[0-9a-f]{64}$'
     and array_to_string(text_path, '/') ~ '^(text|items|steps|blocks|rows|[0-9]{1,3})(/(text|items|steps|blocks|rows|[0-9]{1,3}))*$')
  or
  (anchor_kind = 'region'
     and score_path is null and tex_sha is null and bar_from is null and bar_to is null
     and text_path is null and char_from is null and char_to is null and text_sha is null and ctx_sha is null and block_fp is null
     and region is not null and jsonb_typeof(region) = 'array' and jsonb_array_length(region) between 1 and 12));

create or replace function public.share_region_sha(p_sec jsonb) returns text language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(p_sec::text, 'UTF8')), 'hex') $$;

-- Chuẩn hoá + kiểm các PHẦN do client gửi theo giáo trình HIỆN HÀNH; thêm fp/sha do SERVER tính. Lỗi bất kỳ → null (một thông báo chung ở nơi gọi).
create or replace function public.share_region_build(p_session uuid, p_parts jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_blocks jsonb; v_out jsonb := '[]'::jsonb; e jsonb; v_sec jsonb; v_i integer; v_seen integer[] := '{}'; v_box jsonb; v_leaves jsonb; v_scores jsonb;
  l jsonb; s jsonb; v_p text[]; v_has integer; v_n integer;
begin
  select c.blocks into v_blocks from public.class_lesson_content c where c.session_id = p_session and c.status = 'published';
  if v_blocks is null or jsonb_typeof(v_blocks) <> 'array' or jsonb_typeof(p_parts) <> 'array' or jsonb_array_length(p_parts) not between 1 and 12 then return null; end if;
  for e in select * from jsonb_array_elements(p_parts) loop
    if jsonb_typeof(e) <> 'object' or jsonb_typeof(e -> 'sec') <> 'number' then return null; end if;
    v_i := (e ->> 'sec')::numeric::integer;
    if (e ->> 'sec')::numeric <> v_i or v_i not between 0 and 999 or v_i = any (v_seen) then return null; end if;
    v_seen := v_seen || v_i;
    v_sec := v_blocks -> v_i;
    if jsonb_typeof(v_sec) <> 'object' then return null; end if;
    -- hộp: 4 số nguyên ‰, 0 ≤ x0 < x1 ≤ 1000 …
    v_box := e -> 'box';
    if jsonb_typeof(v_box) <> 'array' or jsonb_array_length(v_box) <> 4 or exists (select 1 from jsonb_array_elements(v_box) b where jsonb_typeof(b) <> 'number' or (b #>> '{}')::numeric <> trunc((b #>> '{}')::numeric) or (b #>> '{}')::numeric not between 0 and 1000)
       or (v_box ->> 0)::int >= (v_box ->> 2)::int or (v_box ->> 1)::int >= (v_box ->> 3)::int then return null; end if;
    -- lá văn bản: phải tồn tại trong khối HIỆN HÀNH
    v_leaves := coalesce(e -> 'leaves', '[]'::jsonb);
    if jsonb_typeof(v_leaves) <> 'array' or jsonb_array_length(v_leaves) > 40 then return null; end if;
    for l in select * from jsonb_array_elements(v_leaves) loop
      if jsonb_typeof(l) <> 'array' or jsonb_array_length(l) not between 1 and 5 or exists (select 1 from jsonb_array_elements(l) x where jsonb_typeof(x) <> 'string') then return null; end if;
      select array(select jsonb_array_elements_text(l)) into v_p;
      if not exists (select 1 from public.share_text_leaves(v_sec) q where q.path = v_p) then return null; end if;
    end loop;
    -- bản nhạc: đường dẫn phải ra alphaTex; dải ô 1..64
    v_scores := coalesce(e -> 'scores', '[]'::jsonb);
    if jsonb_typeof(v_scores) <> 'array' or jsonb_array_length(v_scores) > 6 then return null; end if;
    for s in select * from jsonb_array_elements(v_scores) loop
      if jsonb_typeof(s) <> 'object' or jsonb_typeof(s -> 'p') <> 'array' or jsonb_typeof(s -> 'from') <> 'number' or jsonb_typeof(s -> 'to') <> 'number' then return null; end if;
      if (s ->> 'from')::numeric <> trunc((s ->> 'from')::numeric) or (s ->> 'to')::numeric <> trunc((s ->> 'to')::numeric)
         or (s ->> 'from')::int < 1 or (s ->> 'to')::int < (s ->> 'from')::int or (s ->> 'to')::int - (s ->> 'from')::int > 63 then return null; end if;
      select array(select jsonb_array_elements_text(s -> 'p')) into v_p;
      if public.share_note_tex(p_session, v_i, v_p) is null then return null; end if;
    end loop;
    v_out := v_out || jsonb_build_array(jsonb_build_object('sec', v_i, 'fp', public.share_text_fp(v_sec), 'sha', public.share_region_sha(v_sec),
      'box', v_box, 'leaves', v_leaves, 'scores', (select coalesce(jsonb_agg(jsonb_build_object('p', x -> 'p', 'from', x -> 'from', 'to', x -> 'to')), '[]'::jsonb) from jsonb_array_elements(v_scores) x)));
  end loop;
  return (select jsonb_agg(x order by (x ->> 'sec')::int) from jsonb_array_elements(v_out) x);
end $$;

-- TÌM LẠI các phần (fail-closed): null = có phần không còn khớp NGUYÊN VĂN. Trả {moved, parts} với sec đã giải quyết.
create or replace function public.share_region_resolve(p_session uuid, p_region jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_blocks jsonb; e jsonb; v_i integer; v_out jsonb := '[]'::jsonb; v_moved boolean := false; v_c integer[]; v_k integer; v_n integer; v_used integer[] := '{}';
begin
  select c.blocks into v_blocks from public.class_lesson_content c where c.session_id = p_session and c.status = 'published';
  if v_blocks is null or jsonb_typeof(v_blocks) <> 'array' or jsonb_typeof(p_region) <> 'array' then return null; end if;
  v_n := jsonb_array_length(v_blocks);
  for e in select * from jsonb_array_elements(p_region) loop
    v_i := (e ->> 'sec')::integer;
    if jsonb_typeof(v_blocks -> v_i) = 'object' and public.share_region_sha(v_blocks -> v_i) = e ->> 'sha' then
      null;
    else
      v_c := '{}';
      for v_k in 0 .. v_n - 1 loop
        if jsonb_typeof(v_blocks -> v_k) = 'object' and public.share_text_fp(v_blocks -> v_k) = e ->> 'fp' and public.share_region_sha(v_blocks -> v_k) = e ->> 'sha' then v_c := v_c || v_k; end if;
      end loop;
      if coalesce(array_length(v_c, 1), 0) <> 1 then return null; end if;     -- không có / mơ hồ ⇒ stale
      v_i := v_c[1]; v_moved := true;
    end if;
    if v_i = any (v_used) then return null; end if;
    v_used := v_used || v_i;
    v_out := v_out || jsonb_build_array(jsonb_set(e - 'fp' - 'sha', '{sec}', to_jsonb(v_i)));
  end loop;
  return jsonb_build_object('moved', v_moved, 'parts', v_out);
end $$;

create or replace function public.share_region_create(p_session uuid, p_parts jsonb, p_note text, p_client_key text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_note text := btrim(coalesce(p_note, '')); v_id uuid; v_n integer; v_reg jsonb;
begin
  if v_me is null or not public.is_class_member() then raise exception 'Chưa đăng nhập Class' using errcode = '42501'; end if;
  if char_length(v_note) not between 1 and 500 then raise exception 'Lời nhắn 1–500 ký tự' using errcode = '22023'; end if;
  if p_client_key is null or char_length(p_client_key) not between 8 and 64 then raise exception 'Thiếu khoá chống trùng' using errcode = '22023'; end if;
  select id into v_id from public.share_notes where author_id = v_me and client_key = p_client_key;
  if v_id is not null then return v_id; end if;
  v_reg := case when public.share_note_score_ok(p_session) then public.share_region_build(p_session, p_parts) end;
  if v_reg is null then raise exception 'Vùng này không thể chia sẻ' using errcode = '22023'; end if;
  select count(*) into v_n from public.share_notes where author_id = v_me and created_at > now() - interval '1 minute';
  if v_n >= 10 then raise exception 'Bạn chia sẻ quá nhiều trong thời gian ngắn' using errcode = '54000'; end if;
  insert into public.share_notes (author_id, session_id, section_idx, anchor_kind, region, note, client_key)
    values (v_me, p_session, (v_reg -> 0 ->> 'sec')::integer, 'region', v_reg, v_note, p_client_key)
    on conflict (author_id, client_key) do nothing returning id into v_id;
  if v_id is null then select id into v_id from public.share_notes where author_id = v_me and client_key = p_client_key; end if;
  return v_id;
end $$;
revoke all on function public.share_region_create(uuid, jsonb, text, text) from public, anon;
grant execute on function public.share_region_create(uuid, jsonb, text, text) to authenticated;

-- Mở vùng: 0 hàng = không khả dụng · no_access/stale CHỈ trả metadata (không toạ độ). Cùng cổng truy cập như V1/V2.
create or replace function public.share_region_open(p_id uuid)
returns table(status text, note text, author_id uuid, is_author boolean, class_id uuid, session_no integer, region jsonb, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare r record; v_res jsonb;
begin
  if p_id is null or not public.share_note_visible(p_id) then return; end if;
  select n.*, s.class_id as cid, s.session_number as sno into r from public.share_notes n join public.class_sessions s on s.id = n.session_id
   where n.id = p_id and n.anchor_kind = 'region';
  if not found then return; end if;
  if not public.share_note_score_ok(r.session_id) then
    return query select 'no_access'::text, r.note, r.author_id, r.author_id = auth.uid(), r.cid, r.sno, null::jsonb, r.created_at; return;
  end if;
  v_res := public.share_region_resolve(r.session_id, r.region);
  if v_res is null then
    return query select 'stale'::text, r.note, r.author_id, r.author_id = auth.uid(), r.cid, r.sno, null::jsonb, r.created_at; return;
  end if;
  return query select (case when (v_res ->> 'moved')::boolean then 'moved' else 'ok' end)::text, r.note, r.author_id, r.author_id = auth.uid(), r.cid, r.sno, v_res -> 'parts', r.created_at;
end $$;
revoke all on function public.share_region_open(uuid) from public, anon;
grant execute on function public.share_region_open(uuid) to authenticated;

create or replace function public.social_share_share_region(p_note uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_post uuid; r record;
begin
  if v_me is null or not public.is_class_member() then raise exception 'TS_NOT_MEMBER' using errcode = '42501'; end if;
  select n.*, s.class_id as cid, s.session_number as sno into r from public.share_notes n join public.class_sessions s on s.id = n.session_id
   where n.id = p_note and n.author_id = v_me and n.deleted_at is null and n.anchor_kind = 'region';
  if not found or not public.share_note_score_ok(r.session_id) then raise exception 'TS_BAD_RESULT' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_me::text || ':share_note:' || p_note::text, 23));
  select p.id into v_post from public.class_posts p
   where p.type = 'tool_share' and p.author_user_id = v_me and p.tool_share ->> 'tool' = 'share_note' and p.tool_share ->> 'note_id' = p_note::text order by p.created_at limit 1;
  if v_post is not null then return v_post; end if;
  if (select count(*) from public.class_posts p where p.author_user_id = v_me and p.type = 'tool_share' and p.created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Bạn chia sẻ quá nhiều trong thời gian ngắn. Hãy chờ một chút.' using errcode = '54000';
  end if;
  insert into public.class_posts (author_user_id, type, audience, body, tool_share)
  values (v_me, 'tool_share', 'class', '', jsonb_build_object('v', 1, 'tool', 'share_note', 'kind', 'share_note', 'anchor', 'region', 'note_id', p_note::text,
            'note', r.note, 'class_id', r.cid::text, 'session_no', r.sno))
  returning id into v_post;
  return v_post;
end $$;
revoke all on function public.social_share_share_region(uuid) from public, anon;
grant execute on function public.social_share_share_region(uuid) to authenticated;

revoke all on function public.share_region_sha(jsonb), public.share_region_build(uuid, jsonb), public.share_region_resolve(uuid, jsonb) from public, anon, authenticated;
notify pgrst, 'reload schema';
