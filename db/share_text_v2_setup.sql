-- Contextual Share V2 — chia sẻ VÙNG VĂN BẢN giáo trình. Migration CỘNG THÊM, tương thích ngược (thiết kế: docs/CONTEXTUAL-SHARE-V2-TEXT.md §6, §15–§17).
-- Mở rộng public.share_notes thêm loại neo 'text' (anchor_kind). Ghi chú ô nhịp V1 giữ NGUYÊN giá trị + hành vi: KHÔNG sửa bất kỳ hàm V1 nào
-- (share_note_create / open / card / session_open, social_share_share_note, dm_share, share_note_delete đều nguyên bản).
-- Hàm MỚI: share_text_create · share_note_open_v2 · share_note_card_v2 · social_share_share_text (+ hàm nội bộ share_text_*).
-- Neo văn bản chỉ lưu BĂM + định vị (section_idx gợi ý, text_path, [char_from, char_to) theo ĐIỂM MÃ, text_sha, ctx_sha, block_fp). KHÔNG lưu đoạn chọn / tiền tố / hậu tố.
-- Server TỰ cắt đoạn chọn từ giáo trình rồi tự tính băm; client không gửi băm. Không đụng class_lesson_content. Không begin/commit (prod-db.py bọc transaction). Idempotent.
-- Rollback: db/share_text_v2_rollback.sql (xoá hàng 'text' trước khi khôi phục NOT NULL).
do $gate$
declare v_enc text;
begin
  if to_regclass('public.share_notes') is null or to_regclass('public.class_lesson_content') is null or to_regclass('public.class_sessions') is null
     or to_regprocedure('public.share_note_visible(uuid)') is null or to_regprocedure('public.share_note_score_ok(uuid)') is null
     or to_regprocedure('public.share_note_tex(uuid,integer,text[])') is null or to_regprocedure('public.share_note_open(uuid)') is null
     or to_regprocedure('public.share_note_create(uuid,integer,text[],integer,integer,text,text)') is null
     or to_regprocedure('public.share_note_session_open(uuid)') is null or to_regprocedure('public.dm_share(uuid,text,text)') is null then
    raise exception 'DỪNG — thiếu nền Share Note V1 (+ khoá buổi) / giáo trình';
  end if;
  -- Chỉ số ký tự theo ĐIỂM MÃ (substr/length/position) chỉ đúng khi CSDL là UTF8
  select pg_encoding_to_char(encoding) into v_enc from pg_database where datname = current_database();
  if v_enc is distinct from 'UTF8' then raise exception 'DỪNG — CSDL phải là UTF8 (hiện: %)', v_enc; end if;
  -- V1 phải còn nguyên (không ai đã sửa hàng cột nhạc theo cách khác)
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'share_notes' and column_name = 'anchor_kind')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'share_notes' and column_name = 'text_sha') then
    raise exception 'DỪNG — share_notes có anchor_kind nhưng thiếu text_sha (cài dở?)';
  end if;
end $gate$;

-- 1) Cột neo văn bản + nới cột nhạc (CHECK cũ cho NULL đi qua) + ràng buộc THEO LOẠI NEO
alter table public.share_notes
  add column if not exists anchor_kind text not null default 'bars',
  add column if not exists text_path   text[],
  add column if not exists char_from   integer,
  add column if not exists char_to     integer,
  add column if not exists text_sha    text,
  add column if not exists ctx_sha     text,
  add column if not exists block_fp    text;
alter table public.share_notes alter column score_path drop not null, alter column tex_sha drop not null,
                               alter column bar_from drop not null, alter column bar_to drop not null;
alter table public.share_notes drop constraint if exists share_notes_anchor_shape_check;
alter table public.share_notes add constraint share_notes_anchor_shape_check check (
  (anchor_kind = 'bars'
     and score_path is not null and tex_sha is not null and bar_from is not null and bar_to is not null
     and text_path is null and char_from is null and char_to is null and text_sha is null and ctx_sha is null and block_fp is null)
  or
  (anchor_kind = 'text'
     and score_path is null and tex_sha is null and bar_from is null and bar_to is null
     and text_path is not null and char_from is not null and char_to is not null and text_sha is not null and ctx_sha is not null and block_fp is not null
     and cardinality(text_path) between 1 and 5
     and char_from >= 0 and char_to > char_from and char_to - char_from <= 500
     and text_sha ~ '^[0-9a-f]{64}$' and ctx_sha ~ '^[0-9a-f]{64}$' and block_fp ~ '^[0-9a-f]{64}$'
     and array_to_string(text_path, '/') ~ '^(text|items|steps|blocks|rows|[0-9]{1,3})(/(text|items|steps|blocks|rows|[0-9]{1,3}))*$'));

-- 2) Hàm nội bộ (không grant): đơn vị = ĐIỂM MÃ. Mọi hàm substr/char_length ở đây đếm điểm mã (CSDL UTF8).
create or replace function public.share_text_arr(j jsonb) returns jsonb language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(j) = 'array' then j else '[]'::jsonb end $$;

-- Lá văn bản HỢP LỆ của một khối (đúng 6 loại khối MVP; thứ tự = thứ tự hiển thị). Loại: rỗng, ô '___', mọi trường khác (url/href/tex/label/lead/guidance/assets/quiz/id…)
create or replace function public.share_text_leaves(p_sec jsonb)
returns table(path text[], txt text) language sql stable set search_path = '' as $$
  select l.path, l.txt from (
    select array['text'] as path, p_sec ->> 'text' as txt where p_sec ->> 'kind' = 'note' and jsonb_typeof(p_sec -> 'text') = 'string'
    union all
    select array['items', (e.i - 1)::text], e.v #>> '{}'
      from jsonb_array_elements(public.share_text_arr(p_sec -> 'items')) with ordinality e(v, i)
     where p_sec ->> 'kind' in ('objectives', 'checklist') and jsonb_typeof(e.v) = 'string'
    union all
    select array['steps', (s.i - 1)::text, 'items', (e.i - 1)::text], e.v #>> '{}'
      from jsonb_array_elements(public.share_text_arr(p_sec -> 'steps')) with ordinality s(v, i)
      cross join lateral jsonb_array_elements(public.share_text_arr(case when jsonb_typeof(s.v) = 'object' then s.v -> 'items' end)) with ordinality e(v, i)
     where p_sec ->> 'kind' = 'recap' and jsonb_typeof(e.v) = 'string'
    union all
    select array['items', (e.i - 1)::text, 'text'], e.v ->> 'text'
      from jsonb_array_elements(public.share_text_arr(p_sec -> 'items')) with ordinality e(v, i)
     where p_sec ->> 'kind' = 'assignment' and jsonb_typeof(e.v) = 'object' and jsonb_typeof(e.v -> 'text') = 'string'
    union all
    select array['blocks', (b.i - 1)::text, 'text'], b.v ->> 'text'
      from jsonb_array_elements(public.share_text_arr(p_sec -> 'blocks')) with ordinality b(v, i)
     where p_sec ->> 'kind' = 'study' and jsonb_typeof(b.v) = 'object' and b.v ->> 'b' in ('h', 'p', 'callout') and jsonb_typeof(b.v -> 'text') = 'string'
    union all
    select array['blocks', (b.i - 1)::text, 'items', (e.i - 1)::text], e.v #>> '{}'
      from jsonb_array_elements(public.share_text_arr(p_sec -> 'blocks')) with ordinality b(v, i)
      cross join lateral jsonb_array_elements(public.share_text_arr(case when jsonb_typeof(b.v) = 'object' then b.v -> 'items' end)) with ordinality e(v, i)
     where p_sec ->> 'kind' = 'study' and jsonb_typeof(b.v) = 'object' and b.v ->> 'b' in ('ul', 'ol') and jsonb_typeof(e.v) = 'string'
    union all
    select array['blocks', (b.i - 1)::text, 'rows', (r.i - 1)::text, (c.i - 1)::text], c.v #>> '{}'
      from jsonb_array_elements(public.share_text_arr(p_sec -> 'blocks')) with ordinality b(v, i)
      cross join lateral jsonb_array_elements(public.share_text_arr(case when jsonb_typeof(b.v) = 'object' then b.v -> 'rows' end)) with ordinality r(v, i)
      cross join lateral jsonb_array_elements(public.share_text_arr(r.v)) with ordinality c(v, i)
     where p_sec ->> 'kind' = 'study' and jsonb_typeof(b.v) = 'object' and b.v ->> 'b' = 'table' and jsonb_typeof(c.v) = 'string'
  ) l
  where l.txt is not null and l.txt <> '' and l.txt !~ '^\s*_{2,}\s*$'
$$;

create or replace function public.share_text_sel_sha(p text) returns text language sql immutable cost 1 set search_path = '' as $$
  select encode(sha256(convert_to(p, 'UTF8')), 'hex') $$;
-- Băm ngữ cảnh: ≤32 điểm mã trước + ␟ + ≤32 điểm mã sau, TRONG cùng lá
create or replace function public.share_text_ctx_sha(p_leaf text, p_from integer, p_to integer) returns text language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(
    substr(p_leaf, greatest(0, p_from - 32) + 1, p_from - greatest(0, p_from - 32)) || chr(31) || substr(p_leaf, p_to + 1, 32), 'UTF8')), 'hex') $$;
-- Nhận dạng khối: sha256('tsa1' ␟ kind ␟ title) — chỉ để TÌM LẠI khối khi chỉ số đã dịch
create or replace function public.share_text_fp(p_sec jsonb) returns text language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to('tsa1' || chr(31) || coalesce(p_sec ->> 'kind', '') || chr(31)
    || case when jsonb_typeof(p_sec -> 'title') = 'string' then p_sec ->> 'title' else '' end, 'UTF8')), 'hex') $$;
-- Biên không cắt giữa cụm: ký tự ĐẦU, ký tự NGAY SAU vùng chọn không là dấu tổ hợp / biến thể / ZWJ / skin-tone; ký tự CUỐI không là ZWJ
create or replace function public.share_text_boundary_ok(p_text text, p_from integer, p_to integer) returns boolean language sql immutable cost 100 set search_path = '' as $$
  select p_text is not null and p_from >= 0 and p_to > p_from and p_to <= char_length(p_text)
     and substr(p_text, p_from + 1, 1) !~ '^[̀-ͯ᪰-᫿᷀-᷿⃐-⃿︀-️︠-︯‍\U0001f3fb-\U0001f3ff]'
     and (p_to >= char_length(p_text) or substr(p_text, p_to + 1, 1) !~ '^[̀-ͯ᪰-᫿᷀-᷿⃐-⃿︀-️︠-︯‍\U0001f3fb-\U0001f3ff]')
     and substr(p_text, p_to, 1) <> chr(8205) $$;

-- Quét mọi cửa sổ độ dài p_len trong mọi lá của MỘT khối: băm khớp + biên hợp lệ. Mỗi lá chỉ xét ≤ 4000 điểm mã đầu.
create or replace function public.share_text_scan(p_sec jsonb, p_idx integer, p_len integer, p_sha text, p_ctx text)
returns table(sec integer, path text[], pos integer, ctx_ok boolean) language sql stable set search_path = '' as $$
  select p_idx, l.path, w.p, public.share_text_ctx_sha(l.txt, w.p, w.p + p_len) = p_ctx
    from public.share_text_leaves(p_sec) l
    cross join lateral generate_series(0, least(char_length(l.txt), 4000) - p_len) as w(p)
   where public.share_text_sel_sha(substr(l.txt, w.p + 1, p_len)) = p_sha and public.share_text_boundary_ok(l.txt, w.p, w.p + p_len)
$$;
-- Chi phí quét (số lá, số cửa sổ) của một khối
create or replace function public.share_text_cost(p_sec jsonb, p_len integer, out leaves integer, out windows bigint) language sql stable set search_path = '' as $$
  select count(*)::integer, coalesce(sum(greatest(0, least(char_length(txt), 4000) - p_len + 1)), 0)::bigint from public.share_text_leaves(p_sec) $$;

-- 3) Lá văn bản hiện hành (null = không còn / không hợp lệ). Chỉ giáo trình đã xuất bản. Nội bộ.
create or replace function public.share_text_leaf(p_session uuid, p_section integer, p_path text[])
returns text language sql stable security definer set search_path = '' as $$
  select l.txt from public.class_lesson_content c
    cross join lateral public.share_text_leaves(case when jsonb_typeof(c.blocks -> p_section) = 'object' then c.blocks -> p_section else '{}'::jsonb end) l
   where c.session_id = p_session and c.status = 'published' and jsonb_typeof(c.blocks) = 'array' and l.path = p_path $$;

-- 4) TÌM LẠI (fail-closed). 0 hàng = stale. Ngân sách cứng: ≤ 300 lá/khối · ≤ 60.000 cửa sổ băm cho CẢ lần tìm · ≤ 8 khối cùng block_fp.
--    Bước 1 đúng vị trí → ok · bước 2 cùng khối → moved (duy nhất, hoặc duy nhất sau lọc ctx) · bước 3 khối khác cùng block_fp (duy nhất) → moved · còn lại stale.
create or replace function public.share_text_resolve(p_session uuid, p_section integer, p_path text[], p_from integer, p_to integer, p_sha text, p_ctx text, p_fp text)
returns table(sec integer, path text[], cfrom integer, cto integer, moved boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_blocks jsonb; v_sec jsonb; v_leaf text; v_len integer := p_to - p_from; v_budget bigint := 60000;
  v_n integer; v_w bigint; v_hits jsonb := '[]'::jsonb; v_h jsonb; v_ok integer; v_i integer; v_cands integer[] := '{}';
  v_c record;
begin
  select c.blocks into v_blocks from public.class_lesson_content c where c.session_id = p_session and c.status = 'published';
  if v_blocks is null or jsonb_typeof(v_blocks) <> 'array' or v_len < 1 or p_sha is null then return; end if;
  -- Bước 1 — đúng vị trí gợi ý
  v_sec := v_blocks -> p_section;
  if jsonb_typeof(v_sec) = 'object' then
    select l.txt into v_leaf from public.share_text_leaves(v_sec) l where l.path = p_path;
    if v_leaf is not null and char_length(v_leaf) >= p_to and public.share_text_sel_sha(substr(v_leaf, p_from + 1, v_len)) = p_sha
       and public.share_text_boundary_ok(v_leaf, p_from, p_to) then
      return query select p_section, p_path, p_from, p_to, false; return;
    end if;
    -- Bước 2 — cùng chỉ số khối, mọi lá
    select (public.share_text_cost(v_sec, v_len)).leaves, (public.share_text_cost(v_sec, v_len)).windows into v_n, v_w;
    if v_n > 300 or v_w > v_budget then return; end if;
    v_budget := v_budget - v_w;
    select coalesce(jsonb_agg(jsonb_build_object('s', x.sec, 'p', to_jsonb(x.path), 'f', x.pos, 'c', x.ctx_ok)), '[]'::jsonb) into v_hits
      from public.share_text_scan(v_sec, p_section, v_len, p_sha, p_ctx) x;
    if jsonb_array_length(v_hits) > 0 then
      v_ok := (select count(*) from jsonb_array_elements(v_hits) e where (e ->> 'c')::boolean);
      if jsonb_array_length(v_hits) = 1 then v_h := v_hits -> 0;
      elsif v_ok = 1 then v_h := (select e from jsonb_array_elements(v_hits) e where (e ->> 'c')::boolean);
      else return;                                               -- mơ hồ trong chính khối: dừng, KHÔNG sang khối khác
      end if;
      return query select (v_h ->> 's')::integer, array(select jsonb_array_elements_text(v_h -> 'p')), (v_h ->> 'f')::integer, (v_h ->> 'f')::integer + v_len, true;
      return;
    end if;
  end if;
  -- Bước 3 — khối KHÁC cùng block_fp
  if p_fp is null then return; end if;
  for v_i in 0 .. jsonb_array_length(v_blocks) - 1 loop
    if v_i <> p_section and jsonb_typeof(v_blocks -> v_i) = 'object' and public.share_text_fp(v_blocks -> v_i) = p_fp then v_cands := v_cands || v_i; end if;
  end loop;
  if coalesce(array_length(v_cands, 1), 0) = 0 or array_length(v_cands, 1) > 8 then return; end if;
  v_hits := '[]'::jsonb;
  foreach v_i in array v_cands loop
    select (public.share_text_cost(v_blocks -> v_i, v_len)).leaves, (public.share_text_cost(v_blocks -> v_i, v_len)).windows into v_n, v_w;
    if v_n > 300 or v_w > v_budget then return; end if;
    v_budget := v_budget - v_w;
    select v_hits || coalesce(jsonb_agg(jsonb_build_object('s', x.sec, 'p', to_jsonb(x.path), 'f', x.pos, 'c', x.ctx_ok)), '[]'::jsonb) into v_hits
      from public.share_text_scan(v_blocks -> v_i, v_i, v_len, p_sha, p_ctx) x;
  end loop;
  if jsonb_array_length(v_hits) = 0 then return; end if;
  v_ok := (select count(*) from jsonb_array_elements(v_hits) e where (e ->> 'c')::boolean);
  if jsonb_array_length(v_hits) = 1 then v_h := v_hits -> 0;
  elsif v_ok = 1 then v_h := (select e from jsonb_array_elements(v_hits) e where (e ->> 'c')::boolean);
  else return;
  end if;
  return query select (v_h ->> 's')::integer, array(select jsonb_array_elements_text(v_h -> 'p')), (v_h ->> 'f')::integer, (v_h ->> 'f')::integer + v_len, true;
end $$;

-- 5) Tạo ghi chú văn bản (idempotent theo (tác giả, client_key)). Neo dựng ở SERVER; một thông báo chung cho mọi lý do "không chia sẻ được".
create or replace function public.share_text_create(p_session uuid, p_section integer, p_path text[], p_from integer, p_to integer, p_note text, p_client_key text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_leaf text; v_sel text; v_note text := btrim(coalesce(p_note, '')); v_id uuid; v_n integer; v_sec jsonb;
begin
  if v_me is null or not public.is_class_member() then raise exception 'Chưa đăng nhập Class' using errcode = '42501'; end if;
  if char_length(v_note) not between 1 and 500 then raise exception 'Lời nhắn 1–500 ký tự' using errcode = '22023'; end if;
  if p_client_key is null or char_length(p_client_key) not between 8 and 64 then raise exception 'Thiếu khoá chống trùng' using errcode = '22023'; end if;
  if p_from is null or p_to is null or p_from < 0 or p_to <= p_from or p_to - p_from > 500 or p_section is null or p_section not between 0 and 999
     or p_path is null or cardinality(p_path) not between 1 and 5 then
    raise exception 'Vùng chọn không hợp lệ' using errcode = '22023';
  end if;
  select id into v_id from public.share_notes where author_id = v_me and client_key = p_client_key;
  if v_id is not null then return v_id; end if;                                          -- bấm đúp / thử lại
  v_leaf := case when public.share_note_score_ok(p_session) then public.share_text_leaf(p_session, p_section, p_path) end;
  v_sel := case when v_leaf is not null and char_length(v_leaf) >= p_to then substr(v_leaf, p_from + 1, p_to - p_from) end;
  -- đoạn chọn: ≥ 4 ký tự KHÔNG phải khoảng trắng · biên không cắt giữa cụm ký tự — mọi lý do → MỘT thông báo chung
  if v_sel is null or char_length(regexp_replace(v_sel, '\s', '', 'g')) < 4 or not public.share_text_boundary_ok(v_leaf, p_from, p_to) then
    raise exception 'Nội dung này không thể chia sẻ' using errcode = '22023';
  end if;
  select count(*) into v_n from public.share_notes where author_id = v_me and created_at > now() - interval '1 minute';
  if v_n >= 10 then raise exception 'Bạn chia sẻ quá nhiều trong thời gian ngắn' using errcode = '54000'; end if;
  select c.blocks -> p_section into v_sec from public.class_lesson_content c where c.session_id = p_session and c.status = 'published';
  insert into public.share_notes (author_id, session_id, section_idx, anchor_kind, text_path, char_from, char_to, text_sha, ctx_sha, block_fp, note, client_key)
    values (v_me, p_session, p_section, 'text', p_path, p_from, p_to, public.share_text_sel_sha(v_sel), public.share_text_ctx_sha(v_leaf, p_from, p_to),
            public.share_text_fp(v_sec), v_note, p_client_key)
    on conflict (author_id, client_key) do nothing returning id into v_id;
  if v_id is null then select id into v_id from public.share_notes where author_id = v_me and client_key = p_client_key; end if;   -- đua đồng thời
  return v_id;
end $$;
revoke all on function public.share_text_create(uuid, integer, text[], integer, integer, text, text) from public, anon;
grant execute on function public.share_text_create(uuid, integer, text[], integer, integer, text, text) to authenticated;
comment on function public.share_text_create(uuid, integer, text[], integer, integer, text, text) is 'share_text_v2: tạo ghi chú vùng văn bản (neo = băm + định vị; server tự tính)';

-- 6) Mở (cả hai loại neo). 0 hàng = không khả dụng (không phân biệt lý do). no_access / stale CHỈ trả metadata của câu hỏi — không toạ độ, không băm.
create or replace function public.share_note_open_v2(p_id uuid)
returns table(status text, kind text, note text, author_id uuid, is_author boolean, class_id uuid, session_no integer,
              section_idx integer, score_path text[], bar_from integer, bar_to integer,
              text_path text[], char_from integer, char_to integer, text_sha text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare r record; v_tex text; v_res record;
begin
  if p_id is null or not public.share_note_visible(p_id) then return; end if;
  select n.*, s.class_id as cid, s.session_number as sno into r
    from public.share_notes n join public.class_sessions s on s.id = n.session_id where n.id = p_id;
  if not found then return; end if;
  if not public.share_note_score_ok(r.session_id) then
    return query select 'no_access'::text, r.anchor_kind, r.note, r.author_id, r.author_id = auth.uid(), r.cid, r.sno,
      null::integer, null::text[], null::integer, null::integer, null::text[], null::integer, null::integer, null::text, r.created_at;
    return;
  end if;
  if r.anchor_kind = 'bars' then
    v_tex := public.share_note_tex(r.session_id, r.section_idx, r.score_path);
    if v_tex is null or encode(sha256(convert_to(v_tex, 'UTF8')), 'hex') <> r.tex_sha then
      return query select 'stale'::text, r.anchor_kind, r.note, r.author_id, r.author_id = auth.uid(), r.cid, r.sno,
        null::integer, null::text[], null::integer, null::integer, null::text[], null::integer, null::integer, null::text, r.created_at;
      return;
    end if;
    return query select 'ok'::text, r.anchor_kind, r.note, r.author_id, r.author_id = auth.uid(), r.cid, r.sno,
      r.section_idx, r.score_path, r.bar_from, r.bar_to, null::text[], null::integer, null::integer, null::text, r.created_at;
    return;
  end if;
  select * into v_res from public.share_text_resolve(r.session_id, r.section_idx, r.text_path, r.char_from, r.char_to, r.text_sha, r.ctx_sha, r.block_fp);
  if not found then
    return query select 'stale'::text, r.anchor_kind, r.note, r.author_id, r.author_id = auth.uid(), r.cid, r.sno,
      null::integer, null::text[], null::integer, null::integer, null::text[], null::integer, null::integer, null::text, r.created_at;
    return;
  end if;
  return query select (case when v_res.moved then 'moved' else 'ok' end)::text, r.anchor_kind, r.note, r.author_id, r.author_id = auth.uid(), r.cid, r.sno,
    v_res.sec, null::text[], null::integer, null::integer, v_res.path, v_res.cfrom, v_res.cto, r.text_sha, r.created_at;
end $$;
revoke all on function public.share_note_open_v2(uuid) from public, anon;
grant execute on function public.share_note_open_v2(uuid) to authenticated;
comment on function public.share_note_open_v2(uuid) is 'share_text_v2: mở tham chiếu (bars | text): ok | moved | stale | no_access; 0 hàng = không khả dụng';

-- 7) Thẻ Chat theo lô (≤ 50): cùng luật THẤY; thêm anchor_kind. KHÔNG nội dung giáo án.
create or replace function public.share_note_card_v2(p_ids uuid[])
returns table(id uuid, note text, author_id uuid, class_id uuid, session_no integer, anchor_kind text, bar_from integer, bar_to integer, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select n.id, n.note, n.author_id, s.class_id, s.session_number, n.anchor_kind, n.bar_from, n.bar_to, n.created_at
    from public.share_notes n join public.class_sessions s on s.id = n.session_id
   where n.id = any (p_ids[1:50]) and public.share_note_visible(n.id)
$$;
revoke all on function public.share_note_card_v2(uuid[]) from public, anon;
grant execute on function public.share_note_card_v2(uuid[]) to authenticated;

-- 8) Đăng Feed (chỉ ghi chú văn bản). Payload KHÔNG có nội dung giáo án và KHÔNG có bar_from/bar_to (bundle cũ → thẻ nhẹ, không lỗi).
create or replace function public.social_share_share_text(p_note uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_post uuid; r record;
begin
  if v_me is null or not public.is_class_member() then raise exception 'TS_NOT_MEMBER' using errcode = '42501'; end if;
  select n.*, s.class_id as cid, s.session_number as sno into r from public.share_notes n join public.class_sessions s on s.id = n.session_id
   where n.id = p_note and n.author_id = v_me and n.deleted_at is null and n.anchor_kind = 'text';
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
  values (v_me, 'tool_share', 'class', '', jsonb_build_object('v', 1, 'tool', 'share_note', 'kind', 'share_note', 'anchor', 'text', 'note_id', p_note::text,
            'note', r.note, 'class_id', r.cid::text, 'session_no', r.sno))
  returning id into v_post;
  return v_post;
end $$;
revoke all on function public.social_share_share_text(uuid) from public, anon;
grant execute on function public.social_share_share_text(uuid) to authenticated;
comment on function public.social_share_share_text(uuid) is 'share_text_v2: đăng một vùng văn bản lên Feed (một bài mỗi note)';

-- Hàm nội bộ: không ai gọi trực tiếp qua API
revoke all on function public.share_text_arr(jsonb), public.share_text_leaves(jsonb), public.share_text_sel_sha(text), public.share_text_ctx_sha(text, integer, integer),
  public.share_text_fp(jsonb), public.share_text_boundary_ok(text, integer, integer), public.share_text_scan(jsonb, integer, integer, text, text),
  public.share_text_cost(jsonb, integer), public.share_text_leaf(uuid, integer, text[]),
  public.share_text_resolve(uuid, integer, text[], integer, integer, text, text, text) from public, anon, authenticated;

notify pgrst, 'reload schema';
