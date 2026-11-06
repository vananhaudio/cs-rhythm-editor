-- DỰ THẢO — Contextual Share V3 "Khoanh vùng hỗn hợp" (docs/CONTEXTUAL-SHARE-V3-REGION.md). CHƯA CHẠY PRODUCTION. Chỉ áp trên DB tạm / staging cô lập.
-- Nền: V2 đã migrate (db/share_text_v2_setup.sql). CỘNG THÊM, không sửa hàm V1/V2:
--   share_notes.anchor_kind += 'region'; cột region jsonb = danh sách PHẦN (mỗi phần = một khối giáo trình bị khung chạm tới).
--   Mỗi phần lưu: sec (chỉ số gợi ý) · fp (loại+tiêu đề khối) · box (‰ của hộp khối — chỉ dùng khi KHÔNG có phần tử gốc, vẽ gần đúng)
--   · leaves: [{p: đường dẫn lá, r: [{f,t: ĐIỂM MÃ [từ,đến), s: băm đoạn, c: băm ngữ cảnh}]}]  (V3.1: khoanh ĐÚNG đoạn chữ, không lấy cả lá)
--   · scores: [{p, from, to (ô 1-based), x: băm alphaTex}]  · sha: băm cả khối, CHỈ cho phần không có phần tử gốc.
--   KHÔNG lưu pixel màn hình làm neo, KHÔNG lưu nội dung/ảnh chụp, KHÔNG nhân đôi asset.
-- Mở lại (V3.1): chỉ so cái ĐƯỢC KHOANH (đoạn chữ, bản nhạc). Sửa câu/khối khác ⇒ vẫn ok. Đoạn được khoanh đổi / không còn chắc chắn ⇒ stale cho CẢ vùng (fail-closed, không trả toạ độ).
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

-- Văn bản của MỘT lá trong khối (null = không có lá đó). Nội bộ.
create or replace function public.share_region_leaf_txt(p_sec jsonb, p_path text[]) returns text language sql stable set search_path = '' as $$
  select l.txt from public.share_text_leaves(p_sec) l where l.path = p_path limit 1 $$;

-- Chuẩn hoá + kiểm các PHẦN do client gửi theo giáo trình HIỆN HÀNH; thêm fp/băm do SERVER tính. Lỗi bất kỳ → null (một thông báo chung ở nơi gọi).
-- Phần = { sec, box, leaves:[{p, r:[[from,to],…]}], scores:[{p,from,to}] }  — from/to là ĐIỂM MÃ trong lá (cùng hệ V2), nửa mở.
-- Server lưu thêm: fp (loại+tiêu đề khối) · với mỗi đoạn chữ: s = băm đoạn, c = băm ngữ cảnh · với mỗi bản nhạc: x = băm alphaTex · phần KHÔNG có phần tử gốc (hình…): sha = băm cả khối.
create or replace function public.share_region_build(p_session uuid, p_parts jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_blocks jsonb; v_out jsonb := '[]'::jsonb; e jsonb; v_sec jsonb; v_i integer; v_seen integer[] := '{}'; v_box jsonb; v_leaves jsonb; v_scores jsonb;
  l jsonb; s jsonb; rg jsonb; v_p text[]; v_txt text; v_f integer; v_t integer; v_pf integer; v_ranges integer := 0;
  v_lo jsonb; v_ro jsonb; v_so jsonb; v_pp jsonb; v_tex text; v_part jsonb;
begin
  select c.blocks into v_blocks from public.class_lesson_content c where c.session_id = p_session and c.status = 'published';
  if v_blocks is null or jsonb_typeof(v_blocks) is distinct from 'array' or jsonb_typeof(p_parts) is distinct from 'array' or jsonb_array_length(p_parts) not between 1 and 12 then return null; end if;
  for e in select * from jsonb_array_elements(p_parts) loop
    if jsonb_typeof(e) is distinct from 'object' or jsonb_typeof(e -> 'sec') is distinct from 'number' then return null; end if;
    v_i := (e ->> 'sec')::numeric::integer;
    if (e ->> 'sec')::numeric <> v_i or v_i not between 0 and 999 or v_i = any (v_seen) then return null; end if;
    v_seen := v_seen || v_i;
    v_sec := v_blocks -> v_i;
    if jsonb_typeof(v_sec) is distinct from 'object' then return null; end if;
    v_box := e -> 'box';
    if jsonb_typeof(v_box) is distinct from 'array' or jsonb_array_length(v_box) <> 4 or exists (select 1 from jsonb_array_elements(v_box) b where jsonb_typeof(b) is distinct from 'number' or (b #>> '{}')::numeric <> trunc((b #>> '{}')::numeric) or (b #>> '{}')::numeric not between 0 and 1000)
       or (v_box ->> 0)::int >= (v_box ->> 2)::int or (v_box ->> 1)::int >= (v_box ->> 3)::int then return null; end if;
    -- đoạn chữ: lá phải tồn tại trong khối HIỆN HÀNH; mỗi đoạn [from,to) nằm trong lá, tăng dần, không chồng nhau, biên hợp lệ, ≤ 1000 điểm mã
    v_leaves := coalesce(e -> 'leaves', '[]'::jsonb);
    if jsonb_typeof(v_leaves) is distinct from 'array' or jsonb_array_length(v_leaves) > 40 then return null; end if;
    v_lo := '[]'::jsonb;
    for l in select * from jsonb_array_elements(v_leaves) loop
      if jsonb_typeof(l) is distinct from 'object' or jsonb_typeof(l -> 'p') is distinct from 'array' or jsonb_array_length(l -> 'p') not between 1 and 5
         or exists (select 1 from jsonb_array_elements(l -> 'p') x where jsonb_typeof(x) is distinct from 'string')
         or jsonb_typeof(l -> 'r') is distinct from 'array' or jsonb_array_length(l -> 'r') not between 1 and 12 then return null; end if;
      select array(select jsonb_array_elements_text(l -> 'p')) into v_p;
      v_txt := public.share_region_leaf_txt(v_sec, v_p);
      if v_txt is null then return null; end if;
      v_ro := '[]'::jsonb; v_pf := -1;
      for rg in select * from jsonb_array_elements(l -> 'r') loop
        if jsonb_typeof(rg) is distinct from 'array' or jsonb_array_length(rg) <> 2 or jsonb_typeof(rg -> 0) is distinct from 'number' or jsonb_typeof(rg -> 1) is distinct from 'number'
           or (rg ->> 0)::numeric <> trunc((rg ->> 0)::numeric) or (rg ->> 1)::numeric <> trunc((rg ->> 1)::numeric) then return null; end if;
        v_f := (rg ->> 0)::integer; v_t := (rg ->> 1)::integer;
        if v_f < v_pf or v_f < 0 or v_t <= v_f or v_t > char_length(v_txt) or v_t - v_f > 1000 or not public.share_text_boundary_ok(v_txt, v_f, v_t) then return null; end if;
        if btrim(substr(v_txt, v_f + 1, v_t - v_f)) = '' then return null; end if;
        v_pf := v_t; v_ranges := v_ranges + 1;
        v_ro := v_ro || jsonb_build_array(jsonb_build_object('f', v_f, 't', v_t, 's', public.share_text_sel_sha(substr(v_txt, v_f + 1, v_t - v_f)), 'c', public.share_text_ctx_sha(v_txt, v_f, v_t)));
      end loop;
      v_lo := v_lo || jsonb_build_array(jsonb_build_object('p', l -> 'p', 'r', v_ro));
    end loop;
    if v_ranges > 60 then return null; end if;
    -- bản nhạc: đường dẫn phải ra alphaTex; dải ô 1..64; lưu băm alphaTex
    v_scores := coalesce(e -> 'scores', '[]'::jsonb);
    if jsonb_typeof(v_scores) is distinct from 'array' or jsonb_array_length(v_scores) > 6 then return null; end if;
    v_so := '[]'::jsonb;
    for s in select * from jsonb_array_elements(v_scores) loop
      if jsonb_typeof(s) is distinct from 'object' or jsonb_typeof(s -> 'p') is distinct from 'array' or jsonb_typeof(s -> 'from') is distinct from 'number' or jsonb_typeof(s -> 'to') is distinct from 'number' then return null; end if;
      if (s ->> 'from')::numeric <> trunc((s ->> 'from')::numeric) or (s ->> 'to')::numeric <> trunc((s ->> 'to')::numeric)
         or (s ->> 'from')::int < 1 or (s ->> 'to')::int < (s ->> 'from')::int or (s ->> 'to')::int - (s ->> 'from')::int > 63 then return null; end if;
      select array(select jsonb_array_elements_text(s -> 'p')) into v_p;
      v_tex := public.share_note_tex(p_session, v_i, v_p);
      if v_tex is null then return null; end if;
      v_so := v_so || jsonb_build_array(jsonb_build_object('p', s -> 'p', 'from', s -> 'from', 'to', s -> 'to', 'x', public.share_text_sel_sha(v_tex)));
    end loop;
    v_part := jsonb_build_object('sec', v_i, 'fp', public.share_text_fp(v_sec), 'box', v_box, 'leaves', v_lo, 'scores', v_so);
    if jsonb_array_length(v_lo) = 0 and jsonb_array_length(v_so) = 0 then v_part := v_part || jsonb_build_object('sha', public.share_region_sha(v_sec)); end if;
    v_out := v_out || jsonb_build_array(v_part);
  end loop;
  return (select jsonb_agg(x order by (x ->> 'sec')::int) from jsonb_array_elements(v_out) x);
end $$;

-- TÌM LẠI (fail-closed): null = có phần không còn xác định CHẮC CHẮN. Chỉ cái được khoanh mới được so; chỉnh câu/khối KHÁC không làm stale.
--   • đoạn chữ: đúng vị trí → ok; lệch → thử cùng độ dời của đoạn trước trong lá (băm đoạn + ngữ cảnh khớp) → còn lệch → share_text_resolve (V2: duy nhất / duy nhất theo ngữ cảnh, ngân sách cứng); tối đa 6 lần tìm đắt cho cả vùng
--   • bản nhạc: băm alphaTex tại khối đã xác định (hoặc khối gợi ý); khác → tìm khối CÙNG loại+tiêu đề có alphaTex khớp, duy nhất
--   • phần không phần tử gốc (hình…): băm cả khối (như V3.0)
-- Mọi đoạn chữ của một phần phải cùng một khối; hai phần không được trùng khối. Trả {moved, parts} theo khối/vị trí hiện hành (không băm).
create or replace function public.share_region_resolve(p_session uuid, p_region jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_blocks jsonb; e jsonb; l jsonb; rg jsonb; sc jsonb; v_out jsonb := '[]'::jsonb; v_moved boolean := false; v_used integer[] := '{}'; v_n integer;
  v_hint integer; v_tgt integer; v_cur integer; v_txt text; v_f integer; v_t integer; v_len integer; v_d integer; v_fail integer := 0;
  v_lo jsonb; v_ro jsonb; v_so jsonb; v_p text[]; v_rr record; v_fp text; v_k integer; v_c integer[]; v_tex text; v_ok boolean; v_sec jsonb;
begin
  select c.blocks into v_blocks from public.class_lesson_content c where c.session_id = p_session and c.status = 'published';
  if v_blocks is null or jsonb_typeof(v_blocks) is distinct from 'array' or jsonb_typeof(p_region) is distinct from 'array' then return null; end if;
  v_n := jsonb_array_length(v_blocks);
  for e in select * from jsonb_array_elements(p_region) loop
    v_hint := (e ->> 'sec')::integer; v_fp := e ->> 'fp'; v_tgt := null; v_lo := '[]'::jsonb; v_so := '[]'::jsonb;
    if jsonb_array_length(e -> 'leaves') = 0 and jsonb_array_length(e -> 'scores') = 0 then
      -- phần không phần tử gốc: nguyên văn cả khối (hoặc duy nhất ở chỗ khác)
      if jsonb_typeof(v_blocks -> v_hint) = 'object' and public.share_region_sha(v_blocks -> v_hint) = e ->> 'sha' then v_tgt := v_hint;
      else
        v_c := '{}';
        for v_k in 0 .. v_n - 1 loop
          if jsonb_typeof(v_blocks -> v_k) = 'object' and public.share_text_fp(v_blocks -> v_k) = v_fp and public.share_region_sha(v_blocks -> v_k) = e ->> 'sha' then v_c := v_c || v_k; end if;
        end loop;
        if coalesce(array_length(v_c, 1), 0) <> 1 then return null; end if;
        v_tgt := v_c[1];
      end if;
    else
      v_cur := v_hint;
      for l in select * from jsonb_array_elements(e -> 'leaves') loop
        select array(select jsonb_array_elements_text(l -> 'p')) into v_p;
        v_ro := '[]'::jsonb; v_d := null;
        for rg in select * from jsonb_array_elements(l -> 'r') loop
          v_f := (rg ->> 'f')::integer; v_t := (rg ->> 't')::integer; v_len := v_t - v_f; v_ok := false;
          v_txt := case when jsonb_typeof(v_blocks -> v_cur) = 'object' then public.share_region_leaf_txt(v_blocks -> v_cur, v_p) end;
          if v_txt is not null and char_length(v_txt) >= v_t and public.share_text_sel_sha(substr(v_txt, v_f + 1, v_len)) = rg ->> 's' and public.share_text_boundary_ok(v_txt, v_f, v_t) then
            v_ok := true;
          elsif v_txt is not null and v_d is not null and v_f + v_d >= 0 and char_length(v_txt) >= v_t + v_d
                and public.share_text_sel_sha(substr(v_txt, v_f + v_d + 1, v_len)) = rg ->> 's' and public.share_text_ctx_sha(v_txt, v_f + v_d, v_t + v_d) = rg ->> 'c'
                and public.share_text_boundary_ok(v_txt, v_f + v_d, v_t + v_d) then
            v_f := v_f + v_d; v_t := v_t + v_d; v_ok := true; v_moved := true;
          end if;
          if not v_ok then
            v_fail := v_fail + 1;
            if v_fail > 6 then return null; end if;
            select * into v_rr from public.share_text_resolve(p_session, v_cur, v_p, v_f, v_t, rg ->> 's', rg ->> 'c', v_fp);
            if not found then return null; end if;
            if v_tgt is not null and v_rr.sec <> v_tgt then return null; end if;
            if v_rr.path <> v_p then return null; end if;                      -- đoạn chữ không được nhảy sang lá khác: mơ hồ ⇒ stale
            v_d := v_rr.cfrom - v_f; v_f := v_rr.cfrom; v_t := v_rr.cto; v_cur := v_rr.sec; v_moved := true;
          end if;
          if v_tgt is null then v_tgt := v_cur; elsif v_tgt <> v_cur then return null; end if;
          v_ro := v_ro || jsonb_build_array(jsonb_build_array(v_f, v_t));
        end loop;
        v_lo := v_lo || jsonb_build_array(jsonb_build_object('p', l -> 'p', 'r', v_ro));
      end loop;
      if v_tgt is null then v_tgt := v_hint; end if;
      for sc in select * from jsonb_array_elements(e -> 'scores') loop
        select array(select jsonb_array_elements_text(sc -> 'p')) into v_p;
        v_tex := public.share_note_tex(p_session, v_tgt, v_p);
        if v_tex is null or public.share_text_sel_sha(v_tex) is distinct from sc ->> 'x' then
          if jsonb_array_length(e -> 'leaves') > 0 then return null; end if;      -- đoạn chữ đã chốt khối: nhạc không khớp ở khối đó ⇒ stale
          v_c := '{}';
          for v_k in 0 .. v_n - 1 loop
            if jsonb_typeof(v_blocks -> v_k) = 'object' and public.share_text_fp(v_blocks -> v_k) = v_fp
               and public.share_text_sel_sha(coalesce(public.share_note_tex(p_session, v_k, v_p), '')) = sc ->> 'x' then v_c := v_c || v_k; end if;
          end loop;
          if coalesce(array_length(v_c, 1), 0) <> 1 then return null; end if;
          v_tgt := v_c[1]; v_moved := true;
        end if;
        v_so := v_so || jsonb_build_array(jsonb_build_object('p', sc -> 'p', 'from', sc -> 'from', 'to', sc -> 'to'));
      end loop;
      -- nhiều bản nhạc trong một phần phải cùng một khối (đã chốt bằng v_tgt đầu tiên): kiểm lại bản trước nếu v_tgt đổi
      for sc in select * from jsonb_array_elements(e -> 'scores') loop
        select array(select jsonb_array_elements_text(sc -> 'p')) into v_p;
        if public.share_text_sel_sha(coalesce(public.share_note_tex(p_session, v_tgt, v_p), '')) is distinct from sc ->> 'x' then return null; end if;
      end loop;
    end if;
    if v_tgt = any (v_used) then return null; end if;
    if v_tgt <> v_hint then v_moved := true; end if;
    v_used := v_used || v_tgt;
    v_out := v_out || jsonb_build_array(jsonb_build_object('sec', v_tgt, 'box', e -> 'box', 'leaves', v_lo, 'scores', v_so));
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

revoke all on function public.share_region_sha(jsonb), public.share_region_leaf_txt(jsonb, text[]), public.share_region_build(uuid, jsonb), public.share_region_resolve(uuid, jsonb) from public, anon, authenticated;
notify pgrst, 'reload schema';
