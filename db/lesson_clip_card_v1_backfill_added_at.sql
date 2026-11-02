-- ═══════════════════════════════════════════════════════════════════════════
-- BACKFILL MỘT LẦN (GHI DỮ LIỆU — Owner chạy riêng, SAU khi migration lesson_clip_card_v1 đã lên): gắn added_at cho khối video CHƯA có.
-- Vì sao: khối video đã xuất bản trước G3 (vd. HT2027.TH01 Buổi 7) chưa có added_at nên thẻ "Ôn nhanh" chưa hiện. Backfill này thay cho việc
--   xuất bản lại bài học: KHÔNG qua Admin, KHÔNG đổi status, KHÔNG đổi updated_by (updated_at: do trigger production đẩy tới thời điểm chạy), KHÔNG đụng khối nào khác.
-- Giá trị: added_at = class_lesson_content.updated_at của dòng (≈ lúc xuất bản gần nhất) dưới dạng ISO UTC 'Z'. Cố định sau khi ghi
--   (sửa giáo trình về sau KHÔNG đổi nó; công cụ g2-insert-video cũng không ghi đè).
-- An toàn: chỉ khối kind='video' CHƯA có khoá added_at (có khoá nhưng sai định dạng thì để nguyên và báo); idempotent (chạy lại = 0 dòng);
--   cuối file tự kiểm: mọi khối ngoài trường added_at phải nguyên vẹn, thứ tự/số khối/status không đổi — sai là RAISE và toàn bộ transaction bị huỷ.
-- Sao lưu trước khi chạy: xuất JSON giáo trình buổi liên quan từ Admin (như đã làm cho HT2027.TH01 Buổi 7). Gỡ: không cần (trường thừa vô hại);
--   muốn bỏ hẳn thì khôi phục từ bản sao lưu qua Admin hoặc xoá khoá added_at khỏi khối.
-- CHẠY: scripts/prod-db.py dryrun (kiểm) rồi migrate; file KHÔNG có begin/commit. Kết quả đếm in bằng NOTICE.
-- ═══════════════════════════════════════════════════════════════════════════
do $gate$
begin
  if to_regclass('public.class_lesson_content') is null then raise exception 'BACKFILL_GATE_FAIL: thiếu class_lesson_content'; end if;
  if to_regprocedure('public.social_feed_clip_items(uuid[])') is null then
    raise exception 'BACKFILL_GATE_FAIL: chưa cài migration lesson_clip_card_v1 (backfill chạy SAU migration)';
  end if;
end
$gate$;

create temp table _lc_backfill_before on commit drop as
  select lc.session_id, lc.blocks, lc.status, lc.updated_at, lc.updated_by
    from public.class_lesson_content lc
   where lc.blocks @> '[{"kind":"video"}]'::jsonb
     and exists (select 1 from jsonb_array_elements(lc.blocks) e where e ->> 'kind' = 'video' and not (e ? 'added_at'));

-- Trigger production class_lesson_content_touch (BEFORE UPDATE) ép updated_at := now() và updated_by := auth.uid(). KHÔNG tắt/sửa trigger:
-- với từng dòng, đặt claim sub của giao dịch = updated_by CŨ (cục bộ giao dịch) để auth.uid() trả đúng giá trị cũ ⇒ updated_by GIỮ NGUYÊN;
-- updated_at đổi sang thời điểm chạy (chấp nhận, Owner chốt 02/11). added_at lấy từ updated_at CŨ nên không phụ thuộc điều đó.
do $upd$
declare r record;
begin
  for r in select session_id, updated_by from _lc_backfill_before loop
    perform set_config('request.jwt.claim.sub', coalesce(r.updated_by::text, ''), true);
    update public.class_lesson_content lc
       set blocks = (select jsonb_agg(case when e ->> 'kind' = 'video' and not (e ? 'added_at')
                                           then e || jsonb_build_object('added_at', to_char(coalesce(b.updated_at, now()) at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
                                           else e end order by ord)
                       from jsonb_array_elements(lc.blocks) with ordinality t(e, ord)),
           updated_at = lc.updated_at, updated_by = lc.updated_by
      from _lc_backfill_before b
     where b.session_id = lc.session_id and lc.session_id = r.session_id;
  end loop;
  perform set_config('request.jwt.claim.sub', '', true);
end
$upd$;

do $verify$
declare r record; n int := 0; v_changed int := 0;
begin
  for r in
    select b.session_id, b.blocks as old_blocks, lc.blocks as new_blocks, b.status as old_status, lc.status as new_status,
           b.updated_at as old_upd, lc.updated_at as new_upd, b.updated_by as old_by, lc.updated_by as new_by
      from _lc_backfill_before b join public.class_lesson_content lc on lc.session_id = b.session_id
  loop
    n := n + 1;
    if r.old_status is distinct from r.new_status then raise exception 'BACKFILL_VERIFY_FAIL: status đổi (%)', r.session_id; end if;
    if r.new_upd < r.old_upd then raise exception 'BACKFILL_VERIFY_FAIL: updated_at lùi (%)', r.session_id; end if;  -- trigger production đẩy tới now(); không được lùi
    if r.old_by is distinct from r.new_by then raise exception 'BACKFILL_VERIFY_FAIL: updated_by đổi (%)', r.session_id; end if;
    if jsonb_array_length(r.old_blocks) <> jsonb_array_length(r.new_blocks) then raise exception 'BACKFILL_VERIFY_FAIL: số khối đổi (%)', r.session_id; end if;
    -- bỏ riêng khoá added_at ở khối video rồi so NGUYÊN VĂN từng khối theo thứ tự
    if (select jsonb_agg(case when e ->> 'kind' = 'video' then e - 'added_at' else e end order by ord) from jsonb_array_elements(r.old_blocks) with ordinality t(e, ord))
       is distinct from
       (select jsonb_agg(case when e ->> 'kind' = 'video' then e - 'added_at' else e end order by ord) from jsonb_array_elements(r.new_blocks) with ordinality t(e, ord)) then
      raise exception 'BACKFILL_VERIFY_FAIL: có khối khác bị đổi (%)', r.session_id;
    end if;
    if exists (select 1 from jsonb_array_elements(r.new_blocks) e where e ->> 'kind' = 'video' and not (e ? 'added_at')) then
      raise exception 'BACKFILL_VERIFY_FAIL: còn khối video thiếu added_at (%)', r.session_id;
    end if;
    v_changed := v_changed + 1;
  end loop;
  raise notice 'BACKFILL: % buổi được gắn added_at (khối khác nguyên vẹn, status/updated_by không đổi; updated_at chỉ có thể tiến)', v_changed;
end
$verify$;
